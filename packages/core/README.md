# use-stellar

> React hooks for building on the Stellar network.

`use-stellar` is a collection of React hooks that abstract the [Stellar SDK](https://github.com/stellar/js-stellar-sdk) and wallet APIs into a simple, typed interface. Instead of writing hundreds of lines of boilerplate to connect a wallet, fetch balances, or submit transactions, you get clean hooks that handle all of that for you.

```tsx
import { useWallet, useBalance, useSendPayment } from "use-stellar";

function PayButton() {
  const { connected, connect } = useWallet();
  const { balance } = useBalance();
  const { send, loading } = useSendPayment();

  if (!connected) {
    return <button onClick={() => connect()}>Connect wallet</button>;
  }

  return (
    <div>
      <p>Balance: {balance} XLM</p>
      <button
        onClick={() => send({ to: "G...", asset: "XLM", amount: "10" })}
        disabled={loading}
      >
        {loading ? "Sending..." : "Send 10 XLM"}
      </button>
    </div>
  );
}
```

---

## Table of contents

- [Requirements](#requirements)
- [Installation](#installation)
- [Quick start](#quick-start)
- [Provider setup](#provider-setup)
- [Hooks](#hooks)
  - [useWallet](#usewallet)
  - [useBalance](#usebalance)
  - [useAccount](#useaccount)
  - [useSendPayment](#usesendpayment)
  - [useTransaction](#usetransaction)
  - [usePayments](#usepayments)
  - [useClaimableBalance](#useclaimablebalance)
  - [useNetwork](#usenetwork)
  - [useAsset](#useasset)
  - [useSorobanContract](#usesorobancontract)
- [TypeScript](#typescript)
- [Network configuration](#network-configuration)
- [Error handling](#error-handling)
- [Supported wallets](#supported-wallets)
- [Contributing](#contributing)
- [License](#license)

---

## Requirements

Before installing `use-stellar`, make sure your project meets these requirements:

| Requirement | Version |
|---|---|
| Node.js | 18 or later |
| React | 18 or later |
| TypeScript (optional) | 5.0 or later |

`use-stellar` also requires the [Freighter browser extension](https://freighter.app) to be installed for wallet connection to work. Freighter is a free Stellar wallet extension available for Chrome and Firefox.

---

## Installation

Install `use-stellar` and its peer dependency using your preferred package manager:

```bash
# npm
npm install use-stellar @stellar/stellar-sdk

# pnpm
pnpm add use-stellar @stellar/stellar-sdk

# yarn
yarn add use-stellar @stellar/stellar-sdk
```

> **Note:** `@stellar/stellar-sdk` is a peer dependency. It must be installed alongside `use-stellar` in your project.

---

## Quick start

Follow these steps to integrate `use-stellar` into your application.

### 1. Wrap your app in `StellarProvider`

At the root of your application (e.g., `main.tsx` in Vite/CRA, or `app/layout.tsx` in Next.js), wrap your component tree in `StellarProvider`. By default, the provider connects to **Testnet** (recommended for development).

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { StellarProvider } from "use-stellar";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StellarProvider network="testnet">
      <App />
    </StellarProvider>
  </React.StrictMode>
);
```

### 2. Connect a wallet

Use the `useWallet` hook to prompt wallet connection and display connection status.

```tsx
import { useWallet } from "use-stellar";

export function WalletConnect() {
  const { connected, connecting, address, error, connect, disconnect } = useWallet();

  if (connecting) return <button disabled>Connecting...</button>;

  if (connected) {
    return (
      <div>
        <p>Connected: <code>{address}</code></p>
        <button onClick={disconnect}>Disconnect</button>
      </div>
    );
  }

  return (
    <div>
      <button onClick={() => connect("freighter")}>Connect Freighter</button>
      {error && <p style={{ color: "red" }}>{error.message}</p>}
    </div>
  );
}
```

### 3. Read XLM balance

Use the `useBalance` hook to display the user's XLM balance. Pass `watch: true` to automatically poll and update the balance every 10 seconds.

```tsx
import { useBalance } from "use-stellar";

export function AccountBalance() {
  const { balance, loading, error } = useBalance({
    watch: true, // Auto-refreshes every 10s
  });

  if (loading) return <p>Loading balance...</p>;
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>;

  return <p>XLM Balance: <strong>{balance ?? "0"}</strong> XLM</p>;
}
```

### 4. Send a testnet payment

Use the `useSendPayment` hook to submit payments. Ensure the user's wallet is connected before triggering this action.

> [!WARNING]
> **Safety Note:** Always test your application on the Stellar Testnet. Never use real XLM or real assets during development.

```tsx
import { useSendPayment } from "use-stellar";

export function SendPayment() {
  const { send, loading, error, result } = useSendPayment();

  const handlePayment = async () => {
    try {
      const outcome = await send({
        to: "GDLUW7G2E66W4J...", // a valid testnet destination address
        asset: "XLM",
        amount: "1.5",
        memo: "Quickstart test payment",
      });
      console.log("Transaction submitted:", outcome.hash);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <button onClick={handlePayment} disabled={loading}>
        {loading ? "Sending..." : "Send 1.5 XLM"}
      </button>
      {result?.status === "success" && (
        <p style={{ color: "green" }}>Success! Hash: <code>{result.hash}</code></p>
      )}
      {error && <p style={{ color: "red" }}>Payment failed: {error.message}</p>}
    </div>
  );
}
```

---

## Wallet setup & funding

To test your application locally, you will need the Freighter browser wallet set up on the Stellar Testnet.

1. **Install Freighter**: Go to [freighter.app](https://www.freighter.app) and install the extension for Chrome, Firefox, Edge, or Brave.
2. **Switch Freighter to Testnet**: Open Freighter, click the gear icon (Settings) → **Preferences** → **Active Network** → **Test Network**.
3. **Fund your account**: Copy your Stellar public address from Freighter (starts with `G`), then paste it into the [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#friendbot) and click **Get test network lumens**. This funds the account with 10,000 test XLM.

---

## Provider setup

Every hook in `use-stellar` reads its configuration from `StellarProvider`. You must wrap your application — or at minimum the part that uses Stellar hooks — in this provider.

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `network` | `"testnet"` \| `"mainnet"` | `"testnet"` | The Stellar network to connect to |
| `networkConfig` | `{ horizonUrl: string; sorobanUrl: string }` | — | Optional custom Horizon and Soroban RPC URLs. When omitted, the built-in SDF public endpoints are used. Both fields are required if this prop is provided. |
| `children` | `ReactNode` | — | Your application |

### Example

```tsx
import { StellarProvider } from "use-stellar";

// Development — connect to testnet
<StellarProvider network="testnet">
  <App />
</StellarProvider>

// Production — connect to mainnet
<StellarProvider network="mainnet">
  <App />
</StellarProvider>
```

> **Testnet vs mainnet:** Testnet uses fake tokens and is free to use. Use it during development. Mainnet uses real tokens with real value. Never test on mainnet.

---

## Hooks

### useWallet

Connects and disconnects a Stellar wallet. Exposes the connected address, connection state, and detects when the wallet extension is on a different network than the provider.

#### Usage

```tsx
import { useWallet } from "use-stellar";

function MyComponent() {
  const {
    connected,             // boolean — whether a wallet is connected
    connecting,            // boolean — true while the connection is in progress
    address,               // string | null — the connected Stellar address (G...)
    network,               // "testnet" | "mainnet" | null — network from StellarProvider
    wallet,                // "freighter" | "albedo" | "lobstr" | "rabet" | null
    walletName,            // string | null — display name of the connected wallet (e.g. "Freighter")
    walletNetwork,         // "testnet" | "mainnet" | null — the network the wallet extension itself is on
    isNetworkMismatch,     // boolean — true when walletNetwork differs from the provider's network
    error,                 // StellarError | null — the last connection/signing error
    connect,               // (wallet?: WalletType) => Promise<void>
    disconnect,            // () => void
    refreshWalletNetwork,  // () => Promise<void> — re-check the wallet's active network
  } = useWallet();
}
```

#### Return values

| Property | Type | Description |
|---|---|---|
| `connected` | `boolean` | `true` if a wallet is currently connected |
| `connecting` | `boolean` | `true` while a wallet connection is in progress |
| `address` | `string \| null` | The connected wallet's Stellar address, or `null` if disconnected |
| `network` | `StellarNetwork \| null` | The network configured on `StellarProvider` |
| `wallet` | `WalletType \| null` | Which wallet is connected (`"freighter"`, etc.) |
| `walletName` | `string \| null` | Human-readable name of the connected wallet, e.g. `"Freighter"` |
| `walletNetwork` | `StellarNetwork \| null` | The network the wallet extension itself reports being on |
| `isNetworkMismatch` | `boolean` | `true` when the connected wallet is on a different network than `StellarProvider` |
| `error` | `StellarError \| null` | The error from the last failed connection or network check |
| `connect` | `(wallet?: WalletType) => Promise<void>` | Call this to initiate wallet connection |
| `disconnect` | `() => void` | Call this to disconnect the wallet |
| `refreshWalletNetwork` | `() => Promise<void>` | Re-checks the wallet's active network (Freighter only) and updates `walletNetwork` |

#### Parameters

`connect` accepts an optional wallet type:

```tsx
connect()              // defaults to Freighter
connect("freighter")   // explicitly use Freighter
```

> See [Supported wallets](#supported-wallets) — only Freighter is fully wired up today.

#### Network mismatch protection

If a user connects their wallet while it's set to a different network than your `StellarProvider` (e.g. wallet on Mainnet, app configured for Testnet), `isNetworkMismatch` becomes `true`. `useSendPayment` also checks this automatically and throws a clear error before ever building a transaction, so a mismatched signature can't silently land on the wrong network.

```tsx
import { useWallet } from "use-stellar";

function NetworkWarning() {
  const { isNetworkMismatch, walletNetwork, network, refreshWalletNetwork } = useWallet();

  if (!isNetworkMismatch) return null;

  return (
    <p style={{ color: "red" }}>
      Your wallet is on {walletNetwork}, but this app is on {network}.
      Switch networks in your wallet, then{" "}
      <button onClick={refreshWalletNetwork}>refresh</button>.
    </p>
  );
}
```

#### Examples

**Basic connect / disconnect button:**

```tsx
import { useWallet } from "use-stellar";

export function ConnectButton() {
  const { connected, connecting, address, error, connect, disconnect } = useWallet();

  if (connecting) {
    return <button disabled>Connecting...</button>;
  }

  if (connected) {
    return (
      <button onClick={disconnect}>
        {address!.slice(0, 4)}...{address!.slice(-4)}
      </button>
    );
  }

  return (
    <>
      <button onClick={() => connect()}>Connect wallet</button>
      {error && <p className="error">{error.message}</p>}
    </>
  );
}
```

**Gate content behind wallet connection:**

```tsx
import { useWallet } from "use-stellar";

export function ProtectedPage() {
  const { connected, connect } = useWallet();

  if (!connected) {
    return (
      <div>
        <p>You need to connect your wallet to continue.</p>
        <button onClick={() => connect()}>Connect Freighter</button>
      </div>
    );
  }

  return <div>Welcome! You are connected.</div>;
}
```

---

### useBalance

Fetches the balance of any Stellar asset for any address. Optionally polls for live updates.

#### Usage

```tsx
import { useBalance } from "use-stellar";

function MyComponent() {
  const {
    balance,      // string | null — the balance of the requested asset
    balances,     // Balance[] — all balances for the account
    loading,      // boolean
    error,        // StellarError | null
    lastUpdated,  // Date | null — timestamp of the last successful fetch
    refetch,      // () => void — manually re-fetch
  } = useBalance();
}
```

#### Options

Pass an options object to customise the behaviour:

| Option | Type | Default | Description |
|---|---|---|---|
| `address` | `string \| null` | Connected wallet address | The Stellar address to fetch balances for. Defaults to the connected wallet. |
| `asset` | `Asset` | `"XLM"` | The asset to return in `balance`. See [asset format](#asset-format). |
| `watch` | `boolean` | `false` | When `true`, re-fetches automatically on `interval` |
| `interval` | `number` | `10000` | Polling interval in ms, used only when `watch` is `true` |

#### Return values

| Property | Type | Description |
|---|---|---|
| `balance` | `string \| null` | The balance of the requested `asset`, as a decimal string (e.g. `"100.5000000"`). `null` if no trustline exists or address not loaded yet. |
| `balances` | `Balance[]` | All asset balances for the account |
| `loading` | `boolean` | `true` while the first fetch is in progress |
| `error` | `StellarError \| null` | Error from the failed fetch, if any |
| `lastUpdated` | `Date \| null` | Timestamp of the last successful fetch |
| `refetch` | `() => void` | Manually trigger a re-fetch |

#### Asset format

`useBalance` accepts an `asset` option that determines which balance is returned in `balance`. An asset is either:

```tsx
// Native XLM
asset: "XLM"

// Any issued asset (USDC, AQUA, etc.)
asset: { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" }
```

#### Examples

**XLM balance of the connected wallet:**

```tsx
import { useBalance } from "use-stellar";

export function XlmBalance() {
  const { balance, loading, error } = useBalance();

  if (loading) return <p>Loading...</p>;
  if (error)   return <p>Error: {error.message}</p>;

  return <p>XLM Balance: {balance ?? "0"}</p>;
}
```

**USDC balance with live polling every 5s:**

```tsx
import { useBalance } from "use-stellar";

const USDC = {
  code:   "USDC",
  issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
};

export function UsdcBalance() {
  const { balance, loading } = useBalance({ asset: USDC, watch: true, interval: 5000 });

  return <p>USDC Balance: {loading ? "..." : (balance ?? "0")}</p>;
}
```

**Balance of a specific address:**

```tsx
const { balance } = useBalance({
  address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
  asset:   "XLM",
});
```

**All balances for an account:**

```tsx
const { balances } = useBalance();

return (
  <ul>
    {balances.map((b, i) => (
      <li key={i}>
        {b.asset === "XLM" ? "XLM" : b.asset.code}: {b.balance}
      </li>
    ))}
  </ul>
);
```

---

### useAccount

Fetches full account information from Horizon — balances, signers, sequence number, thresholds.

#### Usage

```tsx
import { useAccount } from "use-stellar";

function MyComponent() {
  const {
    account,  // AccountInfo | null
    loading,  // boolean
    error,    // StellarError | null
    refetch,  // () => void
  } = useAccount();
}
```

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `address` | `string \| null` | Connected wallet address | The address to fetch. Defaults to the connected wallet. |

#### `AccountInfo` shape

```ts
interface AccountInfo {
  address:       string;
  sequence:      string;    // current sequence number
  balances:      Balance[]; // all asset balances
  subentryCount: number;    // number of subentries (trustlines, offers, etc.)
  thresholds: {
    lowThreshold:  number;
    medThreshold:  number;
    highThreshold: number;
  };
  signers: {
    key:    string;  // signer Stellar address
    weight: number;
    type:   string;
  }[];
}
```

#### Examples

**Show full account info:**

```tsx
import { useAccount } from "use-stellar";

export function AccountDetails() {
  const { account, loading, error } = useAccount();

  if (loading) return <p>Loading account...</p>;
  if (error)   return <p>Error: {error.message}</p>;
  if (!account) return <p>No account loaded</p>;

  return (
    <div>
      <p>Address: {account.address}</p>
      <p>Sequence: {account.sequence}</p>
      <p>Subentries: {account.subentryCount}</p>
      <p>Signers: {account.signers.length}</p>
    </div>
  );
}
```

**Check if account has multiple signers (multisig):**

```tsx
const { account } = useAccount();
const isMultisig = account ? account.signers.length > 1 : false;
```

**Fetch a different address:**

```tsx
const { account } = useAccount({ address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN" });
```

---

### useSendPayment

Builds, signs, and submits a Stellar payment transaction using the connected wallet. Automatically rejects with a clear error if the wallet is disconnected or its network doesn't match `StellarProvider` (see [network mismatch protection](#network-mismatch-protection)).

#### Usage

```tsx
import { useSendPayment } from "use-stellar";

function MyComponent() {
  const {
    send,     // (options: SendPaymentOptions) => Promise<SendPaymentResult>
    loading,  // boolean — true while tx is being built/signed/submitted
    error,    // StellarError | null
    result,   // SendPaymentResult | null — the result of the last send
    reset,    // () => void — clear error and result
  } = useSendPayment();
}
```

#### `SendPaymentOptions`

| Property | Type | Required | Description |
|---|---|---|---|
| `to` | `string` | Yes | Destination Stellar address (must start with `G`) |
| `asset` | `Asset` | Yes | Asset to send — `"XLM"` or `{ code, issuer }` |
| `amount` | `string` | Yes | Amount as a string, e.g. `"10"` or `"0.5"` |
| `memo` | `string` | No | Optional text memo attached to the transaction |

> **Why is `amount` a string?** JavaScript floating point arithmetic is imprecise. Using a string avoids rounding errors when working with financial values. Pass amounts as strings: `"10"` not `10`.

#### `SendPaymentResult`

```ts
interface SendPaymentResult {
  hash:   string;            // transaction hash on Stellar
  status: TransactionStatus; // "success" | "failed" | "pending" | "not_found"
}
```

`send()` both returns the result on success and throws a `StellarError` on failure — pick whichever pattern fits your code.

#### Examples

**Send XLM:**

```tsx
import { useSendPayment } from "use-stellar";

export function SendXlm() {
  const { send, loading, error, result } = useSendPayment();

  async function handleSend() {
    try {
      await send({
        to:     "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
        asset:  "XLM",
        amount: "10",
      });
    } catch {
      // error is also available via the `error` field below
    }
  }

  return (
    <div>
      <button onClick={handleSend} disabled={loading}>
        {loading ? "Sending..." : "Send 10 XLM"}
      </button>
      {error  && <p style={{ color: "red" }}>Error: {error.message}</p>}
      {result && <p style={{ color: "green" }}>Sent! Hash: {result.hash}</p>}
    </div>
  );
}
```

**Send USDC with a memo:**

```tsx
const { send } = useSendPayment();

await send({
  to:    "G...",
  asset: { code: "USDC", issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN" },
  amount: "50",
  memo:   "Invoice #42",
});
```

**Full send form:**

```tsx
import { useState } from "react";
import { useSendPayment, useWallet } from "use-stellar";

export function SendForm() {
  const { connected }                           = useWallet();
  const { send, loading, error, result, reset } = useSendPayment();

  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");

  // 1. Gate on wallet connection
  if (!connected) {
    return (
      <div style={{ padding: 24 }}>
        <h2>useSendPayment — README Example</h2>
        <p>Connect your wallet to try the payment flow.</p>
        <button onClick={() => connect("freighter")}>Connect Wallet</button>
      </div>
    );
  }

  // 2. Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    reset(); // Clear previous error / result

    try {
      const outcome = await send({
        to,
        asset: "XLM",        // Required — "XLM" or { code: "USDC", issuer: "G..." }
        amount,               // Required — must be a string, e.g. "10"
        memo: "test payment", // Optional
      });
      console.log("Transaction hash:", outcome.hash);
    } catch (err) {
      // Error is also available via the `error` return value
      console.error("Payment failed:", err);
    }
  };

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        reset();
        await send({ to, asset: "XLM", amount });
      }}
    >
      <input
        placeholder="Destination address (G...)"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        required
      />
      <input
        type="number"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        min="0"
        step="0.0000001"
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? "Sending..." : "Send XLM"}
      </button>
      {error  && <p style={{ color: "red" }}>{error.message}</p>}
      {result && <p style={{ color: "green" }}>Transaction confirmed: {result.hash}</p>}
    </form>
  );
}
```

---

### useTransaction

Fetches a transaction by its hash, with optional polling until it settles. Useful for checking the status of a transaction after submission.

#### Usage

```tsx
import { useTransaction } from "use-stellar";

function MyComponent() {
  const {
    transaction,  // TransactionResult | null
    loading,      // boolean
    error,        // StellarError | null
    refetch,      // () => void
  } = useTransaction({ hash: "abc123...", watch: true });
}
```

#### Options

| Option | Type | Description |
|---|---|---|
| `hash` | `string \| null` | The transaction hash to look up. Pass `null` to skip fetching. |
| `watch` | `boolean` | When `true`, polls every 3 seconds until the transaction reaches `"success"` or `"failed"` |

#### `TransactionResult`

```ts
interface TransactionResult {
  hash:       string;
  status:     "pending" | "success" | "failed" | "not_found";
  ledger?:    number;
  createdAt?: string;
  fee?:       string;
  envelope?:  string;
}
```

#### Examples

**Check a transaction after sending:**

```tsx
import { useState } from "react";
import { useSendPayment, useTransaction } from "use-stellar";

export function SendAndTrack() {
  const [hash, setHash]                 = useState<string | null>(null);
  const { send, loading: sending }      = useSendPayment();
  const { transaction, loading: fetching } = useTransaction({ hash, watch: true });

  async function handleSend() {
    const result = await send({ to: "G...", asset: "XLM", amount: "1" });
    setHash(result.hash);
  }

  return (
    <div>
      <button onClick={handleSend} disabled={sending}>
        {sending ? "Sending..." : "Send 1 XLM"}
      </button>

      {hash && (
        <div>
          <p>Hash: {hash}</p>
          <p>Status: {fetching ? "checking..." : transaction?.status}</p>
          {transaction?.ledger && <p>Ledger: {transaction.ledger}</p>}
        </div>
      )}
    </div>
  );
}
```

---

### usePayments

Fetches the payment operation history for an account (payments, account creation, merges, path payments), normalized into one consistent shape, with cursor-based pagination.

#### Usage

```tsx
import { usePayments } from "use-stellar";

function MyComponent() {
  const {
    payments,  // NormalizedPayment[]
    loading,   // boolean
    error,     // StellarError | null
    refetch,   // () => void
    fetchNext, // () => Promise<void>
    fetchPrev, // () => Promise<void>
    hasNext,   // boolean
    hasPrev,   // boolean
  } = usePayments();
}
```

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `address` | `string \| null` | Connected wallet address | The account whose payment history to fetch |
| `limit` | `number` | `10` | Records per page |
| `order` | `"asc" \| "desc"` | `"desc"` | Sort order |
| `cursor` | `string` | — | Horizon paging token to start from |

#### `NormalizedPayment` shape

```ts
interface NormalizedPayment {
  id:        string;
  txHash:    string;
  type:      string;                     // "payment" | "create_account" | "account_merge" | ...
  from:      string;
  to:        string;
  amount:    string;
  asset:     Asset;
  direction: "incoming" | "outgoing";
  createdAt: string;
}
```

#### Example

```tsx
import { usePayments } from "use-stellar";

export function PaymentHistory() {
  const { payments, loading, hasNext, fetchNext } = usePayments({ limit: 20 });

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <ul>
        {payments.map(p => (
          <li key={p.id}>
            {p.direction === "incoming" ? "+" : "-"}{p.amount} {p.asset === "XLM" ? "XLM" : p.asset.code}
          </li>
        ))}
      </ul>
      {hasNext && <button onClick={fetchNext}>Load more</button>}
    </div>
  );
}
```

---

### useClaimableBalance

Fetches claimable balances available to a Stellar account — funds a sender has set aside for a claimant to accept explicitly.

#### Usage

```tsx
import { useClaimableBalance } from "use-stellar";

function MyComponent() {
  const {
    balances,  // ClaimableBalance[]
    loading,   // boolean
    error,     // StellarError | null
    refetch,   // () => void
  } = useClaimableBalance();
}
```

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `address` | `string \| null` | Connected wallet address | The account to check for claimable balances |

#### `ClaimableBalance` shape

```ts
interface ClaimableBalance {
  id:         string;
  asset:      string;
  amount:     string;
  claimants:  { destination: string; predicate: object }[];
  sponsor?:   string;
}
```

#### Example

```tsx
import { useClaimableBalance } from "use-stellar";

export function ClaimableBalances() {
  const { balances, loading } = useClaimableBalance();

  if (loading) return <p>Loading...</p>;
  if (!balances.length) return <p>No claimable balances.</p>;

  return (
    <ul>
      {balances.map(b => (
        <li key={b.id}>{b.amount} {b.asset}</li>
      ))}
    </ul>
  );
}
```

---

### useNetwork

Returns the current network configuration. Useful for displaying the active network to users or conditionally rendering content based on which network is active.

#### Usage

```tsx
import { useNetwork } from "use-stellar";

function MyComponent() {
  const {
    network,       // "testnet" | "mainnet"
    networkConfig, // { network, horizonUrl, sorobanUrl }
    isTestnet,     // boolean shorthand
    isMainnet,     // boolean shorthand
  } = useNetwork();
}
```

#### Examples

**Show a testnet warning banner:**

```tsx
import { useNetwork } from "use-stellar";

export function NetworkBanner() {
  const { isTestnet } = useNetwork();

  if (!isTestnet) return null;

  return (
    <div style={{ background: "orange", padding: "8px", textAlign: "center" }}>
      You are on testnet. Tokens have no real value.
    </div>
  );
}
```

**Display the current Horizon URL:**

```tsx
const { networkConfig } = useNetwork();
console.log(networkConfig.horizonUrl); // "https://horizon-testnet.stellar.org"
```

---

### useAsset

Fetches metadata about a Stellar issued asset — total supply, number of trustlines, home domain, and authorization flags.

#### Usage

```tsx
import { useAsset } from "use-stellar";

function MyComponent() {
  const {
    asset,     // AssetInfo | null
    loading,   // boolean
    error,     // StellarError | null
    refetch,   // () => void
  } = useAsset({ code: "USDC", issuer: "GA5Z..." });
}
```

#### Options

| Option | Type | Required | Description |
|---|---|---|---|
| `code` | `string` | Yes | The asset code, e.g. `"USDC"` |
| `issuer` | `string` | Yes | The issuer's Stellar address |
| `autoFetch` | `boolean` | No | Fetch automatically on mount / when `code`/`issuer` change (default `true`) |

#### `AssetInfo` shape

```ts
interface AssetInfo {
  code:        string;
  issuer:      string;
  supply:      string;
  homeDomain?: string;
  numAccounts: number;
  flags: {
    authRequired:  boolean;
    authRevocable: boolean;
    authImmutable: boolean;
  };
}
```

#### Example

```tsx
import { useAsset } from "use-stellar";

export function AssetDetails() {
  const { asset, loading, error } = useAsset({
    code:   "USDC",
    issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  });

  if (loading) return <p>Loading asset info...</p>;
  if (error)   return <p>Error: {error.message}</p>;
  if (!asset)  return null;

  return (
    <div>
      <p>Code: {asset.code}</p>
      <p>Home domain: {asset.homeDomain ?? "not set"}</p>
      <p>Total supply: {asset.supply}</p>
      <p>Trustlines: {asset.numAccounts}</p>
    </div>
  );
}
```

---

### useSorobanContract

Simulates a call to a deployed Soroban smart contract and returns its result. Runs automatically whenever `contractId`, `method`, or `args` change — there is no manual "call" trigger, use `refetch` to re-run with the same arguments.

> **Note:** This hook currently supports read-only simulation calls. Write calls (with signing) are not yet implemented — contributions welcome.

#### Usage

```tsx
import { useSorobanContract } from "use-stellar";

function MyComponent() {
  const {
    data,     // unknown | null — the decoded return value from the contract
    loading,  // boolean
    error,    // StellarError | null
    refetch,  // () => void — re-run the same call
  } = useSorobanContract({
    contractId: "CABC123...",
    method:     "get_price",
    args:       ["XLM"],
  });
}
```

#### Options

| Property | Type | Required | Description |
|---|---|---|---|
| `contractId` | `string` | Yes | The deployed contract address (starts with `C`) |
| `method` | `string` | Yes | The contract function name to call |
| `args` | `unknown[]` | No | Arguments to pass to the function — strings, booleans, and integer numbers are converted automatically; pass an `xdr.ScVal` directly for anything more complex |

#### Example

```tsx
import { useSorobanContract } from "use-stellar";

export function ContractReader({ contractId }: { contractId: string }) {
  const { data, loading, error } = useSorobanContract({
    contractId,
    method: "get_price",
    args:   ["XLM"],
  });

  if (loading) return <p>Reading contract...</p>;
  if (error)   return <p style={{ color: "red" }}>{error.message}</p>;

  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

---

## Next.js App Router (SSR)

`use-stellar` is a **client library**. Every export calls client-only React APIs (e.g. `createContext`, `useState`) at module scope, so the published bundle is built with a `"use client"` directive emitted at the top of the file. That directive is included for you automatically — you do **not** need to add it yourself. Because the directive marks the package's modules as client modules, the package can only be meaningfully imported from a client boundary: import it from a module that already carries `"use client"`, or from a component that is otherwise client-side (e.g. inside a `"use client"` provider wrapper or an event handler).

Importing `use-stellar` directly from a Server Component will not work — the `"use client"` directive makes the library's modules client modules, which is the opposite of server-safe. Render `StellarProvider` or call interactive hooks such as `useWallet` and `useSendPayment` from the client side:

```tsx
// app/providers.tsx
"use client";
import { StellarProvider } from "use-stellar";

export function Providers({ children }: { children: React.ReactNode }) {
  return <StellarProvider network="testnet">{children}</StellarProvider>;
}
```

```tsx
// app/layout.tsx
import { Providers } from "./providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

---

## TypeScript

`use-stellar` is written in TypeScript and ships with full type definitions. No additional `@types` package is needed.

### Importing types

```ts
import type {
  StellarNetwork,      // "testnet" | "mainnet"
  NetworkConfig,       // { network, horizonUrl, sorobanUrl }
  WalletType,          // "freighter" | "lobstr" | "albedo" | "rabet"
  WalletState,         // { connected, address, network, wallet, walletName, connecting, error, walletNetwork }
  Asset,               // "XLM" | { code: string, issuer: string }
  NativeAsset,         // "XLM"
  IssuedAsset,         // { code: string, issuer: string }
  Balance,             // { asset, balance, limit?, liquidityPoolId? }
  AccountInfo,         // full account shape
  TransactionResult,   // { hash, status, ledger?, createdAt?, fee?, envelope? }
  TransactionStatus,   // "pending" | "success" | "failed" | "not_found"
  SendPaymentOptions,  // { to, asset, amount, memo? }
  SendPaymentResult,   // { hash, status }
  NormalizedPayment,   // { id, txHash, type, from, to, amount, asset, direction, createdAt }
  ClaimableBalance,    // { id, asset, amount, claimants, sponsor? }
  ContractCallOptions, // { contractId, method, args? }
  StellarError,        // Error subclass with `code` and `message`
  StellarErrorCode,    // union of every STELLAR_ERROR_CODES value
} from "use-stellar";
```

### Working with `Asset`

The `Asset` type is a discriminated union. When working with it you can check whether it is native or issued:

```ts
import type { Asset, NativeAsset, IssuedAsset } from "use-stellar";

function getAssetCode(asset: Asset): string {
  if (asset === "XLM") {
    return "XLM";                    // NativeAsset
  }
  return (asset as IssuedAsset).code; // IssuedAsset
}
```

---

## Network configuration

### Switching between testnet and mainnet

Pass the `network` prop to `StellarProvider`:

```tsx
// testnet (development)
<StellarProvider network="testnet">
  <App />
</StellarProvider>

// mainnet (production)
<StellarProvider network="mainnet">
  <App />
</StellarProvider>
```

### Custom endpoints

By default, `StellarProvider` uses the public SDF endpoints. For production apps that need private infrastructure, rate-limit avoidance, or a custom RPC node, pass a `networkConfig` override:

```tsx
import { StellarProvider } from "use-stellar";

// Custom mainnet node
<StellarProvider
  network="mainnet"
  networkConfig={{
    horizonUrl: "https://horizon.my-node.com",
    sorobanUrl: "https://rpc.my-node.com",
  }}
>
  <App />
</StellarProvider>
```

Both `horizonUrl` and `sorobanUrl` are required when `networkConfig` is provided. Omitting either will throw a descriptive error at startup:

```
use-stellar: Invalid networkConfig — `horizonUrl` is required when providing
a custom networkConfig. Example: { horizonUrl: "https://...", sorobanUrl: "..." }
```

Custom endpoints also work with `"testnet"`, which is useful for private test networks or local Stellar nodes:

```tsx
<StellarProvider
  network="testnet"
  networkConfig={{
    horizonUrl: "http://localhost:8000",
    sorobanUrl: "http://localhost:8001",
  }}
>
  <App />
</StellarProvider>
```

### Reading network config in a hook

All hooks read the effective network config from `StellarProvider` automatically — including any custom URLs. You can also access it directly:

```tsx
import { useNetwork } from "use-stellar";

const { network, networkConfig, isTestnet, isMainnet } = useNetwork();

// networkConfig.horizonUrl   — effective Horizon REST API endpoint
// networkConfig.sorobanUrl   — effective Soroban RPC endpoint
// networkConfig.network      — "testnet" | "mainnet"
// isTestnet                  — boolean shorthand
// isMainnet                  — boolean shorthand
```

### Default endpoints

| Network | Horizon URL | Soroban RPC URL |
|---|---|---|
| testnet | `https://horizon-testnet.stellar.org` | `https://soroban-testnet.stellar.org` |
| mainnet | `https://horizon.stellar.org` | `https://soroban.stellar.org` |

---

## Error handling & troubleshooting

Every hook exposes `error` as a typed `StellarError | null`, never a raw string. `StellarError` is a real `Error` subclass with two extra fields:

- **`code`** — a stable, machine-readable `StellarErrorCode` you can branch on.
- **`message`** — a human-readable string you can render directly.

```tsx
const { data, loading, error, refetch } = useBalance();

if (loading) return <p>Loading...</p>;
if (error) {
  return (
    <p>
      {error.message} — <button onClick={refetch}>Retry</button>
    </p>
  );
}
```

Branch on the stable `code` when you need different behavior per failure type:

```tsx
if (error?.code === "NO_TRUSTLINE") {
  // prompt the user to add a trustline
}
```

### Error codes

| Code | Meaning |
|---|---|
| `WALLET_NOT_INSTALLED` | The selected wallet extension isn't installed or detected |
| `WALLET_NOT_CONNECTED` | An action required a connected wallet but none was connected |
| `WALLET_REQUEST_REJECTED` | The user rejected the request in their wallet |
| `WRONG_NETWORK` | The wallet is connected to a different network than expected |
| `ACCOUNT_NOT_FOUND` | The requested account or resource doesn't exist on the ledger (404) |
| `INSUFFICIENT_BALANCE` | The source account lacks the funds to complete the operation |
| `NO_TRUSTLINE` | The destination doesn't hold a trustline for the asset |
| `TRANSACTION_FAILED` | The transaction was submitted but failed on the network |
| `RATE_LIMITED` | Horizon rate-limited the request (429) |
| `VALIDATION_ERROR` | Caller-supplied input was invalid, or the environment was unsupported (e.g. calling a browser-only hook during SSR) |
| `NETWORK_ERROR` | A transport-level failure — offline, DNS, timeout, CORS |
| `UNKNOWN` | Anything that couldn't be confidently classified |

### Advanced: normalizing errors yourself

The helpers used internally are also exported, for advanced use (e.g. wrapping your own Horizon calls):

```ts
import { toStellarError, createStellarError, isStellarError } from "use-stellar";

const stellarError = toStellarError(unknownThrownValue); // → StellarError
throw createStellarError("WALLET_NOT_CONNECTED");         // build one directly
isStellarError(err);                                      // type guard
```

### Common issues

| Error / Issue | Probable cause | Solution |
| :--- | :--- | :--- |
| `Freighter wallet not found. Install...` | The Freighter browser extension is missing or disabled. | Install it from [freighter.app](https://www.freighter.app) and ensure it's active. |
| `Wrong network. Switch Freighter to...` / `isNetworkMismatch` is `true` | Freighter is set to a different network than `StellarProvider`. | Open Freighter → **Preferences** → **Active Network**, and select the network configured in `StellarProvider`. |
| `Failed to fetch balance` / `ACCOUNT_NOT_FOUND` | The address hasn't been funded yet and doesn't exist on the ledger. | Use the [Stellar Lab Friendbot](https://laboratory.stellar.org/#friendbot) to fund a testnet address first. |
| `Transaction failed` during `send()` | Insufficient balance, invalid destination, missing trustline, or network timeout. | Ensure the sender has enough XLM to cover the amount plus the base fee, confirm the destination is valid on the active network, and check the console for the transaction's error XDR. |

---

## Supported wallets

| Wallet | Status | Notes |
|---|---|---|
| [Freighter](https://freighter.app) | ✅ Supported | Default wallet, fully wired |
| Albedo | 🚧 In progress | Adapter is implemented (`@albedo-link/intent`) but not yet wired into the wallet registry — `connect("albedo")` currently throws. Contributions to finish the integration welcome. |
| LOBSTR | Planned | Not yet implemented |
| Rabet | Planned | Not yet implemented |

Contributions for new wallet integrations are welcome — see [CONTRIBUTING.md](https://github.com/israelolrunfemi/use-stellar/blob/main/CONTRIBUTING.md).

---

## Contributing

`use-stellar` is open source and welcomes contributions. Every hook is a self-contained TypeScript file — you do not need Rust or blockchain expertise to contribute.

See [CONTRIBUTING.md](https://github.com/israelolrunfemi/use-stellar/blob/main/CONTRIBUTING.md) for setup instructions and a guide to adding new hooks and wallet integrations.

```bash
git clone https://github.com/israelolrunfemi/use-stellar
cd use-stellar
pnpm install
pnpm --filter use-stellar build
pnpm --filter @use-stellar/demo dev
```

---

## License

[Apache-2.0](https://github.com/israelolrunfemi/use-stellar/blob/main/LICENSE)
