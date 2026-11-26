# Provider Props

The `StellarProvider` for React Native extends the core provider with platform-specific configuration for native modules, storage, and transaction timeouts.

## Basic Setup

```tsx
import { StellarProvider } from "@use-stellar/react-native"
import { Text } from "react-native"

export default function App() {
  return (
    <StellarProvider network="testnet">
      <MyApp />
    </StellarProvider>
  )
}
```

The `network` prop works the same as on the web:
- `"testnet"` — development (default)
- `"mainnet"` — production

## Core Props

These props work the same on web and native:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `network` | `"testnet" \| "mainnet"` | `"testnet"` | Which Stellar network to use |
| `autoConnect` | `boolean \| AutoConnectOptions` | `false` | Restore the session on app launch |

### autoConnect

Restore a previously connected wallet on app launch:

```tsx
<StellarProvider network="testnet" autoConnect>
  <MyApp />
</StellarProvider>
```

Or with options:

```tsx
<StellarProvider
  network="testnet"
  autoConnect={{
    enabled: true,
    persistAddress: true, // save address for reconnection
  }}
>
  <MyApp />
</StellarProvider>
```

With AsyncStorage installed, sessions survive app restarts. Without it, they are kept in memory only.

## Native-Specific Props

### storage

Where `autoConnect` sessions are persisted. Defaults to AsyncStorage if available, otherwise in-memory:

```tsx
import { createAsyncStorageAdapter } from "@use-stellar/react-native"

<StellarProvider
  network="testnet"
  autoConnect
  storage={createAsyncStorageAdapter()}
>
  <MyApp />
</StellarProvider>
```

To use a custom storage implementation:

```tsx
const customStorage = {
  async getItem(key: string) { /* ... */ },
  async setItem(key: string, value: string) { /* ... */ },
  async removeItem(key: string) { /* ... */ },
}

<StellarProvider storage={customStorage}>
  <MyApp />
</StellarProvider>
```

For testing, use in-memory storage:

```tsx
import { createInMemoryStorage } from "@use-stellar/react-native"

<StellarProvider storage={createInMemoryStorage()}>
  <MyApp />
</StellarProvider>
```

### focusManager

Tracks app focus state to pause polling in the background. Defaults to AppState if available:

```tsx
import { createAppStateFocusManager } from "@use-stellar/react-native"

<StellarProvider focusManager={createAppStateFocusManager()}>
  <MyApp />
</StellarProvider>
```

For testing or always-focused behavior:

```tsx
import { createAlwaysFocusedManager } from "@use-stellar/react-native"

<StellarProvider focusManager={createAlwaysFocusedManager()}>
  <MyApp />
</StellarProvider>
```

### onlineManager

Tracks network connectivity. Defaults to NetInfo if available:

```tsx
import { createNetInfoOnlineManager } from "@use-stellar/react-native"

<StellarProvider onlineManager={createNetInfoOnlineManager()}>
  <MyApp />
</StellarProvider>
```

For testing or always-online behavior:

```tsx
import { createAlwaysOnlineManager } from "@use-stellar/react-native"

<StellarProvider onlineManager={createAlwaysOnlineManager()}>
  <MyApp />
</StellarProvider>
```

### transactionTimeout

How long (in seconds) a transaction built by write hooks (`useSendPayment`, `useTransaction`, etc.) stays valid. Native defaults to `300` (5 minutes) because signing on a phone means switching to a wallet app and back. Web defaults to `30` seconds.

```tsx
<StellarProvider
  network="testnet"
  transactionTimeout={600} // 10 minutes
>
  <MyApp />
</StellarProvider>
```

### warnOnFallback

Dev-only console warnings when an optional native module is missing. Defaults to `true`.

```tsx
<StellarProvider network="testnet" warnOnFallback={false}>
  <MyApp />
</StellarProvider>
```

### walletConnect

Enables WalletConnect signing. See [Connecting Mobile Wallets](./mobile-wallets.md) for full details.

```tsx
<StellarProvider
  network="testnet"
  walletConnect={{
    projectId: "YOUR_PROJECT_ID", // from https://cloud.walletconnect.com
    metadata: {
      name: "My app",
      description: "What my app does",
      url: "https://myapp.example",
      icons: ["https://myapp.example/icon.png"],
    },
  }}
>
  <MyApp />
</StellarProvider>
```

## Complete Example

A production setup with all native modules:

```tsx
import { StellarProvider, createAsyncStorageAdapter } from "@use-stellar/react-native"

export default function App() {
  const walletConnect = {
    projectId: "YOUR_PROJECT_ID",
    metadata: {
      name: "My Stellar App",
      description: "Trade and manage Stellar assets",
      url: "https://myapp.example",
      icons: ["https://myapp.example/logo.png"],
    },
  }

  return (
    <StellarProvider
      network="testnet"
      autoConnect={{ enabled: true, persistAddress: true }}
      storage={createAsyncStorageAdapter()}
      warnOnFallback={false}
      walletConnect={walletConnect}
      transactionTimeout={300}
    >
      <MyApp />
    </StellarProvider>
  )
}
```

## Testing

For tests, use mock implementations:

```tsx
import {
  StellarProvider,
  createInMemoryStorage,
  createAlwaysFocusedManager,
  createAlwaysOnlineManager,
} from "@use-stellar/react-native"

<StellarProvider
  network="testnet"
  storage={createInMemoryStorage()}
  focusManager={createAlwaysFocusedManager()}
  onlineManager={createAlwaysOnlineManager()}
  warnOnFallback={false}
>
  <App />
</StellarProvider>
```

## See Also

- [Installation & Polyfills](./installation.md) — set up your environment
- [Connecting Mobile Wallets](./mobile-wallets.md) — configure WalletConnect
- [Deep Links](./deep-links.md) — handle signing flows with wallet apps
