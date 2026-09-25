# React Native Test Utilities

Standardized testing infrastructure for @use-stellar/react-native.

## Overview

The test harness provides:

- **Shared renderer** (`renderWithStellar`) — wraps components with mocked StellarProvider
- **Lifecycle controls** — simulate app state changes, network connectivity, wallet interactions
- **Native module mocks** — deterministic AppState, NetInfo, AsyncStorage, Linking, WalletConnect
- **Automatic cleanup** — all mocks reset between tests
- **Fake timers** — deterministic polling and retry behavior
- **Fixture reuse** — uses core's SDK mock and fixtures (no duplication)

## Quick Start

```tsx
import { renderWithStellar, setAppState, setOnline } from "@use-stellar/react-native/test-utils"

it("pauses polling when backgrounded", async () => {
  const { getByText } = renderWithStellar(<MyComponent />)

  // Simulate app backgrounding
  setAppState("background")

  // Verify no new polling occurred
  jest.advanceTimersByTime(5000)
  expect(mockServer.loadAccount).toHaveBeenCalledTimes(1)
})
```

## Architecture

### Directory Structure

```
packages/react-native/
├── jest.config.js                    # Jest configuration (preset: react-native)
├── src/
│   ├── test-utils/
│   │   ├── index.ts                  # Public test utilities export
│   │   ├── setup.ts                  # Jest setup file (fake timers, reset hooks)
│   │   ├── render.tsx                # renderWithStellar() helper
│   │   └── mocks/
│   │       ├── index.ts              # Mock exports
│   │       ├── AppState.ts           # AppState mock + setAppState() helper
│   │       ├── NetInfo.ts            # NetInfo mock + setOnline() helper
│   │       ├── AsyncStorage.ts       # AsyncStorage mock
│   │       ├── Linking.ts            # Linking mock + openUrl() helper
│   │       ├── WalletConnect.ts      # WalletConnect mock
│   │       └── runtime.ts            # resetAllMocks() coordinator
│   ├── __mocks__/
│   │   └── react-native.ts           # Module mock mapping (jest moduleNameMapper)
│   ├── __tests__/
│   │   ├── appstate-acceptance.test.tsx      # AppState acceptance test
│   │   ├── connectivity-acceptance.test.tsx  # Connectivity acceptance test
│   │   ├── mock-reset.test.tsx               # Reset/isolation verification
│   │   └── no-live-calls.test.tsx            # Network mocking verification
│   └── test-utils/
│       └── harness.test.tsx          # Harness validation tests
```

### Module Mapper (jest.config.js)

Jest's `moduleNameMapper` routes imports to mocks:

```javascript
"@stellar/stellar-sdk" → core/__mocks__/@stellar/stellar-sdk.ts
"use-stellar" → core/src/index.ts
"react-native" → __mocks__/react-native.ts
"@react-native-async-storage/async-storage" → test-utils/mocks/AsyncStorage.ts
"@react-native-community/netinfo" → test-utils/mocks/NetInfo.ts
"@walletconnect/react-native-compat" → test-utils/mocks/WalletConnect.ts
```

## APIs

### Render Helper

```typescript
renderWithStellar(ui: ReactElement, options?: RenderWithStellarOptions)
```

Wraps your component with `StellarProvider` and test configuration.

#### Options

```typescript
interface RenderWithStellarOptions {
  network?: StellarNetwork | NetworkConfig  // Default: TESTNET
  providerProps?: Partial<StellarProviderProps>
}
```

#### Example

```tsx
it("loads account", async () => {
  const { getByText } = renderWithStellar(<MyComponent />, {
    network: StellarNetwork.TESTNET,
  })

  await waitFor(() => {
    expect(getByText(/account loaded/i)).toBeInTheDocument()
  })
})
```

### AppState Control

```typescript
setAppState(state: "active" | "background" | "inactive" | "unknown" | "extension")
getAppState(): string
getAppStateListenerCount(): number
```

Simulates app lifecycle transitions.

#### Example

```tsx
it("pauses polling when backgrounded", () => {
  renderWithStellar(<Component />)

  setAppState("background")
  // Polling should pause
  jest.advanceTimersByTime(5000)
})
```

### NetInfo Control

```typescript
setOnline(isConnected: boolean)
getNetInfoState(): NetInfoState
getNetInfoListenerCount(): number
```

Simulates network connectivity changes.

#### Example

```tsx
it("handles offline mode", () => {
  renderWithStellar(<Component />)

  setOnline(false)
  // Fetching should pause
})
```

### AsyncStorage

```typescript
getAsyncStorageMap(): Map<string, string>
getAsyncStorageValue(key: string): string | undefined
setAsyncStorageValue(key: string, value: string): void
```

In-memory storage mock.

#### Example

```tsx
it("persists wallet session", async () => {
  setAsyncStorageValue("wallet_session", "xyz123")

  const value = getAsyncStorageValue("wallet_session")
  expect(value).toBe("xyz123")
})
```

### Linking

```typescript
openUrl(url: string): Promise<void>
getOpenedUrls(): string[]
setLinkingSuccess(shouldSucceed: boolean): void
getLastOpenedUrl(): string | undefined
```

Simulates deep link/URL opening.

#### Example

```tsx
it("opens wallet deep link", async () => {
  const { getByText } = renderWithStellar(<Component />)
  getByText(/sign transaction/i)

  const urls = getOpenedUrls()
  expect(urls[0]).toMatch(/wallet-connect/)
})
```

### WalletConnect

```typescript
setWalletConnectConnected(isConnected: boolean): Promise<void>
isWalletConnectConnected(): boolean
getWalletConnectSession(): MockWalletConnectSession | null
signWithWalletConnect(message: string): Promise<string>
```

