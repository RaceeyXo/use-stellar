const path = require("path")
const { getDefaultConfig } = require("expo/metro-config")

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, "../..")
const packagesRoot = path.join(workspaceRoot, "packages")

const config = getDefaultConfig(projectRoot)

config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
]

// The example installs the workspace packages with `file:`, which npm links.
// Mapping them here keeps Metro on the built packages in this checkout instead
// of relying on how a given platform resolves those links.
config.resolver.extraNodeModules = {
  "@use-stellar/react-native": path.resolve(packagesRoot, "react-native"),
  "use-stellar": path.resolve(packagesRoot, "core"),
}

// `@stellar/stellar-sdk` ships a self-contained `browser` build and a Node build
// that requires `url`, `events`, `http` and `https` (through `eventsource`),
// none of which exist in React Native. Metro does not enable the `browser`
// condition on iOS and Android by default, so turn it on to get the former.
const conditionsByPlatform = config.resolver.unstable_conditionsByPlatform ?? {}
config.resolver.unstable_conditionsByPlatform = {
  ...conditionsByPlatform,
  ios: [...new Set([...(conditionsByPlatform.ios ?? ["react-native"]), "browser"])],
  android: [...new Set([...(conditionsByPlatform.android ?? ["react-native"]), "browser"])],
}

// Hierarchical lookup stays on: Expo SDK 58 nests some of its own dependencies
// (for example `expo-asset`) under `node_modules/expo`, which a flat lookup
// cannot find.
//
// The workspace packages carry their own dev installs, though, so a bare import
// made from them (`react`, `react-native`, the native modules) would otherwise
// load a second copy next to the app's. Resolve those from the example first,
// so the app and the packages share one copy of each.
const exampleOrigin = path.join(projectRoot, "index.js")
const defaultResolveRequest = config.resolver.resolveRequest

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest
  const fromWorkspacePackage = context.originModulePath.startsWith(packagesRoot + path.sep)
  const isBare = !moduleName.startsWith(".") && !path.isAbsolute(moduleName)

  if (fromWorkspacePackage && isBare) {
    try {
      return resolve({ ...context, originModulePath: exampleOrigin }, moduleName, platform)
    } catch {
      // Not installed in the example: fall through to the package's own copy.
    }
  }
  return resolve(context, moduleName, platform)
}

module.exports = config
