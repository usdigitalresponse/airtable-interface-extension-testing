/**
 * The public fixture format for simulating an Airtable base in tests, and its
 * conversion to the SDK's `SdkInitData`. Adapted from the SDK's own interface
 * test fixtures (`packages/sdk/test/interface/airtable_interface_mocks/fixture_data.ts`)
 * with extensions: optional globalConfig, search params, run-context
 * overrides, permission level, and collaborators.
 */
import {spawnError} from './error_utils';
import {getId, keyBy, type ObjectMap} from './private_utils';
import {
    BlockRunContextType,
    type BaseId,
    type CollaboratorData,
    type FieldData,
    type FieldId,
    type GlobalConfigData,
    type PageId,
    type RecordData,
    type RecordId,
    type SdkInitData,
    type TableData,
    type TableId,
} from './sdk_types';

const DEFAULT_BLOCK_INSTALLATION_ID = 'blitestdriver0000';
const DEFAULT_PAGE_ID = 'pagtestdriver0000';
const DEFAULT_BASE_COLOR = 'purple';
const DEFAULT_BILLING_GROUP = 'pro';
const DEFAULT_WORKSPACE_ID = 'wsptestdriver0000';
const DEFAULT_COLLABORATOR: CollaboratorData & {isActive: boolean} = {
    id: 'usrtestdriver0000',
    name: 'Test User',
    email: 'test.user@example.com',
    isActive: true,
};

/**
 * A complete set of information necessary to initialize a simulated Airtable
 * base in automated test environments.
 */
export interface FixtureData {
    /** A representation of the state of an Airtable base. */
    base: {
        id: BaseId;
        name: string;
        /** Base color; defaults to "purple". */
        color?: string;
        tables: Array<TableFixtureData>;
        /**
         * Base collaborators. The first entry becomes the current user.
         * Defaults to a single active "Test User".
         */
        collaborators?: Array<CollaboratorData & {isActive: boolean}>;
        /**
         * The current user's permission level ("owner" | "create" | "edit" |
         * "comment" | "read" | "none"). Defaults to "create". Note that
         * permission simulation for mutations is handled separately via
         * `TestDriver.simulatePermissionCheck`.
         */
        permissionLevel?: string;
        /** Workspace identifier; defaults to a fixed test id. */
        workspaceId?: string;
    };
    /** Initial contents of {@link GlobalConfig} (custom property values live here too). */
    globalConfig?: GlobalConfigData;
    /** Initial search params exposed through `useSearchParams`. */
    searchParams?: Record<string, string>;
    /** Overrides for the extension's run context. */
    runContext?: {
        /** The interface page the extension is installed on. */
        pageId?: PageId;
        /** Whether the page element is in edit mode (interface designer). */
        isPageElementInEditMode?: boolean;
    };
}

/** A representation of the state of a table. */
export interface TableFixtureData {
    id: TableId;
    name: string;
    description?: string | null;
    /**
     * Fields present in the simulated table when it is initialized. The first
     * field becomes the table's primary field.
     */
    fields: Array<FieldFixtureData>;
    /** Records present in the simulated table when it is initialized. */
    records: Array<RecordFixtureData>;
}

/** A representation of the state of a field. */
export interface FieldFixtureData {
    id: FieldId;
    name: string;
    description?: string | null;
    /** The field's type, e.g. "singleLineText" (a {@link FieldType} value). */
    type: string;
    /** Type options associated with the simulated field. */
    options?: null | {[key: string]: unknown};
}

/** A representation of the state of a record. */
export interface RecordFixtureData {
    id: RecordId;
    /** The time the simulated record should appear to have been created. */
    createdTime?: string;
    /** A mapping of field identifiers to cell values (SDK internal format). */
    cellValuesByFieldId: ObjectMap<FieldId, unknown>;
}

function convertFieldFixtureDataToFieldData(fieldFixtureData: FieldFixtureData): FieldData {
    const {id, name, description, type, options} = fieldFixtureData;
    return {
        id,
        name,
        type,
        description: description ?? null,
        typeOptions: options ?? null,
        lock: null,
        isSynced: false,
        isEditable: true,
        canCreateNewForeignRecords: type === 'multipleRecordLinks' ? true : undefined,
    };
}

