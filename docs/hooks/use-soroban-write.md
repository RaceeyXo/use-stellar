# `useSorobanWrite`

Invoke, sign, and submit a Soroban contract call. This hook orchestrates the full five-step lifecycle required to mutate contract state on the Stellar network:

1. **Build**: Constructs the invocation transaction.
2. **Simulate**: Runs the transaction against the Soroban RPC to calculate the resource footprint and fee.
3. **Assemble**: Merges the simulation's `minResourceFee` and footprint into the transaction.
4. **Sign**: Prompts the user's connected wallet adapter to sign the payload.
5. **Send & Poll**: Submits the transaction to the network and polls until execution completes.

> **Note on Auth Entries:** If the contract requires authorization from multiple parties, this hook currently only prompts the connected source account for a signature. Multi-party `signAuthEntry` aggregation is not yet supported.

## Usage

```tsx
import { useSorobanWrite } from "use-stellar"
import { xdr } from "@stellar/stellar-sdk"

function Counter() {
  const { invoke, loading, error, result } = useSorobanWrite<number>()

  const handleIncrement = async () => {
    try {
      const { hash, result: newCount } = await invoke({
        contractId: "CAC...",
        method: "increment",
        args: [xdr.ScVal.scvU32(1)],
        fee: "100", // Optional inclusion fee (resource fee is calculated automatically)
        timeout: 30000 // Poll timeout in ms
      })
      console.log(`Success! Hash: ${hash}, New Count: ${newCount}`)
    } catch (err) {
      if (err.name === "RESTORE_PREAMBLE_REQUIRED") {
        console.error("Contract state is archived. A RestoreFootprint transaction must be submitted first.")
      } else if (err.name === "TX_TIMEOUT") {
        console.warn(`Polling timed out, but transaction ${err.hash} might still land.`)
      }
    }
  }

  return (
    <div>
      <button onClick={handleIncrement} disabled={loading}>
        {loading ? "Incrementing..." : "Increment"}
      </button>
      {error && <p>Error: {error.message}</p>}
      {result && <p>Count updated to: {result.result}</p>}
    </div>
  )
}
