# Troubleshooting

This guide covers common errors and setup issues with `@use-stellar/react-native`.

## Polyfill Errors

### Missing polyfill errors at runtime

When polyfills are not installed, you'll see errors like:

```
TypeError: Cannot read property 'getRandomValues' of undefined
TypeError: Buffer is not defined
TypeError: URL is not implemented
TypeError: TextEncoder is not defined
```

### Solution

1. Install the polyfills:

```bash
npm install buffer react-native-get-random-values react-native-url-polyfill text-encoding
```

2. Import them at the top of your app's entry file, **before any other imports**:

```ts
// index.js or index.ts (FIRST import)
import "@use-stellar/react-native/polyfills"
import { AppRegistry } from "react-native"
import App from "./App"

AppRegistry.registerComponent("main", () => App)
```

3. Verify at startup using `checkStellarRuntime()`:

```tsx
import { checkStellarRuntime } from "@use-stellar/react-native"

const result = checkStellarRuntime()
if (!result.passed) {
  console.error("Missing polyfills:", result.missing)
  result.missing.forEach(m => console.error(`Fix: ${m.fix}`))
}
```

Or throw early with `assertStellarRuntime()`:

```tsx
import { assertStellarRuntime } from "@use-stellar/react-native"

try {
  assertStellarRuntime()
} catch (err) {
  console.error(err.message)
}
```

## checkStellarRuntime() Messages

The runtime checker reports specific missing polyfills with actionable fixes.

### "Buffer is not defined"

**Cause**: The `buffer` package is not installed.

**Fix**: Install `buffer`:

```bash
npm install buffer
```

Then import the polyfills:

```ts
import "@use-stellar/react-native/polyfills"
```

**Why it matters**: The Stellar SDK uses `Buffer` for XDR encoding (binary transaction format) and cryptographic operations.

### "crypto.getRandomValues is not defined"

**Cause**: The `react-native-get-random-values` package is not installed, or it wasn't imported before the Stellar SDK.

**Fix**: Install the package:

```bash
npm install react-native-get-random-values
```

Import the polyfills at the top of your app:

```ts
import "@use-stellar/react-native/polyfills"
```

**Why it matters**: The Stellar SDK uses `crypto.getRandomValues` to generate cryptographically secure random numbers for keypairs, transaction hashing, and nonces.

### "URL is not implemented"

**Cause**: React Native ships a `URL` global whose methods throw "not implemented". The `react-native-url-polyfill` package replaces it with a working implementation.

**Fix**: Install the polyfill:

```bash
npm install react-native-url-polyfill
```

Import the polyfills:

```ts
import "@use-stellar/react-native/polyfills"
```

**Why it matters**: The Stellar SDK constructs Horizon API URLs and parses query parameters. A working `URL` implementation is essential.

### "TextEncoder is not defined" or "TextDecoder is not defined"

**Cause**: The `text-encoding` package is not installed.

**Fix**: Install it:

```bash
npm install text-encoding
```

Import the polyfills:

```ts
import "@use-stellar/react-native/polyfills"
```

**Why it matters**: The Stellar SDK uses `TextEncoder` and `TextDecoder` to convert strings to/from UTF-8 bytes in XDR operations.

## Metro Bundler Issues

### "Cannot find module" for polyfills

**Error**:

```
Error: Cannot find module buffer from ...
```

**Cause**: Metro bundler doesn't recognize the polyfill package.

**Solution**: Add to your `metro.config.js`:

```js
module.exports = {
  projectRoot: __dirname,
  watchFolders: [
    // Include node_modules to ensure polyfills are found
  ],
  resolver: {
    extraNodeModules: {
      buffer: require.resolve("buffer"),
      crypto: require.resolve("react-native-get-random-values"),
    },
  },
}
```

Or use the `rn-nodeify` tool to polyfill Node.js modules for React Native.

### "Duplicate polyfill warning"

**Warning**:

```
Multiple polyfills with the same name detected
```

**Cause**: Polyfills are imported multiple times in your app tree.

**Solution**: Import the polyfills **only once**, in your app's entry file:

```ts
// index.js (ONLY here)
import "@use-stellar/react-native/polyfills"
```

Not in individual components or hooks.

## Hermes Engine

### "Unexpected token" or XDR encoding errors

**Cause**: Hermes doesn't support some JavaScript features the Stellar SDK or polyfills use.

**Solution**:

1. Ensure all polyfills are installed and imported first
2. Update to the latest Hermes version
3. Check your `hermes.engine` in `app.json`:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-build-properties",
        {
          "ios": {
            "jsEngine": "hermes"
          }
        }
      ]
    ]
  }
}
```

### XDR encoding fails on Hermes

**Error**:

```
TypeError: Cannot read property 'encode' of undefined
```

**Cause**: Polyfills are missing or in the wrong order.

**Fix**:

1. Verify polyfills are imported first:

```ts
// index.js - ABSOLUTELY FIRST
import "@use-stellar/react-native/polyfills"
// ... everything else after
```

2. Check your Hermes build includes polyfill dependencies:

```bash
# Expo
eas build --platform ios --profile preview

