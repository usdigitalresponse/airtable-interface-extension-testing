/**
 * The concrete simulated host ("AirtableInterface") backing a TestDriver.
 *
 * Adapted from v1 blocks-testing's `mock_airtable_interface.ts` and the SDK's
 * own interface-mode test mock. Interface mode is considerably simpler than
 * v1: records live directly in `sdkInitData.baseData`, and the SDK applies
 * mutations optimistically itself (including cell values, record
 * creation/deletion, and globalConfig), so this mock's `applyMutationAsync`
 * only performs the follow-up work a real host would do — most importantly
 * maintaining `recordOrder` and per-query `dynamicQueriesByKey` result sets —
 * and re-emits mutations for test assertions.
 *
 * Note: `sdk.base._baseData` ALIASES `this.sdkInitData.baseData` (the SDK does
 * not clone it), so reading `this.sdkInitData` always reflects current state,
 * including optimistic updates the SDK already applied.
 */
import {spawnError} from './error_utils';
import {convertFixtureDataToSdkInitData, type FixtureData} from './fixture_data';
import {generateId, has, setGlobalConfigValue} from './private_utils';
import {AbstractMockAirtableInterface} from './sdk_internals';
import {MutationTypes} from './mutation_types';
import {
    type CustomPropertyForAirtableInterface,
    type FieldId,
    type GlobalConfigData,
    type GlobalConfigUpdate,
    type ModelChange,
    type Mutation,
    type PermissionCheckResult,
    type RecordId,
    type SubElementSelectionState,
    type TableId,
} from './sdk_types';

/**
 * A mapping relating the names of event subscriptions available on
 * {@link TestDriver} instances to the arguments provided when one of those
 * events is triggered.
 */
export interface WatchableKeysAndArgs {
    /** Triggered whenever the SDK has been induced to persist a change to the base. */
    mutation: Mutation;
    /** Triggered when the extension expands a record (e.g. via `expandRecord`). */
    expandRecord: {tableId: TableId; recordId: RecordId};
    /** Triggered when the extension registers custom properties (via `useCustomProperties`). */
    setCustomProperties: Array<CustomPropertyForAirtableInterface>;
    /** Triggered when the extension selects a sub-element in edit mode. */
    setSelectedSubElement: SubElementSelectionState | null;
    /** Triggered when the extension sets search params (via `useSearchParams`). */
    setSearchParams: Record<string, string>;
}

/** Handler used to simulate linked-record search results. */
export type ForeignRecordsHandler = (
    tableId: TableId,
    recordId: RecordId,
    fieldId: FieldId,
    filterString: string,
) => Array<{id: RecordId; name: string}>;

export class MockAirtableInterface extends AbstractMockAirtableInterface {
    _userPermissionCheck: ((mutation: Mutation) => boolean) | null = null;
    _foreignRecordsHandler: ForeignRecordsHandler | null = null;
    _lastCustomProperties: Array<CustomPropertyForAirtableInterface> | null = null;

    constructor(fixtureData: FixtureData) {
        super(convertFixtureDataToSdkInitData(fixtureData));
    }

