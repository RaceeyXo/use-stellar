# use-stellar Expo example

Runnable Expo development-build example for `@use-stellar/react-native` on the Stellar **testnet**.

It shows:

- Polyfills imported first (`index.js` → `src/polyfills.ts` → `@use-stellar/react-native/polyfills`)
- `StellarProvider` from `@use-stellar/react-native`, with `autoConnect` restoring the session through AsyncStorage
- WalletConnect configured from environment config (the project id is never committed)
- Deep-link scheme `use-stellar` in `app.json`
- Screens: connect wallet, balance/account, payment history (infinite scroll), send payment

## Prerequisites

- Node 20+
- A [WalletConnect Cloud](https://cloud.walletconnect.com) project id
- A Stellar wallet app that supports WalletConnect, on the device or simulator
- An Expo development build (WalletConnect needs native modules; Expo Go is not enough)

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

## Typecheck

The repo's `pnpm typecheck` covers this example against the package sources, without installing it:

```bash
pnpm typecheck
```

## Secrets

Do not commit `.env` or a WalletConnect project id. Only `.env.example` is tracked.
