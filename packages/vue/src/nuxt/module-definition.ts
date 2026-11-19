import { addPlugin, createResolver } from "@nuxt/kit"

export type ModuleOptions = Record<string, never>

export function createModuleDefinition(moduleUrl: string) {
  return {
    meta: {
      name: "@use-stellar/vue",
      configKey: "stellar",
      compatibility: { nuxt: ">=3.0.0" },
    },
    setup() {
      const resolver = createResolver(moduleUrl)
      addPlugin({ src: resolver.resolve("./runtime/plugin") })
    },
  }
}
