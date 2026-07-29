export default {
    testEnvironment: 'node',
    transform: {
        '^.+\\.[jt]sx?$': 'babel-jest',
    },
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'cjs', 'json'],
    testMatch: ['<rootDir>/test/**/*.test.ts'],
};
