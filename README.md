# Airtable interface extension testing

**Please review USDR’s general guidelines for software & data, too: https://policies.usdigitalresponse.org/data-and-software-guidelines**

[![Code of Conduct](https://img.shields.io/badge/%E2%9D%A4-code%20of%20conduct-blue.svg?style=flat)](./CODE_OF_CONDUCT.md)

Airtable's [interface extensions](https://airtable.com/developers/interface-extensions) don't include an automated testing feature. Data extensions [do have some support for automated testing](https://airtable.com/developers/extensions/guides/automated-testing), but the interface-alpha SDK reorganized the package so thoroughly that the old library can't even be imported against it. This repo fills that gap.

You get a `TestDriver` with the same shape as the v1 library — fixture data in, a `Container` to render your extension, simulated mutations and permissions, a watch API — rebuilt on the interface-alpha SDK's internals, plus a CLI that generates fixture data from a real base.

## Documentation

**[Getting started](docs/getting-started.md) ---** from an untested extension to a passing suite: install, Jest configuration, generating fixtures, and your first test.

**[API reference](docs/api.md) ---** every `TestDriver` member, the fixture format, watch events, and the generator CLI's flags.

## What's here

**[packages/testing](packages/testing) ---** `@usdr/airtable-interface-testing`, the testing library. Start with its README for installation, Jest configuration, and the full API.

**[packages/fixture-generator](packages/fixture-generator) ---** `@usdr/airtable-interface-testing-fixtures`, a CLI that exports schema and records from a real base into fixture files, replacing the v1 "Test Fixtures Generator" extension.

**[examples/todo-list](examples/todo-list) ---** a small interface extension with a complete test suite. If you want to see the library in use before reading docs, read [its test file](examples/todo-list/test/app.test.tsx).

## Quick start for working in this project

If you want to work on the actual testing repo itself:

```bash
npm install
npm run build
npm test
```

`npm test` runs every workspace in this monorepo. Run `npm run build` first — the example workspace loads the testing package's Jest preset from its build output.

A husky pre-commit hook runs `npm run lint` and the test suite before each commit, and commit messages follow [Conventional Commits](https://www.conventionalcommits.org), enforced by commitlint. The same lint, build, and test steps run in GitHub Actions on every pull request, against Node 20.19 and 22.
