# useWallet

> Connects a Stellar wallet, and exposes the connected address, network, and
> connection status.

`useWallet` is the entry point to almost every `use-stellar` app. Nearly every
other hook — `useBalance`, `useSendPayment`, `useAccount` — expects a wallet to
already be connected, so `useWallet` is usually the first hook you call.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useWallet } from "use-stellar"
```

## What is Freighter?

Freighter is a free, non-custodial browser extension wallet for the Stellar
network. It holds your Stellar keys, lets you approve or reject connection
requests from apps like yours, and signs transactions on your behalf. It is
the only wallet that is fully supported today (see
[Supported `WalletType` values](#supported-wallettype-values) below).

Install it from [freighter.app](https://www.freighter.app) for Chrome,
Firefox, Edge, or Brave. After installing, open Freighter, go to
**Settings → Preferences → Active Network**, and select **Test Network** so it
matches the `testnet` network your `StellarProvider` uses in development.

## Basic usage

This example runs as-is inside an app already wrapped in `StellarProvider`.

```tsx
import { useWallet } from "use-stellar"

function WalletStatus() {
  const { connected, connecting, address, connect, disconnect } = useWallet()

  if (connecting) {
    return <button disabled>Connecting...</button>
  }

  if (connected) {
    return (
      <div>
        <p>Connected: {address}</p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    )
  }

  return <button onClick={() => connect("freighter")}>Connect Freighter</button>
}
```

## Parameters

`useWallet` takes no parameters. Call it with no arguments, then call the
`connect` function it returns with an optional `WalletType`.

### Supported `WalletType` values

| Value | Type | Status | Description |
| --- | --- | --- | --- |
| `"freighter"` | `WalletType` | Supported | Connects to the Freighter browser extension. This is the default when you call `connect()` with no argument. |
| `"albedo"` | `WalletType` | Supported | Connects via the Albedo web popup. No browser extension required. |
| `"lobstr"` | `WalletType` | Not yet implemented | Accepted by the type system, but `connect("lobstr")` currently rejects with the message `"LOBSTR is not supported yet."` |
| `"rabet"` | `WalletType` | Not yet implemented | Accepted by the type system, but `connect("rabet")` currently rejects with the message `"Rabet is not supported yet."` |

```ts
type WalletType = "freighter" | "lobstr" | "albedo" | "rabet"
```

Pass a `WalletType` to `connect` to choose which wallet to open:

```ts
await connect("freighter") // opens the Freighter extension
await connect("albedo") // opens the Albedo web popup
await connect() // same as connect("freighter")
```

## Return values

| Property | Type | Description |
| --- | --- | --- |
| `connected` | `boolean` | `true` once a wallet has connected successfully. |
| `connecting` | `boolean` | `true` while a `connect()` call is in flight. |
| `address` | `string \| null` | The connected Stellar public key (starts with `G`), or `null` if no wallet is connected. |
| `network` | `StellarNetwork \| null` | The network your `StellarProvider` is configured for (`"testnet"` or `"mainnet"`), or `null` before the first connection. |
| `wallet` | `WalletType \| null` | Which wallet type is connected, or `null` if none is. |
| `walletName` | `string \| null` | A human-readable name for the connected wallet, e.g. `"Freighter"`. `null` if none is connected. |
| `error` | `StellarError \| null` | The error from the most recent `connect()` call, or `null`. See [Common errors](#common-errors). |
| `walletNetwork` | `StellarNetwork \| null` | The network the wallet extension itself reports it is on. `null` until a connection or `refreshWalletNetwork()` call succeeds. |
| `connect` | `(wallet?: WalletType) => Promise<void>` | Opens the given wallet and requests access. Defaults to `"freighter"` when called with no argument. Never throws — check `error` instead. |
| `disconnect` | `() => void` | Clears the connection state. Does not revoke access inside the wallet extension itself; the user can always reconnect. |
| `refreshWalletNetwork` | `() => Promise<void>` | Re-reads the wallet's current network and updates `walletNetwork`. Useful after the user switches networks inside Freighter without reloading your app. No-op if no wallet is connected. |
| `isNetworkMismatch` | `boolean` | `true` when `walletNetwork` and `network` disagree — for example, your app expects `testnet` but the wallet is on `mainnet`. |

## Examples

### Example 1 — a connect button

The most common use of `useWallet`: a button that connects Freighter and
shows connection state.

```tsx
import { useWallet } from "use-stellar"

function ConnectButton() {
  const { connected, connecting, address, connect, disconnect, error } = useWallet()

  if (connected) {
    return (
      <div>
        <p>Connected as {address}</p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => connect("freighter")} disabled={connecting}>
        {connecting ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && <p style={{ color: "red" }}>{error.message}</p>}
    </div>
  )
}
```

### Example 2 — gating content behind connection

Hide app content until a wallet is connected, and prompt the user to connect
otherwise.

```tsx
import { useWallet } from "use-stellar"

function ProtectedDashboard() {
  const { connected, connect } = useWallet()

  if (!connected) {
    return (
      <div>
        <p>Connect your wallet to view your dashboard.</p>
        <button onClick={() => connect("freighter")}>Connect Wallet</button>
      </div>
    )
  }

  return (
    <div>
      <h1>Your Dashboard</h1>
      <p>Wallet connected. Balance and account details would render here.</p>
    </div>
  )
}
```

### Example 3 — displaying a shortened address

Use the `shortenAddress` helper exported from `use-stellar` to display a
readable, truncated version of the full 56-character address.

```tsx
import { useWallet, shortenAddress } from "use-stellar"

