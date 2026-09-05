# Changelog

All notable changes to use-stellar will be documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added

- Request caching and deduplication — every read hook resolves through a shared
  store created per `StellarProvider`. Concurrent hooks on the same key make one
  Horizon request, and a remount within `gcTime` serves from cache.
  Configurable via the `queryConfig` prop (`staleTime`, `gcTime`).
- `autoConnect` prop on `StellarProvider` — restores the previous wallet session
  on mount without ever popping an approval dialog on page load.
- Typed wallet adapter, payment, asset, trustline, and Soroban simulation error codes.
- Wallet network mismatch detection now compares provider intent with the network reported by every adapter.
- Custom Horizon URLs are honored by Horizon hooks, including local HTTP nodes.
- `useContractEvents` hook — poll Soroban contract events with cursor-based pagination, topic filters, a bounded buffer, and a distinct `LEDGER_OUT_OF_RETENTION` error when a start ledger predates the RPC's retention window.
- Custom network passphrase support — `StellarNetwork` now includes `"futurenet"` and `"custom"`, `NetworkConfig` carries `networkPassphrase`, and `CustomNetworkConfig` accepts one.
- `NETWORK_PASSPHRASES` and `getNetworkPassphrase()` exported for reading a network's passphrase.
- Fee strategy — `fee` and `feeMultiplier` options on `useSendPayment`, `useAddTrustline`, and `usePathPayment`, with `DEFAULT_FEE_MULTIPLIER` exported.
- New error codes: `DESTINATION_NOT_FOUND`, `SEQUENCE_MISMATCH`, `FEE_TOO_LOW`, `LEDGER_OUT_OF_RETENTION`.
- Recorded Horizon error fixtures under `src/__tests__/fixtures/` for classification tests.
- `engines.node` (`>=20`) declares the package's support floor, matching the
  `target` used by both the typechecker and the build.

### Changed

- **Stale-while-revalidate.** A failed refresh now keeps the last known-good data
  and `lastUpdated`, surfacing the error alongside them, instead of clearing
  both. A transient Horizon 429 no longer blanks a polling balance display. A
  *first* fetch that fails still yields `null` data — there is nothing to keep.
- `StellarProvider`'s context value is memoized. It was rebuilt on every render,
  which re-rendered every consumer in the tree regardless of what changed.
- The `exports` map declares separate `types` for the `import` and `require`
  conditions, so ESM consumers resolve `index.d.mts` instead of being served a
  CommonJS declaration file. `./package.json` is exported too.
- `@stellar/freighter-api` and `@albedo-link/intent` are no longer bundled into
  `dist`. They were shipped twice — inlined *and* installed as dependencies —
  which prevented consumers from deduping or overriding either.
- `src/` is published alongside `dist/`, so the shipped source maps resolve.
- `@stellar/freighter-api` is imported via its default export. It is a minified
  CommonJS bundle whose named exports Node's ESM loader cannot detect, so
  `import { WatchWalletChanges }` threw "Named export not found" at load time for
  ESM consumers.

### Removed

- `@lobstrco/signer-extension-api` dependency. It was imported nowhere in the
  library — LOBSTR is registered as an explicitly unsupported adapter — but every
  consumer downloaded it.

### Fixed

- `useSendPayment` and `useAddTrustline` built their Horizon client from the
  network name rather than the resolved config, so a custom `horizonUrl` was
  ignored on exactly the two paths that move value.
- Transactions Horizon accepts with `successful: false` are now classified from
  the full result-code table. `tx_bad_seq` and `tx_insufficient_fee` were named
  on the rejection path but flattened to `TRANSACTION_FAILED` on this one.
- `useSorobanContract` no longer re-wraps its error on every render, so
  `useEffect(..., [error])` in a consumer stops re-firing indefinitely. Its cache
  key now distinguishes spec-aware from raw calls, which decode differently.
- A number outside `Number.MAX_SAFE_INTEGER` passed as a Soroban argument is
  refused with a message naming the precision loss, rather than the generic
  "which width did you mean" error.

## [0.1.5]

### Added

- `usePayments` hook — paginated payment history for an account
- `useClaimableBalance` hook — claimable balances for an account
- `useWallet` — network-mismatch detection (`isNetworkMismatch`, `walletNetwork`, `refreshWalletNetwork`) and `walletName`
- `useBalance` — configurable polling `interval` option and `lastUpdated` timestamp

### Changed

- All hooks now return a typed `StellarError` (with `code` and `message`) via the `error` field, instead of a plain string
- Corrected `packages/core/README.md` to match the actual hook signatures (`useAccount`, `useTransaction`, `useAsset`, `useSorobanContract` had drifted from their documented shapes)

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
