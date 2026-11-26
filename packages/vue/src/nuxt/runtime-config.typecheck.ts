// Type-level test for #499, checked by `pnpm typecheck` (tsc), not by Jest:
// `runtimeConfig.public.stellar` is typed by the module's `@nuxt/schema` augmentation.
import type { PublicRuntimeConfig } from "@nuxt/schema"
import "./module"

export const valid: PublicRuntimeConfig = {
  stellar: { network: "testnet", autoConnect: { enabled: true, storage: "session" } },
}

export const misspelled: PublicRuntimeConfig = {
  // @ts-expect-error `netwrok` is not a stellar runtime config key.
  stellar: { netwrok: "testnet" },
}

export const wrongValue: PublicRuntimeConfig = {
  // @ts-expect-error `network` must be a StellarNetwork.
  stellar: { network: "devnet" },
}
