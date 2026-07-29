import {defineConfig} from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/inject.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    // Provides import.meta.url in the CJS build (sdk_internals.ts needs it).
    shims: true,
    external: ['@airtable/blocks', 'react', 'react-dom'],
});
