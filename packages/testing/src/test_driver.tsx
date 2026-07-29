/**
 * The primary public API of this library. Ported from v1 blocks-testing's
 * `test_driver.tsx`, adapted for interface extensions: no views, cursor, or
 * viewport, plus interface-only simulation methods (search params, custom
 * properties, sub-element selection, foreign records).
 */
import * as React from 'react';
import {type FixtureData} from './fixture_data';
import {
    MockAirtableInterface,
    type ForeignRecordsHandler,
    type WatchableKeysAndArgs,
} from './mock_airtable_interface';
import {
    BlockWrapper,
    InterfaceBlockSdk,
    type InterfaceBlockSdkInstance,
} from './sdk_internals';
import {
    type CustomPropertyForAirtableInterface,
    type GlobalConfigUpdate,
    type GlobalConfigValue,
    type ModelChange,
    type Mutation,
} from './sdk_types';

/**
 * A simulated interface-extension environment for automated tests.
 *
 * Construct one per test with {@link FixtureData}, render the extension under
 * test inside {@link TestDriver.Container}, then interact through the real SDK
 * models (`driver.base`, `driver.globalConfig`, …), the simulation methods
 * (`simulate*`), and the {@link TestDriver.watch} event API.
 */
export class TestDriver {
    /** The simulated host. An escape hatch for advanced scenarios. */
    readonly airtableInterface: MockAirtableInterface;
    /** @internal */
    readonly _sdk: InterfaceBlockSdkInstance;

    constructor(fixtureData: FixtureData) {
        this.airtableInterface = new MockAirtableInterface(fixtureData);
        this._sdk = new InterfaceBlockSdk(this.airtableInterface);
        this.Container = this.Container.bind(this);
    }

    /** The simulated {@link Base}. This is the same instance the extension's hooks observe. */
    get base(): any {
        return this._sdk.base;
    }

    /** The simulated {@link Session}. */
    get session(): any {
        return this._sdk.session;
    }

    /** The simulated {@link GlobalConfig}. */
    get globalConfig(): InterfaceBlockSdkInstance['globalConfig'] {
        return this._sdk.globalConfig;
    }

    /** The current search params, as observed by `useSearchParams`. */
    get searchParams(): Record<string, string> {
        return this._sdk._searchParams.getSearchParams();
    }

    /**
     * The most recent custom-property definitions the extension registered
     * via `useCustomProperties`, or `null` if it has not registered any.
     */
    get customProperties(): Array<CustomPropertyForAirtableInterface> | null {
        return this.airtableInterface._lastCustomProperties;
    }

    /**
     * A React component which may be used to wrap the extension under test,
     * enabling it to run outside of a production extension environment.
     */
    Container({children}: {children: React.ReactNode}) {
        return <BlockWrapper sdk={this._sdk}>{children}</BlockWrapper>;
    }

    /**
     * Specify the outcome of internal permission checks. Rejected mutations
     * cause the SDK's write methods (e.g. `table.createRecordAsync`) to throw.
     */
    simulatePermissionCheck(check: (mutation: Mutation) => boolean): void {
        this.airtableInterface._userPermissionCheck = check;
    }

    /** Simulate the host pushing new search params (e.g. the interface URL changed). */
    simulateSearchParamsUpdate(searchParams: Record<string, string>): void {
        this.airtableInterface.triggerSearchParamsUpdates(searchParams);
    }

    /**
     * Simulate the host applying globalConfig updates — this is how custom
     * property VALUES change when a builder edits them in the interface
     * designer's properties panel.
     */
    simulateGlobalConfigUpdate(updates: ReadonlyArray<GlobalConfigUpdate>): void {
        this.airtableInterface.triggerGlobalConfigUpdates(updates);
    }

    /**
     * Simulate a builder changing one custom property's value in the
     * interface designer. Sugar over {@link simulateGlobalConfigUpdate}:
     * custom property values are stored in globalConfig under the property's
     * key.
     */
    simulateCustomPropertyValueChange(key: string, value: GlobalConfigValue | undefined): void {
        this.simulateGlobalConfigUpdate([{path: [key], value}]);
    }

    /** Simulate the host changing the selected sub-element (edit mode). */
    simulateSubElementSelection(selectedSubElementId: string | null): void {
        this.airtableInterface.triggerSelectionUpdates(selectedSubElementId);
    }

    /**
     * Install a handler for linked-record search (`fetchForeignRecordsAsync`),
     * used when simulating linked-record picking flows.
     */
    simulateForeignRecords(handler: ForeignRecordsHandler): void {
        this.airtableInterface._foreignRecordsHandler = handler;
    }

    /**
     * Apply raw host-side model changes (paths are relative to the base data).
     * An escape hatch for host behaviors without a dedicated simulation
     * method.
     */
    triggerModelUpdates(changes: ReadonlyArray<ModelChange>): void {
        this.airtableInterface.triggerModelUpdates(changes);
    }

    /**
     * Register a handler to be notified of events within the simulated
     * extension environment. See {@link WatchableKeysAndArgs} for events.
     */
    watch<Key extends keyof WatchableKeysAndArgs>(
        key: Key,
        fn: (data: WatchableKeysAndArgs[Key]) => void,
    ): void {
        this.airtableInterface.on(key, fn);
    }

    /** De-register a handler previously registered with {@link TestDriver.watch}. */
    unwatch<Key extends keyof WatchableKeysAndArgs>(
        key: Key,
        fn: (data: WatchableKeysAndArgs[Key]) => void,
    ): void {
        this.airtableInterface.off(key, fn);
    }
}
