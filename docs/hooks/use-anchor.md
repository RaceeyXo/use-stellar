# useAnchor

Resolves an anchor's `stellar.toml` file (SEP-1) and returns structured information about the anchor including signing keys, service endpoints, and supported currencies.

## Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

## Import

```ts
import { useAnchor } from "use-stellar"
```

## Basic usage

```tsx
import { useAnchor } from "use-stellar"

function Example() {
  const { anchor, loading, error } = useAnchor({ 
    homeDomain: "testanchor.stellar.org" 
  })

  if (loading) return <p>Loading anchor info...</p>
  if (error) return <p>Error: {error.message}</p>

  return (
    <div>
      <h3>{anchor?.homeDomain}</h3>
      <p>Signing Key: {anchor?.signingKey}</p>
      <p>Auth Endpoint: {anchor?.webAuthEndpoint}</p>
    </div>
  )
}
```

## Parameters

| Parameter | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `homeDomain` | `string \| null` | No | `undefined` | The anchor's home domain (e.g., "testanchor.stellar.org"). |
| `autoFetch` | `boolean` | No | `true` | Whether to automatically fetch the stellar.toml on mount. Set to `false` to fetch manually via `refetch()`. |

## Return values

| Property | Type | Description |
| :--- | :--- | :--- |
| `anchor` | `AnchorInfo \| null` | The structured anchor information, or `null` if not yet loaded or if an error occurred. |
| `loading` | `boolean` | `true` while a fetch is actively in progress. |
| `error` | `StellarError \| null` | A typed `StellarError` object if the request failed, otherwise `null`. |
| `refetch` | `() => void` | A function you can call to manually re-fetch the anchor's stellar.toml. |

### AnchorInfo

The `AnchorInfo` object contains the following fields:

| Property | Type | Description |
| :--- | :--- | :--- |
| `homeDomain` | `string` | The anchor's home domain (normalized to lowercase). |
| `signingKey` | `string \| null` | The SEP-10 challenge signer public key. Required before any SEP-10 authentication flow. |
| `webAuthEndpoint` | `string \| null` | The SEP-10 authentication endpoint URL. |
| `transferServer` | `string \| null` | The SEP-6 deposit/withdraw server URL. |
| `transferServerSep24` | `string \| null` | The SEP-24 interactive deposit/withdraw server URL. |
| `kycServer` | `string \| null` | The KYC server URL. |
| `currencies` | `AnchorCurrency[]` | Array of currencies supported by the anchor. |
| `raw` | `Record<string, unknown>` | The raw parsed stellar.toml document, for accessing fields not explicitly modeled. |

### AnchorCurrency

Each currency in the `currencies` array has the following structure:

| Property | Type | Description |
| :--- | :--- | :--- |
| `code` | `string` | The asset code (e.g., "USD", "BTC"). |
| `issuer` | `string \| null` | The Stellar public key of the asset issuer. |
| `name` | `string \| undefined` | Optional human-readable name. |
| `desc` | `string \| undefined` | Optional description. |
| `image` | `string \| undefined` | Optional image URL. |
| `isAssetAnchored` | `boolean \| undefined` | Optional flag indicating if the asset is anchored. |

## Security: HTTPS enforcement

**IMPORTANT:** On mainnet, only HTTPS domains are allowed. HTTP is only permitted for local/standalone networks (localhost, 127.x.x.x, 192.168.x.x).

Fetching an anchor's signing key over plaintext HTTP allows a network attacker to choose the key you will later validate a SEP-10 challenge against, defeating the entire authentication flow.

The hook automatically enforces HTTPS on mainnet and allows HTTP only when:
- The network is `testnet`, `futurenet`, or `custom`
- The domain is `localhost` or a private IP range

## Missing fields are normal

Most anchors implement a subset of SEP standards. A stellar.toml with no `TRANSFER_SERVER` is perfectly valid — the hook returns `null` for that field rather than throwing an error.

Only fetch failures or parse failures result in an error state.

## Examples

