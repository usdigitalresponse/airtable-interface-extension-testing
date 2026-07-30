# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repository.

## Maintenance rules for this file

**Keep this file current as part of every change — not as a follow-up.** Before finishing any task that changes code, configuration, or architecture:

1. Update the **Work log** below with a one-line entry (date, what changed, why).
2. If the change alters an invariant, dependency, or command documented here, update that section in the same commit.
3. If the change affects user-facing behavior, update the matching docs (`docs/`, package READMEs) in the same commit as well — stale docs are treated as bugs.

Treat an out-of-date CLAUDE.md the same as a failing test: the task isn't done until it's fixed.

## Git workflow

**Do not commit.** When work is done, run the checks (`npm run lint`, `npm test`), update this file and any affected docs, then tell the user the change is ready for review — they review and commit themselves. Where this file says "in the same commit", read it as "in the same change set you hand over".

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:`, `chore:`, …), enforced by commitlint via a husky `commit-msg` hook; a husky `pre-commit` hook runs lint and the full test suite. If asked to draft a commit message, make it conventional-commits compliant.

## What this repo is

A testing library and fixture tooling for Airtable **interface extensions** (the `interface-alpha` branch of the Blocks SDK), providing what `@airtable/blocks-testing` provided for v1 extensions. See [README.md](README.md), [docs/getting-started.md](docs/getting-started.md), and [docs/api.md](docs/api.md).

npm workspaces monorepo:

- `packages/testing` — `@usdr/airtable-interface-testing`: the `TestDriver` library.
- `packages/fixture-generator` — `@usdr/airtable-interface-testing-fixtures`: CLI that exports a real base to fixture files via the Airtable REST API.
- `examples/todo-list` — example extension + consumer-style Jest suite; doubles as integration test and documentation.
- `_blocks/` (gitignored) — reference checkouts of the `v1` and `interface-alpha` branches of Airtable/blocks. Read-only reference; never a build input.

## Commands

- `npm install` — bootstrap all workspaces (re-run after adding a workspace bin; bins only link if their dist file exists).
- `npm run build` — tsup builds both packages **in dependency order**, which the root script spells out explicitly (`-w testing && -w fixture-generator`). Don't switch it back to `--workspaces`: npm runs workspaces in listed/glob order, not topological order, and the fixture generator's declaration build imports `FixtureData` from the testing package's built `dist/index.d.ts`. Building out of order fails with `TS2307: Cannot find module '@usdr/airtable-interface-testing'` — only on clean checkouts (CI), since a stale local `dist/` hides it. Build before running the testing package's dist smoke test or the CLI.
- `npm test` — every workspace's Jest suite. All suites must pass before committing.
- `npm run pack:release` — builds, then packs both tarballs into `release/` (gitignored). Always pack through this script: `npm pack` alone ships whatever stale `dist/` happens to be on disk.
- `npm run lint` — ESLint over all TypeScript sources (flat config in `eslint.config.mjs`; `.js`/`.cjs`/`.mjs` tool configs and generated `fixtures/` are ignored).
- **Build before test.** `npm test` requires a prior `npm run build`: the examples workspace resolves the testing package's Jest preset out of `dist/`, and the dist smoke test needs the built artifact. CI (`.github/workflows/ci.yml`) runs lint → build → test in that order on every PR and on pushes to `main`, across Node 20.19 and 22.
- `npx tsc` inside a workspace — type check (no emit).

## Architecture invariants (violating these breaks everything)

1. **Inject before SDK import.** The interface-alpha SDK constructs a singleton from `window.__getAirtableInterfaceAtVersion` at module load. `packages/testing/src/inject.ts` must run first — via the library index's side-effect import or Jest `setupFiles`. Never reorder imports in `src/index.ts` so that something evaluates SDK modules before `./inject`.
2. **SDK internals via absolute-path require.** `src/sdk_internals.ts` resolves `@airtable/blocks/package.json` and loads three non-exported dist files (`interface/sdk.js`, `interface/ui/block_wrapper.js`, `testing/interface/abstract_mock_airtable_interface.js`). Module identity with the consumer's SDK imports is load-bearing (React context). Under CJS transforms use the ambient `require` (Jest registry); under real ESM use `createRequire` (`require(esm)` shares Node's cache). Don't "simplify" this to a normal import — the SDK's exports map blocks it.
3. **`sdk.base._baseData` aliases `mock.sdkInitData.baseData`.** The SDK does not clone base data. The mock reads its own `sdkInitData` as current truth (it includes optimistic updates the SDK already applied) and must not clone it per-operation.
4. **The SDK applies mutations optimistically itself.** The mock's `applyMutationAsync` only does host-side follow-up: append `recordOrder` + active `dynamicQueriesByKey` result sets on create, sync query result sets on delete, and emit the `mutation` event. Don't re-apply cell values or globalConfig there.
5. **`useRecords` reads `dynamicQueriesByKey[poolKey].recordOrder`,** populated by the mock's `loadDynamicQueryAsync`. Records missing from a query's `recordOrder` don't render, whatever `recordsById` says.
6. **Vendored types mirror SDK internals.** `src/sdk_types.ts` structurally copies non-exported SDK types; each carries a comment naming its SDK source file. When bumping the pinned SDK build, re-verify them against `_blocks/interface-alpha/packages/sdk/src/`.

## Known constraints

- Pinned/validated SDK build: `@airtable/blocks@interface-alpha-next` = `0.0.0-experimental-dc9f9a979-20260605`. A new experimental build can move internals; the library fails loudly at import if the dist files vanish. Update the README's validated-version note when bumping.
- The SDK's published ESM uses extensionless relative imports → **only runs under a transforming runner** (Jest+babel validated; Vitest plausible, unvalidated; plain Node impossible). Don't chase plain-Node support.
- Consumers use the bundled Jest preset (`packages/testing/jest-preset.cjs`, exported as `./jest-preset`): jsdom + inject setupFile + hermetic babel transform allowed to transform the ESM-only SDK + jest-dom. The toolchain (jest, babel, testing-library) ships in the testing package's `dependencies`; react/react-dom/@airtable/blocks stay peers. The examples workspace proves the preset. The testing package's OWN jest config stays hand-rolled because its tests run against `src/` and need `babel-plugin-transform-import-meta`; consumers of the built dist don't.
- Neither package is on npm. Distribution is GitHub Release tarballs, because npm cannot install a workspace subdirectory from a git URL and GitHub Packages would force every consumer to authenticate. Inside this repo the CLI bin resolves via `npx`; elsewhere, install the fixtures tarball.
- **Release automation.** `tag-on-merge.yml` runs on pushes to `main`: it reads the version from `packages/testing/package.json`, skips if that tag already exists (so ordinary merges are no-ops), otherwise tags the commit and **calls `release.yml` directly via `workflow_call`**. That direct call is load-bearing: a tag pushed with `GITHUB_TOKEN` does not trigger the `push: tags` event, so relying on the tag alone would silently never release. `release.yml` resolves its tag as `inputs.tag || github.ref_name`, covering workflow_call, workflow_dispatch, and manual tag pushes alike. Keep both package versions in lockstep — the release job fails if either disagrees with the tag.
- `packages/fixture-generator` keeps `@usdr/airtable-interface-testing` as a **dev**Dependency even though its public `.d.ts` references it: promoting it to a real dependency would make npm try to resolve `@usdr/airtable-interface-testing@*` from the npm registry, where it doesn't exist, breaking installs of the fixtures tarball. Revisit if these are ever published properly.
- Test base for live checks: `appSvvjTxODMEYhuP` (Tasks table shaped for the example extension).

## Coding rules

Security rules adapted from [TikiTribe/claude-secure-coding-rules](https://github.com/TikiTribe/claude-secure-coding-rules) live in [.claude/rules/security.md](.claude/rules/security.md). Read and follow them when writing or reviewing code in this repo. Style: 4-space indent, single quotes, ES modules, TypeScript strict; prose in Kevin's voice per the user-level CLAUDE.md.

## Work log

- **2026-07-23** — Releases now trigger on merge: `.github/workflows/tag-on-merge.yml` tags `main` with the version from `packages/testing/package.json` (no-op when that tag exists) and invokes `release.yml`, which gained a `workflow_call` trigger. Documented the GITHUB_TOKEN-doesn't-trigger-workflows constraint that forces the direct call.
- **2026-07-23** — Added the release process: root `pack:release` script (build → mkdir → pack both packages into `release/`) and `.github/workflows/release.yml`, which on a `v*` tag verifies the tag matches both package versions, runs lint/build/test, packs, and publishes a GitHub Release with the tarballs attached. Consumer install instructions (release URLs and how to find them) added to the root README, both package READMEs, and docs/getting-started.md; maintainer release steps in the root README.
- **2026-07-23** — Fixed the CI build failure: the root `build` script now builds the testing package before the fixture generator explicitly, instead of relying on `--workspaces` ordering (see Commands). Verification lesson: check build exit codes directly — piping the build through `grep -c "Build success"` masked the non-zero status and made a clean-clone check look green.
- **2026-07-23** — Added `.github/workflows/ci.yml`: on PRs and pushes to `main`, runs `npm ci` → lint → build → test on Node 20.19 and 22, with concurrency cancellation and read-only permissions. Verified the whole sequence from a clean clone. Fixed `dist_smoke.test.tsx`: its `describe.skip` guard didn't work because Jest evaluates a skipped describe's body, so the top-level `require` of `dist/` threw instead of skipping — the require is now lazy inside the test.
- **2026-07-23** — Added husky (pre-commit: `npm run lint` + `npm test`; commit-msg: commitlint with `@commitlint/config-conventional`) and ESLint (flat config, typescript-eslint, TS-only scope). Fixed the handful of violations it surfaced. New policy recorded above: Claude reports work as ready for review instead of committing.
- **2026-07-23** — Restructured docs/getting-started.md "Write your first test" into the four-step progressive pattern from Airtable's v1 automated-testing guide (driver from fixture → render → input as user / as host → verify in UI / via watch), absorbing the old "Simulate the environment" section into step 3.
- **2026-07-23** — Token resolution moved to `token.ts` as injectable `resolveTokenAsync` with the no-cache guarantee made explicit and tested: `--token` and `AIRTABLE_TOKEN` are never written to `~/.airtable-testing` (CI use); only interactively entered tokens are cached. Precedence flag > env > cache > prompt. Docs updated.

- **2026-07-22** — Repo created. Spike proved SDK-internals access + context identity under Jest against the published `interface-alpha-next` tarball. Ported v1 blocks-testing to interface mode (`TestDriver`, mock host, fixtures, vacant-interface injection); added interface-only simulations (search params, custom properties, sub-element selection, foreign records). tsup dual ESM/CJS build with dist smoke test. Example todo-list extension with 9-test consumer suite. Fixture-generator CLI (REST schema+data APIs, PAT cached in `~/.airtable-testing`, interactive table/field selection, select/linked-record cell-value conversion) with round-trip test. READMEs with v1 parity table. 65 tests green.
- **2026-07-22** — Set up Airtable base `appSvvjTxODMEYhuP` (via MCP) to match the example extension: renamed default table to Tasks, added Done checkbox, seeded 3 sample records. Fixed unlinked CLI bin (`npm install` re-run after build).
- **2026-07-22** — Added CLAUDE.md, `docs/` (getting-started, api), README doc links, and `.claude/rules/security.md` adapted from TikiTribe/claude-secure-coding-rules. Applying those rules surfaced a real gap: `setGlobalConfigValue` now rejects `__proto__`/`constructor`/`prototype` path segments (prototype pollution, CWE-1321), with tests.
- **2026-07-23** — Testing package is now batteries-included: jest/babel/testing-library moved into its `dependencies`, and a Jest preset (`jest-preset.cjs` + `setup_after_env.cjs`) collapses consumer config to `{preset: '@usdr/airtable-interface-testing'}`. Example converted to the preset (dropped its babel config, setup file, and 11 dev deps). Docs updated.
- **2026-07-22** — Fixture generator now anonymizes IDs by default (`src/anonymize.ts`): prefix kept, UpperCamelCase name, 17-char cap, numeric suffix on collision; rewrites all cross-references (cell-value keys, select/linked-record ids, linkedTableId). `--keep-ids` opts out. `fixtures/live-smoke.ts` regenerated in anonymized form.