    /**
     * Simulate the host's response to a mutation the SDK has already validated
     * and (for record and globalConfig mutations) optimistically applied to
     * the shared base data. Emits a `mutation` event for test assertions.
     */
    async applyMutationAsync(mutation: Mutation, _opts?: {holdForMs?: number}): Promise<void> {
        switch (mutation.type) {
            case MutationTypes.CREATE_MULTIPLE_RECORDS: {
                // The SDK's optimistic update writes the new records into
                // `recordsById` but not `recordOrder` (nor any active query's
                // result set); in production the host does that. Simulate it.
                const tableData = this.sdkInitData.baseData.tablesById[mutation.tableId];
                if (!tableData) {
                    throw spawnError('table not present in fixture data: %s', mutation.tableId);
                }
                const newRecordIds = mutation.records.map((record) => record.id);
                const changes: Array<ModelChange> = [
                    {
                        path: ['tablesById', mutation.tableId, 'recordOrder'],
                        value: [...tableData.recordOrder, ...newRecordIds],
                    },
                ];
                for (const [queryKey, query] of Object.entries(
                    tableData.dynamicQueriesByKey ?? {},
                )) {
                    changes.push({
                        path: ['tablesById', mutation.tableId, 'dynamicQueriesByKey', queryKey],
                        value: {recordOrder: [...query.recordOrder, ...newRecordIds]},
                    });
                }
                this.triggerModelUpdates(changes);
                break;
            }
            case MutationTypes.DELETE_MULTIPLE_RECORDS: {
                // The SDK's optimistic update already removed the records from
                // `recordsById` and the table `recordOrder`. Sync the per-query
                // result sets the way the host eventually would.
                const tableData = this.sdkInitData.baseData.tablesById[mutation.tableId];
                if (!tableData) {
                    throw spawnError('table not present in fixture data: %s', mutation.tableId);
                }
                const deletedRecordIdSet = new Set(mutation.recordIds);
                const changes: Array<ModelChange> = [];
                for (const [queryKey, query] of Object.entries(
                    tableData.dynamicQueriesByKey ?? {},
                )) {
                    if (!query.recordOrder.some((recordId) => deletedRecordIdSet.has(recordId))) {
                        continue;
                    }
                    changes.push({
                        path: ['tablesById', mutation.tableId, 'dynamicQueriesByKey', queryKey],
                        value: {
                            recordOrder: query.recordOrder.filter(
                                (recordId) => !deletedRecordIdSet.has(recordId),
                            ),
                        },
                    });
                }
                if (changes.length > 0) {
                    this.triggerModelUpdates(changes);
                }
                break;
            }
            case MutationTypes.SET_MULTIPLE_RECORDS_CELL_VALUES:
            case MutationTypes.SET_MULTIPLE_GLOBAL_CONFIG_PATHS:
                // Fully handled by the SDK's optimistic updates.
                break;
            /* istanbul ignore next */
            default:
                throw spawnError(
                    'unknown mutation type: %s',
                    (mutation as {type: string}).type,
                );
        }

        // Strip internal opts before exposing the mutation to test assertions
        // (mirrors v1 behavior).
        if (has(mutation, 'opts')) {
            const {opts: _internalOpts, ...mainMutation} = mutation as Mutation & {opts?: unknown};
            this.emit('mutation', mainMutation);
            return;
        }
        this.emit('mutation', mutation);
    }

    checkPermissionsForMutation(mutation: Mutation): PermissionCheckResult {
        if (!this._userPermissionCheck || this._userPermissionCheck(mutation)) {
            return {hasPermission: true};
        }
        return {
            hasPermission: false,
            reasonDisplayString:
                'The testing environment has been configured to deny this mutation.',
        };
    }

    /**
     * Host contract for record loading: populate the table's
     * `dynamicQueriesByKey[key].recordOrder` so RecordQueryResult (and
     * therefore `useRecords`) sees a result set.
     */
    async loadDynamicQueryAsync(args: {
        key: string;
        tableId: TableId;
        fieldIds: ReadonlyArray<FieldId>;
        recordIds: ReadonlyArray<RecordId> | null;
    }): Promise<void> {
        const tableData = this.sdkInitData.baseData.tablesById[args.tableId];
        if (!tableData) {
            throw spawnError('table not present in fixture data: %s', args.tableId);
        }
        for (const fieldId of args.fieldIds) {
            if (!(fieldId in tableData.fieldsById)) {
                throw spawnError('field %s not present in table %s', fieldId, args.tableId);
            }
        }
        const recordOrder =
            args.recordIds !== null ? [...args.recordIds] : [...tableData.recordOrder];
        this.triggerModelUpdates([
            {
                path: ['tablesById', args.tableId, 'dynamicQueriesByKey', args.key],
                value: {recordOrder},
            },
        ]);
    }

    unloadDynamicQuery(args: {key: string}): void {
        for (const tableData of Object.values(this.sdkInitData.baseData.tablesById)) {
            if (tableData.dynamicQueriesByKey && args.key in tableData.dynamicQueriesByKey) {
                this.triggerModelUpdates([
                    {
                        path: ['tablesById', tableData.id, 'dynamicQueriesByKey', args.key],
                        value: undefined,
                    },
                ]);
            }
        }
    }

    fetchForeignRecordsAsync(
        tableId: TableId,
        recordId: RecordId,
        fieldId: FieldId,
        filterString: string,
    ): Promise<{records: ReadonlyArray<{id: RecordId; name: string}>}> {
        if (this._foreignRecordsHandler) {
            return Promise.resolve({
                records: this._foreignRecordsHandler(tableId, recordId, fieldId, filterString),
            });
        }
        return Promise.resolve({records: []});
    }