# Bare React Native
cd ios && pod install && cd ..
```

3. Test with `checkStellarRuntime()`:

```tsx
const result = checkStellarRuntime()
if (!result.passed) {
  result.missing.forEach(m => console.log(m.description, m.fix))
}
```

## WalletConnect Issues

### "wallet_unavailable" when connecting

**Error**:

```
Error: wallet_unavailable: WalletConnect is not available or not configured
```

**Cause**: WalletConnect packages not installed or `walletConnect` prop missing from `StellarProvider`.

**Fix**:

1. Install packages:

```bash
npm install @walletconnect/sign-client @walletconnect/react-native-compat
```

2. Configure the provider:

```tsx
<StellarProvider
  network="testnet"
  walletConnect={{
    projectId: "YOUR_PROJECT_ID",
    metadata: { /* ... */ },
  }}
>
  <MyApp />
</StellarProvider>
```

3. For Expo, create a development build (Expo Go doesn't support native modules):

```bash
eas build --platform ios --profile preview
```

### "network_mismatch" when signing

**Error**:

```
Error: network_mismatch: Wallet is on a different network than the app
```

**Cause**: Your app is configured for testnet but the wallet is on mainnet (or vice versa).

**Solution**: Switch the wallet's network to match the app:

1. Open the wallet app
2. Go to Settings/Network
3. Select the same network as your app (e.g., Testnet if the app uses `network="testnet"`)

### Session expires after 5 minutes

**Cause**: WalletConnect's default timeout is 5 minutes.

**Solution**: The provider automatically extends transaction timeout to 5 minutes (`transactionTimeout: 300`) to account for the time spent switching to the wallet app. If you need longer:

```tsx
<StellarProvider
  network="testnet"
  transactionTimeout={600} // 10 minutes
>
  <MyApp />
</StellarProvider>
```

### Deep link doesn't return to app

**Cause**: Your app's deep link scheme isn't configured or doesn't match what you're opening.

**Solution**:

1. Configure your app's URL scheme in `app.json` (Expo):

```json
{
  "expo": {
    "scheme": "myapp"
  }
}
```

Or `android/app/build.gradle` (bare React Native):

```gradle
android {
  // ...
  defaultConfig {
    // ...
    manifestPlaceholders = [
      appAuthRedirectScheme: "myapp"
    ]
  }
}
```

2. Use the matching scheme in your deep link:

```tsx
const deepLink = `myapp://sign?requestId=${id}&xdr=${xdr}`
await Linking.openURL(deepLink)
```

3. Test with Expo:

```bash
eas build --platform ios --profile preview
```

## AsyncStorage Issues

### "Cannot find module @react-native-async-storage/async-storage"

**Cause**: The optional package is not installed.

**Solution**:

1. Install it:

```bash
npm install @react-native-async-storage/async-storage
```

2. Rebuild native modules:

```bash
# Expo development build
eas build --platform ios --profile preview

# Bare React Native
npx pod-install
```

Or use in-memory storage instead:

```tsx
import { createInMemoryStorage } from "@use-stellar/react-native"

<StellarProvider storage={createInMemoryStorage()}>
  <MyApp />
</StellarProvider>
```

### Sessions don't persist after app restart

**Cause**: AsyncStorage is not installed, or `autoConnect` is not enabled.

**Solution**:

1. Ensure AsyncStorage is installed:

```bash
npm install @react-native-async-storage/async-storage
```

2. Enable `autoConnect`:

```tsx
<StellarProvider network="testnet" autoConnect>
  <MyApp />
</StellarProvider>
```

## NetInfo Issues

### "Cannot find module @react-native-community/netinfo"

**Cause**: The optional package is not installed.

**Solution**:

1. Install it:

```bash
npm install @react-native-community/netinfo
```

2. Rebuild:

```bash
# Expo
eas build --platform ios --profile preview

# Bare React Native
npx pod-install
```

Or accept the in-memory fallback (always online):

```tsx
<StellarProvider warnOnFallback={false}>
  <MyApp />
</StellarProvider>
```

## Testing Issues

### "jest: command not found"

**Cause**: Test dependencies aren't installed.

**Solution**: The test utilities are internal to the package. For your own tests, ensure Jest is installed in your project and your `jest.config.js` includes:

```js
preset: "react-native"
```

### Mock reset between tests fails

**Cause**: Test setup file not running.

**Solution**: Ensure your `jest.config.js` includes:

```js
setupFilesAfterEnv: ["<rootDir>/setup.js"],
```

And your setup file runs `resetAllMocks()`:

```ts
import { resetAllMocks } from "@use-stellar/react-native/test-utils"

beforeEach(() => {
  resetAllMocks()
})
```

## Getting Help

If you encounter an issue not covered here:

1. Check the [Installation & Polyfills](./installation.md) guide
2. Run `checkStellarRuntime()` to identify missing polyfills
3. Review the [Provider Props](./provider-props.md) configuration
4. Check the [GitHub issues](https://github.com/RaceeyXo/use-stellar/issues)
5. Open a new issue with:
   - Your `package.json` (dependencies)
   - Output of `checkStellarRuntime()`
   - Steps to reproduce
   - Your app's entry file (`index.js`)

## See Also

- [Installation & Polyfills](./installation.md) — initial setup
- [Provider Props](./provider-props.md) — configuration options
- [Connecting Mobile Wallets](./mobile-wallets.md) — WalletConnect setup
