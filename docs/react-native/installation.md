# Installation & Polyfills

React Native requires polyfills for globals that the Stellar SDK depends on. This guide walks you through installation, setting up polyfills, and verifying your environment.

## Requirements

- **React Native** 0.71+ (with Expo or a native development environment)
- **Node.js** 18 or newer
- **@stellar/stellar-sdk** as a peer dependency
- For native modules: a native development environment (Xcode for iOS, Android Studio for Android)

## Install @use-stellar/react-native

Install the package using your preferred package manager:

### npm

```bash
npm install @use-stellar/react-native use-stellar @stellar/stellar-sdk
```

### pnpm

```bash
pnpm add @use-stellar/react-native use-stellar @stellar/stellar-sdk
```

### yarn

```bash
yarn add @use-stellar/react-native use-stellar @stellar/stellar-sdk
```

`use-stellar` is a peer dependency: your app and this package share one copy, so hooks imported from either package see the same provider.

## Install Polyfills

The Stellar SDK requires polyfills on React Native (especially on Hermes). Install them first:

### npm

```bash
npm install buffer react-native-get-random-values react-native-url-polyfill text-encoding
```

### pnpm

```bash
pnpm add buffer react-native-get-random-values react-native-url-polyfill text-encoding
```

### yarn

```bash
yarn add buffer react-native-get-random-values react-native-url-polyfill text-encoding
```

## Set Up Polyfills in Your App

Import the polyfills **first** in your app's entry file, **before any other imports**:

```ts
// index.js (or index.ts)
import "@use-stellar/react-native/polyfills"
import { AppRegistry } from "react-native"
import App from "./App"

AppRegistry.registerComponent("main", () => App)
```

The polyfills install:
- `crypto.getRandomValues` — for cryptographic key generation
- `Buffer` — for binary data handling in XDR encoding
- `URL` and `URLSearchParams` — for Horizon API URL construction (React Native's built-in `URL` throws "not implemented")
- `TextEncoder` and `TextDecoder` — for string encoding in XDR operations

Each polyfill is installed only if it's missing, so it's safe to import even if your environment already provides them.

## Optional Native Modules

Every native module is optional. Without one, the provider falls back and logs a dev-only warning.

### AppState (pause polling when backgrounded)

Built into React Native — no additional installation needed.

```bash
# No installation required
```

### NetInfo (pause queries when offline)

Detects network connectivity and pauses queries while offline:

```bash
npm install @react-native-community/netinfo
# or: pnpm add @react-native-community/netinfo
```

### AsyncStorage (persist sessions across restarts)

Stores `autoConnect` sessions so users don't need to reconnect after an app restart:

```bash
npm install @react-native-async-storage/async-storage
# or: pnpm add @react-native-async-storage/async-storage
```

### WalletConnect (sign with mobile wallet apps)

Enables signing transactions with external wallet apps like Stellar Expert Wallet or other WalletConnect-compatible wallets:

```bash
npm install @walletconnect/sign-client @walletconnect/react-native-compat
# or: pnpm add @walletconnect/sign-client @walletconnect/react-native-compat
```

Native modules require a native rebuild:
- **Expo users**: Build a development build (`eas build --platform ios --profile preview`)
- **Bare React Native**: Run `npx pod-install` (iOS) or rebuild Android

> **Note**: Expo Go cannot load native modules. You must use a development build.

## Verify Your Setup

To check that all required polyfills are installed and working, use `checkStellarRuntime()` during development:

```tsx
import { checkStellarRuntime } from "@use-stellar/react-native"

// In your app startup or provider
const result = checkStellarRuntime()

if (!result.passed) {
  console.error("Missing polyfills:", result.missing)
  // result.missing[i].fix contains installation instructions
}
```

For a development-only assertion that throws if anything is missing:

```tsx
import { assertStellarRuntime } from "@use-stellar/react-native"

// In your app startup (development only)
assertStellarRuntime() // throws with actionable error if missing
```

This runs only in development (`NODE_ENV !== "production"`) and helps catch setup issues early.

## Fallback Behavior

If an optional native module is not installed, the provider falls back:

| Module | Missing Behavior | Impact |
| --- | --- | --- |
| **AppState** | Treated as always focused | Polling continues in the background (higher battery drain) |
| **NetInfo** | Treated as always online | Write hooks fail with network errors instead of failing fast |
| **AsyncStorage** | In-memory storage only | Sessions are lost on app restart |
| **WalletConnect** | Not available | `connect("walletconnect")` throws `wallet_unavailable` |

A dev-only console warning alerts you when a module is missing (`warnOnFallback: true` is the default).

## Next Steps

- [Provider Props](./provider-props.md) — configure the StellarProvider
- [Connecting Mobile Wallets](./mobile-wallets.md) — connect WalletConnect and handle signing
- [Deep Links](./deep-links.md) — handle signing flows that return via your app's URL scheme
