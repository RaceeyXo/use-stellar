import { defineConfig } from "tsup"

export default defineConfig({
  // `polyfills` is its own entry (`@use-stellar/react-native/polyfills`): apps
  // import it for its side effects, and the main entry never pulls it in.
  entry: ["src/index.ts", "src/polyfills.ts"],
  format: ["cjs", "esm"],
  // Pinned to the same floor as tsconfig's `target` and the package's
  // `engines.node`, so typecheck and build agree on what this package supports
  // instead of esbuild silently emitting whatever syntax the source happened to
  // use.
  target: "es2020",
  dts: true,
  // `src` is published (see `files` in package.json), so these maps resolve to
  // real files in an installed copy. A map that points at sources the consumer
  // does not have is worse than shipping no map at all.
  sourcemap: true,
  clean: true,
  // Deliberately no `treeshake: true`. That option runs Rollup over the
  // output, and Rollup rewrites `require("x")` into a `__require("x")` helper
  // call. Metro only follows literal `require` calls, so the optional native
  // modules (NetInfo, AsyncStorage, WalletConnect) would never make it into an
  // app's bundle — and their `try` / `catch` fallbacks would hide that. The
  // CommonJS build is the one Metro resolves (`react-native` condition), and
  // esbuild leaves `require` alone there.
  external: [
    "react",
    "react-native",
    "use-stellar",
    "@react-native-async-storage/async-storage",
    "@react-native-community/netinfo",
    "@walletconnect/react-native-compat",
    "@walletconnect/sign-client",
    "buffer",
    "react-native-get-random-values",
    "react-native-url-polyfill",
    "text-encoding",
  ],
})
