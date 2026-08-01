/**
 * Testing library for Airtable interface extensions (the interface-alpha
 * Blocks SDK). See the package README for usage.
 */
// This import's side effect installs `window.__getAirtableInterfaceAtVersion`
// and must precede any `@airtable/blocks/interface/*` evaluation. If your
// test files import the SDK (or modules that import it) before this library,
// add '@usdr/airtable-interface-testing/inject' to Jest's `setupFiles`.
import './inject';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {spawnError} from './error_utils';
import {sdkInternalPaths, sdkPackageRoot} from './sdk_internals';
import {TestDriver} from './test_driver';

for (const relativePath of Object.values(sdkInternalPaths)) {
    /* istanbul ignore next */
    if (!fs.existsSync(path.join(sdkPackageRoot, relativePath))) {
        throw spawnError(
            'The installed @airtable/blocks package (%s) is missing %s. This ' +
                'testing library supports the interface-alpha builds of the SDK ' +
                '(`npm install --save-dev @airtable/blocks@interface-alpha`).',
            sdkPackageRoot,
            relativePath,
        );
    }
}

export default TestDriver;
export {TestDriver};
export {MutationTypes, type MutationType} from './mutation_types';
export {
    type FixtureData,
    type TableFixtureData,
    type FieldFixtureData,
    type RecordFixtureData,
} from './fixture_data';
export {
    MockAirtableInterface,
    type ForeignRecordsHandler,
    type WatchableKeysAndArgs,
} from './mock_airtable_interface';
export {
    type CollaboratorData,
    type CustomPropertyForAirtableInterface,
    type GlobalConfigUpdate,
    type GlobalConfigValue,
    type ModelChange,
    type Mutation,
    type PermissionCheckResult,
} from './sdk_types';
