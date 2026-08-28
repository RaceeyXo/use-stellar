# useSorobanContract

Calls a read-only function on a Soroban smart contract and returns the decoded result.

> **Write calls are not yet implemented.** This hook currently supports read-only simulation only. If you need to submit a write transaction, follow [issue #105](https://github.com/RaceeyXo/use-stellar/issues/105) for updates.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useSorobanContract } from "use-stellar"
```

## Arguments are `xdr.ScVal`

Start here, because it is the part that surprises people.

Soroban contracts are strongly typed. A function that declares `u32` rejects a `u64`. `Symbol`, `String`, and `Address` are three different types, even though all three look like a JavaScript string.

A JavaScript value does not carry that information. `"GBBD..."` could be a `Symbol`, a `String`, or an `Address`. `42` could be `u32`, `i32`, `u64`, `i64`, `u128`, or `i128`. Nothing in the value says which.

So this hook does not guess. You pass `xdr.ScVal` values, and the types are explicit:

```tsx
import { useSorobanContract } from "use-stellar"
import { Address } from "@stellar/stellar-sdk"

function TokenBalance({ contractId, holder }: { contractId: string; holder: string }) {
  const { data, loading, error } = useSorobanContract<bigint>({
    contractId,
    method: "balance",
    args: [new Address(holder).toScVal()],
  })

  if (loading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>

  return <p>Balance: {data?.toString() ?? "0"}</p>
}
```

### Address

The most common case. Every token contract's `balance`, `transfer`, and `approve` takes one.

```ts
import { Address } from "@stellar/stellar-sdk"

// An account
new Address("GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5").toScVal()

// A contract
new Address("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM").toScVal()
```

### Symbol

Short identifiers — enum-like tags, method names, storage keys. A plain string is **not** a Symbol.

```ts
import { nativeToScVal } from "@stellar/stellar-sdk"

nativeToScVal("transfer", { type: "symbol" })
```

### Integers

Name the width. The contract's own declaration decides which one.

```ts
import { nativeToScVal } from "@stellar/stellar-sdk"

nativeToScVal(7, { type: "u32" })
nativeToScVal(1000n, { type: "u64" })
nativeToScVal(-250n, { type: "i128" })
```

Use `bigint` for anything wider than 53 bits. A JavaScript `number` beyond `Number.MAX_SAFE_INTEGER` has already lost precision before this hook ever sees it.

### What happens if you pass a bare value

An ambiguous value throws an error naming the types it could have been:

```ts
useSorobanContract({ contractId, method: "balance", args: ["GBBD..."] })
// Error: Argument 0 is a string, which could be Symbol, String, or Address.
//        Pass an xdr.ScVal so the type is explicit — ...
```

A loud, actionable error beats a silent wrong guess that surfaces later as a host type error you cannot diagnose from the message.

`boolean` is the one exception. A JavaScript boolean is a Soroban `bool` and nothing else, so it converts without complaint.

## Letting the contract's spec do the conversion

If you have the contract's spec, its declared parameter types resolve the ambiguity for you, and plain JavaScript values become safe to pass.

```tsx
import { useSorobanContract } from "use-stellar"
import { contract } from "@stellar/stellar-sdk"

const spec = new contract.Spec(specEntries)

function TokenBalance({ contractId, holder }: { contractId: string; holder: string }) {
  const { data } = useSorobanContract<bigint>({
    contractId,
    method: "balance",
    // The spec says this parameter is an Address, so the string is unambiguous.
    args: [holder],
    spec,
  })

  return <p>{data?.toString() ?? "0"}</p>
}
```

With a spec, the return value is decoded against the contract's declared return type too, and passing the wrong number of arguments is reported before anything reaches the network.

## Basic usage

```tsx
import { useSorobanContract } from "use-stellar"

function ContractValue() {
  const { data, loading, error } = useSorobanContract<boolean>({
    contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM",
    method: "is_paused",
  })

  if (loading) return <p>Loading...</p>
  if (error) return <p>Error: {error.message}</p>

  return <p>Paused: {String(data)}</p>
}
```

## Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `contractId` | `string` | Yes | — | The C-prefixed contract address. |
| `method` | `string` | Yes | — | The contract function to call. |
| `args` | `unknown[]` | No | `[]` | Call arguments. Use `xdr.ScVal` values, or plain values together with `spec`. |
| `spec` | `ContractSpecLike` | No | — | The contract's parsed spec. When given, arguments and the return value are converted against the types the contract declares. |
| `sourceAccount` | `string` | No | Connected wallet | The account to simulate as. |

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `data` | `T \| null` | The decoded return value. `null` while loading or after an error. |
| `loading` | `boolean` | `true` while the simulation is in flight. |
| `error` | `StellarError \| null` | The failure, or `null`. |
| `refetch` | `() => void` | Re-runs the simulation. |

## Typing the result

The type parameter defaults to `unknown`, so existing code keeps compiling unchanged. Supply it and the result needs no cast at the call site:

```tsx
interface Metadata {
  name: string
  symbol: string
  decimals: number
}

const { data } = useSorobanContract<Metadata>({ contractId, method: "metadata" })

// data is Metadata | null
console.log(data?.symbol)
```

## Who the simulation runs as

Simulation runs as the connected wallet's address. That matters more than it sounds. A simulation answers "what would happen if **this account** made this call", so anything gated on the caller — `require_auth`, a personal balance, a permission check — gives a different answer for a different account.

With no wallet connected, the hook falls back to a placeholder address so a read can still be attempted before connect.

> **A simulation with no wallet connected is a simulation as a stranger.** For any call that depends on who is asking, the result is wrong until a wallet is connected. Treat pre-connect reads of auth-dependent methods as unavailable, not as data.

You can name the account explicitly:

```tsx
const { data } = useSorobanContract<bigint>({
  contractId,
  method: "balance",
  args: [new Address(holder).toScVal()],
  sourceAccount: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
})
```

## Examples

### Example 1 — the connected user's token balance

```tsx
import { useSorobanContract, useWallet } from "use-stellar"
import { Address } from "@stellar/stellar-sdk"

function MyBalance({ contractId }: { contractId: string }) {
  const { address, connected } = useWallet()

  const { data, loading } = useSorobanContract<bigint>({
    contractId,
    method: "balance",
    args: address ? [new Address(address).toScVal()] : [],
  })

  if (!connected) return <p>Connect a wallet to see your balance.</p>
  if (loading) return <p>Loading...</p>

  return <p>{data?.toString() ?? "0"}</p>
}
```

### Example 2 — a call taking a Symbol and a u32

```tsx
import { useSorobanContract } from "use-stellar"
import { nativeToScVal } from "@stellar/stellar-sdk"

function ConfigValue({ contractId }: { contractId: string }) {
  const { data } = useSorobanContract<string>({
    contractId,
    method: "get_config",
    args: [nativeToScVal("fee_rate", { type: "symbol" }), nativeToScVal(1, { type: "u32" })],
  })

  return <p>{data ?? "unset"}</p>
}
```

### Example 3 — handling errors and retrying

```tsx
import { useSorobanContract } from "use-stellar"

function WithRetry({ contractId }: { contractId: string }) {
  const { data, error, refetch } = useSorobanContract<boolean>({
    contractId,
    method: "is_paused",
  })

  if (error) {
    return (
      <div>
        <p>Something went wrong: {error.message}</p>
        <button onClick={refetch}>Try again</button>
      </div>
    )
  }

  return <p>{String(data)}</p>
}
```

## TypeScript

```ts
interface UseSorobanContractReturn<T = unknown> {
  data: T | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}
```

## Common errors

| Error message | Cause | Fix |
| :--- | :--- | :--- |
| `"Argument 0 is a string, which could be Symbol, String, or Address."` | A bare string was passed as an argument. | Wrap it: `new Address(value).toScVal()` or `nativeToScVal(value, { type: "symbol" })`. |
| `"Argument 0 is a number, which could be u32, i32, u64, ..."` | A bare number was passed as an argument. | Name the width: `nativeToScVal(value, { type: "u32" })`. |
| `"Invalid contract ID ..."` | The id is not a C-prefixed 56-character address. | Check the contract address for this network. |
| `"RPC simulation error ..."` | The contract rejected the call, or is not deployed here. | Compare each argument against the contract's declaration, and verify the contract exists on this network. |
| `"Contract method \"x\" expects 2 argument(s), received 1."` | A `spec` was supplied and the count does not match. | Pass every declared parameter. |

## Notes

- This hook performs a **read-only simulation**. It does not submit a transaction and does not change ledger state.
- Arguments are compared by content, not identity, so an inline `args={[...]}` array does not re-run the simulation on every render.
- A `spec` may be built inline — it is held by reference and does not re-trigger the call.
- A simulation still in flight when the component unmounts is discarded.
- Write-call support is tracked in [issue #105](https://github.com/RaceeyXo/use-stellar/issues/105).

## Related hooks

- [`usePathPayment`](./use-path-payment.md) — swap one asset for another on the SDEX.
- [`useSendPayment`](./use-send-payment.md) — send a Stellar payment.
