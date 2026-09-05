# Networks

Understand the difference between Stellar's networks, get free test funds with
Friendbot, and point your app at testnet, mainnet, futurenet, or a local
standalone node with the `network` prop.

## Testnet vs mainnet

Stellar runs several independent networks. Each has its own ledger, its own
accounts, and its own XLM. A testnet account does not exist on mainnet, and a
mainnet account does not exist on testnet.

### Testnet

Testnet is a free, public sandbox run by the Stellar Development Foundation
(SDF). It exists so developers can build and test without risking real money.
Accounts, balances, and transactions on testnet have **no real-world value**.

- Horizon API: `https://horizon-testnet.stellar.org`
- Soroban RPC: `https://soroban-testnet.stellar.org`
- Test XLM can be created for free with Friendbot.

### Mainnet

Mainnet is the production Stellar network. Every XLM and every issued asset on
mainnet has **real-world value**. Transactions on mainnet move real money and
cannot be undone.

- Horizon API: `https://horizon.stellar.org`
- Soroban RPC: `https://soroban.stellar.org`
- XLM must be bought or received from another account.

## use-stellar defaults to testnet

`use-stellar` keeps you safe during development. If you do not pass the
`network` prop, `StellarProvider` defaults to `"testnet"`:

```tsx
import { StellarProvider } from "use-stellar"

export function App() {
  return (
    <StellarProvider>
      <YourApplication />
    </StellarProvider>
  )
}
```

Because the default is testnet, a forgotten `network` prop cannot accidentally
send real funds. Only set `network="mainnet"` when you are ready for real
transactions.

## Funding a testnet account with Friendbot

Friendbot is a free service that creates and funds a new testnet account with
10,000 testnet XLM. You can use it from the browser or from your code.

### Option 1 — use the Stellar Laboratory

