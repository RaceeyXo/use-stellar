---
name: "Vue 43: Add release automation and a package smoke test for @use-stellar/vue"
about: Publish the Vue adapter alongside core with a smoke test that proves ESM/CJS entries load without React.
title: "ci(vue): add release automation and a publish smoke test"
labels: enhancement, vue, framework-agnostic, packaging, ci
---

## Add release automation and a package smoke test for @use-stellar/vue

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-42`

---

### Context

`packages/core/scripts/smoke-test.js` checks the built core package. The release
workflow only publishes `use-stellar`. The Vue adapter needs the same publish
path and a smoke test that loads it in Node without React installed.

---

### Why this matters

The most likely packaging bug is the Vue bundle accidentally importing React
through the main `use-stellar` entry. A smoke test that runs without React
installed catches that before users do.

---

### Where this lives

- New: `packages/vue/scripts/smoke-test.js`
- Update: `packages/vue/package.json` (`test:package`, `publishConfig`, `files`)
- Update: `.github/workflows/release.yml`

---

### Implementation guidelines

- Pack the package, install it into a temp directory with only `vue` and
  `use-stellar`, and import both ESM and CJS entries.
- Fail if `react` or `react-dom` is resolved during import.
- Publish Vue with the same provenance and access settings as core (`ci-08`).
- Keep versioning aligned with the repository’s release process.

---

### Acceptance criteria

- [ ] The smoke test passes for ESM and CJS entries
- [ ] The smoke test fails if React is imported
- [ ] The release workflow publishes Vue only after core succeeds
- [ ] Published `files` contain only `dist` and metadata

---

### Reference

- Core smoke test: `packages/core/scripts/smoke-test.js`
- Release hardening: `ci-08`
- Exports map: `pkg-01`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not publish from local machines; release only through the workflow.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
