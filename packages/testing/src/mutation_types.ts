/**
 * The mutation types that exist for interface extensions. Mirrors the SDK's
 * `MutationTypesCore` (shared/types/mutations_core.ts) as re-exported by
 * interface/types/mutations.ts — interface mode adds no additional types.
 */
export const MutationTypes = Object.freeze({
    SET_MULTIPLE_GLOBAL_CONFIG_PATHS: 'setMultipleGlobalConfigPaths' as const,
    SET_MULTIPLE_RECORDS_CELL_VALUES: 'setMultipleRecordsCellValues' as const,
    DELETE_MULTIPLE_RECORDS: 'deleteMultipleRecords' as const,
    CREATE_MULTIPLE_RECORDS: 'createMultipleRecords' as const,
});

/** @hidden */
export type MutationType = (typeof MutationTypes)[keyof typeof MutationTypes];
