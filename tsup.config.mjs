import { defineConfig } from "tsup";
import pkg from "./package.json" assert { type: "json" };

const externalDeps = Object.keys({
  ...(pkg.dependencies || {}),
  ...(pkg.peerDependencies || {})
});

export default [
  defineConfig({
    entry: {
      index: "src/index.js",
      cli: "src/cli.js"
    },
    format: ["esm"],
    target: "node20",
    platform: "node",
    bundle: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    dts: false,
    shims: false,
    treeshake: true,
    shebang: {
      cli: "#!/usr/bin/env node"
    },
    external: externalDeps
  }),
  defineConfig({
    entry: {
      "action/index": "src/action/index.js"
    },
    format: ["esm"],
    target: "node20",
    platform: "node",
    bundle: true,
    clean: false,
    sourcemap: true,
    splitting: false,
    dts: false,
    shims: false,
    treeshake: true,
    noExternal: [/.*/],
    esbuildOptions(options) {
      options.banner = {
        js: `
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Make require available globally for CommonJS modules
if (typeof globalThis !== 'undefined') {
  globalThis.require = require;
}
`.trim()
      };
    }
  })
];

