# Manage offers with Vue

Configure createStellarPlugin({ network: "testnet" }) and connect a wallet. Call useManageOffer() inside setup(). useManagerOffer is a compatibility alias; the correctly spelled React useManageOffer export remains unchanged.

```ts
import { useManageOffer } from "@use-stellar/vue"
const { createOffer, updateOffer, cancelOffer, loading, error, result, reset } = useManageOffer()
const offer = {
  selling: "XLM" as const,
  buying: { code: "USD", issuer: testnetIssuer },
  amount: "2",
  price: "1",
  side: "sell" as const,
}
await createOffer(offer)
await updateOffer(existingOfferId, offer)
await cancelOffer(existingOfferId)
```

loading, error and result are refs. Actions share React's validation, network fee resolution, signing and submission. Buy offers use buyAmount; sell offers use amount. Cancellation looks up the existing offer's assets and price and submits a zero-amount sell operation. Successful writes invalidate the connected account cache.

As in React, these methods return null on errors and expose the StellarError in error. An error retains the previous result, except that a timeout replaces it with a pending result. Signature rejection remains WALLET_REQUEST_REJECTED; Horizon result codes remain specific (such as LOW_RESERVE). A 504 records TX_TIMEOUT and a pending result with its transaction hash. Check that transaction before retrying. An unsuccessful submitted response returns a failed result. Offline calls do not fetch offers, sign, queue or submit anything.

reset() clears state and ignores previous completions. Newer calls and disposed scopes ignore stale updates. Reset does not cancel a transaction that has already been signed. The React-free use-stellar/core entry exports manageOffer, createOffer, updateOffer, cancelOffer and ManageOfferRuntime for framework adapters.
