# @usdr/airtable-interface-testing-fixtures

Generate [`FixtureData`](../testing/README.md#writing-fixture-data) for interface-extension tests from a real Airtable base. This replaces the v1 "Test Fixtures Generator" extension: instead of installing an extension into your base and copy-pasting its output, you run a CLI that reads the base through Airtable's REST APIs and writes a fixture file, letting you choose which tables and fields to export.

## Install

Inside this repo the CLI is already linked, so `npx airtable-testing-fixtures` works from the repo root. From another project, install the tarball attached to a [GitHub Release](https://github.com/usdigitalresponse/airtable-interface-extension-testing/releases) — copy the link to `usdr-airtable-interface-testing-fixtures-<version>.tgz` under **Assets**:

```bash
npm install --save-dev https://github.com/usdigitalresponse/airtable-interface-extension-testing/releases/download/v0.2.0/usdr-airtable-interface-testing-fixtures-0.2.0.tgz
```

## Usage

```bash
npx airtable-testing-fixtures
```

The first run asks for a [Personal Access Token](https://airtable.com/create/tokens) with the `schema.bases:read` and `data.records:read` scopes. The token is cached in `~/.airtable-testing` (file mode 0600) so you only enter it once per machine; `--reset-token` clears the cache.

For CI — or any run where the token shouldn't touch disk — pass it directly with `--token` or the `AIRTABLE_TOKEN` environment variable. Tokens supplied either way are used for that run only and are **never written to the cache file**; only interactively entered tokens are cached. Precedence: `--token`, then `AIRTABLE_TOKEN`, then the cache, then the prompt.

```bash
AIRTABLE_TOKEN="$AIRTABLE_PAT_SECRET" npx airtable-testing-fixtures --base appXXX --all
```

From there the CLI walks you through picking a base, the tables to include, and the fields within each table (the primary field is always included — the fixture format derives it from position). It then fetches records, converts them, and writes a typed TypeScript module you import directly in tests:

```ts
import fixtureData from '../fixtures/my-base';

const testDriver = new TestDriver(fixtureData);
```

**--base appXXXXXXXXXXXXXX ---** skip the base picker.

**--all ---** export every table and field without prompting. Combined with `--base`, the run is fully non-interactive (given a cached token).

**--out path ---** output file; defaults to `fixtures/<base-name>.ts`.

**--json ---** emit plain JSON instead of a TypeScript module.

**--max-records n ---** per-table record cap, default 500. Fixtures are test data — export the records your tests need, not the whole base.

**--keep-ids ---** keep the real Airtable IDs instead of anonymizing them (see below).

## ID anonymization

By default the CLI replaces every real Airtable ID with a readable one derived from the name of the thing it identifies: a base named "Test base name" becomes `appTestBaseName`, a Tasks table becomes `tblTasks`, its Name field `fldName`, a record whose primary cell reads "Buy groceries" becomes `recBuyGroceries`, and a select choice "Todo" becomes `selTodo`. This keeps real base identifiers out of your repo and makes fixtures and test assertions readable.

The rules: the three-letter prefix is kept, the rest is the UpperCamelCase name, and the whole ID is truncated to Airtable's 17-character length. Name collisions get a numeric suffix from the second occurrence on (`fldName`, `fldName2`, …) — field and record IDs are deduplicated across the whole export, choice IDs within their field. Cross-references are rewritten consistently: `cellValuesByFieldId` keys, linked-record and select cell values, and field options that point at other IDs (`linkedTableId`, `inverseLinkFieldId`).

Pass `--keep-ids` when you need fixtures whose IDs match the live base — for example when a test asserts against IDs your extension reads from custom property values configured in the real interface.

## What gets converted

The REST API and the SDK's internal cell-value format agree for most field types, so most values pass through untouched. Two need translation, which the CLI handles using the base schema:

**Selects ---** the REST API returns choice names; the SDK stores choice objects. Names are resolved to `{id, name, color}` via the field's choices.

**Linked records ---** the REST API returns record ids; the SDK stores `{id, name}`. Names are resolved from the linked table's primary field when that table is part of the same export. Export both sides of a link when your extension displays linked record names.

Anything the converter doesn't recognize passes through with a warning naming the table and field, so surprises are visible instead of silent.

**Note:** field type options are stored as-is from the Meta API, which matches what `field.config.options` returns in the simulated environment. Computed fields (formulas, rollups, lookups) export their computed values; the simulation treats them as plain values and won't recompute them when inputs change.
