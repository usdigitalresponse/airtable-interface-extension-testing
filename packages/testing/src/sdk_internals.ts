/**
 * Access to interface-mode SDK modules that ship in `@airtable/blocks`'s
 * `dist/` but are not listed in its `exports` map (only `./base/*`,
 * `./interface/models`, `./interface/ui`, and the base-mode testing utils
 * are). We resolve the package root through `./package.json` (which IS
 * exported) and load the files by absolute path, which bypasses the exports
 * map in every resolver we care about.
 *
 * Module identity is preserved in both runtimes that matter:
 * - Under Jest (babel CJS transform), the ambient `require` is Jest's, so
 *   these loads share Jest's module registry with the consumer's own
 *   `import '@airtable/blocks/interface/ui'` — critical because BlockWrapper
 *   must provide the exact SdkContext instance the hooks read.
 * - Under real Node ESM/CJS, `createRequire`'s require(esm) shares Node's ESM
 *   module cache with `import` (Node >= 20.19).
 */
import {createRequire} from 'node:module';
import * as path from 'node:path';
import {type ReactNode} from 'react';
import {spawnError} from './error_utils';
import {
    type GlobalConfigUpdate,
    type ModelChange,
    type Mutation,
    type PermissionCheckResult,
    type SdkInitData,
} from './sdk_types';

// Prefer __filename (defined in every CJS context, including Jest and our CJS
// dist; tsup's ESM shims also provide it) over import.meta.url — under jsdom,
// CJS shims can resolve import.meta.url to an http:// URL that createRequire
// rejects.
const nodeRequire = createRequire(
    typeof __filename !== 'undefined' ? __filename : import.meta.url,
);

let sdkRoot: string;
try {
    sdkRoot = path.dirname(nodeRequire.resolve('@airtable/blocks/package.json'));
} catch {
    throw spawnError(
        '@airtable/blocks could not be resolved. Install the interface-alpha ' +
            'build of the SDK, e.g. `npm install --save-dev @airtable/blocks@interface-alpha-next`.',
    );
}

function loadSdkModule(relativePath: string): any {
    const absolutePath = path.join(sdkRoot, relativePath);
    try {
        // Under a CJS transform (Jest, or our own CJS dist), the ambient
        // `require` shares module-registry identity with regular imports; use
        // it when it's a real require (bundlers' ESM shims inject a fake
        // `require` without `.resolve` that throws on every call). Otherwise
        // fall back to Node's own require, whose require(esm) shares Node's
        // ESM module cache with `import`.
        if (typeof require === 'function' && typeof require.resolve === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-require-imports -- ambient CJS require is required for Jest module-registry identity (see comment above)
            return require(absolutePath);
        }
        return nodeRequire(absolutePath);
    } catch (error) {
        throw spawnError(
            'Failed to load %s from the installed @airtable/blocks package (%s). ' +
                'This testing library requires the interface-alpha build of the SDK ' +
                '(`npm install --save-dev @airtable/blocks@interface-alpha-next`). ' +
                'Original error: %s',
            relativePath,
            sdkRoot,
            error instanceof Error ? error.message : String(error),
        );
    }
}

/** Absolute path of the installed `@airtable/blocks` package. Exposed for diagnostics. */
export const sdkPackageRoot = sdkRoot;

/** The internal SDK files this library depends on. */
export const sdkInternalPaths = {
    interfaceSdk: 'dist/esm/interface/sdk.js',
    blockWrapper: 'dist/esm/interface/ui/block_wrapper.js',
    abstractMockAirtableInterface: 'dist/esm/testing/interface/abstract_mock_airtable_interface.js',
    sdkContext: 'dist/esm/shared/ui/sdk_context.js',
} as const;

/**
 * Structural type for the SDK's interface-mode
 * `AbstractMockAirtableInterface` (src/testing/interface/
 * abstract_mock_airtable_interface.ts): an EventEmitter implementing the
 * interface-mode AirtableInterface with mostly-stub behavior. Only the
 * members this library relies on are declared.
 */
export interface AbstractMockAirtableInterfaceInstance {
    sdkInitData: SdkInitData;
    reset(): void;
    readonly fieldTypeProvider: any;
    readonly urlConstructor: any;
    readonly globalConfigHelpers: any;
    readonly idGenerator: any;
    assertAllowedSdkPackageVersion(): void;
    applyMutationAsync(mutation: Mutation, opts?: {holdForMs?: number}): Promise<void>;
    checkPermissionsForMutation(mutation: Mutation): PermissionCheckResult;
    subscribeToModelUpdates(fn: (data: {changes: ReadonlyArray<ModelChange>}) => void): void;
    subscribeToGlobalConfigUpdates(
        fn: (data: {updates: ReadonlyArray<GlobalConfigUpdate>}) => void,
    ): void;
    subscribeToSearchParamsUpdates(
        fn: (data: {searchParams: Record<string, string>}) => void,
    ): void;
    triggerModelUpdates(changes: ReadonlyArray<ModelChange>): void;
    triggerGlobalConfigUpdates(updates: ReadonlyArray<GlobalConfigUpdate>): void;
    // EventEmitter members (the abstract class extends node:events EventEmitter).
    emit(eventName: string, ...args: Array<unknown>): boolean;
    on(eventName: string, listener: (...args: Array<any>) => void): unknown;
    off(eventName: string, listener: (...args: Array<any>) => void): unknown;
    removeAllListeners(eventName?: string): unknown;
}

/** Construct signature for {@link AbstractMockAirtableInterfaceInstance}. */
export interface AbstractMockAirtableInterfaceConstructor {
    new (initData: SdkInitData): AbstractMockAirtableInterfaceInstance;
}

/**
 * Structural type for the SDK's `InterfaceBlockSdk` (src/interface/sdk.ts).
 * Only the members this library relies on are declared; `base`, `session`,
 * and `globalConfig` are the real SDK models.
 */
export interface InterfaceBlockSdkInstance {
    base: any;
    session: any;
    globalConfig: {
        get(key: string | ReadonlyArray<string>): unknown;
        setAsync(key: string | ReadonlyArray<string>, value?: unknown): Promise<void>;
        setPathsAsync(
            updates: Array<{path: ReadonlyArray<string>; value: unknown}>,
        ): Promise<void>;
        [key: string]: any;
    };
    installationId: string;
    runInfo: {isFirstRun: boolean; isDevelopmentMode: boolean; intentData: unknown};
    _searchParams: {
        getSearchParams(): Record<string, string>;
        setSearchParamsAsync(searchParams: Record<string, string>): Promise<boolean>;
    };
    [key: string]: any;
}

/** Construct signature for {@link InterfaceBlockSdkInstance}. */
export interface InterfaceBlockSdkConstructor {
    new (airtableInterface: AbstractMockAirtableInterfaceInstance): InterfaceBlockSdkInstance;
}

export const InterfaceBlockSdk: InterfaceBlockSdkConstructor = loadSdkModule(
    sdkInternalPaths.interfaceSdk,
).InterfaceBlockSdk;

export const BlockWrapper: (props: {
    sdk: InterfaceBlockSdkInstance;
    children: ReactNode;
}) => ReactNode = loadSdkModule(sdkInternalPaths.blockWrapper).BlockWrapper;

export const AbstractMockAirtableInterface: AbstractMockAirtableInterfaceConstructor =
    loadSdkModule(sdkInternalPaths.abstractMockAirtableInterface).AbstractMockAirtableInterface;
