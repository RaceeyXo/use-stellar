# Quickstart

Build a React component that connects Freighter, reads an XLM balance, and sends
a payment on Stellar testnet.

## Before you start

You need Node.js 20.19+ or 22.12+, plus the
[Freighter browser extension](https://freighter.app/). In Freighter, select
Testnet as the active network and fund your account with test XLM.

Create a Vite React TypeScript project and install `use-stellar`:

```bash
npm create vite@latest stellar-quickstart -- --template react-ts
cd stellar-quickstart
npm install
npm install use-stellar @stellar/stellar-sdk
```

## Step 1 - Wrap the app in `StellarProvider`

Replace `src/main.tsx` with this file. Setting `network="testnet"` keeps every
hook and transaction on Stellar testnet.

```tsx
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { StellarProvider } from "use-stellar"
import App from "./App.tsx"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StellarProvider network="testnet">
      <App />
    </StellarProvider>
  </StrictMode>
)
```

## Step 2 - Connect Freighter with `useWallet`

Replace `src/App.tsx` with this component. `connect("freighter")` opens
Freighter and asks the user to approve the connection.

```tsx
import { useWallet } from "use-stellar"

export default function App() {
  const { address, connected, connecting, error, connect, disconnect } = useWallet()

  return (
    <main>
      <h1>Stellar testnet wallet</h1>

      {connected ? (
        <section>
          <p>
            Connected account: <code>{address}</code>
          </p>
          <button type="button" onClick={disconnect}>
            Disconnect
          </button>
        </section>
      ) : (
        <button
          type="button"
          disabled={connecting}
          onClick={() => connect("freighter")}
        >
          {connecting ? "Connecting..." : "Connect Freighter"}
        </button>
      )}

      {error && <p role="alert">{getErrorMessage(error)}</p>}
    </main>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
```

## Step 3 - Display the XLM balance with `useBalance`

Replace `src/App.tsx` with this component. `useBalance` uses the connected
wallet address by default and refreshes the XLM balance every ten seconds.

```tsx
import { useBalance, useWallet } from "use-stellar"

export default function App() {
  const wallet = useWallet()
  const {
    balance,
    loading: balanceLoading,
    error: balanceError,
    refetch,
  } = useBalance({
    asset: "XLM",
    watch: true,
  })

  if (!wallet.connected) {
    return (
      <main>
        <h1>Stellar testnet wallet</h1>
        <button
          type="button"
          disabled={wallet.connecting}
          onClick={() => wallet.connect("freighter")}
        >
          {wallet.connecting ? "Connecting..." : "Connect Freighter"}
        </button>
        {wallet.error && <p role="alert">{getErrorMessage(wallet.error)}</p>}
      </main>
    )
  }

  return (
    <main>
      <h1>Stellar testnet wallet</h1>
      <p>
        Connected account: <code>{wallet.address}</code>
      </p>
      <p>
        XLM balance: <strong>{balanceLoading ? "Loading..." : (balance ?? "0")}</strong>
      </p>
      <button type="button" onClick={refetch} disabled={balanceLoading}>
        Refresh balance
      </button>
      <button type="button" onClick={wallet.disconnect}>
        Disconnect
      </button>
      {balanceError && <p role="alert">{getErrorMessage(balanceError)}</p>}
    </main>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
```

## Step 4 - Send a payment with `useSendPayment`

Replace `src/App.tsx` one last time. Enter another funded Stellar testnet
account, choose an amount, and approve the transaction in Freighter.

```tsx
import { useState, type FormEvent } from "react"
import { useBalance, useSendPayment, useWallet } from "use-stellar"

export default function App() {
  const wallet = useWallet()
  const {
    balance,
    loading: balanceLoading,
    error: balanceError,
    refetch,
  } = useBalance({
    asset: "XLM",
    watch: true,
  })
  const { send, loading: sending, error: paymentError, result, reset } = useSendPayment()
  const [destination, setDestination] = useState("")
  const [amount, setAmount] = useState("1")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    reset()

    try {
      await send({
        to: destination.trim(),
        asset: "XLM",
        amount,
        memo: "use-stellar quickstart",
      })
      refetch()
    } catch (error) {
      console.error(error)
    }
  }

  if (!wallet.connected) {
    return (
      <main>
        <h1>Stellar testnet payment</h1>
        <button
          type="button"
          disabled={wallet.connecting}
          onClick={() => wallet.connect("freighter")}
        >
          {wallet.connecting ? "Connecting..." : "Connect Freighter"}
        </button>
        {wallet.error && <p role="alert">{getErrorMessage(wallet.error)}</p>}
      </main>
    )
  }

  return (
    <main>
      <h1>Stellar testnet payment</h1>
      <p>
        Connected account: <code>{wallet.address}</code>
      </p>
      <p>
        XLM balance: <strong>{balanceLoading ? "Loading..." : (balance ?? "0")}</strong>
      </p>

      <form onSubmit={handleSubmit}>
        <label htmlFor="destination">Destination testnet account</label>
        <input
          id="destination"
          name="destination"
          value={destination}
          onChange={event => setDestination(event.target.value)}
          required
        />

        <label htmlFor="amount">Amount in XLM</label>
        <input
          id="amount"
          name="amount"
          type="number"
          min="0.0000001"
          step="0.0000001"
          value={amount}
          onChange={event => setAmount(event.target.value)}
          required
        />

        <button type="submit" disabled={sending}>
          {sending ? "Sending..." : "Send XLM"}
        </button>
      </form>

      <button type="button" onClick={wallet.disconnect} disabled={sending}>
        Disconnect
      </button>

      {balanceError && <p role="alert">{getErrorMessage(balanceError)}</p>}
      {paymentError && <p role="alert">{getErrorMessage(paymentError)}</p>}
      {result && (
        <p>
          Payment submitted: <code>{result.hash}</code>
        </p>
      )}
    </main>
  )
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
```

Start the development server:

```bash
npm run dev
```

Open the local URL shown by Vite, connect Freighter, and approve requests only
when Freighter shows Testnet.

## What's next

- [`useWallet`](../hooks/use-wallet.md) - wallet connection and account state
- [`useBalance`](../hooks/use-balance.md) - XLM and issued asset balances
- [`useSendPayment`](../hooks/use-send-payment.md) - payment options and results
- [SSR and Next.js App Router](../guides/ssr.md) - how to use use-stellar in Next.js, Remix, and other SSR frameworks
