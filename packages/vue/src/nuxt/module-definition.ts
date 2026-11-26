import { addImports, addPlugin, createResolver } from "@nuxt/kit"
import type { StellarPluginOptions } from "../plugin"

/** The package composables are imported from when auto-imported. */
export const PACKAGE_NAME = "@use-stellar/vue"

/** Options under the `stellar` key of `nuxt.config`. */
export interface ModuleOptions {
  /**
   * Registers every `use*` composable the package exports as a Nuxt
   * auto-import, so `useBalance()` works in a component without an import.
   * Set to `false` to keep imports explicit. Defaults to `true`.
   */
  autoImports?: boolean
}

/** The typed `runtimeConfig.public.stellar` the runtime plugin reads. */
export interface StellarPublicRuntimeConfig extends StellarPluginOptions {
  autoConnect?: boolean | { enabled?: boolean; storage?: "local" | "session" }
}

/**
 * The composables to auto-import, derived from the package's own exports:
 * every exported function whose name is `use` followed by a capital letter.
 * A composable added to `src/index.ts` is picked up without touching the module.
 */
export function composableNames(packageExports: Record<string, unknown>): string[] {
  return Object.keys(packageExports)
    .filter(name => /^use[A-Z]/.test(name) && typeof packageExports[name] === "function")
    .sort()
}

/** Loads the package's runtime exports — the same module an app imports. */
const loadPackageExports = (): Promise<Record<string, unknown>> => import(PACKAGE_NAME)

export function createModuleDefinition(
  moduleUrl: string,
  loadExports: () => Promise<Record<string, unknown>> = loadPackageExports
) {
  return {
    meta: {
      name: PACKAGE_NAME,
      configKey: "stellar",
      compatibility: { nuxt: ">=3.0.0" },
    },
    defaults: { autoImports: true } satisfies ModuleOptions,
    async setup(options: ModuleOptions = {}) {
      const resolver = createResolver(moduleUrl)
      addPlugin({ src: resolver.resolve("./runtime/plugin") })

      if (options.autoImports === false) return
      const names = composableNames(await loadExports())
      addImports(names.map(name => ({ name, from: PACKAGE_NAME })))
    },
  }
}
