# Storage

Session storage persists the user's wallet connection and address across app restarts. On React Native, the provider supports AsyncStorage, in-memory storage, and custom implementations.

## AsyncStorage (Recommended)

AsyncStorage persists sessions to the device's file system so users don't need to reconnect after restarting the app.

### Installation

```bash
npm install @react-native-async-storage/async-storage
# or: pnpm add @react-native-async-storage/async-storage
```

### Usage

```tsx
import { StellarProvider, createAsyncStorageAdapter } from "@use-stellar/react-native"

export default function App() {
  return (
    <StellarProvider
      network="testnet"
      autoConnect
      storage={createAsyncStorageAdapter()}
    >
      <MyApp />
    </StellarProvider>
  )
}
```

With `autoConnect` enabled, the user's address is restored on app launch. The session survives:
- App restarts
- OS kills the app (memory pressure)
- Device restarts

Without AsyncStorage, sessions are kept in memory only and lost on restart.

## In-Memory Storage (Development/Testing)

For development, testing, or when you don't want persistence, use in-memory storage:

```tsx
import { StellarProvider, createInMemoryStorage } from "@use-stellar/react-native"

export default function App() {
  return (
    <StellarProvider network="testnet" storage={createInMemoryStorage()}>
      <MyApp />
    </StellarProvider>
  )
}
```

Sessions are lost when the app restarts or the user switches away from it.

## Custom Storage

Implement the `Storage` interface to use your own storage backend:

```tsx
interface Storage {
  getItem(key: string): string | null | Promise<string | null>
  setItem(key: string, value: string): void | Promise<void>
  removeItem(key: string): void | Promise<void>
}
```

Example with SQLite:

```tsx
import Database from "better-sqlite3"

const db = new Database(":memory:")

const customStorage = {
  getItem(key: string) {
    const row = db.prepare("SELECT value FROM storage WHERE key = ?").get(key)
    return row?.value ?? null
  },

  setItem(key: string, value: string) {
    db.prepare("INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?)").run(key, value)
  },

  removeItem(key: string) {
    db.prepare("DELETE FROM storage WHERE key = ?").run(key)
  },
}

export default function App() {
  return (
    <StellarProvider network="testnet" storage={customStorage}>
      <MyApp />
    </StellarProvider>
  )
}
```

Or with a simple file-based store:

```tsx
import AsyncStorage from "@react-native-async-storage/async-storage"

const myAppStorage = {
  async getItem(key: string) {
    // Add a prefix to namespace your storage
    return AsyncStorage.getItem(`myapp_${key}`)
  },

  async setItem(key: string, value: string) {
    return AsyncStorage.setItem(`myapp_${key}`, value)
  },

  async removeItem(key: string) {
    return AsyncStorage.removeItem(`myapp_${key}`)
  },
}

export default function App() {
  return (
    <StellarProvider network="testnet" storage={myAppStorage}>
      <MyApp />
    </StellarProvider>
  )
}
```

## What Gets Stored

The provider stores:
- Wallet address (if `persistAddress: true` in `autoConnect`)
- Session data needed to reconnect (if using WalletConnect)

Keys are namespaced to avoid collisions:
- `@use-stellar/address` — connected wallet address
- `@use-stellar/walletconnect-session` — WalletConnect session

Custom storage implementations should preserve these namespaces.

## Fallback Behavior

If `autoConnect` is enabled but no storage is provided:
- AsyncStorage is used if available
- Otherwise, in-memory storage is used (sessions lost on restart)
- A dev-only warning is logged if a module is missing

```tsx
// ❌ Warning: AsyncStorage not installed, falling back to in-memory
<StellarProvider network="testnet" autoConnect>
  <MyApp />
</StellarProvider>
```

To silence the warning (in development):

```tsx
<StellarProvider network="testnet" autoConnect warnOnFallback={false}>
  <MyApp />
</StellarProvider>
```

## Clearing Sessions

To manually clear stored sessions:

```tsx
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useWallet } from "@use-stellar/react-native"

export function ClearSession() {
  const { disconnect } = useWallet()

  const handleLogout = async () => {
    await disconnect()
    await AsyncStorage.multiRemove([
      "@use-stellar/address",
      "@use-stellar/walletconnect-session",
    ])
  }

  return <Button title="Logout" onPress={handleLogout} />
}
```

## Testing

For tests, use `createInMemoryStorage()` to ensure test isolation:

```tsx
import {
  StellarProvider,
  createInMemoryStorage,
} from "@use-stellar/react-native"
import { render } from "@testing-library/react-native"

describe("wallet persistence", () => {
  it("restores the session", () => {
    const storage = createInMemoryStorage()

    const { rerender } = render(
      <StellarProvider network="testnet" storage={storage} autoConnect>
        <MyApp />
      </StellarProvider>
    )

    // Simulate app restart by re-rendering with the same storage
    rerender(
      <StellarProvider network="testnet" storage={storage} autoConnect>
        <MyApp />
      </StellarProvider>
    )

    // Verify session was restored
  })
})
```

## See Also

- [Provider Props](./provider-props.md) — configure storage
- [Installation & Polyfills](./installation.md) — install AsyncStorage
