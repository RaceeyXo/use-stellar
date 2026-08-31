# `useOrderbook`

Fetches the live SDEX order book for an asset pair. Because Stellar exposes an on-chain matching engine, this hook allows you to integrate deep liquidity graphs, accurate spreads, and mid prices.

> **Zero Float Arithmetic:** In the SDEX, prices are stored as exact rationals (`n/d`). This hook performs all internal spread and mid-price arithmetic using native `BigInt` to guarantee you never suffer from JavaScript floating-point rounding bugs (`parseFloat` drift).

## Usage

```tsx
import { useOrderbook } from "use-stellar"

function Orderbook() {
  const { bids, asks, spread, midPrice, loading, error } = useOrderbook({
    selling: "XLM",
    buying: { code: "USDC", issuer: "GBBD47IF6LWK7P7MDEVSCWTTCJM4RTWA6FCIGGLCUAW24G2NBDUTAPP" },
    limit: 10,
    watch: true,     // Enable polling
    interval: 5000   // Poll every 5 seconds
  })

  if (loading && !bids.length) return <p>Loading market...</p>
  if (error) return <p>Error loading market: {error.message}</p>

  return (
    <div>
      <h2>Market Stats</h2>
      <p>Spread: {spread ? `${spread} USDC` : "N/A (Thin Market)"}</p>
      <p>Mid Price: {midPrice ? `${midPrice} USDC` : "N/A"}</p>
      
      <div>
        <h3>Asks</h3>
        {asks.map((ask, i) => (
          <div key={`ask-${i}`}>Sell {ask.amount} XLM at {ask.price}</div>
        ))}
      </div>
    </div>
  )
}