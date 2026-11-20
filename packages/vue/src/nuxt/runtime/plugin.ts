import { defineNuxtPlugin, useRuntimeConfig } from "#app"
import { installStellarRuntime as installVueRuntime, type StellarPluginOptions } from "../../plugin"

interface NuxtRuntimeConfig {
  public?: { stellar?: StellarPluginOptions }
}

interface NuxtAppLike {
  vueApp: Parameters<typeof installVueRuntime>[0]
}

export function installStellarRuntime(
  nuxtApp: NuxtAppLike,
  config: NuxtRuntimeConfig,
  isClient: boolean
): Promise<void> {
  return installVueRuntime(nuxtApp.vueApp, config.public?.stellar ?? {}, isClient)
}

export default defineNuxtPlugin(async (nuxtApp: NuxtAppLike) => {
  await installStellarRuntime(
    nuxtApp,
    useRuntimeConfig() as NuxtRuntimeConfig,
    typeof window !== "undefined"
  )
})
