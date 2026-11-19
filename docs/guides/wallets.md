# Connecting Wallets

> A guide on how to integrate and manage Stellar wallets using use-stellar.

## Supported wallets

The following wallet adapters are registered and available in `use-stellar`. Each adapter is built from metadata that matches what the wallet reports at runtime, ensuring the documentation and demo always stay in sync with what is actually supported.

| Wallet | Type | Platform | Networks | Peer Dependency | Auto-connect | Change Events |
| --- | --- | --- | --- | --- | --- | --- |
| Freighter | `"freighter"` | web | any (via extension) | `@stellar/freighter-api` | ✓ | ✓ |
| Albedo | `"albedo"` | web | testnet, mainnet | `@albedo-link/intent` | ✗ | ✗ |
| WalletConnect | `"walletconnect"` | web, native | any (via chain ID) | `@walletconnect/sign-client` | ✓ | ✓ |

**Unavailable** means the wallet's `isAvailable()` returned `false`. In practice:
- **Freighter:** Extension not installed, not unlocked, or no session yet.
- **Albedo:** Never unavailable in a browser (web-popup based, no extension required). Unavailable on native/ReactNative.
- **WalletConnect:** Always available if the SignClient loads. Requires configuration (see below).

The demo's wallet picker shows only available adapters and updates dynamically as availability changes.

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

Albedo is a web-based popup signer for the Stellar network. Unlike Freighter, it does not require a browser extension to be installed. It uses a per-request model, where users confirm their identity and transactions in a secure browser popup window.

### Installation

To use Albedo, install its SDK (`@albedo-link/intent`). Like Freighter's, it is an **optional peer dependency** of `use-stellar`, so it is only required if you use Albedo:

```bash
npm install @albedo-link/intent
# or: pnpm add @albedo-link/intent  /  yarn add @albedo-link/intent
```

Until it is installed, `connect("albedo")` throws `wallet_unavailable` naming the package to install.

### Network support

Albedo confirms the network per-request rather than exposing a persistent "current network" like an extension does. It only supports networks with published passphrases: **testnet** and **mainnet**. Attempting to connect Albedo on a custom network (one without a known passphrase) throws `wallet_unsupported`.

### Connecting Albedo

You can connect Albedo to your application using the `useWallet` hook, just like Freighter:

```tsx
import { useWallet } from "use-stellar"

export function ConnectAlbedo() {
  const { connected, connecting, address, error, connect, disconnect } = useWallet()

  if (connecting) {
    return <button disabled>Connecting...</button>
  }

  if (connected) {
    return (
      <div>
        <p>Connected to Albedo: {address}</p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    )
  }

  return (
    <div>
      <button onClick={() => connect("albedo")}>Connect Albedo</button>
      {error && <p>Error connecting: {error.message}</p>}
    </div>
  )
}
```

### Differences from Freighter

- **No extension required:** Albedo works in any browser via popup. No installation or setup needed.
- **Per-request confirmation:** The network is confirmed for each signing request, not maintained as a background state.
- **No autoconnect:** Albedo does not implement `canAutoConnect`, so autoconnect restores intent only (wallet is pre-selected) rather than a live connection.
- **No change events:** Albedo does not report account or network changes; updates happen only on the next signing request.

## WalletConnect

### What it is

WalletConnect is a protocol that connects apps to any wallet via a QR code or deep link. It works on both web and native platforms, enabling users to sign transactions from their mobile wallet while using your web app. It is ideal for supporting any Stellar wallet without building a dedicated adapter.

### Installation

WalletConnect is an **optional peer dependency** of `use-stellar`. Install it only if you use WalletConnect:

```bash
npm install @walletconnect/sign-client
# or: pnpm add @walletconnect/sign-client  /  yarn add @walletconnect/sign-client
```

Until it is installed, creating a WalletConnect adapter throws `wallet_unavailable` naming the package to install.

### Configuration

WalletConnect requires configuration via `createWalletConnectAdapter()`. All options are **required**:

