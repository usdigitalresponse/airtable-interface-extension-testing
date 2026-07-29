/**
 * Jest preset for testing Airtable interface extensions. Consumers use it as:
 *
 *   // jest.config.js
 *   export default {preset: '@usdr/airtable-interface-testing'};
 *
 * It provides everything the environment needs:
 * - jsdom test environment;
 * - the inject setup file, installing the simulated host BEFORE any SDK
 *   module evaluates (the SDK builds a singleton from a window global at
 *   import time);
 * - a babel-jest transform (env/react/typescript presets, hermetic — the
 *   consumer needs no babel config) that is also allowed to transform
 *   @airtable/blocks, which ships ESM-only;
 * - @testing-library/jest-dom matchers.
 *
 * Every key can be overridden in the consumer's own jest config; Jest merges
 * the preset underneath it. All paths are resolved from this package so the
 * consumer doesn't need direct dependencies on the toolchain.
 */
module.exports = {
    testEnvironment: require.resolve('jest-environment-jsdom'),
    setupFiles: [require.resolve('./dist/inject.cjs')],
    setupFilesAfterEnv: [require.resolve('./setup_after_env.cjs')],
    transform: {
        '^.+\\.[jt]sx?$': [
            require.resolve('babel-jest'),
            {
                babelrc: false,
                configFile: false,
                presets: [
                    [require.resolve('@babel/preset-env'), {targets: {node: 'current'}}],
                    [require.resolve('@babel/preset-react'), {runtime: 'automatic'}],
                    require.resolve('@babel/preset-typescript'),
                ],
            },
        ],
    },
    transformIgnorePatterns: ['/node_modules/(?!@airtable/blocks/)'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json', 'node'],
};
