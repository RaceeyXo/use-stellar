# Changelog

All notable changes to use-stellar will be documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [0.2.2] — Unreleased

### Added

- **`transactionTimeout` provider prop** — how long (seconds) a transaction
  built by the write hooks stays valid. Defaults to 30, as before. The clock
  starts before the wallet is asked to sign, so it has to cover signing.
- **`platform` provider prop** — declare the platform instead of detecting it.
  Adapter packages use it: React Native defines a global `window`, so detection
  alone mistook a native app for a browser.
- `NATIVE_PLATFORM`, `createPlatformCapabilities`, `detectPlatform` and the
  `PlatformCapabilities` type are exported.
- A top-level `react-native` field, so Metro resolves the native entry even
  without package `exports` support (the default before React Native 0.79).
- `canAutoConnect(network)` receives the network being connected to, so an
  adapter with per-network approvals can answer for it. WalletConnect uses it:
  a session approved for mainnet no longer counts as a silent testnet reconnect.

### Fixed

- **Trezor signing never worked.** It called `Transaction.fromXDR`, which does
  not exist in the Stellar SDK, and attached Trezor's hex signature as if it
  were base64. It now parses with `TransactionBuilder.fromXDR`, converts the
  signature, and attaches it to the signing account — which verifies it, so a
  signature from another key or over another transaction is rejected.
- Trezor checks the network before asking the device for an address, so an
  unsupported network no longer costs a confirmation on the device first, and
  its error mapping is no longer case-sensitive ("Bridge is not running" is
  now recognised as unavailable).
- Browser wallets (Freighter, Albedo, xBull, Rabet, HOT, Trezor) are registered
  by the web entry only, as before: one of the wallet merges had moved them
  into the shared registry, which pulled them into the React Native and
  React-free builds.
- `@hot-wallet/sdk`, `@trezor/connect` and `@creit.tech/xbull-wallet-connect`
  are optional peer dependencies and kept out of the bundle, like the other
  wallet SDKs.
- Repaired the build after concurrent merges: a missing `export {` in
  `use-stellar/core`, a duplicated `WalletType` and duplicate registry keys, an
  invalid `packages/vue/package.json`, and two Vue files with two versions of
  their code spliced together.

### Changed

- The bundle-size budget for the main entry is 28 kB (was 26 kB), for the HOT,
  Trezor, xBull and Rabet wallet adapters and the path-payment action.

### `@use-stellar/vue`

- `useSorobanContract` runs on the shared query layer like the other
  composables, instead of a second, Vue-only cache.
- Inputs that change in the same tick produce one query for the final
  combination, not an extra request for the half-updated one in between.
- `useBalance` accepts `maxRetries`, as the React hook does.

### `@use-stellar/react-native` (first release)

- `use-stellar` is a peer dependency, so an app and this package share one copy
  of core (one provider, one wallet registry).