### Example 1 — Reading anchor information

```tsx
import { useAnchor } from "use-stellar"

export function AnchorInfoComponent() {
  const { anchor, loading, error } = useAnchor({
    homeDomain: "testanchor.stellar.org",
  })

  if (loading) return <p>Loading anchor info...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>
  if (!anchor) return <p>No anchor found</p>

  return (
    <div>
      <h3>Anchor: {anchor.homeDomain}</h3>
      <div>
        <h4>Endpoints</h4>
        <p>Web Auth: {anchor.webAuthEndpoint ?? "Not available"}</p>
        <p>Transfer Server: {anchor.transferServer ?? "Not available"}</p>
        <p>SEP-24 Server: {anchor.transferServerSep24 ?? "Not available"}</p>
      </div>
      <div>
        <h4>Security</h4>
        <p>Signing Key: {anchor.signingKey ?? "Not available"}</p>
      </div>
    </div>
  )
}
```

### Example 2 — Displaying supported currencies

```tsx
import { useAnchor } from "use-stellar"

export function AnchorCurrenciesComponent() {
  const { anchor, loading, error } = useAnchor({
    homeDomain: "testanchor.stellar.org",
  })

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>
  if (!anchor) return <p>No anchor found</p>

  return (
    <div>
      <h3>Supported Currencies</h3>
      {anchor.currencies.length === 0 ? (
        <p>No currencies listed</p>
      ) : (
        <ul>
          {anchor.currencies.map((currency, index) => (
            <li key={index}>
              <strong>{currency.code}</strong>
              {currency.name && ` - ${currency.name}`}
              {currency.issuer && (
                <div>
                  <small>Issuer: {currency.issuer.slice(0, 8)}...</small>
                </div>
              )}
              {currency.desc && <p>{currency.desc}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

### Example 3 — Manual fetch with autoFetch: false

```tsx
import { useAnchor } from "use-stellar"
import { useState } from "react"

export function ManualAnchorLookup() {
  const [domain, setDomain] = useState("")
  const [searchDomain, setSearchDomain] = useState<string | null>(null)

  const { anchor, loading, error, refetch } = useAnchor({
    homeDomain: searchDomain,
    autoFetch: false,
  })

  const handleSearch = () => {
    setSearchDomain(domain)
    refetch()
  }

  return (
    <div>
      <h3>Anchor Lookup</h3>
      <input
        type="text"
        value={domain}
        onChange={(e) => setDomain(e.target.value)}
        placeholder="Enter anchor domain"
      />
      <button onClick={handleSearch} disabled={loading}>
        {loading ? "Searching..." : "Search"}
      </button>

      {error && <p style={{ color: "red" }}>Error: {error.message}</p>}
      {anchor && (
        <div>
          <h4>{anchor.homeDomain}</h4>
          <p>Signing Key: {anchor.signingKey ?? "Not available"}</p>
          <p>Currencies: {anchor.currencies.length}</p>
        </div>
      )}
    </div>
  )
}
```

### Example 4 — Accessing custom fields via raw

```tsx
import { useAnchor } from "use-stellar"

export function CustomFieldsComponent() {
  const { anchor, loading, error } = useAnchor({
    homeDomain: "testanchor.stellar.org",
  })

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>
  if (!anchor) return <p>No anchor found</p>

  // Access unmapped fields from the raw document
  const orgName = anchor.raw.DOCUMENTATION?.ORG_NAME
  const orgUrl = anchor.raw.DOCUMENTATION?.ORG_URL

  return (
    <div>
      <h3>{anchor.homeDomain}</h3>
      {orgName && <p>Organization: {orgName}</p>}
      {orgUrl && <p>Website: {orgUrl}</p>}
    </div>
  )
}
```

### Example 5 — Checking SEP-10 authentication availability

```tsx
import { useAnchor } from "use-stellar"

