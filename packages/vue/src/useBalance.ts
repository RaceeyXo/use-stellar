// packages/vue/src/useBalance.ts

import { computed, ref, watchEffect, type ComputedRef, type Ref } from "vue"
import { useStellarRuntime } from "./plugin"
import { accountKey } from "./keys"
import { getHorizonServer, parseHorizonBalance } from "./horizon"
import type { Asset, Balance } from "./types"

/** A plain value, a ref, or a getter — like VueUse's `MaybeRefOrGetter`. */
export type MaybeRefOrGetter<T> = T | Ref<T> | (() => T)

function resolveAddress(source: MaybeRefOrGetter<string | null | undefined>): string | null {
  if (typeof source === "function") {
    return (source as () => string | null | undefined)() ?? null
  }
  if (source !== null && typeof source === "object" && "value" in source) {
    return (source as Ref<string | null | undefined>).value ?? null
  }
  return (source as string | null | undefined) ?? null
}

export interface UseBalanceOptions {
  /** A static address, a ref, or a getter — reactive inputs are watched and re-fetched on change. */
  address: MaybeRefOrGetter<string | null | undefined>
  /** Defaults to `"XLM"`. */
  asset?: Asset
  /** Overrides the provider-level staleTime for this composable instance (ms). */
  staleTime?: number
}

export interface UseBalanceReturn {
  balance: ComputedRef<string | null>
  balances: ComputedRef<Balance[]>
  loading: ComputedRef<boolean>
  error: ComputedRef<unknown>
  refetch: () => void
}

interface AccountData {
  balances: Balance[]
}

function matchesAsset(balance: Balance, asset: Asset): boolean {
  if (asset === "XLM") return balance.asset === "XLM"
  if (typeof asset === "object" && typeof balance.asset === "object") {
    return balance.asset.code === asset.code && balance.asset.issuer === asset.issuer
  }
  return false
}

/**
 * Fetches the XLM or issued-asset balance for a Stellar account, backed by
 * the runtime's shared `QueryStore` — two composable instances for the same
 * address and network share one in-flight request rather than issuing two.
 *
 * `address` may be a static string, a `ref`, or a getter: reactive inputs are
 * watched, and an address change unsubscribes from the old query before
 * subscribing to and loading the new one.
 *
 * @example
 * const { balance, loading } = useBalance({ address: "GABC..." })
 *
 * @example
 * const address = ref("GABC...")
 * const { balance } = useBalance({ address })
 */
export function useBalance(options: UseBalanceOptions): UseBalanceReturn {
  const { networkConfig, queryStore } = useStellarRuntime()
  const asset = options.asset ?? "XLM"

  const currentKey = ref<string | null>(null)
  const currentAddress = ref<string | null>(null)

  async function fetchAccount(address: string): Promise<AccountData> {
    const server = getHorizonServer(networkConfig)
    const raw = await server.loadAccount(address)
    return { balances: raw.balances.map(parseHorizonBalance) }
  }

  watchEffect(onCleanup => {
    const address = resolveAddress(options.address)
    currentAddress.value = address

    if (!address) {
      currentKey.value = null
      return
    }

    const key = accountKey(networkConfig.horizonUrl, networkConfig.network, address)
    currentKey.value = key

    const unsubscribe = queryStore.subscribe(key)
    // The error is already recorded on the store entry (`error` above reads
    // it back reactively) — nothing here awaits this promise, so it must not
    // reject unhandled.
    queryStore
      .run<AccountData>(key, () => fetchAccount(address), { staleTime: options.staleTime })
      .catch(() => {})

    onCleanup(unsubscribe)
  })

  const entry = computed(() =>
    currentKey.value ? queryStore.getEntry<AccountData>(currentKey.value) : null
  )

  const balances = computed<Balance[]>(() => entry.value?.data?.balances ?? [])
  const balance = computed<string | null>(
    () => balances.value.find(b => matchesAsset(b, asset))?.balance ?? null
  )
  const loading = computed(() => entry.value?.loading ?? false)
  const error = computed(() => entry.value?.error ?? null)

  function refetch(): void {
    const address = currentAddress.value
    const key = currentKey.value
    if (!address || !key) return
    queryStore.run<AccountData>(key, () => fetchAccount(address), { force: true }).catch(() => {})
  }

  return { balance, balances, loading, error, refetch }
}
