---
name: "Vue 71: Auto-import composables and type runtimeConfig in the Nuxt module"
about: Nuxt users must import every composable manually and get no types for runtimeConfig.public.stellar.
title: "feat(vue): auto-import composables and type runtimeConfig in the Nuxt module"
labels: enhancement, vue, framework-agnostic, ssr
---

## Auto-import composables and type runtimeConfig in the Nuxt module

**Complexity:** Medium (150 points)
**Estimated time:** 1 to 2 days

---

### Context

`packages/vue/src/nuxt/module.ts` installs the runtime but does not register auto-imports, which Nuxt users expect for composables. The `runtimeConfig.public.stellar` settings are untyped, so a typo like `autoconnect` is silently ignored.

---

### Why this matters

Auto-imports are the Nuxt convention; without them the module feels half-integrated. Typed config catches misconfiguration at build time.

---

### Where this lives

- `packages/vue/src/nuxt/module.ts`
- `packages/vue/src/nuxt/module-definition.ts`
- `packages/vue/src/nuxt/module.test.ts`
- `packages/vue/README.md` (Nuxt section)

---

### Implementation guidelines

- Use `addImports` from `@nuxt/kit` for every exported `use*` composable; derive the list from the package exports, not a hand-written array that goes stale.
- Augment `PublicRuntimeConfig` with a `stellar` key typed from `StellarPluginOptions`.
- Add an `autoImports: false` module option for apps that prefer explicit imports.

---

### Acceptance criteria

- [ ] In a Nuxt fixture, `useBalance()` works without an import
- [ ] A misspelled key in `runtimeConfig.public.stellar` is a type error
- [ ] `autoImports: false` disables it
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

- Nuxt `addImports`: https://nuxt.com/docs/api/kit/autoimports
- `packages/vue/src/nuxt/module.ts`

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
- **Follow existing conventions** — match the surrounding code.
- **Use testnet only** in every example and test. Never hardcode a mainnet address.
- **Check the references above** before writing code. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
