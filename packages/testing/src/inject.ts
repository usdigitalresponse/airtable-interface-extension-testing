/**
 * Side-effect module: installs `window.__getAirtableInterfaceAtVersion` so the
 * interface-alpha SDK's module-load-time singleton construction succeeds.
 *
 * This MUST run before any `@airtable/blocks/interface/*` module is evaluated.
 * Importing anything from this testing library does this automatically (the
 * package's index imports this module first), but if a test file imports the
 * SDK before the testing library, add this module to Jest's `setupFiles`:
 *
 * ```js
 * // jest.config.js
 * setupFiles: ['@usdr/airtable-interface-testing/inject'],
 * ```
 *
 * Ported from v1 `src/inject_mock_airtable_interface.ts`.
 */
import {VacantAirtableInterface} from './vacant_airtable_interface';

const globalObject = (typeof window !== 'undefined' ? window : globalThis) as any;

if (typeof globalObject.__getAirtableInterfaceAtVersion !== 'function') {
    const vacantAirtableInterface = new VacantAirtableInterface();
    globalObject.__getAirtableInterfaceAtVersion = () => vacantAirtableInterface;
}

export {};
