import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
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
  // Every export in this package is client-only — `StellarProvider` calls
  // `createContext` at module scope — so the bundle must carry the RSC
  // directive or a Server Component importing it throws.
  //
  // Deliberately no `treeshake: true`: tsup's tree-shaking pass re-emits through
  // rollup, which strips module-level directives, and this banner is the first
  // casualty. esbuild already drops unreachable code during bundling, and the
  // few kB the rollup pass saved are not worth shipping a package that cannot be
  // imported from an App Router page.
  banner: { js: '"use client";' },
  // Every runtime dependency stays external. Inlining the wallet SDKs would ship
  // them twice — once bundled here, once installed from `dependencies` — and
  // would defeat the dynamic `import("@albedo-link/intent")` in the adapters,
  // whose whole purpose is keeping those SDKs out of the SSR bundle.
  external: [
    "react",
    "react-dom",
    "@stellar/stellar-sdk",
    "@stellar/freighter-api",
    "@albedo-link/intent",
  ],
})