function ShortAddress() {
  const { connected, address } = useWallet()

  if (!connected || !address) {
    return <span>Not connected</span>
  }

  // shortenAddress(address) → "GABCDE...UVWXYZ"
  return <span title={address}>{shortenAddress(address)}</span>
}
```

### Example 4 — handling connection errors

Branch on `error.code` to show a specific, actionable message for each
failure instead of a generic one.

```tsx
import { useWallet } from "use-stellar"

function ConnectWithErrorHandling() {
  const { connected, connecting, connect, error } = useWallet()

  const handleConnect = () => {
    void connect("freighter")
  }

  if (connected) {
    return <p>Wallet connected.</p>
  }

  return (
    <div>
      <button onClick={handleConnect} disabled={connecting}>
        {connecting ? "Connecting..." : "Connect Wallet"}
      </button>

      {error?.code === "WALLET_NOT_INSTALLED" && (
        <p>
          Freighter is not installed. Get it at{" "}
          <a href="https://www.freighter.app" target="_blank" rel="noreferrer">
            freighter.app
          </a>
          .
        </p>
      )}

      {error?.code === "WALLET_REQUEST_REJECTED" && (
        <p>You declined the connection request. Try again when ready.</p>
      )}

      {error && error.message.toLowerCase().includes("wrong network") && (
        <p>Your wallet is on the wrong network. Switch Freighter to Testnet and reconnect.</p>
      )}

      {error &&
        error.code !== "WALLET_NOT_INSTALLED" &&
        error.code !== "WALLET_REQUEST_REJECTED" &&
        !error.message.toLowerCase().includes("wrong network") && <p>{error.message}</p>}
    </div>
  )
}
```

## TypeScript

```ts
type StellarNetwork = "testnet" | "mainnet"
type WalletType = "freighter" | "lobstr" | "albedo" | "rabet"

interface WalletState {
  connected: boolean
  connecting: boolean
  address: string | null
  network: StellarNetwork | null
  wallet: WalletType | null
  error: StellarError | null
  walletNetwork: StellarNetwork | null
  walletName: string | null
}

interface UseWalletReturn extends WalletState {
  connect: (wallet?: WalletType) => Promise<void>
  disconnect: () => void
  refreshWalletNetwork: () => Promise<void>
  isNetworkMismatch: boolean
}
```

## Common errors

| Error message | Cause | Fix |
| --- | --- | --- |
| `"Freighter wallet is not installed or could not be detected."` (`error.code === "WALLET_NOT_INSTALLED"`) | The Freighter browser extension is missing, disabled, or not yet unlocked. | Install it from [freighter.app](https://www.freighter.app), unlock it, and try `connect("freighter")` again. |
| `"The request was rejected in the wallet."` (`error.code === "WALLET_REQUEST_REJECTED"`) | The user closed the Freighter popup or clicked **Reject** on the access request. | Call `connect()` again. There is nothing to fix in your code — this is a normal user action. |
| `"Wrong network. Switch Freighter to testnet and try again."` | `StellarProvider` is configured for one network (e.g. `testnet`) but Freighter is set to another (e.g. `mainnet`). | Open Freighter, go to **Settings → Preferences → Active Network**, and select the same network your `StellarProvider` uses. Then reconnect. |
| `"use-stellar: No StellarProvider found. Wrap your app in <StellarProvider> before using any use-stellar hooks."` | `useWallet()` was called outside of a `<StellarProvider>` tree. | Wrap your application (or the relevant part of it) in `<StellarProvider>`. |
| `"LOBSTR is not supported yet."` / `"Rabet is not supported yet."` | `connect("lobstr")` or `connect("rabet")` was called. Both are declared in the `WalletType` union but have no working adapter yet. | Use `"freighter"` or `"albedo"` until support lands. Track progress in the project's open issues. |

The wrong-network error above is worth a closer look: unlike the other rows,
it is **not** currently tagged with a dedicated error code. Check
`error.message` for this case rather than relying on `error.code`.

## Notes

- `connect()` never throws. It always resolves, and reports failures through
  the `error` return value instead. Wrapping it in `try/catch` is safe but
  unnecessary.
- `disconnect()` only clears local state in your app. It does not revoke the
  site's access inside the Freighter extension itself — the user can do that
  from Freighter's settings if they want to fully disconnect.
- `network` is your app's configured network (set on `StellarProvider`).
  `walletNetwork` is whatever network the connected wallet extension reports.
  They can drift apart if the user switches networks inside Freighter after
  connecting — use `isNetworkMismatch` to detect that, and call
  `refreshWalletNetwork()` to re-check it on demand (for example, when your
  app regains focus).
- Calling `connect()` during server-side rendering, or before the component
  has mounted in the browser, sets a `VALIDATION_ERROR` on `error` instead of
  attempting a connection. Only call `connect()` from client components,
  after the `"use client"` boundary in Next.js or Remix.
- Every code example on this page is testnet-only. Never point a real wallet
  at mainnet while following along.

## Related hooks

- [`useNetwork`](./use-network.md) — Reads your app's configured network directly, without needing a connected wallet.
- [`useSendPayment`](./use-send-payment.md) — Requires a wallet connected via `useWallet` before it can sign and submit a payment.
