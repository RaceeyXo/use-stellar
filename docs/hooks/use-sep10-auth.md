# `useSep10Auth`

SEP-10 web authentication with strict challenge validation. This hook securely authenticates a connected Stellar wallet against an anchor to retrieve a JWT, which is required for SEP-6, SEP-24, and SEP-31 operations.

It enforces a strict validation lifecycle:
1. **Fetch**: Requests a challenge transaction from the anchor's `WEB_AUTH_ENDPOINT`.
2. **Validate**: Parses the challenge using `WebAuth.readChallengeTx` to guarantee it has sequence `0`, correct time bounds, and is signed by the anchor's verified `SIGNING_KEY` (fetched independently via `stellar.toml`).
3. **Verify**: Ensures the challenge's client account matches the currently connected wallet.
4. **Sign**: Only after all checks pass, prompts the wallet to sign the challenge.
5. **Submit**: Exchanges the signed challenge for a JWT.

By default, the token is held in-memory and cleared immediately if the wallet disconnects or switches networks.

## Usage

```tsx
import { useSep10Auth } from "use-stellar"

function AnchorAuth() {
  const { authenticate, logout, token, authenticated, loading, error } = useSep10Auth({
    homeDomain: "testanchor.stellar.org",
  })

  const handleAuth = async () => {
    try {
      await authenticate()
      console.log("Successfully authenticated!")
    } catch (err) {
      if (err.name === "SEP10_VALIDATION_FAILED") {
        console.error("The anchor returned an invalid or tampered challenge.")
      }
    }
  }

  return (
    <div>
      {authenticated ? (
        <button onClick={logout}>Log Out</button>
      ) : (
        <button onClick={handleAuth} disabled={loading}>
          {loading ? "Authenticating..." : "Authenticate"}
        </button>
      )}
      {error && <p>Error: {error.message}</p>}
    </div>
  )
}