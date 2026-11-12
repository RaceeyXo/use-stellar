import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { defineConfig } from "tsup"

const USE_CLIENT = '"use client";'
const CLIENT_ENTRIES = ["index.js", "index.mjs", "index.react-native.js", "index.react-native.mjs"]

export default defineConfig({
  entry: ["src/index.ts", "src/index.react-native.ts", "src/core.ts"],
  format: ["cjs", "esm"],
  target: "es2020",
  dts: true,
  // Pinned to the same floor as tsconfig's `target` and the package's
  // `engines.node`, so typecheck and build agree on what this package supports
  // instead of esbuild silently emitting whatever syntax the source happened to
  // use.
  // `src` is published (see `files` in package.json), so these maps resolve to
  // real files in an installed copy. A map that points at sources the consumer
  // does not have is worse than shipping no map at all.
  sourcemap: true,
  clean: true,
  treeshake: true,
  // The React entries must begin with "use client" for the Next.js App Router.
  // A `banner` cannot do it: `treeshake: true` runs Rollup over the output,
  // and Rollup drops module-level directives. A banner would also land on
  // `core.*`, which is React-free and has to stay callable from server
  // components. So the directive is prepended after the build, to the React
  // entries only. (Metro ignores directives it doesn't recognize.)
  async onSuccess() {
    for (const file of CLIENT_ENTRIES) {
      const path = join("dist", file)
      const code = await readFile(path, "utf8")
      // Same line as the existing first statement, so source maps keep their
      // line numbers.
      if (!code.startsWith(USE_CLIENT)) await writeFile(path, USE_CLIENT + code)
    }
  },
  external: [
    "react",
    "react-dom",
    "@stellar/stellar-sdk",
    "@albedo-link/intent",
    "@stellar/freighter-api",
    "@walletconnect/sign-client",
    "@trezor/connect",
    "@hot-wallet/sdk",
    "@creit.tech/xbull-wallet-connect",
  ],
})
