# Testing

The `@use-stellar/react-native/test-utils` package provides helpers to test your React Native components with mocked Stellar provider, AppState, NetInfo, AsyncStorage, and Linking.

## Overview

The test utilities include:

- **Mock provider** — render components with mocked `StellarProvider`
- **Lifecycle controls** — simulate app state changes (foreground/background)
- **Network controls** — simulate connectivity changes (online/offline)
- **Storage** — in-memory AsyncStorage mock
- **Deep links** — mock Linking for signing flows

## Basic Setup

```tsx
import { renderWithStellar, setAppState, setOnline } from "@use-stellar/react-native/test-utils"
import { render, screen } from "@testing-library/react-native"

describe("MyComponent", () => {
  it("displays balance on load", () => {
    const { getByText } = renderWithStellar(<MyComponent />)

    expect(getByText(/loading/i)).toBeInTheDocument()
  })
})
```

## renderWithStellar

Wraps your component with a mocked `StellarProvider` and test configuration.

```typescript
renderWithStellar(ui: ReactElement, options?: RenderWithStellarOptions)
```

Options:

```typescript
interface RenderWithStellarOptions {
  network?: "testnet" | "mainnet" // Default: "testnet"
  providerProps?: Partial<StellarProviderProps>
}
```

Example:

```tsx
it("works on mainnet", () => {
  renderWithStellar(<MyComponent />, {
    network: "mainnet",
  })
})

it("with custom provider props", () => {
  renderWithStellar(<MyComponent />, {
    providerProps: {
      autoConnect: true,
      warnOnFallback: false,
    },
  })
})
```

## App State Control

Simulate app lifecycle transitions (foreground/background):

```typescript
setAppState(state: "active" | "background" | "inactive" | "unknown" | "extension")
getAppState(): string
getAppStateListenerCount(): number
```

Example:

```tsx
it("pauses polling when backgrounded", async () => {
  renderWithStellar(<PollingComponent />)

  // App goes to background
  setAppState("background")
  jest.advanceTimersByTime(5000)

  // Verify polling paused
  expect(mockServer.loadAccount).toHaveBeenCalledTimes(1)

  // App returns to foreground
  setAppState("active")
  jest.advanceTimersByTime(1000)

  // Polling resumes
  expect(mockServer.loadAccount.mock.calls.length).toBeGreaterThan(1)
})
```

## Network Control

Simulate network connectivity changes:

```typescript
setOnline(isConnected: boolean)
getNetInfoState(): NetInfoState
getNetInfoListenerCount(): number
```

Example:

```tsx
it("handles offline gracefully", async () => {
  renderWithStellar(<OfflineAwareComponent />)

  setOnline(false)
  jest.advanceTimersByTime(1000)

  expect(screen.getByText(/offline/i)).toBeInTheDocument()

  setOnline(true)
  jest.advanceTimersByTime(1000)

  expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()
})
```

## Storage Control

Mock AsyncStorage for testing session persistence:

```typescript
getAsyncStorageMap(): Map<string, string>
getAsyncStorageValue(key: string): string | undefined
setAsyncStorageValue(key: string, value: string): void
```

Example:

```tsx
it("persists wallet session", async () => {
  renderWithStellar(<WalletComponent />, {
    providerProps: { autoConnect: true },
  })

  // Simulate user connecting
  // ...

  const stored = getAsyncStorageValue("@use-stellar/address")
  expect(stored).toBe("G...")
})
```

## Deep Links

Mock the Linking module for testing signing flows:

```typescript
openUrl(url: string): Promise<void>
getOpenedUrls(): string[]
getLastOpenedUrl(): string | undefined
setLinkingSuccess(shouldSucceed: boolean): void
```

Example:

```tsx
it("handles deep links from signing", async () => {
  renderWithStellar(<SigningComponent />)

  // Trigger signing
  const button = screen.getByText(/sign/i)
  fireEvent.press(button)

  // Verify the wallet was opened
  const urls = getOpenedUrls()
  expect(urls[0]).toMatch(/wallet-connect/)

  // Simulate returning from wallet with signed XDR
  const deepLinkUrl = "myapp://sign?requestId=abc123&xdr=AxBf..."
  await openUrl(deepLinkUrl)

  // Verify signing completed
  expect(screen.getByText(/success/i)).toBeInTheDocument()
})
```

