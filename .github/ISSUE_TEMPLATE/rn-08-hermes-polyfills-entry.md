---
name: "React Native 08: Add a polyfills entry and runtime checks for Hermes"
about: Provide a documented polyfill entry for Buffer, crypto.getRandomValues, URL, and TextEncoder required by stellar-sdk on Hermes.
title: "feat(react-native): add a polyfills entry and startup capability checks"
labels: enhancement, react-native, framework-agnostic
---

## Add a polyfills entry and runtime checks for Hermes

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-06`

---

### Context

`@stellar/stellar-sdk` expects Node/browser globals such as `Buffer`,
`crypto.getRandomValues`, a spec-compliant `URL`, and `TextEncoder`. Hermes
lacks some of these, which produces opaque errors deep inside XDR encoding or
transaction hashing.

---

### Why this matters

The most common RN failure is a cryptic `Buffer is not defined` on the first
transaction. An explicit entry and a clear startup check replace hours of
debugging with one import.

---

### Where this lives

- New: `packages/react-native/src/polyfills.ts` (exported as `@use-stellar/react-native/polyfills`)
- New: `packages/react-native/src/platform/assertRuntime.ts`
- New: matching tests
- Update: `packages/react-native/package.json` (subpath export, optional peers)

---

### Implementation guidelines

- Install only missing globals; never overwrite an existing implementation.
- Use well-maintained polyfills (`buffer`, `react-native-get-random-values`,
  `react-native-url-polyfill`) as optional peers.
- In development, have the provider check required globals and throw an
  actionable error naming the missing polyfill.
- Keep polyfills out of the main entry so apps opt in explicitly.

---

### Acceptance criteria

- [ ] Importing the polyfills entry makes XDR encoding and transaction hashing succeed on Hermes
- [ ] Existing globals are not replaced
- [ ] Missing polyfills produce an actionable dev error
- [ ] The main entry does not import polyfills

---

### Reference

- Stellar SDK README (React Native section): https://github.com/stellar/js-stellar-sdk
- Package scaffold: `rn-06`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not bundle a random-number polyfill that is not cryptographically secure.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
