declare module "#app" {
  export function defineNuxtPlugin<T>(plugin: T): T
  export function useRuntimeConfig(): unknown
}
