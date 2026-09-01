---
name: "Vue 01: Extract framework-neutral network configuration runtime"
about: Move network configuration resolution out of the React provider so React and Vue share one validated implementation.
title: "feat(core): extract framework-neutral network configuration runtime"
labels: enhancement, vue, framework-agnostic, good first issue
---

## Extract framework-neutral network configuration runtime

**Complexity:** Medium (100 points)
**Estimated time:** 1 day

---

### Context

`resolveNetworkConfig` currently lives in `StellarProvider.tsx`, despite being
pure configuration logic. Vue cannot reuse it without importing React. Move this
logic into a React-free runtime module so every framework resolves built-in and
custom Stellar networks identically.

---

### Why this matters

Network passphrase and endpoint validation are correctness-critical. Duplicating
them in a Vue adapter would eventually produce different validation errors or,
worse, transactions signed for a different network.

---

### Where this lives

- New: `packages/core/src/runtime/network.ts`
- New: `packages/core/src/runtime/network.test.ts`
- Update: `packages/core/src/context/StellarProvider.tsx`
- Update: `packages/core/src/index.ts`

---

### Implementation guidelines

- Export a pure `resolveNetworkConfig(network, override)` function and any
  narrowly-scoped helper types it needs.
- Preserve today’s built-in defaults, custom-network requirements, trimming, and
  descriptive validation errors.
- Make the React provider consume the extracted function; do not change its
  public props or rendering behavior.
- The new runtime module must not import React, browser globals, or Vue.

---

### Acceptance criteria

- [ ] Built-in and custom network configurations resolve exactly as before
- [ ] Invalid custom configuration still fails with actionable errors
- [ ] Unit tests run without React or a DOM environment
- [ ] `StellarProvider` delegates to the shared runtime function
- [ ] The helper is exported from the framework-neutral entry point or subpath
- [ ] `pnpm lint`, `pnpm typecheck`, and the affected tests pass
- [ ] No unrelated hooks or public return shapes change

---

### Reference

- Current implementation: `packages/core/src/context/StellarProvider.tsx`
- Network types and defaults: `packages/core/src/types/index.ts`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Preserve React compatibility; this is an extraction, not a behavior change.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.

