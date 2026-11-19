import { defineNuxtPlugin, useRuntimeConfig } from "#app"
import {
  createStellarRuntime,
  restoreWalletSession,
  STELLAR_RUNTIME_KEY,
  type StellarPluginOptions,
} from "../../plugin"

interface PublicStellarConfig extends StellarPluginOptions {
  autoConnect?: boolean | { enabled?: boolean; storage?: "local" | "session" }
}

interface NuxtRuntimeConfig {
  public?: { stellar?: PublicStellarConfig }
}

interface NuxtAppLike {
  vueApp: { provide: (key: unknown, value: unknown) => void }
}

function resolveAutoConnect(value: PublicStellarConfig["autoConnect"]): {
  enabled: boolean
  storage: "local" | "session"
} {
  if (typeof value === "boolean") return { enabled: value, storage: "local" }
  return { enabled: value?.enabled ?? false, storage: value?.storage ?? "local" }
}

export async function installStellarRuntime(
  nuxtApp: NuxtAppLike,
  config: NuxtRuntimeConfig,
  isClient: boolean
): Promise<void> {
  const stellar = config.public?.stellar ?? {}
  const { autoConnect, ...runtimeOptions } = stellar
  const runtime = createStellarRuntime(runtimeOptions)
  nuxtApp.vueApp.provide(STELLAR_RUNTIME_KEY, runtime)

  const restore = resolveAutoConnect(autoConnect)
  if (isClient && restore.enabled) {
    await restoreWalletSession(runtime, restore.storage)
  }
}

export default defineNuxtPlugin(async (nuxtApp: NuxtAppLike) => {
  await installStellarRuntime(
    nuxtApp,
    useRuntimeConfig() as NuxtRuntimeConfig,
    typeof globalThis === "object" && "window" in globalThis
  )
})
