import { defineConfig } from "tsup"

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "test-utils": "src/test-utils.ts",
    "nuxt/module": "src/nuxt/module.ts",
    "nuxt/runtime/plugin": "src/nuxt/runtime/plugin.ts",
  },
  format: ["cjs", "esm"],
  target: "es2020",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // `use-stellar` is a peer: the app's copy is used, so there is one wallet
  // registry and one set of error and cache classes.
  // The Nuxt module reads the package's own exports (`@use-stellar/vue`) to list
  // the composables it auto-imports, so that import must stay external too.
  external: [
    "vue",
    "use-stellar",
    "use-stellar/core",
    "@stellar/stellar-sdk",
    "@nuxt/kit",
    "#app",
    "@use-stellar/vue",
  ],
})
