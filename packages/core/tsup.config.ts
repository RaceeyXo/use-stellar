import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  target: "es2020",
  dts: true,
  // Pinned to the same floor as tsconfig's `target` and the package's
  // `engines.node`, so typecheck and build agree on what this package supports
  // instead of esbuild silently emitting whatever syntax the source happened to
  // use.
  target: "es2020",
  // `src` is published (see `files` in package.json), so these maps resolve to
  // real files in an installed copy. A map that points at sources the consumer
  // does not have is worse than shipping no map at all.
  sourcemap: true,
  clean: true,
  treeshake: true,
  // Metro (React Native's bundler) ignores directive prologues it doesn't
  // recognize, so this banner is a no-op there rather than a problem — it
  // only needs to stay accurate for the Next.js/webpack consumers it's for.
  banner: { js: '"use client";' },
  external: [
    "react",
    "react-dom",
    "@stellar/stellar-sdk",
    "@albedo-link/intent",
    "@stellar/freighter-api",
  ],
})
