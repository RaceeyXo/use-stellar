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
  external: ["vue", "@stellar/stellar-sdk", "@nuxt/kit", "#app"],
})