1. Open the [Stellar Laboratory](https://laboratory.stellar.org).
2. Navigate to the **Friendbot** tab.
3. Paste a testnet public address (an account key that starts with `G`).
4. Click **Get test network lumens**.
5. The account is created and funded instantly.

### Option 2 — use the Friendbot endpoint from your code

Friendbot is a simple HTTP endpoint. You can call it with `fetch` or any HTTP
client:

```ts
const address = "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"

const response = await fetch(`https://friendbot.stellar.org?addr=${address}`)
const result = await response.json()

if (!response.ok) {
  throw new Error(result.detail ?? "Friendbot request failed")
}
```

Friendbot only works for **testnet**. A Friendbot request funds an account on
the testnet ledger, not on mainnet.

## Switching networks with the `network` prop

Pass `"testnet"` or `"mainnet"` to the `network` prop on `StellarProvider`. This
configures the Horizon and Soroban endpoints for every hook in your app.

```tsx
import { StellarProvider } from "use-stellar"

export function App() {
  return (
    <StellarProvider network="mainnet">
      <YourApplication />
    </StellarProvider>
  )
}
```

You can switch the network dynamically. When the `network` prop changes, the
context updates its config instantly and every downstream hook re-queries on the
new network:

```tsx
import { useState } from "react"
import { StellarProvider } from "use-stellar"
import type { StellarNetwork } from "use-stellar"

export function App() {
  const [network, setNetwork] = useState<StellarNetwork>("testnet")

  return (
    <StellarProvider network={network}>
      <button onClick={() => setNetwork("testnet")}>Use testnet</button>
      <button onClick={() => setNetwork("mainnet")}>Use mainnet</button>
      <YourApplication />
    </StellarProvider>
  )
}
```

You can read the active network anywhere in your app with `useNetwork`:

```tsx
import { useNetwork } from "use-stellar"

function NetworkBanner() {
  const { network, isTestnet } = useNetwork()

  if (isTestnet) {
    return <p>Connected to Stellar testnet.</p>
  }

  return <p>Connected to Stellar mainnet.</p>
}
```

### Keep the wallet on the same network

A wallet extension such as Freighter has its own active network setting. Your
app's `network` prop and your wallet must be on the same network, or
transactions fail with a network mismatch. When you switch your app to mainnet,
switch your wallet to mainnet too.

## Warning — never test with real funds on mainnet

Mainnet transactions move real money and cannot be reversed. If you point a test
script or a debug button at mainnet, you can permanently lose real XLM or
assets.

- Keep `network="testnet"` everywhere you test.
- Never reuse a mainnet address in a Friendbot request or a tutorial.
- Guard mainnet with an explicit confirmation in your UI before sending.
- Keep a hard-coded `network="testnet"` until you are ready to deploy.

## Futurenet

Futurenet is where new protocol features land before they reach testnet. If you
are building against a Soroban feature that is not on testnet yet, this is the
network you want. Like testnet, its XLM has no real-world value.

- Horizon API: `https://horizon-futurenet.stellar.org`
- Soroban RPC: `https://rpc-futurenet.stellar.org`
- Network passphrase: `Test SDF Future Network ; October 2022`

```tsx
import { StellarProvider } from "use-stellar"

export function App() {
  return (
    <StellarProvider network="futurenet">
      <YourApplication />
    </StellarProvider>
  )
}
```

Fund a futurenet account with the futurenet Friendbot:

```ts
await fetch(`https://friendbot-futurenet.stellar.org?addr=${address}`)
```

## Custom and local networks

A local quickstart or standalone container generates its own network. So does a
private deployment. Use `network="custom"` and supply everything:

```tsx
import { StellarProvider } from "use-stellar"

export function App() {
  return (
    <StellarProvider
      network="custom"
      networkConfig={{
        horizonUrl: "http://localhost:8000",
        sorobanUrl: "http://localhost:8000/soroban/rpc",
        networkPassphrase: "Standalone Network ; February 2017",
      }}
    >
      <YourApplication />
    </StellarProvider>
  )
}
```

All three fields are required for a custom network. Leave out
`networkPassphrase` and the provider throws when it renders — see below for
why that is deliberate.

You can also override just the endpoints for a network this library knows,
without restating its passphrase:

```tsx
<StellarProvider
  network="mainnet"
  networkConfig={{
    horizonUrl: "https://horizon.my-node.com",
    sorobanUrl: "https://rpc.my-node.com",
  }}
>
  <YourApplication />
</StellarProvider>
```

## Why the network passphrase matters

The passphrase is what binds a signature to one network.

It is mixed into the transaction hash before signing, so the same transaction
envelope signed with the testnet passphrase is invalid on mainnet, and vice
versa. This is Stellar's replay protection between networks: without it, a
transaction you signed on testnet could be replayed against your mainnet
account.

That is why a wrong passphrase is worse than a missing one. A transaction
signed against the wrong network is rejected by the target network, and the
rejection says nothing about the passphrase — you get an opaque failure with no
indication of the actual cause.

So `use-stellar` never picks a passphrase for you when it cannot know the right
one. A custom network with no `networkPassphrase` throws immediately, at
provider render, where the mistake is obvious:

```
use-stellar: Invalid networkConfig — `networkPassphrase` is required when
network="custom". There is no default passphrase for a network this library
ships no configuration for, and guessing one would sign transactions that the
target network rejects.
```

The passphrases for the networks this library knows:

| Network | Passphrase |
| :--- | :--- |
| `testnet` | `Test SDF Network ; September 2015` |
| `mainnet` | `Public Global Stellar Network ; September 2015` |
| `futurenet` | `Test SDF Future Network ; October 2022` |

Read the resolved passphrase anywhere with `useNetwork`, or from the provider's
`networkConfig`:

```tsx
import { useStellarContext } from "use-stellar"

function PassphraseBanner() {
  const { networkConfig } = useStellarContext()

  return <p>Signing against: {networkConfig.networkPassphrase}</p>
}
```

### Wallets on a custom network

A wallet reports the network it is on by passphrase. When it reports one this
library ships no configuration for, `useWallet` returns
`walletNetwork: "custom"` and puts the raw value on
`walletNetworkPassphrase` — a value your UI can render, rather than an error.

Albedo is the exception: it confirms the network per request rather than
exposing a current one, so it cannot be used with `network="custom"` and says
so rather than signing against a guess.

## Exploring the chain

Use these tools to inspect accounts, balances, and transactions:

- [Stellar Laboratory](https://laboratory.stellar.org) — build and submit
  transactions, use Friendbot, and explore the testnet.
- [Stellar Expert](https://stellar.expert) — an explorer for the Stellar
  network with account, asset, and transaction details.

## Related guides

- [`StellarProvider`](../getting-started/stellar-provider.md) — the `network`
  prop and provider configuration.
- [Connecting Wallets](./wallets.md) — setting up Freighter on testnet.
- [`useNetwork`](../hooks/use-network.md) — reading the active network in a
  component.
