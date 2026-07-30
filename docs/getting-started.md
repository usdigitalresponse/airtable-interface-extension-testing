# Getting started

When building an [Airtable Interface Extension](https://airtable.com/developers/interface-extensions) with any complexity, it is best practice to use automated and unit testing within your codebase. Jest unit testing can only go so far though, and it is very difficult to implement a traditional Cypress end-to-end test in Airtable.

This project provides a separate [Jest test environment](https://jestjs.io/docs/test-environment) that simulates an Airtable base. Your code runs within that environment against a static fixture that represents the schema and records of a sample base.

You should be familiar with [Testing Library](https://testing-library.com/) to write your tests.

For a live example, check out the [Example extension](../examples/todo-list).

## Install

This package isn't on npm yet — we publish tarballs on [GitHub Releases](https://github.com/usdigitalresponse/airtable-interface-extension-testing/releases) instead. After setting up your Airtable project, install the latest release:

```bash
npm install --save-dev https://github.com/usdigitalresponse/airtable-interface-extension-testing/releases/download/v0.1.0/usdr-airtable-interface-testing-0.1.0.tgz
```

**Finding the URL ---** open the [releases page](https://github.com/usdigitalresponse/airtable-interface-extension-testing/releases), pick a release, and look under **Assets**. Copy the link address of `usdr-airtable-interface-testing-<version>.tgz` — that's the URL you pass to `npm install`. The URLs always follow the same pattern, so you can also just edit the version in the command above:

```
https://github.com/usdigitalresponse/airtable-interface-extension-testing/releases/download/v<version>/usdr-airtable-interface-testing-<version>.tgz
```

npm records the URL in your lockfile, so installs stay reproducible. To upgrade later, install the newer URL the same way.

The testing toolchain (Jest, jsdom, babel, and Testing Library) comes along as dependencies of this package. `@airtable/blocks`, `react`, and `react-dom` are peer dependencies your extension project already has.

## Configure Jest

Create `jest.config.js` with one line:

```js
export default {
  preset: "@usdr/airtable-interface-testing",
};
```

Feel free to add any additional Jest configuration values.

## Structure your extension for testability

You will want to have a separate file that exports your app. Unlike the [Hello World example](https://github.com/Airtable/interface-extensions-hello-world-typescript/blob/main/frontend/index.tsx), you should export your app as a component, then import it into your app's index file like this:

```tsx
// src/index.tsx — the only file tests never import
import { initializeBlock } from "@airtable/blocks/interface/ui";
import { MyApp } from "./app";

initializeBlock({ interface: () => <MyApp /> });
```

This way the test environment can load your app without the default `initializeBlock` wrapper.

## Generate fixture data

You can write [`FixtureData`](api.md#fixturedata) by hand, but generating it from a real base is faster and less error-prone:

```bash
npx airtable-testing-fixtures --base appXXXXXXXXXXXXXX --out test/fixtures/my-base.ts
```

The first run prompts for a [Personal Access Token](https://airtable.com/create/tokens) with the `schema.bases:read` and `data.records:read` scopes, then walks you through selecting tables and fields. See the [generator README](../packages/fixture-generator/README.md) for flags and conversion details.

**Note:** The token is cached in a file located in `~/.airtable-testing`. If you are testing within a CI environment, or just don't want to save the token, you can use:

```bash
npx airtable-testing-fixtures --base appXXXXXXXXXXXXXX --out test/fixtures/my-base.ts --token pat123.456
```

## Write your first test

Every test follows the same four-step pattern: create a test driver from fixture data, render the extension, provide input, and verify the expected behavior. We'll build one test step by step, then put it all together.

### 1. Create a test driver with fixture data

Each test starts by instantiating a `TestDriver` with fixture data. We suggest saving this as a single file for resuse.

```tsx
import TestDriver from "@usdr/airtable-interface-testing";
import fixtureData from "./fixtures/my-base";

const testDriver = new TestDriver(fixtureData);
export testDriver
```

### 2. Render the extension

Render your extension's component as a child of the driver's `Container` component:

```tsx
import { render } from "@testing-library/react";
import { MyApp } from "../src/app";
import testDriver from "../test/test-driver";

render(
  <testDriver.Container>
    <MyApp />
  </testDriver.Container>,
);
```

### 3. Provide input

You can provide input in two ways: as a user interaction, or simulating a change in the base itself.

Simulate interactions with the rendered UI using `@testing-library/user-event`, which ships with the testing package:

```tsx
import userEvent from "@testing-library/user-event";

await userEvent.type(screen.getByLabelText("New task name"), "Water plants");
await userEvent.click(screen.getByRole("button", { name: "Add task" }));
```

You can also simulate backend behavior with the real SDK models on the driver, or with its `simulate*` methods. Wrap calls made after the initial render in `act(...)` so React processes the resulting re-renders. This is useful to simulate, say, a record is updated by another user.

```tsx
import { act } from "@testing-library/react";

// Another collaborator edits a record: the UI re-renders.
await act(async () => {
  await testDriver.base
    .getTableByName("Tasks")
    .updateRecordAsync(recordId, { [DONE_FIELD_ID]: true });
});

// The interface URL changes.
act(() => {
  testDriver.simulateSearchParamsUpdate({ filter: "done" });
});

// A builder edits a custom property in the designer panel.
act(() => {
  testDriver.simulateCustomPropertyValueChange("title", "Sprint board");
});

// The user loses permission to create records.
testDriver.simulatePermissionCheck(
  (mutation) => mutation.type !== MutationTypes.CREATE_MULTIPLE_RECORDS,
);
```

### 4. Verify expected behavior

You can check that changes were made in the UI using `@testing-library/react`:

```tsx
import { screen } from "@testing-library/react";

expect(await screen.findByText("Water plants")).toBeInTheDocument();
```

**Note:** the first render of a component using `useRecords` suspends while the simulated query loads, so use `await screen.findByText(...)` and not `getByText`.

Some behaviors don't change the UI: writing records, expanding a record, registering custom properties. Track those with the driver's [watch API](api.md#events), registering the handler before the input that triggers it:

```tsx
import { MutationTypes } from "@usdr/airtable-interface-testing";

const mutations = [];
testDriver.watch("mutation", (mutation) => mutations.push(mutation));

// ...provide input, then:
expect(mutations[0].type).toBe(MutationTypes.CREATE_MULTIPLE_RECORDS);
```

### Putting it together

```tsx
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TestDriver, { MutationTypes } from "@usdr/airtable-interface-testing";
import { MyApp } from "../src/app";
import fixtureData from "./fixtures/my-base";

test("shows records and creates new ones", async () => {
  // 1. Create a test driver with fixture data.
  const testDriver = new TestDriver(fixtureData);

  // 2. Render the extension.
  render(
    <testDriver.Container>
      <MyApp />
    </testDriver.Container>,
  );
  expect(await screen.findByText("Buy groceries")).toBeInTheDocument();

  // 4 (setup). Watch what the extension writes back.
  const mutations = [];
  testDriver.watch("mutation", (mutation) => mutations.push(mutation));

  // 3. Provide input as the user.
  await userEvent.type(screen.getByLabelText("New task name"), "Water plants");
  await userEvent.click(screen.getByRole("button", { name: "Add task" }));

  // 4. Verify the behavior — in the UI and outside it.
  expect(await screen.findByText("Water plants")).toBeInTheDocument();
  expect(mutations[0].type).toBe(MutationTypes.CREATE_MULTIPLE_RECORDS);
});
```
