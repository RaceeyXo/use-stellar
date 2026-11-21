/**
 * Bundles a tiny app with Metro — the bundler React Native apps actually use —
 * and checks what ends up in it. Jest cannot see any of this: it resolves
 * `use-stellar` and the native modules through its own module mapper.
 *
 * Checks:
 *  1. The package's `exports` resolve under the `react-native` condition,
 *     including `@use-stellar/react-native/polyfills`.
 *  2. An app WITHOUT the optional native modules still bundles.
 *  3. An app WITH them gets them in its bundle. Metro only follows literal
 *     `require("x")` calls, so this fails if the build ever rewrites them.
 *  4. Browser-only wallet SDKs never reach a native bundle.
 *  5. All of the above also holds with package `exports` support turned off,
 *     which is how Metro resolves by default before React Native 0.79.
 *
 * Run `pnpm build:lib` first: the bundle is built from `dist`, as an app's is.
 */

const fs = require("fs")
const os = require("os")
const path = require("path")
const Metro = require("metro")
const { getDefaultConfig, mergeConfig } = require("metro-config")

const packageDir = path.resolve(__dirname, "..")
const repoRoot = path.resolve(packageDir, "../..")
const fixtureDir = path.join(packageDir, "test-fixtures/metro-app")
const stub = name => path.join(fixtureDir, "stubs", name)

/** Resolved to a stub in every build. */
const ALWAYS_STUBBED = {
  "react-native": stub("react-native.js"),
  // Polyfill packages: the entry requires them unconditionally, by design.
  buffer: stub("empty.js"),
  "react-native-get-random-values": stub("empty.js"),
  "react-native-url-polyfill/auto": stub("empty.js"),
  "text-encoding": stub("empty.js"),
  // Node built-ins the Stellar SDK references and an app polyfills or shims.
  url: stub("empty.js"),
  events: stub("empty.js"),
  https: stub("empty.js"),
  http: stub("empty.js"),
  util: stub("empty.js"),
}

/** Present only in the "installed" build. */
const OPTIONAL_NATIVE_MODULES = {
  "expo-secure-store": stub("secure-store.js"),
  "@react-native-community/netinfo": stub("netinfo.js"),
  "@react-native-async-storage/async-storage": stub("async-storage.js"),
  "@walletconnect/react-native-compat": stub("walletconnect.js"),
  "@walletconnect/sign-client": stub("walletconnect.js"),
}

/** Strings only the optional-module stubs contain. */
const MARKERS = [
  "USE_STELLAR_FIXTURE_SECURE_STORE",
  "USE_STELLAR_FIXTURE_NETINFO",
  "USE_STELLAR_FIXTURE_ASYNC_STORAGE",
  "USE_STELLAR_FIXTURE_WALLETCONNECT",
]

const WORKSPACE_PACKAGES = {
  "@use-stellar/react-native": packageDir,
  "use-stellar": path.join(repoRoot, "packages/core"),
}

async function bundle({ withOptionalModules, packageExports = true }) {
  const stubs = { ...ALWAYS_STUBBED, ...(withOptionalModules ? OPTIONAL_NATIVE_MODULES : {}) }
  const base = await getDefaultConfig(fixtureDir)

  const config = mergeConfig(base, {
    projectRoot: fixtureDir,
    watchFolders: [repoRoot],
    resetCache: true,
    resolver: {
      unstable_enablePackageExports: packageExports,
      unstable_conditionNames: ["react-native", "require", "import"],
      // React Native's Metro defaults: without `exports`, the top-level
      // `react-native` field is what picks a package's native entry.
      resolverMainFields: ["react-native", "browser", "main"],
      nodeModulesPaths: [
        path.join(packageDir, "node_modules"),
        path.join(repoRoot, "packages/core/node_modules"),
        path.join(repoRoot, "node_modules"),
      ],
      extraNodeModules: WORKSPACE_PACKAGES,
      resolveRequest: (context, moduleName, platform) => {
        if (stubs[moduleName]) return { type: "sourceFile", filePath: stubs[moduleName] }
        if (!withOptionalModules && OPTIONAL_NATIVE_MODULES[moduleName]) {
          // "Not installed": fail resolution the way a missing package does.
          throw new Error(`Unable to resolve module ${moduleName}`)
        }
        return context.resolveRequest(context, moduleName, platform)
      },
    },
    transformer: {
      // What React Native's own Metro config sets: a `require` inside a `try`
      // block may be missing without failing the build.
      allowOptionalDependencies: true,
    },
  })

  const out = path.join(
    os.tmpdir(),
    `use-stellar-metro-${withOptionalModules ? "with" : "without"}-${packageExports ? "exports" : "legacy"}.js`
  )
  await Metro.runBuild(config, {
    entry: path.join(fixtureDir, "index.js"),
    out,
    platform: "ios",
    dev: false,
    minify: false,
  })

  const code = fs.readFileSync(out, "utf8")
  fs.rmSync(out, { force: true })
  fs.rmSync(`${out}.map`, { force: true })
  return code
}

function check(condition, message) {
  if (!condition) throw new Error(message)
  console.log(`  ✓ ${message}`)
}

async function main() {
  console.log("Bundling without the optional native modules...")
  const without = await bundle({ withOptionalModules: false })
  check(
    without.includes("StellarProvider"),
    "an app without NetInfo / AsyncStorage / WalletConnect / SecureStore bundles"
  )
  check(!MARKERS.some(marker => without.includes(marker)), "and contains none of them")

  console.log("Bundling with the optional native modules installed...")
  const withModules = await bundle({ withOptionalModules: true })
  check(
    withModules.includes("USE_STELLAR_FIXTURE_SECURE_STORE"),
    "SecureStore is bundled when installed"
  )
  check(withModules.includes("USE_STELLAR_FIXTURE_NETINFO"), "NetInfo is bundled when installed")
  check(
    withModules.includes("USE_STELLAR_FIXTURE_ASYNC_STORAGE"),
    "AsyncStorage is bundled when installed"
  )
  check(
    withModules.includes("USE_STELLAR_FIXTURE_WALLETCONNECT"),
    "WalletConnect is bundled when installed"
  )

  for (const sdk of ["@albedo-link/intent", "@stellar/freighter-api"]) {
    check(!withModules.includes(sdk), `the bundle does not reference ${sdk}`)
  }

  console.log("Bundling with package exports disabled (Metro before React Native 0.79)...")
  const legacy = await bundle({ withOptionalModules: true, packageExports: false })
  check(
    legacy.includes("StellarProvider"),
    "the main entry and /polyfills resolve without `exports`"
  )
  check(
    MARKERS.every(marker => legacy.includes(marker)),
    "and the optional native modules are still bundled"
  )
  for (const sdk of ["@albedo-link/intent", "@stellar/freighter-api"]) {
    check(!legacy.includes(sdk), `and it does not reference ${sdk}`)
  }

  console.log("\nSUCCESS: Metro resolves and bundles @use-stellar/react-native correctly.")
}

main().then(
  () => process.exit(0),
  error => {
    console.error("\nMetro bundle test failed:", error.message)
    process.exit(1)
  }
)
