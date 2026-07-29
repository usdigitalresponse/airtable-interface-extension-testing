/**
 * The interface-alpha SDK creates a singleton `InterfaceBlockSdk` at module
 * load time from `window.__getAirtableInterfaceAtVersion`. That singleton is
 * unusable for testing (module state persists across tests), so — as in v1's
 * blocks-testing — we satisfy it with a "vacant" interface describing an empty
 * base, and every `TestDriver` builds its own SDK instance against its own
 * mock. Anything that reaches the vacant interface at runtime indicates the
 * extension was rendered outside `TestDriver.Container`.
 *
 * Ported from v1 `src/vacant_airtable_interface.ts`, adapted to the
 * interface-mode `AbstractMockAirtableInterface`.
 */
import {spawnError} from './error_utils';
import {AbstractMockAirtableInterface} from './sdk_internals';
import {BlockRunContextType, type SdkInitData} from './sdk_types';

const vacantSdkInitData: SdkInitData = {
    isDevelopmentMode: false,
    blockInstallationId: 'blivacant00000000',
    isFirstRun: false,
    initialKvValuesByKey: {},
    initialSearchParams: {},
    runContext: {
        type: BlockRunContextType.PAGE_ELEMENT_IN_QUERY_CONTAINER,
        pageId: 'pagvacant00000000',
        isPageElementInEditMode: false,
    },
    baseData: {
        id: 'appvacant00000000',
        name: 'Vacant base',
        color: 'purple',
        tableOrder: [],
        tablesById: {},
        permissionLevel: 'read',
        currentUserId: null,
        enabledFeatureNames: [],
        collaboratorsById: {},
        activeCollaboratorIds: [],
        billingPlanGrouping: 'pro',
        appInterface: {},
        isBlockDevelopmentRestrictionEnabled: false,
        workspaceId: 'wspvacant00000000',
    },
    intentData: null,
};

const OUTSIDE_CONTAINER_MESSAGE =
    'An Airtable interface extension attempted to communicate with the host ' +
    'application outside of a simulated environment. Render your extension ' +
    "inside a TestDriver's `Container` component, and access SDK state " +
    'through the TestDriver instance.';

export class VacantAirtableInterface extends AbstractMockAirtableInterface {
    constructor() {
        super(vacantSdkInitData);
    }

    applyMutationAsync(): Promise<void> {
        throw spawnError(OUTSIDE_CONTAINER_MESSAGE);
    }

    setCustomPropertiesAsync(): Promise<boolean> {
        throw spawnError(OUTSIDE_CONTAINER_MESSAGE);
    }

    setSelectedSubElementAsync(): Promise<boolean> {
        throw spawnError(OUTSIDE_CONTAINER_MESSAGE);
    }

    setSearchParamsAsync(): Promise<boolean> {
        throw spawnError(OUTSIDE_CONTAINER_MESSAGE);
    }

    expandRecord(): void {
        throw spawnError(OUTSIDE_CONTAINER_MESSAGE);
    }

    reloadFrame(): void {
        throw spawnError(OUTSIDE_CONTAINER_MESSAGE);
    }

    trackEvent(): void {}
    trackExposure(): void {}
    sendStat(): void {}
}
