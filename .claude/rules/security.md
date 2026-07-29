# Security rules for this repository

Adapted from [TikiTribe/claude-secure-coding-rules](https://github.com/TikiTribe/claude-secure-coding-rules) (MIT). We scanned the full rule set and kept what applies to this repo — a TypeScript/React testing library and a Node CLI that talks to the Airtable REST API. Rules for backends, sessions/auth, SQL, containers, IaC, and AI/RAG systems were omitted as not applicable. Levels follow the source convention: `strict` rules must not be violated; `warning` rules need a stated justification.

Source rule sets drawn from: `rules/_core/owasp-2025.md`, `rules/languages/typescript/CLAUDE.md`, `rules/languages/javascript/CLAUDE.md`, `rules/frontend/react/CLAUDE.md`.

## TypeScript

### Keep strict compiler configuration — `warning`

`tsconfig.base.json` sets `strict: true`; never weaken it (`noImplicitAny: false`, `strictNullChecks: false`, per-file `// @ts-nocheck`) to silence an error. Fix the type instead. (CWE-704)

### Validate external data at runtime — `strict`

TypeScript types are erased at runtime; data from the Airtable REST API, the token cache file, `process.env`, and CLI arguments must be checked before use, not just cast. `packages/fixture-generator/src/token.ts` (parse + shape check) and `airtable_api.ts` (status checks before `.json()`) are the pattern to follow. Never `as T` an untrusted payload and pass it on — narrow it or validate it. (CWE-20, CWE-843)

**Repo-specific carve-out ---** `packages/testing/src/sdk_internals.ts` intentionally types runtime-loaded SDK internals via structural interfaces; that's trusted first-party SDK code loaded from `node_modules`, not external data. Keep the structural types honest (see CLAUDE.md invariant 6) rather than widening to `any`.

## JavaScript / Node

### Never use eval or its equivalents — `strict`

No `eval()`, `new Function()`, `setTimeout(string)`, or dynamic `import()` of user-derived specifiers — including in generated fixture modules, which must be built by `JSON.stringify`, never by string-concatenating user data into code positions. (CWE-95)

### Guard against prototype pollution — `strict`

Code that walks user-supplied paths into objects must reject `__proto__`, `constructor`, and `prototype` as keys. This is live here: `setGlobalConfigValue` in `packages/testing/src/private_utils.ts` walks globalConfig paths, and the fixture generator builds objects keyed by API-supplied ids. Use `Object.create(null)` or key validation for dictionaries built from external keys. (CWE-1321)

### Validate file paths from user input — `strict`

The CLI writes to `--out` and reads the token cache. Resolve paths with `path.resolve` and never concatenate user input into paths that are then trusted to stay inside a directory. If a future feature writes into a directory the user didn't name explicitly, verify the resolved path stays within it (`path.relative` check). (CWE-22)

### No shelling out with interpolated input — `strict`

Nothing in this repo spawns processes today. If that changes, use `execFile`/`spawn` with an argument array — never `exec` with an interpolated string. (CWE-78)

## Secrets and tokens

### Never hardcode or log credentials — `strict`

Personal Access Tokens come only from the `--token` flag, `AIRTABLE_TOKEN`, the cache file, or an interactive masked prompt. Never write a token into source, test fixtures, error messages, or console output (the CLI's password prompt uses `mask`). The cache file must keep mode `0600`. Never commit `~/.airtable-testing` contents or real PATs into the repo — tests use obviously-fake `patFakeToken...` strings and a mocked home directory. (CWE-798, CWE-532)

### Keep secrets out of URLs — `strict`

Auth goes in the `Authorization` header (as `airtable_api.ts` does), never in query strings, which end up in logs and histories. (CWE-598)

## HTTP / supply chain

### Only call the fixed Airtable API origin — `strict`

The CLI's network surface is `https://api.airtable.com/v0` and nothing else. Never fetch a URL that arrives from user input or API response content (SSRF). If Airtable pagination ever returns full URLs, validate the origin before following. (CWE-918)

### Pin and audit dependencies — `warning`

Keep `package-lock.json` committed; install with the lockfile in CI. Run `npm audit` when adding or upgrading dependencies and address high/critical findings before merging. The `@airtable/blocks` dependency is deliberately pinned to a dist-tag with a recorded validated version (see CLAUDE.md); record the new version whenever it's bumped. (CWE-829, CWE-1357)

## React (example extension and any future components)

### No dangerouslySetInnerHTML with external data — `strict`

Cell values in a real base are user-controlled data. Render them as text (React escapes by default), never via `dangerouslySetInnerHTML`. If rich rendering is ever needed, sanitize with DOMPurify first. (CWE-79)

### Validate URLs before using them in href/src — `strict`

If a component ever renders a link or image from cell values (url/attachment fields), allow only `http:`/`https:` schemes — `javascript:` URLs in `href` execute. (CWE-79)

### Don't put sensitive values in client state — `warning`

Extensions run in the user's browser; anything in globalConfig, custom properties, or component state is visible to every collaborator. The docs already warn that interface extensions cannot hold third-party credentials securely — never design example code that stores tokens in globalConfig.
