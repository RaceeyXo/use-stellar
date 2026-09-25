# @use-stellar/react-native

React Native integration for [use-stellar](https://github.com/RaceeyXo/use-stellar) with automatic wiring of native platform capabilities.

## Features

- **AppState Integration**: Automatically pauses polling while the app is backgrounded and resumes on foreground with stale data refetch.
- **NetInfo Integration**: Automatically pauses network requests when offline and resumes on reconnect.
- **AsyncStorage Integration**: Persists wallet session data (autoConnect) to AsyncStorage for session restoration across app restarts.
- **Graceful Fallbacks**: All native modules are optional. The provider continues to work (with reduced functionality) if they're not installed, with dev-only warnings.
- **Full Compatibility**: Re-exports all core hooks and types. Use it exactly like the web provider.

## Installation

```bash
npm install @use-stellar/react-native use-stellar react-native
```

### Optional Native Modules

For full functionality, also install:

```bash
npm install @react-native-async-storage/async-storage @react-native-community/netinfo
```

These are optional — the provider works without them, but with fallback behavior:

- Without AsyncStorage: Sessions persist in memory only (lost on app restart)
- Without NetInfo: Treated as always online
- AppState is built-in to React Native

## Usage

### Basic Setup

```tsx
import { StellarProvider, useBalance } from "@use-stellar/react-native"

export default function App() {
  return (
    <StellarProvider network="testnet">
      <YourApp />
    </StellarProvider>
  )
}

function BalanceDisplay() {
  const { balance, loading } = useBalance()
  return <Text>{loading ? "Loading..." : balance}</Text>
}
```

### With AutoConnect

```tsx
<StellarProvider
  network="testnet"
  autoConnect={{
    enabled: true,
    persistAddress: true,
    storage: "local", // "local" or "session"
  }}
>
  <YourApp />
</StellarProvider>
```

### Custom Configuration

```tsx
import { createInMemoryStorage, createAlwaysFocusedManager } from "@use-stellar/react-native"

<StellarProvider
  network="mainnet"
  networkConfig={{
    horizonUrl: "https://horizon.example.com",
    sorobanUrl: "https://rpc.example.com",
  }}
  queryConfig={{ staleTime: 60000, gcTime: 600000 }}
  storage={createInMemoryStorage()} // for testing
  focusManager={createAlwaysFocusedManager()} // for testing
  warnOnFallback={false} // suppress warnings
>
  <YourApp />
</StellarProvider>
```

## How It Works

### AppState (Focus Management)

When AppState reports the app is backgrounded:
- Polling is paused (timers suspended)
- Network requests continue for manual operations (payments, etc.)

When the app returns to foreground:
- Stale cached queries are refetched once
- Fresh data is served from cache without making requests

### NetInfo (Connectivity Detection)

When NetInfo reports the device is offline:
- New network requests are skipped
- Cached data is served (if available)
- Write operations (payments, transactions) fail fast with a clear error

When connectivity is restored:
- Stale queries are refetched once
- Fresh data is fetched on next request

### AsyncStorage (Session Persistence)

When autoConnect is enabled:
- After successful wallet connection, the session is persisted to AsyncStorage
- On app restart, the session is restored automatically
- If the wallet can reconnect silently, connection is automatic
- If a prompt would be required, the wallet is pre-selected as "intent"

## Props

Extends the core [`StellarProviderProps`](https://github.com/RaceeyXo/use-stellar/blob/main/packages/core/src/context/StellarProvider.tsx) with:

### `storage?: Storage`

Custom storage adapter for autoConnect sessions. Defaults to AsyncStorage if available, falls back to in-memory.

### `focusManager?: FocusManager`

Custom focus manager for app lifecycle. Defaults to AppState-based.

### `onlineManager?: OnlineManager`

Custom online manager for connectivity. Defaults to NetInfo-based.

### `warnOnFallback?: boolean`

Emit `console.warn()` when optional native modules are unavailable. Defaults to `true`.

## Platform Adapters

### Focus Manager Interface

```typescript
interface FocusManager {
  isFocused(): boolean
  subscribe(handler: (isFocused: boolean) => void): () => void
}
```

### Online Manager Interface

```typescript
interface OnlineManager {
  isOnline(): boolean
  subscribe(handler: (isOnline: boolean) => void): () => void
}
```

### Storage Interface

```typescript
interface Storage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}
```

## Fallback Behavior

| Module | Missing Behavior |
|--------|------------------|
| **AppState** | Treated as always focused. Polling continues uninterrupted. (Very rare — AppState is built-in to React Native) |
| **NetInfo** | Treated as always online. Requests continue without connectivity awareness. |
| **AsyncStorage** | Sessions stored in memory only. Lost on app restart. |

Dev warnings are printed for each missing module (controlled by `warnOnFallback`).

## Testing

### In-Memory Storage

```tsx
import { createInMemoryStorage } from "@use-stellar/react-native"

<StellarProvider storage={createInMemoryStorage()}>
  <App />
</StellarProvider>
```

### Always-Focused Manager

```tsx
import { createAlwaysFocusedManager } from "@use-stellar/react-native"

<StellarProvider focusManager={createAlwaysFocusedManager()}>
  <App />
</StellarProvider>
```

### Always-Online Manager

```tsx
import { createAlwaysOnlineManager } from "@use-stellar/react-native"

<StellarProvider onlineManager={createAlwaysOnlineManager()}>
  <App />
</StellarProvider>
```

### Suppress Warnings

```tsx
<StellarProvider warnOnFallback={false}>
  <App />
</StellarProvider>
```

## Hooks

All core hooks are re-exported and work identically on React Native:

- `useWallet()` — Manage wallet connections
- `useBalance()` — Fetch account balances
- `useAccount()` — Fetch account details
- `useSendPayment()` — Send payments
- `useTransaction()` — Monitor transactions
- `useAsset()` — Fetch asset information
- ...and all others from `use-stellar`

See the [core documentation](https://github.com/RaceeyXo/use-stellar) for hook usage.

## Capabilities

The React Native provider registers `{ kind: "native" }` capabilities so wallet adapters can allow or deny connection attempts on mobile platforms.

## License

MIT
