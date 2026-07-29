/**
 * The preset supplies everything: jsdom, the simulated-host setup file, a
 * babel transform that also handles the ESM-only @airtable/blocks package,
 * and jest-dom matchers. Add overrides here only when a project needs them.
 */
export default {
    preset: '@usdr/airtable-interface-testing',
};
