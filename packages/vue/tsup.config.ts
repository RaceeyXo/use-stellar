import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts", "src/test-utils.ts"],
  format: ["cjs", "esm"],
  target: "es2020",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ["vue", "@stellar/stellar-sdk"],
})
