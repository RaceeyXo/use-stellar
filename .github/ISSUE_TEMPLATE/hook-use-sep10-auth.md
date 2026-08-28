---
name: "New hook: useSep10Auth"
about: SEP-10 web authentication — get a JWT from an anchor without signing a blank cheque
title: "feat(hook): useSep10Auth — SEP-10 web authentication with challenge validation"
labels: enhancement, hook, security, help wanted
---

## New hook: `useSep10Auth`

**Complexity:** High (200 points)
**Estimated time:** 4 days
**Depends on:** `hook-use-anchor` (must land first)

---

### Context

**SEP-10** is how a Stellar account proves ownership to a server without a
password. The anchor hands you a *challenge transaction*, you sign it with your
wallet, you hand it back, and you get a JWT. Every anchor API — deposit,
withdraw, KYC — is gated behind that JWT.

The flow is four steps:

1. `GET {WEB_AUTH_ENDPOINT}?account=G...&home_domain=...` → a challenge XDR
2. **Validate the challenge**
3. Sign it with the connected wallet
4. `POST {WEB_AUTH_ENDPOINT}` with the signed XDR → a JWT

Nothing in `use-stellar` implements any of this today.

---

### Why this matters — read this part before writing code

**Step 2 is the entire issue.** A "challenge" is just a transaction. If you skip
validation and pass whatever the server sent straight to
`adapter.signTransaction`, you have built a hook whose sole purpose is to make
users sign arbitrary transactions chosen by a remote server. A malicious or
compromised anchor sends a real payment operation instead of a challenge, the
user sees a signing prompt they have been trained to approve, and their account is
drained.

A valid SEP-10 challenge has properties that make it un-submittable:

- **Sequence number 0** — a transaction with sequence 0 can never be included in a
  ledger. This is the property that makes the whole scheme safe.
- Source account equals the anchor's `SIGNING_KEY` from its `stellar.toml`
- Exactly one `manageData` operation whose key is `{home_domain} auth`, whose
  source is the *user's* account
- An optional second `manageData` with key `web_auth_domain`, matching the domain
  actually serving the endpoint
- Time bounds that are currently valid and not absurdly long
- A signature from the anchor's `SIGNING_KEY`

**You do not have to check these by hand.** The SDK ships the validator:

```ts
import { WebAuth } from "@stellar/stellar-sdk"

const { tx, clientAccountID } = WebAuth.readChallengeTx(
  challengeXdr,
  serverSigningKey,   // from useAnchor — NOT from the challenge itself
  networkPassphrase,
  homeDomain,
  webAuthDomain
)
```

Note what `serverSigningKey` must be: the key from the anchor's `stellar.toml`,
fetched independently. Reading the expected signer out of the challenge you are
validating is circular and validates nothing.

---

### Where this lives

- Hook: `packages/core/src/hooks/useSep10Auth.ts`
- Test: `packages/core/src/hooks/useSep10Auth.test.ts`
- Types: add to `packages/core/src/types/index.ts`
- Export: add to `packages/core/src/index.ts` (hook and types)
- Docs: `docs/hooks/use-sep10-auth.md`

---

### Suggested API

```ts
export interface UseSep10AuthOptions {
  /** Anchor home domain, e.g. `"testanchor.stellar.org"`. */
  homeDomain: string
  /** Defaults to the connected wallet address. */
  account?: string
  /** Optional muxed/memo sub-account, per SEP-10. */
  memo?: string
  /** Client domain for client attribution. Advanced; omit for most uses. */
  clientDomain?: string
}

export interface UseSep10AuthReturn {
  /** The JWT, or `null` when unauthenticated or expired. */
  token: string | null
  /** Decoded `exp` as a Date, so a caller can pre-emptively re-auth. */
  expiresAt: Date | null
  authenticated: boolean
  loading: boolean
  error: StellarError | null
  authenticate: () => Promise<string>
  logout: () => void
}
```

---

### Implementation guidelines

- **Never sign before `readChallengeTx` returns successfully.** Order the code so
  this is structurally impossible — validate, then sign, with no branch that skips
  the first. A test must prove it (see acceptance criteria).
- **Get `SIGNING_KEY` from `useAnchor`,** not from the challenge response.
  `hook-use-anchor` must land first.
