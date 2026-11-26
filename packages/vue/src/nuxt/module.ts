import { defineNuxtModule } from "@nuxt/kit"
import {
  createModuleDefinition,
  type ModuleOptions,
  type StellarPublicRuntimeConfig,
} from "./module-definition"

export { composableNames, createModuleDefinition, PACKAGE_NAME } from "./module-definition"
export type { ModuleOptions, StellarPublicRuntimeConfig } from "./module-definition"

// Types `runtimeConfig.public.stellar` in the app's `nuxt.config`, so a misspelled
// key is a type error rather than a setting that is silently ignored.
declare module "@nuxt/schema" {
  interface PublicRuntimeConfig {
    stellar?: StellarPublicRuntimeConfig
  }
  interface NuxtConfig {
    stellar?: ModuleOptions
  }
  interface NuxtOptions {
    stellar?: ModuleOptions
  }
}

export default defineNuxtModule<ModuleOptions>(createModuleDefinition(import.meta.url))
