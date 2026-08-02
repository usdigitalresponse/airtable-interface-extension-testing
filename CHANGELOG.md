# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-08-02

### Added

- `examples/field-types`: a workbench extension covering every `FieldType`, with a smoke suite that validates each type's documented cell read format against the SDK and each editor's mutations against the documented write format.
- `fixtures/field-types.ts`: a fixture with every creatable Airtable field type and full option permutations, generated from a real base.
- The fixture generator warns when exporting `multipleLookupValues` fields: the REST API flattens lookups, so the documented `Array<{linkedRecordId, value}>` shape needs hand-editing.

### Fixed

- Reading a `multipleLookupValues` cell no longer throws: fixtures now declare lookups in the SDK's documented read format, and the test driver initializes the SDK accordingly (`isUsingNewLookupCellValueFormat`).

## [0.2.0] - 2026-08-01

### Changed

- Pinned Airtable blocks to "interface-alpha" because that is what most consumers have.

## [0.1.1] - 2026-07-30

### Added

- Release workflow and additional CI testing in PRs.

### Changed

- Edited some getting started docs to clean up examples.

## [0.1.0] - 2025-07-26

### Added

- Initial commit
