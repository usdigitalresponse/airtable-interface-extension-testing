/**
 * Structural copies of interface-mode SDK types that `@airtable/blocks` does
 * not export through its `exports` map. Each type notes the SDK source file it
 * mirrors (paths relative to the SDK repo's `packages/sdk/src/`) so drift can
 * be tracked when the `interface-alpha` branch moves.
 *
 * These are intentionally structural: TypeScript's structural typing makes
 * them assignable to/from the real SDK internals, which we load untyped at
 * runtime (see `sdk_internals.ts`).
 */
import {type ObjectMap} from './private_utils';

/** Mirrors shared/types/hyper_ids.ts (all ids are strings at runtime). */
export type BaseId = string;
export type TableId = string;
export type FieldId = string;
export type RecordId = string;
export type UserId = string;
export type PageId = string;
export type BlockInstallationId = string;

/** Mirrors shared/types/collaborator.ts */
export interface CollaboratorData {
    id: UserId;
    name?: string;
    email?: string;
    profilePicUrl?: string;
}

/** Mirrors shared/types/global_config.ts */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- interface (not type alias) is required to break the circular reference with GlobalConfigValue
export interface GlobalConfigArray extends ReadonlyArray<GlobalConfigValue> {}
/** Mirrors shared/types/global_config.ts */
export interface GlobalConfigObject {
    [key: string]: GlobalConfigValue | undefined;
}
/** Mirrors shared/types/global_config.ts */
export type GlobalConfigValue =
    | null
    | boolean
    | number
    | string
    | GlobalConfigArray
    | GlobalConfigObject;
/** Mirrors shared/types/global_config.ts */
export interface GlobalConfigData {
    [key: string]: GlobalConfigValue | undefined;
}
/** Mirrors shared/types/global_config.ts */
export interface GlobalConfigUpdate {
    readonly path: ReadonlyArray<string>;
    readonly value: GlobalConfigValue | undefined;
}

/** Mirrors interface/types/field.ts */
export interface FieldData {
    id: FieldId;
    name: string;
    type: string;
    description: string | null;
    typeOptions: {[key: string]: unknown} | null | undefined;
    lock: unknown | null;
    isSynced?: boolean;
    isEditable?: boolean;
    canCreateNewForeignRecords?: boolean;
}

/** Mirrors interface/types/record.ts */
export interface RecordData {
    id: RecordId;
    createdTime: string;
    cellValuesByFieldId: ObjectMap<FieldId, unknown>;
}

/** Mirrors interface/types/table.ts */
export interface TableData {
    id: TableId;
    name: string;
    description: string | null;
    primaryFieldId: FieldId;
    fieldsById: ObjectMap<FieldId, FieldData>;
    recordsById: ObjectMap<RecordId, RecordData>;
    recordOrder: Array<RecordId>;
    dynamicQueriesByKey: ObjectMap<string, {recordOrder: Array<RecordId>}>;
    lock: unknown | null;
    externalSyncById: unknown | null;
    isRecordExpansionEnabled: boolean;
    canCreateRecordsInline: boolean;
    canEditRecordsInline: boolean;
    canDestroyRecordsInline: boolean;
}

/** Mirrors interface/types/base.ts + shared/types/base_core.ts (BaseDataCore) */
export interface BaseData {
    id: BaseId;
    name: string;
    color: string;
    tableOrder: Array<TableId>;
    tablesById: ObjectMap<TableId, TableData>;
    appInterface: {[key: string]: unknown};
    collaboratorsById: ObjectMap<UserId, CollaboratorData>;
    activeCollaboratorIds: Array<UserId>;
    currentUserId: UserId | null;
    permissionLevel: string;
    enabledFeatureNames: Array<string>;
    billingPlanGrouping: string;
    isBlockDevelopmentRestrictionEnabled: boolean;
    maxRowsPerTable?: number;
    workspaceId: string;
    allTableDataForEditModeConfiguration?: ObjectMap<
        TableId,
        {
            id: TableId;
            name: string;
            primaryFieldId: FieldId;
            fieldsById: ObjectMap<
                FieldId,
                {
                    id: FieldId;
                    name: string;
                    type: string;
                    typeOptions: {[key: string]: unknown} | null | undefined;
                }
            >;
        }
    >;
}

