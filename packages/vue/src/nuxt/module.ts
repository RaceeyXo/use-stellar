import { defineNuxtModule } from "@nuxt/kit"
import { createModuleDefinition } from "./module-definition"

export { createModuleDefinition } from "./module-definition"
export type { ModuleOptions } from "./module-definition"

export default defineNuxtModule(createModuleDefinition(import.meta.url))
