export default {
    testEnvironment: 'jsdom',
    // Installs window.__getAirtableInterfaceAtVersion BEFORE any SDK module loads.
    setupFiles: ['<rootDir>/test/setup_inject.ts'],
    setupFilesAfterEnv: ['<rootDir>/test/setup_rtl.ts'],
    transform: {
        '^.+\\.[jt]sx?$': 'babel-jest',
    },
    // The interface-alpha SDK ships ESM-only; Jest must transform it too.
    transformIgnorePatterns: ['/node_modules/(?!@airtable/blocks/)'],
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'cjs', 'json'],
    testMatch: ['<rootDir>/test/**/*.test.{ts,tsx}'],
};