function convertRecordFixtureDataToRecordData(recordFixtureData: RecordFixtureData): RecordData {
    const {id, createdTime, cellValuesByFieldId} = recordFixtureData;
    return {
        id,
        createdTime: createdTime ?? '2024-01-01T00:00:00.000Z',
        cellValuesByFieldId,
    };
}

function convertTableFixtureDataToTableData(tableFixtureData: TableFixtureData): TableData {
    const {id, name, description, fields, records} = tableFixtureData;

    if (!fields || fields.length === 0) {
        throw spawnError(
            'Every table in fixture data must specify at least one field, but table "%s" specified zero fields',
            id,
        );
    }
    fields
        .map((field) => field.id)
        .forEach((fieldId, index, ids) => {
            if (ids.indexOf(fieldId) !== index) {
                throw spawnError('repeated field ID: %s', fieldId);
            }
        });
    records
        .map((record) => record.id)
        .forEach((recordId, index, ids) => {
            if (ids.indexOf(recordId) !== index) {
                throw spawnError('repeated record ID: %s', recordId);
            }
        });

    return {
        id,
        name,
        description: description ?? null,
        primaryFieldId: fields[0].id,
        fieldsById: keyBy<FieldData, string>(fields.map(convertFieldFixtureDataToFieldData), getId),
        recordsById: keyBy<RecordData, string>(
            records.map(convertRecordFixtureDataToRecordData),
            getId,
        ),
        recordOrder: records.map((record) => record.id),
        dynamicQueriesByKey: {},
        lock: null,
        externalSyncById: null,
        isRecordExpansionEnabled: true,
        canCreateRecordsInline: true,
        canEditRecordsInline: true,
        canDestroyRecordsInline: true,
    };
}

/** @internal */
export function convertFixtureDataToSdkInitData(fixtureData: FixtureData): SdkInitData {
    const {base} = fixtureData;

    if (!base.tables || base.tables.length === 0) {
        throw spawnError('Fixture data must include at least one table');
    }
    base.tables
        .map((table) => table.id)
        .forEach((tableId, index, ids) => {
            if (ids.indexOf(tableId) !== index) {
                throw spawnError('repeated table ID: %s', tableId);
            }
        });

    const collaborators =
        base.collaborators && base.collaborators.length > 0
            ? base.collaborators
            : [DEFAULT_COLLABORATOR];

    const tables = base.tables.map(convertTableFixtureDataToTableData);

    return {
        isDevelopmentMode: false,
        blockInstallationId: DEFAULT_BLOCK_INSTALLATION_ID,
        isFirstRun: false,
        initialKvValuesByKey: fixtureData.globalConfig ?? {},
        initialSearchParams: fixtureData.searchParams ?? {},
        runContext: {
            type: BlockRunContextType.PAGE_ELEMENT_IN_QUERY_CONTAINER,
            pageId: fixtureData.runContext?.pageId ?? DEFAULT_PAGE_ID,
            isPageElementInEditMode: fixtureData.runContext?.isPageElementInEditMode ?? false,
        },
        baseData: {
            id: base.id,
            name: base.name,
            color: base.color ?? DEFAULT_BASE_COLOR,
            tableOrder: tables.map(getId),
            tablesById: keyBy<TableData, string>(tables, getId),
            permissionLevel: base.permissionLevel ?? 'create',
            currentUserId: collaborators[0].id,
            enabledFeatureNames: [],
            collaboratorsById: keyBy(
                collaborators.map(({id, name, email, profilePicUrl}) => ({
                    id,
                    name,
                    email,
                    profilePicUrl,
                })),
                getId,
            ),
            activeCollaboratorIds: collaborators
                .filter((collaborator) => collaborator.isActive)
                .map(getId),
            billingPlanGrouping: DEFAULT_BILLING_GROUP,
            appInterface: {},
            isBlockDevelopmentRestrictionEnabled: false,
            workspaceId: base.workspaceId ?? DEFAULT_WORKSPACE_ID,
            // useCustomProperties reads this when computing possibleValues for
            // field-type custom properties.
            allTableDataForEditModeConfiguration: keyBy(
                tables.map((table) => ({
                    id: table.id,
                    name: table.name,
                    primaryFieldId: table.primaryFieldId,
                    fieldsById: table.fieldsById as ObjectMap<
                        string,
                        {
                            id: string;
                            name: string;
                            type: string;
                            typeOptions: {[key: string]: unknown} | null | undefined;
                        }
                    >,
                })),
                getId,
            ),
        },
        intentData: null,
    };
}
