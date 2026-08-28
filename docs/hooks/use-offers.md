# useOffers

Fetches a paginated list of open SDEX offers for a specific account.

## Usage

```tsx
import { useOffers } from "@use-stellar/core"

function MyOffers() {
  const { offers, loading, error, hasNext, fetchNext } = useOffers({
    address: "GB...TESTNET", // defaults to connected wallet if omitted
    limit: 10
  })

  if (loading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <div>
      {offers.map(offer => (
        <div key={offer.id}>
          Selling {offer.amount} at price {offer.price}
        </div>
      ))}
      {hasNext && <button onClick={fetchNext}>Load More</button>}
    </div>
  )
}