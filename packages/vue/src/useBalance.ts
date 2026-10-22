import { computed, toValue, type ComputedRef, type MaybeRefOrGetter } from "vue"
import {
  accountKey,
  fetchAccount,
  type Asset,
  type Balance,
  type StellarError,
} from "use-stellar/core"
import { useQuery } from "./internal/useQuery"
import { useStellarRuntime } from "./plugin"
import { accountKey } from "./keys"
import { getHorizonServer, normalizeAdapterError, parseHorizonBalance } from "./horizon"
import type { Asset, Balance } from "./types"

/** A plain value, a ref, or a getter — like VueUse's `MaybeRefOrGetter`. */
export type MaybeRefOrGetter<T> = T | Ref<T> | (() => T)

export type { MaybeRefOrGetter } from "vue"

export interface UseBalanceOptions {
  address: MaybeRefOrGetter<string | null | undefined>
  asset?: Asset
  staleTime?: MaybeRefOrGetter<number | undefined>
}

export interface UseBalanceReturn {
  balance: ComputedRef<string | null>
  balances: ComputedRef<Balance[]>
  loading: ComputedRef<boolean>
  error: ComputedRef<StellarError | null>
  refetch: () => Promise<void>
}

function matchesAsset(balance: Balance, asset: Asset): boolean {
  if (asset === "XLM") return balance.asset === "XLM"
  if (typeof asset !== "object") return balance.asset === asset
  return (
    typeof balance.asset === "object" &&
    balance.asset.code === asset.code &&
    balance.asset.issuer === asset.issuer
  )
}

export function useBalance(options: UseBalanceOptions): UseBalanceReturn {
  const runtime = useStellarRuntime()
  const address = computed(() => toValue(options.address)?.trim() || null)
  const asset = options.asset ?? "XLM"

  const currentKey = ref<string | null>(null)
  const currentAddress = ref<string | null>(null)

  async function fetchAccount(address: string): Promise<AccountData> {
    try {
      const server = getHorizonServer(networkConfig)
      const raw = await server.loadAccount(address)
      return { balances: raw.balances.map(parseHorizonBalance) }
    } catch (error) {
      throw normalizeAdapterError(error)
    }
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
  const query = useQuery({
    store: runtime.queryStore,
    queryKey: () =>
      accountKey(
        runtime.networkConfig.horizonUrl,
        runtime.networkConfig.network,
        address.value ?? ""
      ),
    queryFn: () => fetchAccount(runtime.networkConfig, { address: address.value! }),
    enabled: () => address.value !== null,
    staleTime: options.staleTime,
  })

  const balances = computed<Balance[]>(() => query.data.value?.balances ?? [])
  return {
    balance: computed(
      () => balances.value.find(item => matchesAsset(item, asset))?.balance ?? null
    ),
    balances,
    loading: computed(() => query.loading.value),
    error: computed(() => query.error.value as StellarError | null),
    refetch: query.refetch,
  }
}