    setCustomPropertiesAsync(
        properties: Array<CustomPropertyForAirtableInterface>,
    ): Promise<boolean> {
        this._lastCustomProperties = properties;
        this.emit('setCustomProperties', properties);
        return Promise.resolve(true);
    }

    setSelectedSubElementAsync(
        selectedSubElement: SubElementSelectionState | null,
    ): Promise<boolean> {
        this.emit('setSelectedSubElement', selectedSubElement);
        return Promise.resolve(true);
    }

    /**
     * App-side search param write. Echo the update back through the host
     * subscription so `sdk._searchParams` (and `useSearchParams`) updates,
     * matching production behavior.
     */
    setSearchParamsAsync(searchParams: Record<string, string>): Promise<boolean> {
        this.emit('setSearchParams', searchParams);
        this.triggerSearchParamsUpdates(searchParams);
        return Promise.resolve(true);
    }

    /** Host-side search param push. */
    triggerSearchParamsUpdates(searchParams: Record<string, string>): void {
        this.emit('searchParamsUpdates', {searchParams});
    }

    /** Host-side sub-element selection push. */
    triggerSelectionUpdates(selectedSubElementId: string | null): void {
        this.emit('selectedSubElementIdUpdates', {selectedSubElementId});
    }

    // The abstract base's implementations of these two are empty no-ops; wire
    // them through the EventEmitter (like `modelupdates`) so host-side
    // globalConfig pushes reach the SDK.
    subscribeToGlobalConfigUpdates(fn: (data: {updates: ReadonlyArray<GlobalConfigUpdate>}) => void) {
        this.on('globalconfigupdates', fn);
    }

    triggerGlobalConfigUpdates(updates: ReadonlyArray<GlobalConfigUpdate>) {
        this.emit('globalconfigupdates', {updates});
    }

    get globalConfigHelpers() {
        // The abstract base's `validateAndApplyUpdates` throws; the SDK's
        // GlobalConfig model requires a real implementation (ported from v1).
        return {
            ...super.globalConfigHelpers,
            validateAndApplyUpdates: (
                updates: ReadonlyArray<GlobalConfigUpdate>,
                store: GlobalConfigData,
            ) => {
                const changedTopLevelKeys = new Set<string>();
                let newKvStore: GlobalConfigData = {...store};
                for (const update of updates) {
                    changedTopLevelKeys.add(update.path[0]);
                    newKvStore = setGlobalConfigValue(
                        newKvStore as never,
                        update.path,
                        update.value,
                    ) as GlobalConfigData;
                }

                return {
                    newKvStore,
                    changedTopLevelKeys: Array.from(changedTopLevelKeys),
                };
            },
        };
    }

    get fieldTypeProvider() {
        const base = super.fieldTypeProvider;
        // The abstract base's `convertCellValueToString` returns '' for every
        // value; port v1's approximation so `record.name` and
        // `getCellValueAsString` behave usefully in tests.
        const convertCellValueToString = (
            appInterface: unknown,
            cellValue: unknown,
            fieldData: unknown,
        ): string => {
            if (cellValue === null || cellValue === undefined) {
                return '';
            }

            if (Array.isArray(cellValue)) {
                return cellValue
                    .map((item: unknown) =>
                        convertCellValueToString(appInterface, item, fieldData),
                    )
                    .join(', ');
            }

            if (typeof cellValue === 'object' && cellValue !== null && has(cellValue, 'name')) {
                const named = cellValue as {name: unknown};
                if (typeof named.name === 'string') {
                    return named.name;
                }
            }

            return String(cellValue);
        };
        return {...base, convertCellValueToString};
    }

    get idGenerator() {
        // The abstract base returns a fixed id, which breaks creating more
        // than one record; generate unique Airtable-shaped ids instead.
        return {
            ...super.idGenerator,
            generateRecordId: () => generateId('rec'),
        };
    }

    expandRecord(tableId: TableId, recordId: RecordId): void {
        this.emit('expandRecord', {tableId, recordId});
    }

    reloadFrame(): void {}
    trackEvent(): void {}
    trackExposure(): void {}
    sendStat(): void {}
}
