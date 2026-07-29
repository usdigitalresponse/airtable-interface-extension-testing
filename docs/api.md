# API reference

Reference for `@usdr/airtable-interface-testing` and the `airtable-testing-fixtures` CLI. For a guided introduction, read [getting started](getting-started.md) first.

## Package exports

```ts
import TestDriver, {
    // also a named export: {TestDriver}
    MutationTypes,           // the four mutation type constants
    MockAirtableInterface,   // the simulated host class
    type FixtureData,
    type TableFixtureData,
    type FieldFixtureData,
    type RecordFixtureData,
    type WatchableKeysAndArgs,
    type ForeignRecordsHandler,
    type Mutation,
    type ModelChange,
    type GlobalConfigUpdate,
    type GlobalConfigValue,
    type PermissionCheckResult,
    type CustomPropertyForAirtableInterface,
    type CollaboratorData,
} from '@usdr/airtable-interface-testing';
```

Importing the package installs the simulated host global as a side effect. Two secondary entries exist:

**`@usdr/airtable-interface-testing/jest-preset` ---** the Jest preset (`preset: '@usdr/airtable-interface-testing'` in your config). Provides jsdom, the inject setup file, a hermetic babel transform that also transforms the ESM-only SDK, and jest-dom matchers. Consumer config keys override preset keys.

**`@usdr/airtable-interface-testing/inject` ---** just the host installation, for hand-rolled Jest configs: put it in `setupFiles` so the host exists before any SDK module loads, regardless of import order in test files.

## TestDriver

One `TestDriver` is one simulated extension environment. Construct a fresh one per test; two drivers never share state.

```ts
const testDriver = new TestDriver(fixtureData);
```

### Container

```tsx
render(
    <testDriver.Container>
        <MyApp />
    </testDriver.Container>,
);
```

A React component providing the simulated SDK to your extension — the equivalent of running inside an interface page. Everything using SDK hooks must render beneath it; hooks outside it throw, and SDK calls outside any driver raise a descriptive "outside of a simulated environment" error.

### State properties

**`base` ---** the SDK `Base` model backing the simulation — the same instance your extension's `useBase` returns. Use its real API (`getTableByName`, `createRecordAsync` on tables, …) to read state or make writes that propagate into the rendered UI.

**`session` ---** the SDK `Session`; `session.currentUser` reflects the fixture's first collaborator.

**`globalConfig` ---** the SDK `GlobalConfig`; `get`/`setAsync`/`setPathsAsync` work and emit `mutation` events.

**`searchParams` ---** the current search params as a plain object.

**`customProperties` ---** the definitions most recently registered through `useCustomProperties` (as sent to the host: `key`, `label`, `type`, `possibleValues`, …), or `null` before any registration.

**`airtableInterface` ---** the `MockAirtableInterface` instance. An escape hatch: `sdkInitData.baseData` is the live simulated store (the SDK aliases it, so reads always reflect current state).

### Simulation methods

**`simulatePermissionCheck(check)` ---** installs a permission handler; `check(mutation)` returning `false` denies. Denied mutations make SDK write methods reject with "The testing environment has been configured to deny this mutation", and sync helpers (`table.hasPermissionToCreateRecord()` etc.) return `false`.

**`simulateSearchParamsUpdate(params)` ---** host pushes new search params; `useSearchParams` re-renders.

**`simulateGlobalConfigUpdate(updates)` ---** host applies globalConfig updates (`{path, value}` pairs), as when another collaborator changes settings.

**`simulateCustomPropertyValueChange(key, value)` ---** a builder edits one custom property in the designer panel. Sugar for `simulateGlobalConfigUpdate([{path: [key], value}])` — property values live in globalConfig under the property key.

**`simulateSubElementSelection(idOrNull)` ---** host changes the selected sub-element (edit-mode flows).

**`simulateForeignRecords(handler)` ---** installs a `(tableId, recordId, fieldId, filterString) => Array<{id, name}>` handler answering linked-record searches.

**`triggerModelUpdates(changes)` ---** applies raw host-side `ModelChange`s (paths relative to base data, e.g. `['tablesById', tableId, 'recordsById', recordId, 'cellValuesByFieldId', fieldId]`). The escape hatch when no dedicated method exists.

### Events

**`watch(key, handler)` / `unwatch(key, handler)` ---** subscribe to what the extension does:

| Key | Payload | Fires when |
|---|---|---|
| `mutation` | `Mutation` | the SDK persists any change (see MutationTypes) |
| `expandRecord` | `{tableId, recordId}` | the extension calls `expandRecord(record)` |
| `setCustomProperties` | property array | `useCustomProperties` registers definitions |
| `setSearchParams` | params object | the extension writes search params |
| `setSelectedSubElement` | selection or `null` | the extension selects a sub-element |

### MutationTypes

The four mutation types that exist for interface extensions:

