# Caching

`use-stellar` includes a built-in cache and request deduplication layer that makes multi-component UIs fast and Horizon-friendly.

## The problem

Without a cache, every hook instance issues its own request:

```tsx
// 🔴 Without cache: 3 separate requests to Horizon for the same account
function Dashboard() {
  const { balance } = useBalance({ address: "G..." })        // Request 1
  const { account } = useAccount({ address: "G..." })        // Request 2  
  const { payments } = usePayments({ address: "G..." })      // Request 3
  
  return <div>...</div>
}
```

Navigate away and back? Three more requests. Unmount and remount? Three more requests. This is what triggers Horizon's rate limiter.

## The solution

The cache is built in and enabled by default. The same three hooks now issue **exactly one network request**:

```tsx
// ✅ With cache: 1 request, result shared across all three hooks
function Dashboard() {
  const { balance } = useBalance({ address: "G..." })        // Fetches
  const { account } = useAccount({ address: "G..." })        // Reuses ↑
  const { payments } = usePayments({ address: "G..." })      // Reuses ↑
  
  return <div>...</div>
}
```

The cache tracks subscribers, deduplicates in-flight requests, and evicts stale entries automatically.

## How it works

### Deduplication

When multiple components request the same data simultaneously, only one network request is made. All subscribers await the same promise:

```tsx
// Component A mounts and starts fetching
const { balance: balanceA } = useBalance({ address: "G..." })

// Component B mounts 10ms later — no second request!
// It awaits the same in-flight fetch that A started.
const { balance: balanceB } = useBalance({ address: "G..." })
```

### Freshness (`staleTime`)

Data is considered **fresh** for 30 seconds by default. Within that window, a remount serves from cache with zero network activity:

```tsx
const { balance } = useBalance({ address: "G..." })
// Navigate away, then back within 30 seconds → served from cache
```

Once `staleTime` expires the data is **stale**: it's still returned immediately (so your UI never waits), but a background refetch updates it. This is [stale-while-revalidate](https://web.dev/stale-while-revalidate/).

### Garbage collection (`gcTime`)

When the last subscriber unmounts, a timer starts. If nobody subscribes again within `gcTime` (5 minutes by default), the entry is evicted. This keeps the cache from growing unbounded.

```tsx
// Both components unmount → GC timer starts (5 min)
// One component remounts within 5 min → served from cache, timer cancelled
// No remount within 5 min → entry evicted, next mount fetches fresh
```

## Configuration

### Provider-level defaults

Set `staleTime` and `gcTime` at the provider level to apply them everywhere:

```tsx
<StellarProvider
  network="testnet"
  queryConfig={{
    staleTime: 60_000,   // 60 seconds (default: 30_000)
    gcTime: 600_000,     // 10 minutes (default: 300_000)
  }}
>
  <App />
</StellarProvider>
```

Both values are in **milliseconds**.

### Per-hook overrides

Override for a specific hook instance:

```tsx
// Always fetch fresh — bypasses cache entirely
const { balance } = useBalance({ 
  address: "G...",
  staleTime: 0 
})

// Keep for 2 minutes after unmount
const { account } = useAccount({ 
  address: "G...",
  gcTime: 120_000 
})
```

Per-hook values win over provider defaults.

## What is cached?

Every **read** hook is cached:

- `useBalance`
- `useAccount`
- `useAccountExists`
- `useTransaction`
- `useTransactionHistory` (first page only; pagination bypasses cache)
- `usePayments` (first page only)
- `usePaymentHistory` (wraps `usePayments`)
- `usePaymentPaths`
- `useAsset`
- `useClaimableBalance`
- `useFederationLookup`
- `useSorobanContract`

**Write** hooks are never cached:

- `useSendPayment`
- `useAddTrustline`
- `usePathPayment`

These invalidate the cache on success (see below).

## Cache invalidation

After a successful transaction, the cache for the sender's account is **invalidated** automatically:

```tsx
const { send } = useSendPayment()
const { balance } = useBalance()  // Cached at 100 XLM

await send({ to: "G...", asset: "XLM", amount: "10" })

// ✅ `balance` refetches automatically — sees 90 XLM on next render
```

The following writes invalidate the sender's `account` key:

- `send()` from `useSendPayment`
- `addTrustline()` from `useAddTrustline`
- `pathPayment()` from `usePathPayment`

Because `useBalance`, `useAccount`, and `useAccountExists` all share the same cache key (they all call `server.loadAccount` under the hood), invalidating one invalidates all three.

## Query keys

A **query key** uniquely identifies one piece of data. Keys include every dimension that changes the result:

