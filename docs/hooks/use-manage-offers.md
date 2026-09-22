**`docs/hooks/use-manage-offer.md`**
```markdown
# useManageOffer

A signing hook for creating, updating, and cancelling SDEX offers.

> **Note**: Passive offers (`managePassiveSellOffer`) are explicitly out of scope for this hook.

## Cancelling an Offer
In Stellar, there is no discrete `delete` operation. Cancelling an offer is simply updating it with an `amount` of `"0"`. `useManageOffer` abstracts this into a first-class `cancelOffer` function so you never have to pass `"0"` directly, but consumers reviewing their transaction histories will see a "Manage Offer" operation instead of a delete.

## Usage

```tsx
import { useManageOffer } from "@use-stellar/core"

function OfferManager() {
  const { createOffer, updateOffer, cancelOffer, loading, error } = useManageOffer()

  const placeOffer = async () => {
    await createOffer({
      selling: "XLM",
      buying: { code: "USDC", issuer: "GB...TESTNET" },
      amount: "100.5",
      price: "0.25", // Decimal strings are parsed precisely by the Stellar SDK
      side: "sell"   // Uses manageSellOffer under the hood
    })
  }

  const editOffer = async () => {
    await updateOffer("12345", {
      selling: "XLM",
      buying: { code: "USDC", issuer: "GB...TESTNET" },
      amount: "50",
      price: { n: 1, d: 4 }, // Rational price representation
    })
  }

  const deleteOffer = async () => {
    await cancelOffer("12345")
  }

  return (
    <div>
      <button onClick={placeOffer}>Place</button>
      <button onClick={editOffer}>Update</button>
      <button onClick={deleteOffer}>Cancel</button>
      {error && <p>{error.message}</p>}
    </div>
  )
}