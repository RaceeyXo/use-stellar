---
name: "Docs 20: seven exported hooks have no documentation page"
about: Nine of fifteen exported hooks are undocumented; two are already covered by other issues — these seven are not
title: "docs(hooks): backfill the seven missing hook reference pages"
labels: documentation, good first issue, help wanted
---

## Seven exported hooks have no documentation page

**Complexity:** High (200 points) — see "Claiming part of this" below
**Estimated time:** 3 to 4 days for all seven

---

### Context

`packages/core/src/index.ts` exports **fifteen** hooks. `docs/hooks/` contains
**six** pages:

`use-asset.md`, `use-balance.md`, `use-network.md`, `use-send-payment.md`,
`use-soroban-contract.md`, `use-transaction.md`

Nine hooks are undocumented. Two of those — `useWallet` and `useAccount` — are
already covered by `docs-06` and `docs-08`. **These seven are covered by nothing:**

| Hook                    | Source                           | Page to write                           |
| ----------------------- | -------------------------------- | --------------------------------------- |
| `useAccountExists`      | `hooks/useAccountExists.ts`      | `docs/hooks/use-account-exists.md`      |
| `useAddTrustline`       | `hooks/useAddTrustline.ts`       | `docs/hooks/use-add-trustline.md`       |
| `useClaimableBalance`   | `hooks/useClaimableBalance.ts`   | `docs/hooks/use-claimable-balance.md`   |
| `useFederationLookup`   | `hooks/useFederationLookup.ts`   | `docs/hooks/use-federation-lookup.md`   |
| `usePayments`           | `hooks/usePayments.ts`           | `docs/hooks/use-payments.md`            |
| `usePaymentHistory`     | `hooks/usePaymentHistory.ts`     | `docs/hooks/use-payment-history.md`     |
| `useTransactionHistory` | `hooks/useTransactionHistory.ts` | `docs/hooks/use-transaction-history.md` |

---

### Why this matters

Every one of these is exported from the package index, which means it is public API
that users will find via autocomplete and then have nowhere to read about. Two of
them are the ones people reach for most: `usePayments` and `useTransactionHistory`
are how you build a transaction list, the second thing anyone builds after a balance
display.

Several are also being changed by this wave — `state-06`, `state-07` and `state-08`
all touch payment and history hooks. Documenting the current behaviour first gives
those issues something to diff against.

---

### Claiming part of this

Seven pages is more than one person should take on in a wave. **Say in the comments
which hooks you want** and you will be assigned those. Multiple contributors can
work on this issue at once, one PR per person. Note in your PR which pages it covers
so the rest stay claimable.

---

### Where this lives

- `docs/hooks/*.md` — the seven files above
- `docs/hooks/.gitkeep` — remove it once the directory has real content
- `README.md` — if it carries a hook index

Do not change any source file.

---

### Implementation guidelines

- **Follow `docs/example.md`,** and read the six existing pages first. Match their
  structure exactly — this is a reference section, and consistency across pages is
  the whole value.
- **Read the hook before writing about it.** Document what the code does, not what
  the name suggests. Signatures, option defaults, and return shapes all come from
  the source and from `packages/core/src/types/index.ts`.
- **Run every example.** Use the demo app or a scratch Next.js project. A reference
  page whose example does not compile is worse than a missing page.
- **Document the failure cases, not just the happy path.** For each hook: what
  happens on a Horizon 404, what `loading` and `error` do, what `refetch` does, and
  what happens when the wallet is not connected. Users read reference pages when
  something has gone wrong.
- **Document today's behaviour, including behaviour you think is wrong.** If you
  find a bug — and in these particular hooks you may well, since several are the
  subject of open issues in this wave — write down what it currently does, open a
  separate issue, and link it from the PR. Do not silently document the behaviour
  you wish it had.
- **Note where an open issue will change things.** A short "this is changing —
  see #N" line is genuinely useful to a reader and costs one sentence. `state-06`,
  `state-07`, `state-08` and `bug-06` all touch hooks on this list.
- **Fix one known contradiction while you are here.** `README.md` describes
  `@stellar/stellar-sdk` as a **peer dependency**; `packages/core/package.json`
  declares it under `dependencies`. The source wins — correct the README, and
  mention it in the PR so it can be cross-checked against `pkg-02`, which is
  reworking the dependency layout.
- Every address in every example must be **testnet**.

---

### Acceptance criteria

- [ ] Each claimed hook has a page under `docs/hooks/` following `docs/example.md`
- [ ] Each page documents the full options and return shape, verified against the
      source and `types/index.ts`
- [ ] Each page documents `loading`, `error`, and the not-connected / 404 cases
- [ ] Every example was run, and the PR says where
- [ ] Behaviour is documented as it is today; anything that looks like a bug is filed
      and linked, not quietly corrected
- [ ] Pages affected by open issues carry a short pointer to them
- [ ] The README's peer-dependency claim is corrected
- [ ] `docs/hooks/.gitkeep` is removed once the directory has content
- [ ] Every address is testnet
- [ ] No source file is changed
- [ ] The PR states which pages it covers
- [ ] `pnpm lint` and `pnpm typecheck` pass locally
- [ ] No file outside "Where this lives" is touched
- [ ] PR description includes `Closes #[issue number]` — or `Part of #[issue number]`
      if you claimed a subset
- [ ] **Your PR targets the `dev` branch** — work pushed to `main` (or any
      branch other than `dev`) will **not** be merged
- [ ] ⭐ Leave a star on the project — it is small, free, and very much
      appreciated
- [ ] Open your PR **before the wave ends** — anyone without a submitted PR by
      then is automatically unassigned so the task can go to someone else

---

### Reference

- Documentation template: [`docs/example.md`](../../docs/example.md)
- Pages to match: `docs/hooks/use-balance.md`, `docs/hooks/use-asset.md`
- The export list: `packages/core/src/index.ts`
- Shared types: `packages/core/src/types/index.ts`
- The dependency claim to fix: `README.md`, "Installation"
- Related: `docs-06` (`useWallet`), `docs-08` (`useAccount`), `state-06`,
  `state-07`, `state-08`, `bug-06`, `pkg-02`

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
- **Follow existing conventions** — match the surrounding docs.
- **Use testnet only** in every example. Never hardcode a mainnet address.
- **Check the references above** before writing. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
