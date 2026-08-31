# `useCreateAccount`

Funds and activates a new Stellar account on the ledger. 

On Stellar, an address does not exist until it is funded with at least the network's base reserve. Attempting to send a standard payment to an unfunded address results in a `DESTINATION_NOT_FOUND` error. This hook allows your application to seamlessly recover from that error by performing a `createAccount` operation.

> **Dynamic Reserves:** The required base reserve is not a hardcoded constant. This hook dynamically fetches `base_reserve_in_stroops` from the latest network ledger to guarantee your transaction will not fail due to protocol upgrades.

## Usage: The Recovery Flow

The primary use case for this hook is recovering from a `DESTINATION_NOT_FOUND` error when executing a standard payment via `useSendPayment`.

```tsx
import { useState } from "react"
import { useSendPayment, useCreateAccount } from "use-stellar"

function PaymentForm() {
  const [destination, setDestination] = useState("")
  const [amount, setAmount] = useState("10")
  const [needsCreation, setNeedsCreation] = useState(false)

  const { sendPayment, loading: sendLoading, error: sendError } = useSendPayment()
  const { createAccount, loading: createLoading, error: createError } = useCreateAccount()

  const handlePay = async () => {
    try {
      if (needsCreation) {
        // Recover by creating the account
        const { hash } = await createAccount({
          destination,
          startingBalance: amount, // Must meet the minimum reserve (usually 1 XLM)
        })
        console.log("Account created successfully:", hash)
      } else {
        // Standard payment
        const { hash } = await sendPayment({
          to: destination,
          asset: "XLM",
          amount,
        })
        console.log("Payment sent successfully:", hash)
      }
    } catch (err: any) {
      if (err.name === "DESTINATION_NOT_FOUND") {
        // The address doesn't exist yet! Offer the user a chance to fund it.
        setNeedsCreation(true)
      } else if (err.name === "VALIDATION_ERROR") {
        console.error(err.message) // e.g. "The network requires a minimum of 1 XLM..."
      }
    }
  }

  return (
    <div>
      <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="G..." />
      <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount in XLM" />
      
      {needsCreation && <p className="warning">This account doesn't exist yet. Funding it requires XLM.</p>}
      
      <button onClick={handlePay} disabled={sendLoading || createLoading}>
        {needsCreation ? "Fund New Account" : "Send Payment"}
      </button>

      {sendError && !needsCreation && <p>Error: {sendError.message}</p>}
      {createError && <p>Creation Error: {createError.message}</p>}
    </div>
  )
}