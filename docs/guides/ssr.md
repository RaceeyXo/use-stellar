# SSR and Next.js App Router

Use `use-stellar` safely in Next.js App Router, Remix, and any framework that
renders React on the server.

## Why hooks cannot run on the server

Stellar wallets are browser extensions. They inject themselves into `window`
when the page loads in a browser. During a server render there is no browser,
no `window`, and no extension — so any code that tries to reach the wallet
crashes or hangs. `use-stellar` detects this with a single guard in
`packages/core/src/utils/index.ts`:

```ts
export function isBrowser(): boolean {
  return typeof window !== "undefined"
}
```

Every hook that touches a wallet checks `isBrowser()` before doing anything
browser-specific. If you call one of those hooks in a server context, you get a
clear error instead of a cryptic crash. The hooks that only call Horizon — which
is a plain HTTPS API — do not use this guard and are safe to call on the server.

## Where `"use client"` goes

You do not add `"use client"` to every file that uses a hook. You add it once,
on a thin wrapper around `StellarProvider`, and every component inside that
wrapper automatically becomes a client subtree.

This is the exact pattern used in the demo app
(`packages/demo/components/Providers.tsx`):

```tsx
// app/providers.tsx
"use client"
import { StellarProvider } from "use-stellar"

export function Providers({ children }: { children: React.ReactNode }) {
  return <StellarProvider network="testnet">{children}</StellarProvider>
}
```

Your root layout stays a server component. It imports `Providers` and passes
children through:

```tsx
// app/layout.tsx
import type { Metadata } from "next"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "My Stellar app",
  description: "Built with use-stellar",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

Any component that calls a `use-stellar` hook must also be a client component.
Add `"use client"` at the top of that file, or nest it inside a parent that
already has `"use client"`:

```tsx
// app/wallet-button.tsx
"use client"
import { useWallet } from "use-stellar"

export function WalletButton() {
  const { connected, address, connect, disconnect } = useWallet()

  return connected ? (
    <button onClick={disconnect}>{address}</button>
  ) : (
    <button onClick={() => connect("freighter")}>Connect Freighter</button>
  )
}
```

## What `StellarProvider` does during a server render

Reading the source in `packages/core/src/context/StellarProvider.tsx` directly:

`StellarProvider` calls `useState` with a `DEFAULT_WALLET` object and wraps its
children in a React context provider. That is all it does on mount. It makes no
network requests, opens no WebSocket connections, sets up no timers, and
registers no `window` event listeners. There is nothing browser-specific in the
component itself.

This means `StellarProvider` renders safely on the server. The HTML it produces
is identical on server and client — an empty wallet state — so no hydration
mismatch comes from the provider itself.

The `"use client"` directive on your `Providers` wrapper is still required
because `StellarProvider` calls `useState` internally, and React does not allow
`useState` in server components.

## The two error messages

### "Wallet connection is only available in the browser."

**Full message:**

```
Wallet connection is only available in the browser. Move your component to a "use client" boundary in Next.js / Remix.
```

**Source:** `packages/core/src/hooks/useWallet.ts` — thrown inside `connect()`
when `isBrowser()` returns `false`.

**What causes it:** You called `connect()` from `useWallet` in a component that
rendered on the server, or in a component that is not inside a `"use client"`
boundary.

**How to fix it:** Add `"use client"` to the file that contains the component
calling `connect()`, or move the component inside the `Providers` wrapper shown
above. Never call `connect()` outside a client component.

---

### "Transaction signing is only available in the browser."

**Full message:**

```
Transaction signing is only available in the browser. Move your component to a "use client" boundary in Next.js / Remix.
```

**Source:** `packages/core/src/hooks/useSendPayment.ts` — thrown inside
`send()` when `isBrowser()` returns `false`.

**What causes it:** You called `send()` from `useSendPayment` (or
`addTrustline()` from `useAddTrustline`) in a component that is not a client
component. Transaction signing requires the wallet extension, which only exists
in the browser.

**How to fix it:** Same as above — add `"use client"` to the file containing
the component, or move the component into the client subtree. Payment forms and
any component that triggers a transaction must always be client components.

## Avoiding hydration mismatches

A hydration mismatch happens when the HTML the server renders does not match
what React renders on the client on first paint. The most common cause with
`use-stellar` is rendering wallet state — `address`, `connected`, `balance` —
directly in a server component or in a component without `"use client"`.

The wallet starts disconnected on the server. On the client, the user may
already be connected. If you render `address` without a client boundary, the
server renders `null` and the client renders the address — React throws a
hydration error.

**Wrong — renders wallet state in a server component:**

```tsx
// app/page.tsx  ← server component, no "use client"
import { useWallet } from "use-stellar" // ← crashes: hooks need a React runtime

export default function Page() {
  const { address } = useWallet()
  return <p>Address: {address}</p>
}
```

**Wrong — mixes server-rendered structure with client wallet state:**

```tsx
// app/page.tsx  ← server component
import { WalletAddress } from "./wallet-address"

export default function Page() {
  return (
    <main>
      <h1>My app</h1>
      <WalletAddress /> {/* fine only if WalletAddress has "use client" */}
    </main>
  )
}

// wallet-address.tsx  ← missing "use client"
import { useWallet } from "use-stellar"

export function WalletAddress() {   // ← hydration mismatch: server renders null, client renders address
  const { address } = useWallet()
  return <p>{address}</p>
}
```

**Correct — wallet state stays inside a client component:**

```tsx
// app/page.tsx  ← server component, safe
import { WalletAddress } from "./wallet-address"