## Fake Timers

All tests automatically use fake timers (`jest.useFakeTimers()`). Advance time explicitly:

```tsx
it("retries after 5 seconds", async () => {
  renderWithStellar(<RetryComponent />)

  jest.advanceTimersByTime(5000)

  // Verify retry happened
})
```

## Complete Example

```tsx
import { renderWithStellar, setAppState, setOnline } from "@use-stellar/react-native/test-utils"
import { screen, fireEvent, waitFor } from "@testing-library/react-native"
import { MyComponent } from "./MyComponent"

describe("MyComponent", () => {
  beforeEach(() => {
    // Mocks reset automatically; this is optional
  })

  it("loads account on mount", async () => {
    renderWithStellar(<MyComponent />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText(/account loaded/i)).toBeInTheDocument()
    })
  })

  it("pauses loading when offline", async () => {
    renderWithStellar(<MyComponent />)

    setOnline(false)
    jest.advanceTimersByTime(1000)

    // Verify offline state
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
  })

  it("pauses polling when backgrounded", () => {
    renderWithStellar(<MyComponent />)

    setAppState("background")
    jest.advanceTimersByTime(5000)

    // Verify polling is paused
    expect(screen.queryByText(/refreshing/i)).not.toBeInTheDocument()
  })

  it("resumes polling when brought to foreground", () => {
    renderWithStellar(<MyComponent />)

    setAppState("background")
    jest.advanceTimersByTime(2000)

    setAppState("active")
    jest.advanceTimersByTime(1000)

    // Verify polling resumed
    expect(screen.getByText(/refreshing/i)).toBeInTheDocument()
  })

  it("signs transaction with WalletConnect", async () => {
    renderWithStellar(<SigningComponent />)

    const signButton = screen.getByText(/sign/i)
    fireEvent.press(signButton)

    await waitFor(() => {
      expect(screen.getByText(/success/i)).toBeInTheDocument()
    })
  })
})
```

## Testing with Custom Storage

```tsx
it("restores session across app restart", async () => {
  const storage = createInMemoryStorage()

  const { rerender } = renderWithStellar(<MyComponent />, {
    providerProps: {
      autoConnect: true,
      storage,
    },
  })

  // Connect wallet
  fireEvent.press(screen.getByText(/connect/i))
  await waitFor(() => {
    expect(screen.getByText(/connected/i)).toBeInTheDocument()
  })

  // Simulate app restart
  rerender(
    <StellarProvider
      network="testnet"
      autoConnect
      storage={storage}
    >
      <MyComponent />
    </StellarProvider>
  )

  // Verify session restored
  expect(screen.getByText(/connected/i)).toBeInTheDocument()
})
```

## Fixture Reuse

Reuse core's mock SDK and fixtures instead of duplicating them:

```tsx
import {
  mockAccountData,
  mockSubmitResponse,
  TESTNET_ADDRESS_A,
  createMockHorizonServer,
} from "@stellar/stellar-sdk"

describe("payment", () => {
  let mockServer: ReturnType<typeof createMockHorizonServer>

  beforeEach(() => {
    mockServer = createMockHorizonServer()
  })

  it("sends payment", async () => {
    mockServer.loadAccount.mockResolvedValue(mockAccountData(TESTNET_ADDRESS_A))

    renderWithStellar(<PaymentComponent />)
    // ...
  })
})
```

## No Live Network Calls

The test utilities guarantee no live calls to:
- Horizon (mocked via `createMockHorizonServer`)
- Soroban RPC (mocked)
- WalletConnect APIs (mocked)
- Device APIs (Linking, AsyncStorage, AppState, NetInfo)

All external dependencies are mocked at the module boundary.

## See Also

- [Installation & Polyfills](./installation.md) — set up your environment
- [Provider Props](./provider-props.md) — configure the provider
- [@use-stellar/react-native/test-utils source](../../packages/react-native/TEST-UTILS.md)
