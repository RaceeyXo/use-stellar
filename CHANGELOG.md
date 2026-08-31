# Changelog

All notable changes to use-stellar will be documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
## [Unreleased]

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
