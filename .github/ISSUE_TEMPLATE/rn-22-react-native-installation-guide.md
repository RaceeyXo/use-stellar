---
name: "React Native 22: Document React Native installation, polyfills, and provider setup"
about: Write the RN getting-started guide covering install, Metro config, polyfills, and the native StellarProvider.
title: "docs(react-native): add installation and provider setup guide"
labels: enhancement, react-native, framework-agnostic, documentation
---

## Document React Native installation, polyfills, and provider setup

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-07`, `rn-08`, `rn-09`

---

### Context

RN setup differs from web in four places: required polyfills, Metro
package-exports configuration, optional native modules (AsyncStorage, NetInfo),
and the native provider. None of this is documented.

---

### Why this matters

Getting-started friction decides adoption. Each undocumented step becomes an
issue report.

---

### Where this lives

- New: `docs/react-native/installation.md`
- New: `docs/react-native/provider.md`
- Update: `docs/getting-started/installation.md` (link only)
- Update: `README.md` (RN section)

---

### Implementation guidelines

- Cover Expo and bare RN separately where steps differ.
- List every optional peer and what breaks without it.
- Explain the platform capability, focus, and online behavior in user terms.
- Follow the tone and structure of `docs/getting-started/`.

---

### Acceptance criteria

- [ ] A new user can reach a working balance read by following the guide
- [ ] Every code snippet uses testnet and public exports
- [ ] Troubleshooting covers `Buffer is not defined` and Metro resolution errors

---

### Reference

- Getting started: `docs/getting-started/`
- Polyfills: `rn-08`
- Metro: `rn-09`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not rewrite web documentation beyond navigation links.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
