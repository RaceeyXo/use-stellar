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
    "react-native",
    "@stellar/stellar-sdk",
    "@albedo-link/intent",
    "@stellar/freighter-api",
    "@react-native-async-storage/async-storage",
    "@react-native-community/netinfo",
    "@walletconnect/react-native-compat",
  ],
})