Simulates wallet connection lifecycle.

#### Example

```tsx
it("connects and signs", async () => {
  await setWalletConnectConnected(true)
  expect(isWalletConnectConnected()).toBe(true)

  const sig = await signWithWalletConnect("message")
  expect(sig).toBeDefined()
})
```

## Test Lifecycle

### Before Each Test

1. Fake timers enabled globally (setup.ts)
2. All mocks reset to defaults (resetAllMocks)
3. Listeners cleared
4. Storage emptied
5. AppState → "active"
6. NetInfo → online
7. WalletConnect → disconnected

### After Each Test

1. Pending timers cleared
2. All jest.fn() call history cleared

## Fixture Reuse

Do not duplicate fixtures. Reuse core's:

```typescript
import {
  mockAccountData,
  mockAccountRecord,
  mockSubmitResponse,
  TESTNET_ADDRESS_A,
  createMockHorizonServer,
  createMockSorobanServer,
} from "use-stellar/dist/__mocks__/@stellar/stellar-sdk"
```

These are shared, single-source-of-truth fixtures used across all tests in the monorepo.

## SDK Mock Strategy

The core SDK mock (`packages/core/src/__mocks__/@stellar/stellar-sdk.ts`):

- **Re-exports real encoding** (TransactionBuilder, Asset, Operation, etc.)
- **Mocks only the network boundary** (Horizon.Server, SorobanRpc.Server)
- **Enables deterministic tests** without forking encoding logic

This ensures tests assert against Stellar's real XDR encoding, not a fake.

## Fake Timers

All tests use `jest.useFakeTimers()` (configured in setup.ts).

This ensures:

- Deterministic polling intervals
- Controllable retry behavior
- No timing flakiness

Advance timers explicitly in tests:

```tsx
it("retries after 5 seconds", async () => {
  // Component set up to retry after 5s
  jest.advanceTimersByTime(5000)
  // Verify retry occurred
})
```

## No Live Network Calls

The harness guarantees no live network calls:

- Horizon requests → mock Horizon server
- Soroban RPC requests → mock SorobanRpc server
- Wallet interactions → local mocks
- Storage → in-memory map
- AppState/Linking → no native code invoked

All external dependencies are mocked at the module boundary.

## Running Tests

```bash
# Test just react-native package
pnpm --filter @use-stellar/react-native test

# Watch mode
pnpm --filter @use-stellar/react-native test:watch

# With coverage
pnpm --filter @use-stellar/react-native test -- --coverage
```

## Example: Complete Test

```tsx
import React, { useEffect, useState } from "react"
import { Text } from "react-native"
import { renderWithStellar, setAppState, setOnline } from "@use-stellar/react-native/test-utils"
import { createMockHorizonServer } from "use-stellar/dist/__mocks__/@stellar/stellar-sdk"

describe("account polling", () => {
  let mockServer: ReturnType<typeof createMockHorizonServer>

  beforeEach(() => {
    mockServer = createMockHorizonServer()
  })

  it("pauses polling when backgrounded", async () => {
    function Component() {
      const [account, setAccount] = useState<string | null>(null)

      useEffect(() => {
        const timer = setInterval(() => {
          mockServer.loadAccount("GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS")
          setAccount("loaded")
        }, 1000)

        return () => clearInterval(timer)
      }, [])

      return <Text testID="status">{account ?? "loading"}</Text>
    }

    const { getByTestId } = renderWithStellar(<Component />)

    // Initial poll
    const initialCalls = mockServer.loadAccount.mock.calls.length
    expect(initialCalls).toBeGreaterThan(0)

    // Background the app
    setAppState("background")
    jest.advanceTimersByTime(2000)

    // No new polls while backgrounded
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(initialCalls)

    // Restore foreground
    setAppState("active")
    jest.advanceTimersByTime(1000)

    // Polls resume
    expect(mockServer.loadAccount.mock.calls.length).toBeGreaterThan(initialCalls)
  })

  it("pauses fetching when offline", () => {
    const { getByTestId } = renderWithStellar(<Component />)

    setOnline(false)
    jest.advanceTimersByTime(5000)

    // Fetching should respect offline state
  })
})
```

## Troubleshooting

### "Cannot find module '@react-native-async-storage/async-storage'"

This is expected if you haven't installed the optional peer dependency. The mock handles it gracefully. If you want the full integration test, install the peer dep:

```bash
pnpm add -D @react-native-async-storage/async-storage
```

### Timers not advancing

Ensure you call `jest.advanceTimersByTime()` explicitly. The mocks don't auto-resolve — you control timing:

```tsx
jest.advanceTimersByTime(5000)  // ✅ Advance 5 seconds
// Do not expect timers to fire automatically
```

### State persists across tests

This indicates `beforeEach` is not resetting mocks properly. Verify:

1. Jest config has `setupFilesAfterEnv: ["<rootDir>/src/test-utils/setup.ts"]`
2. setup.ts imports and calls `resetAllMocks()` in `beforeEach`

### AppState listeners not firing

The mock stores listeners but tests must invoke them manually or via `setAppState()`.

## Contributing

When adding new mocks:

1. Create a mock file in `src/test-utils/mocks/`
2. Export helpers (e.g., `setAppState()`)
3. Add reset function to `resetAllMocks()` in runtime.ts
4. Export helpers from `mocks/index.ts`
5. Add corresponding `__mocks__` mapping in jest.config.js if needed

## References

- [Jest React Native preset](https://jestjs.io/docs/preset-react-native)
- [React Testing Library for RN](https://callstack.github.io/react-native-testing-library/)
- [Core SDK mock](../../core/src/__mocks__/@stellar/stellar-sdk.ts)
- [Core fixtures](../../core/src/__tests__/fixtures/)