| Option | Type | Description | Example |
| --- | --- | --- | --- |
| `projectId` | `string` | Your WalletConnect Cloud project ID. | `"YOUR_WALLETCONNECT_PROJECT_ID"` |
| `metadata.name` | `string` | Your app's name, shown to the user. | `"My Stellar App"` |
| `metadata.description` | `string` | Short description of your app. | `"Sign transactions with any wallet"` |
| `metadata.url` | `string` | Your app's public URL. | `"http://localhost:3000"` (testnet), `"https://myapp.example.com"` (prod) |
| `metadata.icons` | `string[]` | Array of icon URLs (at least one). | `["http://localhost:3000/logo.png"]` |
| `onDisplayUri` | `(uri: string) => void` | *Optional.* Callback when QR code is ready. | `(uri) => showQRModal(uri)` |

**Getting a Project ID:**
1. Sign up for free at [cloud.walletconnect.com](https://cloud.walletconnect.com).
2. Create a new project.
3. Copy your Project ID from the dashboard.

### Usage example

Unlike Freighter and Albedo (which are registered globally), WalletConnect is created on-demand by your app so you can pass configuration:

```tsx
import { createWalletConnectAdapter, registerWalletAdapter, StellarProvider } from "use-stellar"

export function App({ children }) {
  const walletConnectAdapter = createWalletConnectAdapter({
    projectId: "YOUR_WALLETCONNECT_PROJECT_ID", // Placeholder — get real ID from WalletConnect Cloud
    metadata: {
      name: "My Stellar App",
      description: "Sign transactions with any wallet",
      url: "http://localhost:3000", // For testnet during development
      icons: ["http://localhost:3000/logo.png"],
    },
    onDisplayUri: (uri) => {
      // Called when a QR code is ready. Display it to the user.
      // In a web app, you might show a modal with a QR code library like `qrcode.react`.
      console.log("Scan this QR code:", uri)
    },
  })

  // Register the adapter so connect("walletconnect") can find it.
  registerWalletAdapter(walletConnectAdapter)

  return (
    <StellarProvider network="testnet">
      {children}
    </StellarProvider>
  )
}
```

Then connect as usual:

```tsx
import { useWallet } from "use-stellar"

export function ConnectButton() {
  const { connect, connected, address } = useWallet()

  if (connected) {
    return <p>Connected: {address}</p>
  }

  return <button onClick={() => connect("walletconnect")}>Connect with WalletConnect</button>
}
```

### Testnet only in examples

**Never commit a real Project ID to version control.** The example above uses placeholders for all sensitive values. In production, use environment variables:

```tsx
// app.tsx or your entry point
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
if (!projectId) {
  throw new Error("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required")
}

const adapter = createWalletConnectAdapter({
  projectId,
  metadata: {
    name: "My Stellar App",
    description: "Sign transactions with any wallet",
    url: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    icons: [process.env.NEXT_PUBLIC_LOGO_URL || "http://localhost:3000/logo.png"],
  },
})

registerWalletAdapter(adapter)
```

Then set the env vars in your `.env.local`:

```bash
# .env.local (testnet development)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_LOGO_URL=http://localhost:3000/logo.png
```

### Platform support

WalletConnect works on **web and native platforms**. On web, users scan a QR code or approve a deeplink. On React Native, the adapter detects the platform and works transparently. No platform-specific code needed; the same adapter works everywhere.

### Availability and autoconnect

WalletConnect's `isAvailable()` always returns `true` if the SignClient loads successfully. It uses existing sessions for autoconnect: if a session was previously approved, `canAutoConnect()` returns `true` and `connect()` reconnects silently without a new QR code. On first connection, a new QR code is generated.

## Future wallet support

The `use-stellar` library is designed to support a diverse Stellar ecosystem. Wallet adapters for the following are planned as future features:

- **LOBSTR:** A popular mobile and web wallet for Stellar (wallet-02).
- **Rabet:** A browser extension and desktop wallet for Stellar (wallet-03).
- **xbull:** Another browser extension option for Stellar (wallet-04).
- **Hana:** A Chrome extension wallet (wallet-05).

When these adapters land on the `dev` branch, they will be automatically picked up by the metadata matrix and demo picker.

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
