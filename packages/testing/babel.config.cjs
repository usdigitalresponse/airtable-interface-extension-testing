module.exports = {
    presets: [
        ['@babel/preset-env', {targets: {node: 'current'}}],
        ['@babel/preset-react', {runtime: 'automatic'}],
        '@babel/preset-typescript',
    ],
    // src/sdk_internals.ts uses import.meta.url; under Jest everything is
    // transformed to CJS, so rewrite import.meta to a CJS-safe equivalent.
    // Consumers use the tsup-built dist (shimmed) and don't need this.
    plugins: ['babel-plugin-transform-import-meta'],
};