/** Mirrors interface/types/airtable_interface.ts (enum BlockRunContextType) */
export const BlockRunContextType = Object.freeze({
    PAGE_ELEMENT_IN_QUERY_CONTAINER: 'pageElementInQueryContainer' as const,
});

/** Mirrors interface/types/airtable_interface.ts */
export interface PageElementInQueryContainerBlockRunContext {
    type: typeof BlockRunContextType.PAGE_ELEMENT_IN_QUERY_CONTAINER;
    pageId: PageId;
    isPageElementInEditMode: boolean;
}

/** Mirrors interface/types/airtable_interface.ts (SdkInitData) */
export interface SdkInitData {
    isDevelopmentMode: boolean;
    blockInstallationId: BlockInstallationId;
    isFirstRun: boolean;
    initialKvValuesByKey: GlobalConfigData;
    initialSearchParams: Record<string, string>;
    runContext: PageElementInQueryContainerBlockRunContext;
    baseData: BaseData;
    intentData: unknown;
}

/** Mirrors shared/types/base_core.ts (ModelChange) */
export interface ModelChange {
    path: ReadonlyArray<string>;
    value: unknown;
}

/**
 * Mirrors interface/types/airtable_interface.ts
 * (BlockInstallationPageElementCustomPropertyTypeForAirtableInterface)
 */
export const CustomPropertyTypeForAirtableInterface = Object.freeze({
    BOOLEAN: 'boolean' as const,
    STRING: 'string' as const,
    ENUM: 'enum' as const,
    FIELD_ID: 'fieldId' as const,
    TABLE_ID: 'tableId' as const,
});

/**
 * Mirrors interface/types/airtable_interface.ts
 * (BlockInstallationPageElementCustomPropertyForAirtableInterface). The exact
 * per-type payloads are host-defined; tests generally assert on `key`,
 * `label`, and `type`.
 */
export interface CustomPropertyForAirtableInterface {
    key: string;
    label: string;
    type: string;
    [extra: string]: unknown;
}

/** Mirrors interface/types/airtable_interface.ts (SubElementSelectionState) */
export interface SubElementSelectionState {
    subElementId: string;
    sourceLocation?: unknown;
    name?: string;
}

/** Mirrors shared/types/mutations_core.ts (PermissionCheckResult) */
export type PermissionCheckResult =
    | {hasPermission: true}
    | {hasPermission: false; reasonDisplayString: string};

/** Mirrors shared/types/mutations_core.ts (SetMultipleGlobalConfigPathsMutation) */
export interface SetMultipleGlobalConfigPathsMutation {
    readonly type: 'setMultipleGlobalConfigPaths';
    readonly updates: ReadonlyArray<GlobalConfigUpdate>;
}

/** Mirrors shared/types/mutations_core.ts (SetMultipleRecordsCellValuesMutation) */
export interface SetMultipleRecordsCellValuesMutation {
    readonly type: 'setMultipleRecordsCellValues';
    readonly tableId: TableId;
    readonly records: ReadonlyArray<{
        readonly id: RecordId;
        readonly cellValuesByFieldId: ObjectMap<FieldId, unknown>;
    }>;
}

/** Mirrors shared/types/mutations_core.ts (DeleteMultipleRecordsMutation) */
export interface DeleteMultipleRecordsMutation {
    readonly type: 'deleteMultipleRecords';
    readonly tableId: TableId;
    readonly recordIds: ReadonlyArray<RecordId>;
}

/** Mirrors shared/types/mutations_core.ts (CreateMultipleRecordsMutation) */
export interface CreateMultipleRecordsMutation {
    readonly type: 'createMultipleRecords';
    readonly tableId: TableId;
    readonly records: ReadonlyArray<{
        readonly id: RecordId;
        readonly cellValuesByFieldId: ObjectMap<FieldId, unknown>;
    }>;
}

/**
 * Mirrors interface/types/mutations.ts (Mutation = MutationCore). The only
 * mutations that exist in interface mode.
 */
export type Mutation =
    | SetMultipleGlobalConfigPathsMutation
    | SetMultipleRecordsCellValuesMutation
    | DeleteMultipleRecordsMutation
    | CreateMultipleRecordsMutation;
