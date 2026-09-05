# Connecting Wallets

> A guide on how to integrate and manage Stellar wallets using use-stellar.

## Freighter

### What it is

Freighter is a browser extension wallet for the Stellar network. It provides a secure way to manage your Stellar accounts and sign transactions directly from your browser.

### Installation

To install Freighter, navigate to [freighter.app](https://www.freighter.app) and install the extension for your preferred browser (Chrome, Firefox, Edge, or Brave). Once installed, pin the extension to your browser toolbar and follow the setup flow to create a new wallet and save your recovery phrase.

You must also install the `@stellar/freighter-api` npm package. It is an **optional peer dependency** of `use-stellar`, so you only install it if you use Freighter:

```bash
npm install @stellar/freighter-api
# or: pnpm add @stellar/freighter-api  /  yarn add @stellar/freighter-api
```

Until it is installed, `connect("freighter")` throws `wallet_unavailable` telling you to install it.

### Creating a testnet account

Before you can build on the testnet, you need an active testnet account in your Freighter wallet.

1. Open the Freighter extension.
2. Click the gear icon in the top-right corner to open Settings.
3. Navigate to **Preferences** -> **Active Network**.
4. Select **Test Network**.
5. Copy your Stellar public address (starts with `G`) from the main Freighter screen.
6. Navigate to the [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#friendbot).
7. Paste your address into the Friendbot tool and click **Get test network lumens**. This funds your account with 10,000 testnet XLM, making it active on the testnet.

### Switching networks

When building with `use-stellar`, your application expects the connected wallet to be on the same network as your `StellarProvider`. Since `use-stellar` targets the testnet by default during development, you must ensure Freighter's active network is also set to the **Test Network**. If you ever need to switch back to Mainnet, you can do so from Freighter's **Preferences** -> **Active Network** menu.

### Connecting Freighter

You can connect Freighter to your application using the `useWallet` hook. This hook provides the connection state and the functions needed to interact with the wallet.

```tsx
import { useWallet } from "use-stellar"

export function ConnectFreighter() {
  const { connected, connecting, address, error, connect, disconnect } = useWallet()

  if (connecting) {
    return <button disabled>Connecting...</button>
  }

  if (connected) {
    return (
      <div>
        <p>Connected to Freighter: {address}</p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => connect("freighter")}>Connect Freighter</button>
      {error && <p>Error connecting: {error.message}</p>}
    </div>
  )
}
```

## Albedo

### What it is

Albedo is a web-based popup signer for the Stellar network. Unlike Freighter, it does not require a browser extension to be installed. It uses a session-based signing model, where users confirm their identity and transactions in a secure browser popup window.

To use Albedo, install its SDK (`@albedo-link/intent`). Like Freighter's, it is an **optional peer dependency** of `use-stellar`, so it is only required if you connect Albedo:

```bash
npm install @albedo-link/intent
# or: pnpm add @albedo-link/intent  /  yarn add @albedo-link/intent
```

Until it is installed, `connect("albedo")` throws `wallet_unavailable` naming the package to install.

### Differences from Freighter

Because Albedo is entirely web-based, it works in any modern browser without requiring users to install extensions. However, it operates on a per-request basis. It does not maintain a persistent background connection or expose an active network toggle in the same way Freighter does. Instead, the network is confirmed for each transaction signing request.

### Current support status

The underlying adapter code for Albedo exists in `use-stellar`, but it is currently marked as unsupported in the wallet registry. It is considered an open issue and contributions are welcome. Attempting to connect Albedo using the hook will result in an "Albedo is not supported yet" error.

### Connecting Albedo

Because Albedo is not fully supported, passing `"albedo"` to the `connect` function will throw an unsupported wallet error. Here is how you might handle it in an application.

```tsx
import { useWallet } from "use-stellar"

export function ConnectAlbedo() {
  const { connected, address, error, connect } = useWallet()

  if (connected) {
    return <p>Connected to Albedo: {address}</p>
  }

  return (
    <div>
      <button onClick={() => connect("albedo")}>Connect Albedo</button>
      {error && <p>Error: {error.message}</p>}
    </div>
  )
}
```

## Future wallet support

The `use-stellar` library is built to support a diverse ecosystem of Stellar wallets. In addition to Freighter, the wallet registry contains stubs for future integrations. The following wallets are planned for future support:

- **LOBSTR:** A popular mobile and web wallet for the Stellar network.
- **Rabet:** A browser extension and desktop wallet for Stellar.

Currently, attempting to connect either of these will return an unsupported error.

## Detecting the connected wallet

You can determine which wallet a user has connected to by inspecting the `wallet` property returned from the `useWallet` hook. This is useful for displaying the correct wallet name or tailoring the user experience based on their active provider.

```tsx
import { useWallet } from "use-stellar"

export function WalletInfo() {
  const { connected, address, wallet, walletName } = useWallet()

  if (!connected) {
    return <p>No wallet is currently connected.</p>
  }

  return (
    <div>
      <p>Wallet Address: {address}</p>
      {wallet === "freighter" ? (
        <p>You are connected with {walletName}.</p>
      ) : (
        <p>You are connected with an unsupported wallet: {wallet}.</p>
      )}
    </div>
  )
}
```

## Restoring a session after a reload (autoconnect)

By default, a page reload disconnects the wallet. The user has to click Connect again.

`autoConnect` on `StellarProvider` restores the previous session instead. It is **off by default** — turning it on changes what happens on mount, so it is an explicit choice.

```tsx
import { StellarProvider } from "use-stellar"

export function App({ children }) {
  return (
    <StellarProvider network="testnet" autoConnect>
      {children}
    </StellarProvider>
  )
}
```

### What is stored

Only the wallet type, and only if you ask for it. Set `persistAddress` to also keep the public address, so your UI can render it in the moment between mount and the wallet answering.

```tsx
<StellarProvider
  network="testnet"
  autoConnect={{ enabled: true, persistAddress: true, storage: "local" }}
>
  {children}
</StellarProvider>
```

| Option           | Type                   | Default   | Description                              |
| :--------------- | :--------------------- | :-------- | :--------------------------------------- |
| `enabled`        | `boolean`              | `false`   | Restore the previous session on mount.   |
| `persistAddress` | `boolean`              | `false`   | Also store the connected public address. |
| `storage`        | `"local" \| "session"` | `"local"` | `localStorage` or `sessionStorage`.      |

Nothing secret is ever written to storage. A wallet adapter never holds your secret key — signing happens inside the wallet — so there is no key material for this hook to persist.

### It will not pop a dialog at you

Autoconnect reconnects only when the wallet can do it silently, because it has already approved your site. If approval would be required, the session is restored as **intent only**: the wallet is pre-selected and `restoredWallet` tells you which one, but nothing is connected until the user clicks.

An autoconnect that raises an approval dialog on every page load is worse than no autoconnect.

```tsx
import { useWallet } from "use-stellar"

export function ConnectButton() {
  const { connected, address, restoredWallet, connect } = useWallet()

  if (connected) {
    return <p>Connected: {address}</p>
  }

  // The previous session could not reconnect silently — pre-select it.
  if (restoredWallet) {
    return <button onClick={() => connect(restoredWallet)}>Reconnect {restoredWallet}</button>
  }

  return <button onClick={() => connect("freighter")}>Connect</button>
}
```

Storage that is unavailable — private mode, a sandboxed iframe, a browser set to block site data — is not an error. Reading throws, the hook catches it, and your app mounts with a disconnected wallet.

## Reacting to changes made inside the wallet

Users switch accounts and networks in their extension, not in your app. `useWallet` subscribes to those changes through the wallet's adapter, so `address` and `walletNetwork` update on their own.

```tsx
import { useWallet } from "use-stellar"

export function WalletStatus() {
  const { address, network, walletNetwork, isNetworkMismatch } = useWallet()

  if (isNetworkMismatch) {
    return (
      <p>
        Your wallet is on {walletNetwork}, but this app is on {network}. Switch networks in your
        wallet to continue.
      </p>
    )
  }

  return <p>{address}</p>
}
```

`walletNetwork` is the network the **wallet** reports, not the one your provider asked for. That is what makes `isNetworkMismatch` meaningful: comparing the requested network with itself would never flag anything.

A wallet pointed at a private or standalone network reports `walletNetwork: "custom"`. That is a value, not an error — your app can say "unrecognised network" instead of crashing. The raw passphrase is on `walletNetworkPassphrase`.

Subscriptions are torn down when the component unmounts and when you call `disconnect()`.

`refreshWalletNetwork()` remains available for a manual re-check, and it now works for every wallet whose adapter can report its current network — not just Freighter.

## Registering your own wallet adapter

The adapter registry is open. An application, or a wallet vendor, can add a wallet without a change to this package.

```tsx
import { registerWalletAdapter, useWallet } from "use-stellar"
import type { WalletAdapter } from "use-stellar"

const myWallet: WalletAdapter = {
  metadata: { type: "my-wallet", name: "My Wallet", supported: true },

  async isAvailable() {
    return typeof window !== "undefined" && "myWallet" in window
  },

  async connect(network) {
    const address = await window.myWallet.requestAddress()

    return {
      address,
      wallet: "my-wallet",
      network,
      networkPassphrase:
        network === "mainnet"
          ? "Public Global Stellar Network ; September 2015"
          : "Test SDF Network ; September 2015",
    }
  },

  async getNetworkDetails(network) {
    return {
      network,
      networkPassphrase:
        network === "mainnet"
          ? "Public Global Stellar Network ; September 2015"
          : "Test SDF Network ; September 2015",
    }
  },

  async signTransaction(xdr, options) {
    return window.myWallet.sign(xdr, options.networkPassphrase)
  },
}

registerWalletAdapter(myWallet)

// Now usable like any built-in wallet.
function Connect() {
  const { connect } = useWallet()
  return <button onClick={() => connect("my-wallet")}>Connect My Wallet</button>
}
```

Call `registerWalletAdapter` once, before the first `connect()` — module scope in your app entry point is a good place.

### Optional adapter capabilities

Three members of `WalletAdapter` are optional. Implement them if your wallet can; leave them out if it cannot, and the hooks adapt without any wallet-specific branching.

| Member           | Purpose                                                                      | If omitted                                                 |
| :--------------- | :--------------------------------------------------------------------------- | :--------------------------------------------------------- |
| `resolveNetwork` | Report the network the wallet is on right now, without asserting it matches. | The requested network stands.                              |
| `canAutoConnect` | Report whether `connect()` would complete without a prompt.                  | Read as "would prompt" — autoconnect restores intent only. |
| `subscribe`      | Report account and network changes made inside the wallet.                   | No live updates for that wallet.                           |
| `disconnect`     | Release any wallet-side session.                                             | Nothing to release.                                        |

`subscribe` receives a handler and returns an unsubscribe function:

```ts
subscribe(handler) {
  const listener = (event) =>
    handler({
      address: event.address,
      network: event.passphrase === TESTNET_PASSPHRASE ? "testnet" : "custom",
      networkPassphrase: event.passphrase,
    })

  window.myWallet.on("change", listener)
  return () => window.myWallet.off("change", listener)
}
```

### Two libraries, one wallet type

Registering a type that is already taken throws, rather than silently replacing it. That is deliberate: a silent overwrite means whichever library loads second wins and the other fails at runtime with a confusing error.

```ts
registerWalletAdapter(myWallet) // ok
registerWalletAdapter(myWallet) // throws — "my-wallet" is already registered

registerWalletAdapter(myWallet, { override: true }) // explicit replacement
```

### Unknown wallet types

`getWalletAdapter` throws a `WalletAdapterError` with code `wallet_unsupported` for a type nobody registered. It never returns `undefined`, so a stored or JavaScript-supplied value that is not a real wallet fails with a message you can act on rather than `TypeError: Cannot read properties of undefined`.

```ts
import { getWalletAdapter, hasWalletAdapter, WalletAdapterError } from "use-stellar"

if (hasWalletAdapter(storedType)) {
  const adapter = getWalletAdapter(storedType)
}

try {
  getWalletAdapter("nonsense")
} catch (err) {
  if (err instanceof WalletAdapterError) {
    console.log(err.code) // "wallet_unsupported"
  }
}
```
