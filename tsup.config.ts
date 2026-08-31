import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/sdk/index.ts',
    browser: 'src/sdk/browser.ts',
  },
  outDir: 'dist',
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  platform: 'node',
  external: [
    /sovereign-states\.json/,  // never bundle the data
    /subdivisions\.json/,
    /continents\.json/,
  ],
  esbuildOptions(opts) {
    // Silence the import.meta warning for CJS by providing a shim
    opts.define = {
      ...opts.define,
    };
  },
});