export default function Page() {
  return (
    <main>
      <h1>My app</h1>
      <WalletAddress />
    </main>
  )
}

// wallet-address.tsx
"use client"
import { useWallet } from "use-stellar"

export function WalletAddress() {
  const { address, connected } = useWallet()

  if (!connected) return null   // render nothing until client-side wallet state is known
  return <p>Connected: {address}</p>
}
```

The rule: any component that reads `address`, `connected`, `balance`, or any
other value that differs between server and client must have `"use client"`.

## What is safe on the server

`use-stellar` hooks fall into two groups based on the source code:

### Wallet-dependent — must be client components

These hooks call `isBrowser()` before browser-specific operations. Calling them
outside a `"use client"` boundary produces the error messages above:

| Hook | Why it needs a client boundary |
| :--- | :--- |
| `useWallet` | `connect()` accesses the wallet extension via `window` |
| `useSendPayment` | `send()` calls `adapter.signTransaction()`, which requires the wallet extension |
| `useAddTrustline` | `addTrustline()` calls `adapter.signTransaction()` for the same reason |

### Server-safe — Horizon calls work without a wallet

These hooks only make HTTPS requests to Horizon or do pure computation. They do
not touch `window` or a wallet extension. You can call them in server components
or pass an explicit `address` from server-side data fetching:

| Hook | What it does |
| :--- | :--- |
| `useBalance` | Fetches account balances from Horizon |
| `useAccount` | Fetches full account info from Horizon |
| `useAsset` | Fetches asset metadata from Horizon |
| `useNetwork` | Reads network config from context — pure context read |
| `useTransaction` | Fetches a transaction by hash from Horizon |
| `usePayments` | Fetches paginated payment operations from Horizon |
| `usePaymentHistory` | Wraps `usePayments` with client-side filtering |
| `useTransactionHistory` | Fetches paginated transactions from Horizon |
| `useAccountExists` | Calls `server.loadAccount()` on Horizon |
| `useClaimableBalance` | Queries claimable balances from Horizon |
| `useFederationLookup` | DNS + HTTPS federation lookup — no Horizon, no wallet |
| `useSorobanContract` | Calls Soroban RPC — plain HTTPS |

**Note:** even though these hooks are safe to import and call on the server,
they all use `useStellarContext()` internally, which requires a `StellarProvider`
ancestor. In practice, that means they run inside your `Providers` client
subtree, not in a bare server component. Horizon calls from these hooks happen
on the client after hydration, not during the server render.

## Complete App Router example

This is a minimal but complete Next.js 14 App Router project that wraps the app
in `StellarProvider`, adds a wallet connect button, and displays the XLM balance.
Every file is shown in full.

**`app/providers.tsx`** — the `"use client"` boundary for the provider:

```tsx
"use client"
import { StellarProvider } from "use-stellar"

export function Providers({ children }: { children: React.ReactNode }) {
  return <StellarProvider network="testnet">{children}</StellarProvider>
}
```

**`app/layout.tsx`** — server component root layout:

```tsx
import type { Metadata } from "next"
import { Providers } from "./providers"

export const metadata: Metadata = {
  title: "use-stellar Next.js example",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

**`app/wallet-button.tsx`** — client component for connect/disconnect:

```tsx
"use client"
import { useWallet } from "use-stellar"

export function WalletButton() {
  const { connected, connecting, address, error, connect, disconnect } = useWallet()

  if (connecting) return <button disabled>Connecting…</button>

  if (connected) {
    return (
      <div>
        <p>
          Connected: <code>{address}</code>
        </p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => connect("freighter")}>Connect Freighter</button>
      {error && <p style={{ color: "red" }}>{error.message}</p>}
    </div>
  )
}
```

**`app/balance.tsx`** — client component that reads the XLM balance:

```tsx
"use client"
import { useBalance, useWallet } from "use-stellar"

export function Balance() {
  const { connected } = useWallet()
  const { balance, loading, error } = useBalance({ asset: "XLM" })

  if (!connected) return <p>Connect your wallet to see your balance.</p>
  if (loading) return <p>Loading balance…</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>

  return (
    <p>
      XLM balance: <strong>{balance ?? "0"}</strong>
    </p>
  )
}
```

**`app/page.tsx`** — server component page that composes the client components:

```tsx
import { WalletButton } from "./wallet-button"
import { Balance } from "./balance"

export default function Page() {
  return (
    <main style={{ padding: 24 }}>
      <h1>use-stellar — Next.js App Router</h1>
      <WalletButton />
      <Balance />
    </main>
  )
}
```

Install dependencies and run:

```bash
npm install use-stellar
npm run dev
```

Open the local URL, connect Freighter (set to **Testnet**), and confirm your
balance loads without hydration errors.

## Remix and Vite

The same two error messages appear in Remix because `use-stellar` explicitly
calls them out. In Remix, mark any component that uses wallet hooks with the
[`"use client"` directive](https://remix.run/docs/en/main/guides/client-only-components)
or move the component into a client-only route. In a Vite SPA there is no
server rendering at all, so no `"use client"` directives are needed — wrap your
app in `StellarProvider` once in `main.tsx` and use every hook freely.

## Related

- [Quickstart](../getting-started/quickstart.md) — Vite-based setup walkthrough
- [Error handling](./error-handling.md) — the `StellarError` type and error codes
- [Networks](./networks.md) — switching between testnet and mainnet
