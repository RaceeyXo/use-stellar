# @use-stellar/vue

Vue 3 composables for the Stellar network. Every composable reads and writes through one runtime installed by the plugin, so they share a single query cache.

```bash
npm install @use-stellar/vue @stellar/stellar-sdk vue
```

## Setup

| Page                                                           | Description                                                             |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`createStellarPlugin`](./create-stellar-plugin.md)            | Installs the runtime: network configuration and the shared query cache. |
| [`createStellarTestHarness`](./create-stellar-test-harness.md) | Provides the runtime to composables in tests, with no component tree.   |

## Reading data

| Composable                                          | Description                                                |
| --------------------------------------------------- | ---------------------------------------------------------- |
| [`useBalance`](./use-balance.md)                    | XLM or issued-asset balance of an account.                 |
| [`useClaimableBalance`](./use-claimable-balance.md) | Claimable balances an account can claim.                   |
| [`usePayments`](./use-payments.md)                  | Paginated payment operations for an account.               |
| [`usePaymentHistory`](./use-payment-history.md)     | The same payments, filtered by direction or asset.         |
| [`useSorobanContract`](./use-soroban-contract.md)   | A read-only Soroban contract call, simulated and decoded.  |
| [`useContractEvents`](./use-contract-events.md)     | Polls the events emitted by one or more Soroban contracts. |

## Sending transactions

These sign with the wallet connected to the runtime.

| Composable                                  | Description                                             |
| ------------------------------------------- | ------------------------------------------------------- |
| [`useSendPayment`](./use-send-payment.md)   | Sends a payment in XLM or an issued asset.              |
| [`usePathPayment`](./use-path-payment.md)   | Pays in one asset while the recipient receives another. |
| [`useAddTrustline`](./use-add-trustline.md) | Adds or removes a trustline to an issued asset.         |

## React equivalents

Most composables mirror a React hook. See the [React hooks reference](../hooks/use-balance.md) and the "Differences from React" section on each page.
