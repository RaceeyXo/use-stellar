import { useEffect, useMemo, useRef } from "react"
import { useStellarContext } from "../context/StellarProvider"
import { toStellarError } from "../errors"
import { useQuery, paymentPathsKey } from "../cache"
import { focusManager } from "../runtime/focusManager"
import { fetchPaymentPaths, assetKeyStr, type PaymentPathsResult } from "../queries/paymentPaths"
import type { UsePaymentPathsOptions, UsePaymentPathsReturn } from "../types"

const DEFAULT_WATCH_INTERVAL = 10_000

type PathPageData = PaymentPathsResult

/**
 * Finds the routes and quotes for converting one asset into another.
 *
 * Results are cached in the shared QueryStore and deduplicated. With `watch`,
 * quotes are re-polled every `interval` ms while the app is focused (see
 * `focusManager`); polling pauses in the background and refreshes once on
 * return.
 *
 * @example
 * const { paths, lastUpdated } = usePaymentPaths({
 *   mode: "strictSend",
 *   sourceAsset: "XLM",
 *   sourceAmount: "100",
 *   destinationAsset: { code: "USDC", issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5" },
 * })
 */
export function usePaymentPaths(options: UsePaymentPathsOptions): UsePaymentPathsReturn {
  const {
    mode,
    sourceAsset,
    destinationAsset,
    enabled = true,
    watch = false,
    interval = DEFAULT_WATCH_INTERVAL,
  } = options

  const sourceAmount = mode === "strictSend" ? options.sourceAmount : undefined
  const destinationAmount = mode === "strictReceive" ? options.destinationAmount : undefined
  const destinationAddress = mode === "strictSend" ? options.destinationAddress : undefined
  const sourceAddress = mode === "strictReceive" ? options.sourceAddress : undefined

  const { network, networkConfig, queryStore } = useStellarContext()

  const sourceKey = assetKeyStr(sourceAsset)
  const destinationKey = assetKeyStr(destinationAsset)
  const amount = (sourceAmount ?? destinationAmount ?? "") as string
  const addressFilter = destinationAddress ?? sourceAddress

  const queryKey = useMemo(
    () =>
      paymentPathsKey(
        networkConfig.horizonUrl,
        network,
        mode,
        sourceKey,
        destinationKey,
        amount,
        addressFilter
      ),
    [networkConfig.horizonUrl, network, mode, sourceKey, destinationKey, amount, addressFilter]
  )

  const {
    data,
    loading,
    error: rawError,
    refetch,
    updatedAt,
  } = useQuery<PathPageData>({
    queryKey,
    queryFn: () => fetchPaymentPaths(networkConfig, options),
    store: queryStore,
    enabled,
  })

  // Keep stable ref for polling interval.
  const refetchRef = useRef(refetch)
  refetchRef.current = refetch

  useEffect(() => {
    if (!enabled || !watch) return
    const ms = interval > 0 ? interval : DEFAULT_WATCH_INTERVAL
    let id: ReturnType<typeof setInterval> | undefined
    const start = () => {
      if (id !== undefined) clearInterval(id)
      if (!focusManager.isFocused()) return
      id = setInterval(() => {
        if (focusManager.isFocused()) refetchRef.current()
      }, ms)
    }
    start()
    const unsubscribeFocus = focusManager.subscribe(focused => {
      if (id !== undefined) {
        clearInterval(id)
        id = undefined
      }
      if (!focused) return
      const entry = queryStore.getSnapshot(queryKey)
      if (entry?.subscribers && !queryStore.isLoading(queryKey) && !queryStore.isFresh(queryKey)) {
        refetchRef.current()
      }
      start()
    })
    return () => {
      if (id !== undefined) clearInterval(id)
      unsubscribeFocus()
    }
  }, [
    enabled,
    watch,
    interval,
    sourceKey,
    destinationKey,
    amount,
    addressFilter,
    network,
    networkConfig.horizonUrl,
    queryStore,
    queryKey,
  ])

  const error = rawError ? toStellarError(rawError) : null

  const value = useMemo<UsePaymentPathsReturn>(
    () => ({
      paths: data?.paths ?? [],
      loading,
      error,
      lastUpdated: data?.lastUpdated ?? (updatedAt ? new Date(updatedAt) : null),
      refetch,
    }),
    [data, loading, error, updatedAt, refetch]
  )

  return value
}