- **Verify the returned `clientAccountID` matches the connected wallet.** An
  anchor that returns a challenge for a *different* account is a red flag; refuse
  rather than sign.
- **Sign through the adapter**, `getWalletAdapter(wallet.wallet).signTransaction`,
  the same path `useSendPayment` uses (`useSendPayment.ts:99-104`). Do not add a
  second signing route.
- **The JWT is a credential. Treat it as one.**
  - Default to **in-memory only**. If you offer persistence, make it opt-in, document
    the XSS exposure plainly, and never make `localStorage` the default.
  - Never log it, never put it in an error message, never include it in the
    `StellarError` details object.
  - Expose `expiresAt` by decoding the `exp` claim, but **do not trust the JWT's
    contents for anything security-relevant** — you are not the party verifying it.
    Decode; do not verify.
- **Clear the token on disconnect and on network change.** A JWT minted against
  testnet must not survive a switch to mainnet. Subscribe to the same wallet state
  `useWallet` exposes.
- **Errors:** a user rejecting the signing prompt is `WALLET_REQUEST_REJECTED`, not
  a failure of the anchor. A challenge that fails validation needs its own code —
  coordinate with `core-05`, which is expanding `STELLAR_ERROR_CODES`. Do **not**
  let a validation failure fall through to `UNKNOWN`; this is the one error a user
  most needs to see clearly.
- Guard with `isBrowser()`; SSR is a no-op.
- Test against **`testanchor.stellar.org`** only.

---

### Acceptance criteria

- [ ] Full round trip against `testanchor.stellar.org` returns a JWT
- [ ] **A test feeds a tampered challenge and asserts the wallet's
      `signTransaction` was never called.** Cover at minimum: wrong source account,
      non-zero sequence number, wrong home domain, and expired time bounds
- [ ] The expected signing key comes from `useAnchor`, not from the challenge
- [ ] A challenge naming a different account than the connected wallet is refused
- [ ] `expiresAt` is populated from the `exp` claim
- [ ] Token is cleared on wallet disconnect and on network change
- [ ] Token is in memory by default; any persistence is opt-in and documented
- [ ] The token appears in no log line and in no error object
- [ ] User rejection surfaces as `WALLET_REQUEST_REJECTED`
- [ ] A validation failure surfaces as a distinct, explicit error — never `UNKNOWN`
- [ ] SSR render is a no-op, not a throw
- [ ] `docs/hooks/use-sep10-auth.md` follows `docs/example.md` and documents the
      validation guarantees
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass locally
- [ ] No file outside "Where this lives" is touched
- [ ] Every example and test uses **testnet only** — no mainnet addresses
- [ ] PR description includes `Closes #[issue number]`
- [ ] **Your PR targets the `dev` branch** — work pushed to `main` (or any
      branch other than `dev`) will **not** be merged
- [ ] ⭐ Leave a star on the project — it is small, free, and very much
      appreciated
- [ ] Open your PR **before the wave ends** — anyone without a submitted PR by
      then is automatically unassigned so the task can go to someone else

---

### Reference

- Signing path to reuse: `packages/core/src/hooks/useSendPayment.ts:99-104`
- Adapter contract: `packages/core/src/wallets/types.ts`
- Error codes: `packages/core/src/errors/codes.ts`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Related: `hook-use-anchor` (land first), `core-05` (new error codes)
- SEP-10: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md
- SDK `WebAuth`: https://stellar.github.io/js-stellar-sdk/module-WebAuth.html

---

### Important rules — read before you start

- **Get assigned first.** Do not open a PR before you are assigned. Unassigned PRs
  are closed without review.
- **Target the `dev` branch.** Branch from `dev` and open your PR against `dev`.
  PRs opened against `main` will not be merged.
- **Make sure CI/CD passes.** Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and
  `pnpm build` locally and confirm green before pushing.
- **Pull before you push.** `git pull --rebase origin dev` right before pushing.
- **Do not touch files outside your task.** Only the files under "Where this
  lives". Do not reformat, rename, or delete unrelated files.
- **Follow existing conventions** — match the surrounding hooks.
- **Use testnet only** in every example and test. Never hardcode a mainnet address.
- **Check the references above** before writing code. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