- The `./polyfills` entry is actually built, resolves under every Metro
  configuration, and is no longer tree-shaken away. It installs a working
  `URL` / `URLSearchParams` (React Native's own throws "not implemented") and
  checks `TextEncoder` and `TextDecoder` separately.
- Optional native modules (NetInfo, AsyncStorage, WalletConnect) are loaded the
  way Metro can see them. They were being compiled to a form Metro does not
  follow, so they silently fell back to "always online" and in-memory storage.
  A Metro bundle test now checks this in CI.
- Importing the package no longer crashes when AsyncStorage is missing or not
  linked.
- `autoConnect` sessions are persisted through AsyncStorage (or the `storage`
  prop); the storage was resolved but never used.
- The provider declares the native platform and defaults to a 300-second
  transaction validity, for signing that switches to a wallet app and back.
- AppState and NetInfo listeners are attached with the first subscriber and
  removed with the last; every remount used to leak one of each. NetInfo's
  "not yet known" state is no longer treated as offline.
- WalletConnect: registered before child effects run (so a stored session is
  restored), keyed on the project id rather than re-registered every render,
  and `@walletconnect/react-native-compat` is optional.
- Deep links are parsed without `URLSearchParams`, keep `+` in base64 XDR,
  reject malformed XDR, and hand results nobody is waiting for (the app was
  killed while the user was in the wallet) to `onUnmatchedResult`. The
  duplicate `persistSession` / `restoreSession` / `clearSession` helpers, which
  kept a second session record, are removed; `autoConnect` does that job.
- `assertStellarRuntime`, `checkStellarRuntime` and
  `createReactNativeWalletConnectAdapter` are exported.
- README, test-harness docs and the Expo example corrected (licence, polyfill
  setup, WalletConnect, session storage).

## [0.2.1] — 2026-10-11

First published release of the 0.2 line — `0.2.0` was tagged but never reached
npm. Everything listed under 0.2.0 below ships in this version.

### Changed

- The package's `repository`, `homepage` and `bugs` URLs, and the README links,
  now point at `RaceeyXo/use-stellar`, the repository releases are built from.

## [0.2.0] — 2026-10-11

### Breaking

- **Wallet SDKs are externalized and made optional peer dependencies.**
  `@stellar/freighter-api` and `@albedo-link/intent` are no longer bundled into
  `dist` or installed as dependencies of every consumer. Install only the SDK
  for the wallet you use (`npm install @stellar/freighter-api` or
  `npm install @albedo-link/intent`). A consumer who only uses Freighter
  installs only Freighter, and gets no warning about Albedo.
- Connecting to a wallet whose SDK is not installed now throws a
  `WalletAdapterError("wallet_unavailable", ...)` naming the package to install,
  instead of an unhandled module-resolution rejection or a raw bundler error.
- Removed the never-imported `@lobstrco/signer-extension-api` dependency.
- Removed the (private, non-shipping) root package's runtime dependency on
  `@albedo-link/intent`.
- Node.js 20 is now the minimum supported version (`engines.node`).

### Added

- **`use-stellar/core`** — a React-free entry exposing the query fetchers
  (`fetchAccount`, `fetchAccountExists`, `fetchAsset`, `fetchClaimableBalance`,
  `fetchTransaction`, `fetchFederationLookup`), the cache primitives
  (`QueryStore`, `createQueryObserver`), typed errors and utilities. Callable
  from Server Components, route handlers, scripts and other frameworks.
- **Pluggable wallets** — `registerWalletAdapter`, `getWalletAdapter`,
  `getWalletAdapters`, `hasWalletAdapter` and the `WalletAdapter` contract, so
  an app or wallet vendor can add a wallet without a change to this package.
- **Albedo** is wired into the registry: `connect("albedo")`.
- **WalletConnect** — `createWalletConnectAdapter`, with
  `@walletconnect/sign-client` as an optional peer dependency.
- **Session restore** — the `autoConnect` provider prop and
  `useWallet().restoredWallet`. Reconnects silently when the wallet allows it
  and never raises an approval dialog on page load.
- **Wallet change events** — account and network switches made inside the
  wallet update `useWallet` with no user action.
- `useStreamPayments` — live payments over Horizon Server-Sent Events, with
  reconnect and cursor resume.
- `useContractEvents` — poll Soroban contract events with cursor-based
  pagination, topic filters, a bounded buffer, and a distinct
  `LEDGER_OUT_OF_RETENTION` error when a start ledger predates the RPC's
  retention window.
- `useFederationLookup`, `useAnchor`, `useSep10Auth`, `useCreateAccount`,
  `useFeeStats`, `useOrderbook`, `useOffers`, `useManageOffer`, `useTrades`,
  `usePaymentHistory`, `useTransactionHistory`, `usePaymentPaths`,
  `usePathPayment`, `useAddTrustline`, `useAccountExists`, `useSorobanWrite`.
- **Offline handling** — `onlineManager`. Queries pause while offline and keep
  cached data on screen; stale queries refetch once on reconnect. Write hooks
  fail fast with `NETWORK_ERROR` before anything is built or signed.
- **Focus handling** — `focusManager`. Polling pauses in a hidden tab.
- Custom network passphrase support — `StellarNetwork` now includes
  `"futurenet"` and `"custom"`, `NetworkConfig` carries `networkPassphrase`, and
  `CustomNetworkConfig` accepts one. `NETWORK_PASSPHRASES` and
  `getNetworkPassphrase()` are exported.
- Custom Horizon URLs are honored by every Horizon hook, including local HTTP
  nodes.
- Fee strategy — `fee` and `feeMultiplier` options on `useSendPayment`,
  `useAddTrustline`, and `usePathPayment`, with `DEFAULT_FEE_MULTIPLIER`
  exported.
- Typed wallet adapter, payment, asset, trustline, and Soroban simulation error
  codes, including `DESTINATION_NOT_FOUND`, `SEQUENCE_MISMATCH`, `FEE_TOO_LOW`,
  `MEMO_REQUIRED`, `TX_TIMEOUT` and `LEDGER_OUT_OF_RETENTION`.
- A `react-native` export condition, and `react-dom` is now an optional peer,
  so the package can be consumed from React Native.
- TypeScript projects on the legacy `moduleResolution: "node"` setting can now
  resolve `use-stellar/core` (via `typesVersions`).

### Fixed

- **Freighter and Albedo were missing from production webpack / Next.js
  builds.** The package was marked side-effect free while the built-in wallets
  are registered by the entry module, so bundlers dropped the registration and
  `connect()` failed with `Unknown wallet type "freighter"` — in production
  builds only. The entry files are now declared as having side effects.
- **`connect` changed identity on every wallet state update**, so an effect
  depending on it (`useEffect(() => { connect() }, [connect])`) re-fired after
  every connection and prompted the wallet in a loop.
- **Read hooks never resolved under `<React.StrictMode>`.** The query observer
  was created during render and could not be revived after StrictMode's
  simulated unmount, leaving hooks at `loading: true` and leaking a store
  subscription. The observer now lives in an effect; render is pure, so a
  server render no longer starts Horizon requests either.
- **Rate-limit retries were silently disabled** for `useAccount`, `useAsset`,
  `usePayments`, `useTransactionHistory`, `useTrades`, `useTransaction` and
  `usePaymentPaths`: a normalized 429 no longer carried its status, so it was
  never retried and `maxRetries` did nothing.
- A read hook kept calling a stale `queryFn` when an input that is not part of
  its cache key changed (for example `useTransaction`'s `watch`).
- After going offline with every query unmounted, the app stayed "offline"
  forever: queries never fetched and write hooks kept rejecting.
- `useStreamPayments` opened a second stream on every reconnect without closing
  the first, delivering each payment once per stream. It also kept the previous
  account's payments and cursor after the address or network changed.
- **The published files had no `"use client"` directive** (the bundler stripped
  it), so App Router consumers had to add their own boundary. It is now emitted
  on the React entries — and deliberately not on `use-stellar/core`.
- WalletConnect: an approved session is reused instead of pairing again on
  every `connect()`; signing uses the session that approved the account rather
  than the newest one; `disconnect()` closes the session; a session ended from
  the wallet disconnects the app; a failed client initialisation is no longer
  cached until reload.
- `sendPayment` rejected in React Native with "only available in the browser"
  even though the hook's own guard had allowed it.
- The `react-native` entry was missing `useStreamPayments`,
  `createStellarRuntime`, `resolveNetworkConfig` and the wallet-session helpers.
- `usePayments` now extracts real transfers from Soroban `invoke_host_function`
  operations instead of returning blank 0 XLM rows, reports the actual merged
  amount for `account_merge` operations, and filters out unhandled operation
  types instead of returning fabricated zero-amount rows.
- Wallet network mismatch detection now compares provider intent with the
  network reported by every adapter.

### Changed

- The bundle-size budget for the main entry is 26 kB (was 25 kB).

## [0.1.5]

### Added

- `usePayments` hook — paginated payment history for an account
- `useClaimableBalance` hook — claimable balances for an account
- `useWallet` — network-mismatch detection (`isNetworkMismatch`, `walletNetwork`, `refreshWalletNetwork`) and `walletName`
- `useBalance` — configurable polling `interval` option and `lastUpdated` timestamp
- `useBalance`, `useAccount`, `usePayments`, and `useClaimableBalance` now return an `isStale` flag

### Changed

- All hooks now return a typed `StellarError` (with `code` and `message`) via the `error` field, instead of a plain string
- Corrected `packages/core/README.md` to match the actual hook signatures (`useAccount`, `useTransaction`, `useAsset`, `useSorobanContract` had drifted from their documented shapes)
- **Behaviour change:** `useBalance`, `useAccount`, `usePayments`, and `useClaimableBalance` now follow a stale-while-revalidate contract — a failed fetch (e.g. a transient Horizon rate limit while `watch` is polling) no longer clears the previously-fetched data. It only sets `error` and flips the new `isStale` flag to `true`, so consumers can keep rendering the last known-good value instead of nothing. Data is still cleared immediately when the query itself changes (e.g. `address`), since that data belongs to a different account. See [docs/hooks/use-balance.md](docs/hooks/use-balance.md#stale-while-revalidate).

### Fixed

- Removed `useFriendbot` from documentation — it was never implemented

## [0.1.4] and earlier

- useWallet hook with Freighter support
- useBalance hook with watch option
- useAccount hook
- useSendPayment hook
- useTransaction hook
- useNetwork hook
- useAsset hook
- useSorobanContract hook (read-only)
- StellarProvider context