- The **resolved Horizon URL** (not just network name — a custom private node is never confused with SDF's public endpoint)
- The **network name** (for readability in logs)
- Every **hook parameter** (address, limit, order, cursor, asset code/issuer, contract ID, method, args, etc.)

Two hooks with the same key share a cache entry. Two hooks with different keys do not.

Examples:

```tsx
// Same key → shared cache entry
useBalance({ address: "GABC..." })
useAccount({ address: "GABC..." })  // Reuses the above fetch

// Different key → separate cache entries
useBalance({ address: "GABC..." })
useBalance({ address: "GXYZ..." })  // Different address → different key
```

A key also includes the **resolved `horizonUrl`** from `networkConfig`, so a custom private node and the public SDF endpoint are never conflated:

```tsx
// Custom horizonUrl → different key
<StellarProvider 
  network="testnet"
  networkConfig={{ horizonUrl: "https://horizon.my-node.com", ... }}
>
```

## Opting out

Set `staleTime: 0` to always refetch:

```tsx
const { balance } = useBalance({ 
  address: "G...",
  staleTime: 0  // Never serve stale data
})
```

The cache still deduplicates in-flight requests, so two components mounting at the same time still issue only one network call.

To bypass the cache entirely (not recommended), you would need to use Horizon SDK directly outside of the hooks.

## Watch mode and polling

Hooks with `watch: true` keep refetching on an interval:

```tsx
const { balance } = useBalance({ 
  address: "G...",
  watch: true,
  interval: 5000  // Poll every 5 seconds
})
```

Each poll calls `refetch()`, which **bypasses `staleTime`** and always fetches fresh data. The cache is updated on every poll, so any other component subscribed to the same key sees the new data immediately.

## Pagination

Paginated hooks (`useTransactionHistory`, `usePayments`) cache the **first page** only. Calling `fetchNext()` or `fetchPrev()` issues a fresh Horizon request and does not update the cache — pagination cursors are one-time-use and not stable enough to cache safely.

The first page is still deduplicated: two components mounting with the same address/limit/order see one request.

## Manual refetch

Every hook exposes a `refetch()` function:

```tsx
const { balance, refetch } = useBalance({ address: "G..." })

// Force a fresh fetch, bypassing staleTime
refetch()
```

This is useful after a transaction you know should change the data, or when the user explicitly clicks "Refresh".

## Debugging

The cache is a `QueryStore` instance available on `StellarContextValue.queryStore`. In development you can inspect it:

```tsx
import { useStellarContext } from "use-stellar"

function DebugPanel() {
  const { queryStore } = useStellarContext()
  
  console.log("Cache size:", queryStore.size)
  
  return <button onClick={() => queryStore.clear()}>Clear cache</button>
}
```

`queryStore.size` returns the number of entries currently held. `queryStore.clear()` empties the entire cache (useful in tests).

## Comparison to TanStack Query

This cache works like TanStack Query conceptually:

| TanStack Query | use-stellar |
|----------------|-------------|
| `useQuery` | `useBalance`, `useAccount`, etc. |
| `queryKey` | Built automatically from hook params |
| `staleTime` | `staleTime` (provider or per-hook) |
| `cacheTime` / `gcTime` | `gcTime` (provider or per-hook) |
| `queryClient.invalidateQueries` | Automatic on write hooks |

The difference: TanStack Query is a peer dependency consumers install. `use-stellar`'s cache is built in, so there's zero setup and no version conflicts.

If you already use TanStack Query and prefer it, you can wrap the hooks yourself — the cache here is opt-out, not mandatory.

## Performance

The cache is a `Map` with O(1) lookups, and entries are garbage collected automatically. The only performance consideration is `staleTime`:

- **Too low** (e.g., `staleTime: 0`): Every render refetches, defeating the cache.
- **Too high** (e.g., `staleTime: 300_000`): Data goes stale before the UI sees fresh updates.

30 seconds is a good default for most UIs. Balance-heavy UIs (dashboards, portfolio trackers) may want 10–60 seconds. Real-time UIs (trading, live events) may want 0–5 seconds with `watch: true`.

## Common patterns

### Dashboard with multiple widgets

```tsx
function Dashboard({ address }: { address: string }) {
  // All three read from the same cache entry
  const { balance } = useBalance({ address })
  const { account } = useAccount({ address })
  const { payments } = usePayments({ address })
  
  return (
    <div>
      <BalanceWidget balance={balance} />
      <AccountWidget account={account} />
      <PaymentList payments={payments} />
    </div>
  )
}
```

**Network requests:** 1 for account (shared by `useBalance` and `useAccount`), 1 for payments. Total: **2 requests** (instead of 3+ without cache).

### Sending and seeing the updated balance

```tsx
function SendForm({ address }: { address: string }) {
  const { balance } = useBalance({ address })
  const { send } = useSendPayment()
  
  async function handleSend() {
    await send({ to: "G...", asset: "XLM", amount: "10" })
    // ✅ `balance` refetches automatically — no manual refetch needed
  }
  
  return <button onClick={handleSend}>Send 10 XLM ({balance})</button>
}
```

### Always-fresh data

```tsx
// Live price feed — always fetch the latest
const { paths } = usePaymentPaths({
  mode: "strictSend",
  sourceAsset: "XLM",
  sourceAmount: "100",
  destinationAsset: { code: "USDC", issuer: "G..." },
  staleTime: 0,  // Never stale
  watch: true,   // Poll every 10s
  interval: 10_000,
})
```

### Prefetching on hover

```tsx
function AccountLink({ address }: { address: string }) {
  const { queryStore, networkConfig, network } = useStellarContext()
  
  function prefetch() {
    // Trigger a fetch without mounting the hook
    const key = accountKey(networkConfig.horizonUrl, network, address)
    if (!queryStore.isFresh(key)) {
      // Fetch logic would go here — or mount a hidden component
    }
  }
  
  return (
    <Link to={`/account/${address}`} onMouseEnter={prefetch}>
      {address}
    </Link>
  )
}
```

(Prefetching is advanced — most apps don't need it.)

## Summary

- **Enabled by default** — zero setup.
- **Deduplicates requests** — N components = 1 network call.
- **Survives unmount/remount** — navigate away and back with no refetch.
- **Automatic invalidation** — writes update the cache so reads see fresh data.
- **Configurable** — `staleTime` and `gcTime` at provider or hook level.
- **No breaking changes** — hooks return the same shape they always did.

The cache is the difference between a library usable for a demo and a library usable for a real app.
