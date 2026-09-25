---
name: "React Native 03: Make react-dom an optional peer and remove DOM-only assumptions"
about: Allow use-stellar to install and load in React Native projects, which have react but not react-dom.
title: "fix(package): make react-dom optional and keep core free of DOM-only imports"
labels: enhancement, react-native, framework-agnostic, refactor, packaging
---

## Make react-dom an optional peer and remove DOM-only assumptions

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `rn-01`

---

### Context

`packages/core/package.json` declares `react-dom >=18` as a required peer and
`tsup.config.ts` treats it as external. React Native apps do not install
`react-dom`, so package managers warn or fail, and any accidental `react-dom`
import crashes Metro at bundle time.

---

### Why this matters

Installation is the first thing an RN developer tries. A required peer they
cannot satisfy makes the library look web-only before any code runs.

---

### Where this lives

- Update: `packages/core/package.json` (`peerDependenciesMeta`)
- Update: `packages/core/tsup.config.ts`
- New: `packages/core/src/__tests__/no-react-dom.test.ts`

---

### Implementation guidelines

- Mark `react-dom` optional via `peerDependenciesMeta` and confirm nothing in
  `src` imports it.
- Add a test that scans the built bundle for `react-dom` and DOM-only globals
  used at module scope.
- Review the `"use client"` banner: it is harmless to Metro but document why it
  stays.

---

### Acceptance criteria

- [ ] Installing `use-stellar` without `react-dom` produces no peer error
- [ ] The built bundles contain no `react-dom` import
- [ ] No module-scope access to `window` or `document` exists
- [ ] Web and demo builds still pass

---

### Reference

- Package manifest: `packages/core/package.json`
- Build config: `packages/core/tsup.config.ts`
- Directive history: `bug-03`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not drop React 18 support.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