export function SEP10CheckComponent() {
  const { anchor, loading, error } = useAnchor({
    homeDomain: "testanchor.stellar.org",
  })

  if (loading) return <p>Loading...</p>
  if (error) return <p style={{ color: "red" }}>Error: {error.message}</p>
  if (!anchor) return <p>No anchor found</p>

  const canAuthenticate = anchor.signingKey && anchor.webAuthEndpoint

  return (
    <div>
      <h3>SEP-10 Authentication</h3>
      {canAuthenticate ? (
        <div>
          <p style={{ color: "green" }}>✓ SEP-10 authentication is available</p>
          <p>Endpoint: {anchor.webAuthEndpoint}</p>
          <p>Signing Key: {anchor.signingKey?.slice(0, 8)}...</p>
        </div>
      ) : (
        <p style={{ color: "orange" }}>
          ✗ SEP-10 authentication is not available for this anchor
        </p>
      )}
    </div>
  )
}
```

## TypeScript

```ts
interface UseAnchorOptions {
  homeDomain?: string | null
  autoFetch?: boolean
}

interface UseAnchorReturn {
  anchor: AnchorInfo | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}

interface AnchorInfo {
  homeDomain: string
  signingKey: string | null
  webAuthEndpoint: string | null
  transferServer: string | null
  transferServerSep24: string | null
  kycServer: string | null
  currencies: AnchorCurrency[]
  raw: Record<string, unknown>
}

interface AnchorCurrency {
  code: string
  issuer: string | null
  name?: string
  desc?: string
  image?: string
  isAssetAnchored?: boolean
}
```

## Common errors

| Error message | Cause | Fix |
| :--- | :--- | :--- |
| `"HTTP is not allowed for anchors on mainnet..."` | Attempted to fetch from an HTTP domain on mainnet. | Use HTTPS for mainnet anchors. HTTP is only allowed for local/testnet networks. |
| `"Invalid signing key in stellar.toml..."` | The SIGNING_KEY field contains an invalid Stellar public key. | Contact the anchor to fix their stellar.toml. The signing key must be a valid G-address. |
| `"stellar.toml not found"` | The domain does not have a stellar.toml file at `/.well-known/stellar.toml`. | Verify the domain is correct and the anchor has published their stellar.toml. |
| `"stellar.toml fetch timed out..."` | The request took longer than 10 seconds. | Check your network connection or try again later. The anchor server may be slow or unreachable. |

## Bounds and limits

The hook enforces the following limits per SEP-1:

- **Size limit:** 100 KB maximum for the stellar.toml file
- **Timeout:** 10 seconds maximum for the fetch request

These limits prevent unbounded resource consumption and ensure responsive UIs.

## Validation

The hook validates:

- **Signing key:** Must be a valid Stellar public key (G-address, 56 characters)
- **Currency issuers:** Invalid issuers are skipped rather than failing the entire fetch
- **Domain format:** Normalized to lowercase and trimmed of whitespace

## Notes

- **SSR Safety:** The hook is a no-op during server-side rendering. It only fetches in the browser.
- **Cancellation:** In-flight requests are automatically cancelled when the component unmounts or when the `homeDomain` parameter changes.
- **Normalization:** Domain names are normalized to lowercase and trimmed of whitespace before fetching.
- **No TOML parser dependency:** The hook uses the Stellar SDK's built-in resolver, so no additional TOML parsing library is required.

## SEP standards

This hook implements [SEP-1: stellar.toml](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md), which is the entry point to the entire SEP stack:

- **SEP-6:** Deposit and Withdrawal API (`transferServer`)
- **SEP-10:** Stellar Authentication (`webAuthEndpoint`, `signingKey`)
- **SEP-12:** KYC API (`kycServer`)
- **SEP-24:** Hosted Deposit and Withdrawal (`transferServerSep24`)

## Related hooks

- [`useAsset`](./use-asset.md) — Returns a `homeDomain` field that can be passed to `useAnchor` to learn more about the asset's issuer.
- Future: `useSEP10Auth` — Will use the `signingKey` and `webAuthEndpoint` from this hook to authenticate with an anchor.

