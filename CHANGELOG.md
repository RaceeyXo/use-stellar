# Changelog

All notable changes to use-stellar will be documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- `useContractEvents` hook — poll Soroban contract events with cursor-based pagination, topic filters, a bounded buffer, and a distinct `LEDGER_OUT_OF_RELENTION` error when a start ledger predates the RPC's retention window-
- Custom network passphrase support — `StellarNetwork` now includes `"futurenet"` and `"custom"`, `NetworkConfig` carries `networkPassphrase`, and `CustomNetworkConfig` accepts one
- `NETWORK_PASSPHRASES` and `getNetworkPassphrase()` exported for reading a network's passphrase
- Fee strategy — `fee` and `feeMultiplier` options on `useSendPayment`, `useAddTrustline`, and `usePathPayment`, with `DEFAULT_FEE_MULTIPLIER` exported
- New error codes: `DESTINATION_NOT_FOUND`, `SEQUENCE_MISMATCH , `FEE_TOO_LOW`, `LEDGER_OUT_OF_RELENTION`
- Recorded Horizon error fixtures under `src/__tests__/fixtures/` for classification tests
