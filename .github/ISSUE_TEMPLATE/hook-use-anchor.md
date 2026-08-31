---
name: "New hook: useAnchor"
about: Resolve an anchor's stellar.toml (SEP-1) so the rest of the SEP stack has something to build on
title: "feat(hook): useAnchor — resolve an anchor's stellar.toml (SEP-1)"
labels: enhancement, hook, help wanted
---

## New hook: `useAnchor`

**Complexity:** Medium (100 points)
**Estimated time:** 2 days
**Blocks:** `hook-use-sep10-auth`

---

### Context

Every Stellar anchor — the on/off ramps that turn XLM into local currency —
publishes a `stellar.toml` at `https://{home_domain}/.well-known/stellar.toml`.
That file is **SEP-1**, and it is the entry point to the entire SEP stack: it is
where you find the anchor's signing key, its authentication endpoint, its
deposit/withdraw server, and the list of currencies it issues.

Nothing in `use-stellar` reads it today. `useAsset` returns a `homeDomain` field
(`types/index.ts`) and then does nothing with it — the caller is handed a domain
string and left to fetch and parse the TOML themselves.

The Stellar SDK already ships a resolver, so this hook does **not** need a TOML
parsing dependency:

```ts
import { StellarToml } from "@stellar/stellar-sdk"
const toml = await StellarToml.Resolver.resolve("testanchor.stellar.org")
```

---

### Why this matters

This is the smallest issue in the anchor track and the one everything else waits
on. `hook-use-sep10-auth` cannot authenticate without `WEB_AUTH_ENDPOINT` and
`SIGNING_KEY`; a future deposit/withdraw hook cannot start without
`TRANSFER_SERVER`. Both of those come from here.

It also closes the `useAsset` loop: today a consumer gets `homeDomain: "centre.io"`
and has to go build their own fetch-and-parse to learn anything from it.

---

### Where this lives

- Hook: `packages/core/src/hooks/useAnchor.ts`
- Test: `packages/core/src/hooks/useAnchor.test.ts`
- Types: add to `packages/core/src/types/index.ts`
- Export: add to `packages/core/src/index.ts` (hook and types)
- Docs: `docs/hooks/use-anchor.md`

---

### Suggested API

```ts
export interface AnchorInfo {
  homeDomain: string
  /** SEP-10 challenge signer. Required before any SEP-10 flow. */
  signingKey: string | null
  /** SEP-10 endpoint. */
  webAuthEndpoint: string | null
  /** SEP-6 deposit/withdraw. */
  transferServer: string | null
  /** SEP-24 interactive deposit/withdraw. */
  transferServerSep24: string | null
  kycServer: string | null
  currencies: AnchorCurrency[]
  /** The raw parsed document, for fields this interface does not model. */
  raw: Record<string, unknown>
}

export interface AnchorCurrency {
  code: string
  issuer: string | null
  name?: string
  desc?: string
  image?: string
  isAssetAnchored?: boolean
}

export interface UseAnchorOptions {
  homeDomain?: string | null
  /** Defaults to `true`; set `false` to fetch manually via `refetch()`. */
  autoFetch?: boolean
}

export interface UseAnchorReturn {
  anchor: AnchorInfo | null
  loading: boolean
  error: StellarError | null
  refetch: () => void
}
```

---

### Implementation guidelines

- **Use `StellarToml.Resolver.resolve()` from the SDK.** Do not add a TOML parser
  dependency and do not hand-roll one — every dependency added here ships to every
  consumer of the library (see `pkg-02`).
- **HTTPS only.** The resolver accepts an `allowHttp` option; it must be `false`
  on mainnet, always. Fetching an anchor's signing key over plaintext HTTP means a
  network attacker chooses the key you will later validate a SEP-10 challenge
  against, which defeats the entire authentication flow. Allow HTTP **only** when
  the provider network is a local/standalone network, and say so in the JSDoc.
- **Bound the response.** SEP-1 caps `stellar.toml` at 100 KB. Enforce a limit and
  a timeout rather than trusting a remote server to be well-behaved.
- **Missing fields are normal, not errors.** Most anchors implement a subset. A
  TOML with no `TRANSFER_SERVER` is a valid TOML — return `null` for that field.
  Only a fetch failure or a parse failure is an `error`.
- **Normalize, don't just forward.** The TOML keys are `SCREAMING_SNAKE_CASE`;
  the hook's surface is camelCase. Keep the untouched document on `raw` so callers
  can reach fields this interface does not model without a library change.
- **Validate `signingKey` is actually a valid Stellar public key** before returning
  it. Land `bug-07` first and reuse its `StrKey` validation rather than a regex —
  a malformed signing key that reaches `hook-use-sep10-auth` becomes a security
  problem there.
- Follow the `useAsset` shape for `autoFetch` / `refetch`, and use `toStellarError`
  for every failure so the error surface matches the rest of the library.
- Guard with `isBrowser()` the way the other hooks do; SSR renders should be inert.
- Test against **`testanchor.stellar.org`**, the SDF-run reference anchor. Do not
  point tests at a production anchor.

---

### Acceptance criteria

- [ ] Resolves a real testnet anchor's `stellar.toml` and exposes the mapped fields
- [ ] `signingKey`, `webAuthEndpoint`, `transferServer`, and `currencies` are all
      populated for `testanchor.stellar.org`
- [ ] An anchor TOML missing optional fields yields `null`s, **not** an error
- [ ] A 404 / unreachable domain sets `error`, not a thrown exception
- [ ] Plaintext HTTP is refused on mainnet
- [ ] An oversized or slow response is bounded by a size limit and a timeout
- [ ] `signingKey` is validated as a real Stellar public key before being returned
- [ ] `raw` carries the untouched parsed document
- [ ] No TOML parsing dependency is added — the SDK resolver is used
- [ ] SSR render is a no-op, not a throw
- [ ] `docs/hooks/use-anchor.md` follows `docs/example.md`
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

- Hook shape to follow: `packages/core/src/hooks/useAsset.ts`
- The unused `homeDomain` field: `packages/core/src/types/index.ts`
- Address validation to reuse: `bug-07`
- Error codes: `packages/core/src/errors/codes.ts`
- Documentation template: [`docs/example.md`](../../docs/example.md)
- Related: `hook-use-sep10-auth` (blocked by this), `pkg-02` (dependency weight)
- SEP-1: https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md
- Reference anchor: https://testanchor.stellar.org/.well-known/stellar.toml

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
