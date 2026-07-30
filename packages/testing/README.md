# @usdr/airtable-interface-testing

Automated testing for Airtable [interface extensions](https://airtable.com/developers/interface-extensions). This library gives you the same workflow as v1's [`@airtable/blocks-testing`](https://airtable.com/developers/extensions/guides/automated-testing): describe a base as fixture data, render your extension in a simulated environment, drive it with [Testing Library](https://testing-library.com/), and assert on both the UI and the mutations your extension attempts.

```tsx
import TestDriver, {MutationTypes} from '@usdr/airtable-interface-testing';
import {render, screen} from '@testing-library/react';
import {TodoApp} from '../src/app';

test('renders tasks and creates records', async () => {
    const testDriver = new TestDriver(fixtureData);

    render(
        <testDriver.Container>
            <TodoApp />
        </testDriver.Container>,
    );

    expect(await screen.findByText('Buy groceries')).toBeInTheDocument();
});
```

The [example extension's test suite](../../examples/todo-list/test/app.test.tsx) exercises every feature below and doubles as a template.

## Installation

This package isn't published to npm. Install the tarball from a [GitHub Release](https://github.com/usdigitalresponse/airtable-interface-extension-testing/releases):

```bash
npm install --save-dev https://github.com/usdigitalresponse/airtable-interface-extension-testing/releases/download/v0.1.0/usdr-airtable-interface-testing-0.1.0.tgz @airtable/blocks@interface-alpha-next
```

**Finding the URL ---** on the [releases page](https://github.com/usdigitalresponse/airtable-interface-extension-testing/releases), open a release and copy the link to `usdr-airtable-interface-testing-<version>.tgz` under **Assets**. Every release follows the same URL shape, so bumping the version in the command above works too:

```
https://github.com/usdigitalresponse/airtable-interface-extension-testing/releases/download/v<version>/usdr-airtable-interface-testing-<version>.tgz
```

The toolchain — **Jest**, jsdom, babel, and **Testing Library** — ships as this package's dependencies, so that one install is enough. **React 19** and `react-dom` are peer dependencies your extension project already has.

This library was validated against `@airtable/blocks@0.0.0-experimental-dc9f9a979-20260605` (the `interface-alpha-next` dist-tag as of July 2026). It reaches into the SDK's `dist/` for a few modules the package doesn't export publicly, so a new SDK build can break it — if that happens you'll get a descriptive error at import time rather than silent misbehavior.

## Jest configuration

Use the bundled preset:

```js
// jest.config.js
export default {
    preset: '@usdr/airtable-interface-testing',
};
```

If you'd rather configure Jest yourself (or are integrating with an existing config), two lines are load-bearing; everything else in the preset is convenience:

```js
export default {
    testEnvironment: 'jsdom',
    // 1. The SDK builds a singleton from a window global at import time.
    //    This setup file installs the simulated host first.
    setupFiles: ['@usdr/airtable-interface-testing/inject'],
    // 2. @airtable/blocks ships ESM-only; Jest must be allowed to transform it.
    transformIgnorePatterns: ['/node_modules/(?!@airtable/blocks/)'],
    transform: {'^.+\\.[jt]sx?$': 'babel-jest'},
    // ...plus a babel config with preset-env, preset-react, preset-typescript.
};
```

See [examples/todo-list](../../examples/todo-list) for a complete working preset-based setup.

**Note:** a transforming test runner is required. The SDK's published ESM uses extensionless relative imports, which plain Node can't resolve — the SDK itself only runs under bundlers. Jest with babel-jest is the validated path; Vitest should work through Vite's resolver but we haven't validated it.

## Writing fixture data

`FixtureData` describes the simulated base: tables, fields, records, and optional environment state. Cell values use the SDK's internal format, keyed by field id. The first field of each table becomes its primary field.

```ts
const fixtureData: FixtureData = {
    base: {
        id: 'appTest0000000000',
        name: 'Todo base',
        tables: [
            {
                id: 'tblTasks000000000',
                name: 'Tasks',
                fields: [
                    {id: 'fldName0000000000', name: 'Name', type: 'singleLineText'},
                    {id: 'fldDone0000000000', name: 'Done', type: 'checkbox'},
                ],
                records: [
                    {
                        id: 'recOne00000000000',
                        cellValuesByFieldId: {
                            fldName0000000000: 'Buy groceries',
                            fldDone0000000000: false,
                        },
                    },
                ],
            },
        ],
    },
    globalConfig: {doneField: 'fldDone0000000000'},
    searchParams: {filter: 'open'},
    runContext: {isPageElementInEditMode: false},
};
```

**base.collaborators ---** optional; the first entry becomes the current user. Defaults to a single active "Test User".

**globalConfig ---** initial key-value contents. Custom property values live here too, keyed by the property's `key`.

**searchParams ---** what `useSearchParams` returns initially.

**runContext ---** set `isPageElementInEditMode: true` to simulate the interface designer's edit mode, and `pageId` to control the page id.

Rather than hand-writing fixtures for a real base, generate them: the [fixture-generator CLI](../fixture-generator) exports schema and records through the Airtable REST API and lets you pick which tables and fields to include.

## Interacting with the simulated base

Your test drives the extension two ways.

**As the user ---** render inside `testDriver.Container` and interact with the DOM via Testing Library. The extension's hooks (`useBase`, `useRecords`, `useGlobalConfig`, `useSearchParams`, `useCustomProperties`, …) see the simulated base and re-render on changes.

**As the backend or another collaborator ---** use the real SDK models on the driver. `testDriver.base` is the same `Base` instance the extension observes, so writes propagate into the rendered UI:

```ts
await testDriver.base.getTableByName('Tasks').createRecordAsync({fldName0000000000: 'New'});
await testDriver.globalConfig.setAsync('doneField', 'fldOther000000000');
```

## TestDriver API

### State

**`base`, `session`, `globalConfig` ---** the real SDK model instances backing the simulation.

**`searchParams` ---** the current search params object.

**`customProperties` ---** the most recent custom-property definitions the extension registered through `useCustomProperties`, or `null`. Useful for asserting what appears in the designer's properties panel (labels, types, filtered `possibleValues`).

**`airtableInterface` ---** the mock host itself; an escape hatch when no dedicated method exists.

### Simulation methods

**`simulatePermissionCheck(check)` ---** decide mutation permissions. Return `false` to deny; denied mutations make SDK write methods throw, and permission helpers such as `table.hasPermissionToCreateRecord()` reflect the outcome.

**`simulateSearchParamsUpdate(params)` ---** the host pushes new search params (e.g. the interface URL changed).

**`simulateCustomPropertyValueChange(key, value)` ---** a builder edits a custom property in the designer. Sugar for a globalConfig update, which is where property values are stored.

**`simulateGlobalConfigUpdate(updates)` ---** the host applies raw globalConfig updates (another collaborator changed settings).

**`simulateSubElementSelection(id)` ---** the host changes the selected sub-element in edit mode.

**`simulateForeignRecords(handler)` ---** answer linked-record searches (`fetchForeignRecordsAsync`).

**`triggerModelUpdates(changes)` ---** apply raw host-side model changes (paths relative to the base data). The escape hatch for anything without a dedicated method.

### Events

**`watch(key, fn)` / `unwatch(key, fn)` ---** subscribe to environment events:

| Event | Fires when |
|---|---|
| `mutation` | the SDK persists any change (see `MutationTypes`: cell values, record create/delete, globalConfig) |
| `expandRecord` | the extension calls `expandRecord(record)` |
| `setCustomProperties` | the extension registers custom properties |
| `setSearchParams` | the extension writes search params |
| `setSelectedSubElement` | the extension selects a sub-element |

## What changed from v1 blocks-testing

Record and globalConfig testing carry over almost unchanged — you drive writes through the SDK's public API and observe `mutation` events. The differences come from the interface SDK itself.

**Gone with the platform ---** interface extensions have no views, cursor, or viewport, so `deleteViewAsync`, `setActiveCursorModels`, `userSelectRecords`, `simulateExpandedRecordSelection`, `expandRecordList`/`expandRecordPickerAsync`, fullscreen, settings-button, and `performRecordAction` testing APIs have no equivalent. Schema mutations (`deleteTable`, `deleteFieldAsync`) are gone too — the interface SDK has no schema-writing API to test.

**New here ---** search params, custom properties, edit mode/sub-element selection, and linked-record search simulation, plus the `expandRecord` event now carrying `tableId`.

**Fixture format ---** tables no longer take `views`; `createdTime` on records is optional; collaborators are optional; `searchParams` and `runContext` are new.

## Troubleshooting

**"attempted to communicate with the host application outside of a simulated environment" ---** your extension rendered (or called SDK functions) outside `testDriver.Container`. Wrap the render, and access state through the driver.

**`ERR_PACKAGE_PATH_NOT_EXPORTED` or missing-module errors mentioning `dist/esm` ---** the installed `@airtable/blocks` isn't an interface-alpha build. Install `@airtable/blocks@interface-alpha-next`.

**`SyntaxError: Cannot use import statement outside a module` pointing into `@airtable/blocks` ---** Jest isn't transforming the SDK; check `transformIgnorePatterns`.

**Hooks throw "This component can only be used in a block" ---** the component using SDK hooks isn't under `testDriver.Container`, or two copies of `@airtable/blocks` are installed (check `npm ls @airtable/blocks`).