```ts
MutationTypes.SET_MULTIPLE_RECORDS_CELL_VALUES  // 'setMultipleRecordsCellValues'
MutationTypes.CREATE_MULTIPLE_RECORDS           // 'createMultipleRecords'
MutationTypes.DELETE_MULTIPLE_RECORDS           // 'deleteMultipleRecords'
MutationTypes.SET_MULTIPLE_GLOBAL_CONFIG_PATHS  // 'setMultipleGlobalConfigPaths'
```

Record CRUD in tests goes through the real SDK (`table.createRecordAsync`, `updateRecordAsync`, `deleteRecordAsync`, and their batch variants) — the driver has no separate record methods.

## FixtureData

```ts
interface FixtureData {
    base: {
        id: string;                 // 'appXXXXXXXXXXXXXX'
        name: string;
        color?: string;             // default 'purple'
        tables: Array<TableFixtureData>;
        collaborators?: Array<CollaboratorData & {isActive: boolean}>;
        permissionLevel?: string;   // default 'create'
        workspaceId?: string;
    };
    globalConfig?: GlobalConfigData;          // initial key-values (custom property values live here)
    searchParams?: Record<string, string>;    // initial useSearchParams contents
    runContext?: {
        pageId?: string;
        isPageElementInEditMode?: boolean;    // default false
    };
}

interface TableFixtureData {
    id: string;                     // 'tblXXXXXXXXXXXXXX'
    name: string;
    description?: string | null;
    fields: Array<FieldFixtureData>;   // first field = primary field
    records: Array<RecordFixtureData>;
}

interface FieldFixtureData {
    id: string;                     // 'fldXXXXXXXXXXXXXX'
    name: string;
    description?: string | null;
    type: string;                   // a FieldType value, e.g. 'singleLineText'
    options?: null | {[key: string]: unknown};
}

interface RecordFixtureData {
    id: string;                     // 'recXXXXXXXXXXXXXX'
    createdTime?: string;           // ISO date, defaulted if omitted
    cellValuesByFieldId: {[fieldId: string]: unknown};  // SDK internal format
}
```

Rules the converter enforces: at least one table; at least one field per table; unique table, field, and record ids. The first collaborator becomes the current user (a default "Test User" is supplied when none are given).

Cell values use the SDK's internal format — notably selects are `{id, name, color}` objects and linked records are arrays of `{id, name}`. The [fixture generator](#fixture-generator-cli) produces this format for you from REST API data.

## MockAirtableInterface

The simulated host, exposed as `testDriver.airtableInterface`. Most tests never touch it directly, but it's useful for:

**`sdkInitData.baseData` ---** the live simulated store, for asserting on raw data after mutations.

**`fetchForeignRecordsAsync(...)` ---** call directly to test a `simulateForeignRecords` handler.

**`reset()` ---** restores the initial data snapshot and removes listeners. Prefer constructing a new `TestDriver` — an SDK built on a reset mock keeps stale references.

Host behaviors it implements for the SDK: dynamic query loading (what `useRecords` consumes), permission checks, globalConfig validation and application, realistic `convertCellValueToString` (so `record.name` and `getCellValueAsString` work), and unique record-id generation.

## Fixture generator CLI

```bash
npx airtable-testing-fixtures [options]
```

| Flag | Meaning |
|---|---|
| `--base appXXX` | skip the interactive base picker |
| `--all` | export every table and field without prompting |
| `--out path` | output file (default `fixtures/<base-name>.ts`) |
| `--json` | emit JSON instead of a TypeScript module |
| `--max-records n` | per-table record cap (default 500) |
| `--keep-ids` | keep real Airtable IDs; by default IDs are anonymized to name-derived ones (`appTestBaseName`, `fldName`, `recBuyGroceries`), 17 chars max, numbered on collision |
| `--token pat` | Personal Access Token for this run only — never written to the cache (CI use); overrides `AIRTABLE_TOKEN` and the cache |
| `--reset-token` | forget the cached token and prompt again |
| `--help` | usage |

The token needs the `schema.bases:read` and `data.records:read` scopes. Precedence: `--token`, then the `AIRTABLE_TOKEN` env var (also never cached), then the cache file `~/.airtable-testing` (mode 0600), then an interactive prompt — only interactively entered tokens are cached. Conversion behavior — selects, linked records, warnings for unrecognized shapes — is documented in the [generator README](../packages/fixture-generator/README.md).

## Not supported (and why)

Interface extensions have no views, cursor, or viewport, so the corresponding v1 blocks-testing APIs have no equivalent here: `deleteTable`/`deleteFieldAsync`/`deleteViewAsync`, `setActiveCursorModels`, `userSelectRecords`, `simulateExpandedRecordSelection`, `expandRecordList`/`expandRecordPickerAsync`, fullscreen, settings button, and `performRecordAction`. Schema mutations are also absent — the interface SDK has no schema-writing API. The full mapping lives in the [testing README](../packages/testing/README.md#what-changed-from-v1-blocks-testing).
