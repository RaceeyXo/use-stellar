# use-stellar Expo example

Runnable Expo development-build example for `@use-stellar/react-native` on the Stellar **testnet**.

It shows:

- Polyfills imported first (`index.js` → `src/polyfills.ts` → `@use-stellar/react-native/polyfills`)
- `StellarProvider` from `@use-stellar/react-native`, with `autoConnect` restoring the session through AsyncStorage
- WalletConnect configured from environment config (the project id is never committed)
- Deep-link scheme `use-stellar` in `app.json`
- Screens: 
  - Connect wallet (via WalletConnect)
  - Balance and account info
  - Payment history (infinite scroll)
  - Send payment
  - Soroban contract read calls
  - Soroban contract write calls

## Prerequisites

- Node 22.13+ (required by Expo SDK 58)
- A [WalletConnect Cloud](https://cloud.walletconnect.com) project id
- A Stellar wallet app that supports WalletConnect, on the device or simulator
- An Expo development build (WalletConnect needs native modules; Expo Go is not enough)

## Tested versions

The example is pinned to the latest Expo SDK with the New Architecture on, and CI bundles it for iOS and Android on every push.

| Expo SDK | React Native | React | New Architecture                   | Bundled in CI   |
| -------- | ------------ | ----- | ---------------------------------- | --------------- |
| 58       | 0.88.1       | 19.3  | on (the only mode from RN 0.82 on) | iOS and Android |

The CI check is `node packages/react-native/scripts/metro-bundle-test.js --example`: it bundles the example with its own Expo Metro config and fails on any resolution error. It does not build or launch native binaries, so it covers module resolution and the polyfill entry, not runtime behaviour on a device.

Earlier versions of this example were pinned to Expo SDK 52 and React Native 0.76; those are no longer exercised.

Notes from the SDK 58 upgrade, all in `metro.config.js` and `package.json`:

- `babel-preset-expo` must be a direct dev dependency; SDK 58 no longer hoists it.
- `@stellar/stellar-sdk` needs the `browser` condition on iOS and Android, or Metro picks its Node build, which requires `url`, `events`, `http` and `https`.
- Expo nests some of its own dependencies, so Metro's hierarchical lookup stays on; shared packages (`react`, `react-native`, native modules) are pinned to the example's copy.
- `SafeAreaView` from `react-native` is deprecated in 0.88 and still works.

## Run on testnet

This folder is not part of the pnpm workspace — it would pull Expo into every
install of the monorepo — so it has its own install, against the locally built
packages:

```bash
# from the repo root: build the packages the example installs
pnpm install
pnpm build:lib

cd examples/react-native-expo
npm install
npx expo install --fix   # align native module versions with the Expo SDK
cp .env.example .env     # put your WalletConnect project id in EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID

npx expo prebuild
npx expo run:android
# or
npx expo run:ios
```

The app is hard-wired to `network="testnet"`. Fund the connected account with [Friendbot](https://laboratory.stellar.org/#friendbot).

Freighter and Albedo are browser wallets, so the Connect button uses WalletConnect, which hands signing to a mobile wallet app. It stays disabled until a project id is configured.

## Screens

### Connect
Pairs with a Stellar wallet via WalletConnect. Shows the connected account address.

### Balance
Displays the connected account's native XLM balance and sequence number.

### History
Lists recent payment transactions on testnet in an infinite-scrolling list.

### Send
Sends a testnet XLM payment to a specified address. Requires a connected wallet and adequate funds (use Friendbot to fund).

### Read
Demonstrates `useSorobanContract` for read-only contract calls. Enter a contract ID (C-prefixed), a method name, and invoke the call. The result is decoded and displayed. Contract must exist on testnet.

**Example testnet contracts**: Check the [Soroban documentation](https://developers.stellar.org/docs/learn/storing-data) for public testnet contracts, or deploy your own using `soroban-cli`.

### Write
Demonstrates `useSorobanWrite` for contract mutations. Enter a contract ID, method name, and optional arguments. The transaction is simulated, signed by the connected wallet, and submitted to testnet. The result includes the transaction hash and any returned value.

**Write flows tested**: This is where WalletConnect signing, deep-link handling, and mobile native code paths are exercised on a real device.

## Environment setup

Create `.env` from `.env.example` and add your WalletConnect project id:

```bash
cp .env.example .env
# Edit .env and set:
EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

The project id comes from [WalletConnect Cloud](https://cloud.walletconnect.com):
1. Create a project in WalletConnect Cloud
2. Copy the **Project ID** (not the secret key)
3. Paste it into `.env`

**Never commit `.env` or a real project id.** Only `.env.example` is tracked.

## Typecheck

The repo's `pnpm typecheck` covers this example against the package sources, without installing it:

```bash
pnpm typecheck
```

## Secrets

Do not commit `.env` or a WalletConnect project id. Only `.env.example` is tracked.
