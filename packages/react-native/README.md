# @use-stellar/react-native

React Native integration for [use-stellar](https://github.com/RaceeyXo/use-stellar): the same hooks as the web package, with the native platform wired in for you.

- **AppState** — polling pauses while the app is in the background and catches up when it returns.
- **NetInfo** — queries pause while the device is offline and refetch once on reconnect; write hooks fail fast instead of signing.
- **AsyncStorage** — `autoConnect` sessions survive an app restart.
- **WalletConnect** — sign with a mobile wallet app.
- **Longer transaction validity** — signing on a phone means switching to a wallet app and back, so transactions stay valid for 5 minutes instead of the web's 30 seconds.

Every native module is optional. Without one, the provider falls back (always online, in-memory sessions) and says so with a dev-only warning.

## Installation

```bash
npm install @use-stellar/react-native use-stellar
```

Polyfills the Stellar SDK needs on Hermes:

```bash
npm install buffer react-native-get-random-values react-native-url-polyfill text-encoding
```

Recommended native modules:

```bash
npm install @react-native-async-storage/async-storage @react-native-community/netinfo
```

For WalletConnect:

```bash
npm install @walletconnect/sign-client @walletconnect/react-native-compat
```

Native modules need a native rebuild (`npx pod-install`, or an Expo development build — Expo Go cannot load WalletConnect).

`use-stellar` is a peer dependency: your app and this package share one copy, so hooks imported from either package see the same provider.

## Polyfills

Import the polyfills **first** in your app's entry file, before anything that loads the Stellar SDK:

```js
// index.js
import "@use-stellar/react-native/polyfills"
import { AppRegistry } from "react-native"
import App from "./App"

AppRegistry.registerComponent("main", () => App)
```

They install `crypto.getRandomValues`, `Buffer`, a working `URL` / `URLSearchParams` (React Native's built-in one throws "not implemented"), and `TextEncoder` / `TextDecoder` — each only if missing.

To check at startup that nothing is missing (development only):

```ts
import { assertStellarRuntime } from "@use-stellar/react-native"

assertStellarRuntime() // throws with install instructions for anything missing
```

## Usage

```tsx
import { Text } from "react-native"
import { StellarProvider, useBalance } from "@use-stellar/react-native"

export default function App() {
  return (
    <StellarProvider network="testnet" autoConnect>
      <Balance />
    </StellarProvider>
  )
}

function Balance() {
  const { balance, loading } = useBalance({ address: "G..." })
  return <Text>{loading ? "Loading..." : balance}</Text>
}
```

Every hook and utility from `use-stellar` is re-exported, so one import path is enough.

### Session restore

`autoConnect` works as on the web, except that the session is stored with AsyncStorage (or the `storage` prop). Browser options such as `storage: "local"` do not apply.

```tsx
<StellarProvider network="testnet" autoConnect={{ enabled: true, persistAddress: true }}>
```

### WalletConnect

```tsx
const walletConnect = {
  projectId: "YOUR_PROJECT_ID", // from https://cloud.walletconnect.com
  metadata: {
    name: "My app",
    description: "What my app does",
    url: "https://myapp.example",
    icons: ["https://myapp.example/icon.png"],
  },
}

<StellarProvider network="testnet" autoConnect walletConnect={walletConnect}>
```

Then `connect("walletconnect")` from `useWallet`. The pairing link opens a wallet app on the device; pass `onPairingUri` to also show it as a QR code, or `openWallet` to open it your own way. With `autoConnect`, an approved session is reused on the next launch instead of pairing again.

WalletConnect Stellar wallets sign `testnet` and `mainnet` only. Freighter and Albedo are browser wallets and are not available on native.

### Deep-link signing flows

If your signing flow hands off to another app and comes back through your URL scheme, the deep-link handler (`initDeepLinkHandler`) matches the returning link to the request that started it. The provider starts it for you when it mounts and removes it when it unmounts, so a wallet's return link is never dropped because the app forgot to initialise it. Pass `deepLinks` to configure it, or `deepLinks={false}` to leave `Linking` alone:

```tsx
<StellarProvider network="testnet" deepLinks={{ onUnmatchedResult: handleOrphanedResult }}>
```

```ts
import { registerPendingRequest } from "@use-stellar/react-native"

const signedXdr = await registerPendingRequest(requestId) // resolves when the link returns
```

The request id must be unguessable (any app can open your scheme). A pending request lives in memory, so if the OS kills the app while the user is in the wallet, the returning link arrives with nothing waiting for it: it is passed to `onUnmatchedResult` instead. Treat that link as untrusted input.

You can still call `initDeepLinkHandler()` yourself; it is idempotent, so the provider and your call together register one `Linking` listener and a link is handled once. Whichever starts first owns the handler and its options, and React runs a child's effects before its parent's. So a call made in a component **above** the provider (for example your root `App`) starts second, and its options are ignored. If you were already calling `initDeepLinkHandler({ onUnmatchedResult })` there, move the options to the provider, `deepLinks={{ onUnmatchedResult }}`, or pass `deepLinks={false}` and keep your call.

## Props

Everything the core `StellarProvider` accepts, plus:

| Prop                 | Default                    | Description                                                                                                      |
| -------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `storage`            | AsyncStorage, or in-memory | Where `autoConnect` sessions are stored. Any object with `getItem` / `setItem` / `removeItem` (sync or async).   |
| `focusManager`       | AppState                   | `{ isFocused(), subscribe(handler) }`                                                                            |
| `onlineManager`      | NetInfo                    | `{ isOnline(), subscribe(handler) }`                                                                             |
| `deepLinks`          | `true`                     | Starts the wallet deep-link handler on mount. Pass `DeepLinkHandlerOptions`, or `false` to register no listener. |
| `walletConnect`      | —                          | Enables WalletConnect (see above).                                                                               |
| `transactionTimeout` | `300`                      | Seconds a transaction built by the write hooks stays valid.                                                      |
| `warnOnFallback`     | `true`                     | Dev-only `console.warn` when an optional native module is missing.                                               |

## Fallback behavior

| Module           | Missing behavior                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **AppState**     | Treated as always focused; polling continues in the background. (AppState is built into React Native, so this only happens outside it.) |
| **NetInfo**      | Treated as always online.                                                                                                               |
| **AsyncStorage** | Sessions are kept in memory and lost on restart.                                                                                        |

## Testing

The platform pieces are exported so tests (and unusual setups) can swap them:

```tsx
import {
  StellarProvider,
  createInMemoryStorage,
  createAlwaysFocusedManager,
  createAlwaysOnlineManager,
} from "@use-stellar/react-native"

;<StellarProvider
  storage={createInMemoryStorage()}
  focusManager={createAlwaysFocusedManager()}
  onlineManager={createAlwaysOnlineManager()}
  warnOnFallback={false}
>
  <App />
</StellarProvider>
```

## License

[Apache-2.0](https://github.com/RaceeyXo/use-stellar/blob/main/LICENSE)
