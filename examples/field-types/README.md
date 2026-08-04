# Field types example

A workbench extension covering **every [FieldType](https://airtable.com/developers/interface-extensions/api/FieldType)**, used as a smoke test for all cell value formats. If you want to know what a given field type's cell value looks like — or how to write one back — this example is the reference.

The app lists every record of every table in the base and renders a type-appropriate editor for each field: text inputs for the string family (committing on blur), selects and checkbox groups for choices, cross-table checkboxes for record links, an append-by-URL control for attachments, and plain text for the read-only computed types (formula, rollup, count, lookups, barcode, button, and the created/modified metadata fields).

Two suites keep it honest:

**[format_coverage.test.tsx](test/format_coverage.test.tsx) ---** iterates the SDK's own `FieldType` enum and asserts the fixture contains every type, and that every cell value read through the real SDK matches that type's documented **cell read format**. If Airtable adds a field type, this suite fails until the fixture covers it — that's the point.

**[app.test.tsx](test/app.test.tsx) ---** renders the UI and edits a representative field of each editable kind, asserting the emitted mutations carry the documented **cell write format** (`{id}` for selects, `Array<{id, name}>` for record links, appended `{url}` for attachments, and so on).

The fixture comes from [fixtures/field-types.ts](../../fixtures/field-types.ts) — generated from a real base holding every field type the Meta API can create — extended in [test/fixtures.ts](test/fixtures.ts) with the eight read-only types the API cannot create (autoNumber, button, createdTime, lastModifiedTime, createdBy, lastModifiedBy, externalSyncSource, aiText).

```bash
npm test
```
