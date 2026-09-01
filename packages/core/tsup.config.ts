import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  target: "es2020",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  banner: { js: '"use client";' },
  external: [
    "react",
    "react-dom",
    "@stellar/stellar-sdk",
    "@albedo-link/intent",
    "@stellar/freighter-api",
  ],
})
