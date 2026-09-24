---
name: "React Native 23: Document mobile wallet connection and deep linking"
about: Explain WalletConnect setup, supported mobile wallets, deep-link schemes, and signing round-trip behavior on RN.
title: "docs(react-native): add mobile wallets and deep linking guide"
labels: enhancement, react-native, framework-agnostic, documentation
---

## Document mobile wallet connection and deep linking

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-11`, `rn-12`, `rn-13`

---

### Context

Mobile signing requires a WalletConnect project, app metadata, a redirect
scheme, and an understanding of what happens during app switches.
`docs/guides/wallets.md` covers only browser wallets.

---

### Why this matters

Misconfigured redirect schemes and missing metadata are the top causes of
‘wallet never returns’ reports. Clear docs prevent them.

---

### Where this lives

- New: `docs/react-native/wallets.md`
- Update: `docs/guides/wallets.md` (platform matrix and link)

---

### Implementation guidelines

- Include a platform matrix of which adapters work on web and native.
- Show WalletConnect configuration with a placeholder `projectId` read from env.
- Explain transaction time bounds on native and the expiry error from `rn-13`.
- Document QR fallback when the wallet app is not installed.

---

### Acceptance criteria

- [ ] The guide covers setup, connect, sign, return, and error handling
- [ ] The platform matrix matches adapter metadata
- [ ] No real project IDs or secrets appear

---

### Reference

- WalletConnect RN: `rn-11`
- Deep links: `rn-12`
- Wallet guide: `docs/guides/wallets.md`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
