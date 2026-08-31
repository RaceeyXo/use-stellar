# Changelog

All notable changes to use-stellar will be documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
## [Unreleased]

### Fixed
- `usePayments` now extracts real transfers from Soroban `invoke_host_function` operations instead of returning blank 0 XLM rows.
- `usePayments` reports the actual merged amount for `account_merge` operations by reading operation effects.
- Unhandled payment operation types are filtered out instead of being returned as fabricated zero-amount rows.

### Added
- Typed wallet adapter, payment, asset, trustline, and Soroban simulation error codes.
- Wallet network mismatch detection now compares provider intent with the network reported by every adapter.
- Custom Horizon URLs are honored by Horizon hooks, including local HTTP nodes.
- `useContractEvents` hook — poll Soroban contract events with cursor-based pagination, topic filters, a bounded buffer, and a distinct `LEDGER_OUT_OF_RELENTION` error when a start ledger predates the RPC's retention window-
- Custom network passphrase support — `StellarNetwork` now includes `"futurenet"` and `"custom"`, `NetworkConfig` carries `networkPassphrase`, and `CustomNetworkConfig` accepts one
- `NETWORK_PASSPHRASES` and `getNetworkPassphrase()` exported for reading a network's passphrase
- Fee strategy — `fee` and `feeMultiplier` options on `useSendPayment`, `useAddTrustline`, and `usePathPayment`, with `DEFAULT_FEE_MULTIPLIER` exported
- New error codes: `DESTINATION_NOT_FOUND`, `SEQUENCE_MISMATCH , `FEE_TOO_LOW`, `LEDGER_OUT_OF_RELENTION`
- Recorded Horizon error fixtures under `src/__tests__/fixtures/` for classification tests
