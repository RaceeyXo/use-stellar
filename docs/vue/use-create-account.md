# Create an account with Vue

Install the Stellar plugin with network: "testnet", then call the composable inside setup(). A connected wallet funds the new account; the destination must be a valid, unfunded Ed25519 address.

```ts
import { useCreateAccount } from "@use-stellar/vue"
const { createAccount, loading, error, result, reset } = useCreateAccount()
await createAccount({ destination: recipientPublicKey, startingBalance: "2" })
```

loading, error and result are Vue refs. Fees, minimum reserve validation, wallet signing and submission use the same framework-neutral createAccount action as React. Explicit fee takes precedence over feeMultiplier; the default fee multiplier is 1. Successful transactions invalidate both account caches.

Errors reject the promise with a StellarError (for example WALLET_REQUEST_REJECTED, WRONG_NETWORK or NETWORK_ERROR). A Horizon 504 is TX_TIMEOUT and records a pending result with the transaction hash: look it up before retrying. A submitted unsuccessful transaction returns status: "failed", matching the React API. reset() clears state and ignores earlier completions; scope disposal and newer requests also prevent stale state updates. Offline calls never prompt a wallet or queue a transaction. Resetting state does not cancel an already signed transaction.

The React-free use-stellar/core entry also exports createAccount and CreateAccountRuntime for custom adapters. Supply the runtime network, resolved networkConfig, wallet and queryStore; transactionTimeout is optional (30 seconds by default).
