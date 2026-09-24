---
name: "Wallets 10: Lazy-load wallet SDKs as optional peers with per-adapter size budgets"
about: Keep bundle size flat as adapters are added: vendor SDKs load on demand and are optional peers, with size checks per adapter.
title: "build(wallets): lazy-load wallet SDKs as optional peers and enforce size budgets"
labels: enhancement, wallets, framework-agnostic, packaging
---

## Lazy-load wallet SDKs as optional peers with per-adapter size budgets

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `wallet-01`

---

### Context

Core ships `@stellar/freighter-api`, `@albedo-link/intent`, and
`@lobstrco/signer-extension-api` as hard dependencies, and the root
`package.json` duplicates `@albedo-link/intent` (`pkg-02`). Adding eight
adapters the same way would multiply install size and bundle weight for every
user.

---

### Why this matters

Most apps support two or three wallets. They should not download and bundle SDKs
for all of them. Size budgets turn that principle into a CI failure.

---

### Where this lives

- Update: `packages/core/package.json` (optional peers, `peerDependenciesMeta`, `size-limit`)
- Update: `packages/core/tsup.config.ts`
- Update: `packages/core/src/wallets/*Adapter.ts` (dynamic imports)
- Update: root `package.json` (remove duplicated wallet dependency)

---

### Implementation guidelines

- Load each vendor SDK with a dynamic import inside the adapter method that
  needs it.
- Move vendor SDKs to optional peers; throw `wallet_unavailable` with an install
  hint when a peer is missing.
- Add a size-limit entry proving the main entry does not grow when adapters are
  added.
- Coordinate with `pkg-02` so the duplicated dependency is removed once.

---

### Acceptance criteria

- [ ] Main bundle size does not include vendor SDK code
- [ ] Missing optional peers produce an actionable install error
- [ ] Size-limit enforces budgets in CI
- [ ] Freighter and Albedo keep working with their peers installed

---

### Reference

- Duplicated SDKs: `pkg-02`
- Size configs: `pkg-03`
- Build settings: `pkg-04`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not break existing Freighter or Albedo users without a documented migration
  note.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
