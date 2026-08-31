---
name: "Pkg 03: two conflicting size-limit configs, neither of which ever runs"
about: .size-limit.json and the package.json size-limit key disagree on the file and the rules, and no workflow measures either
title: "fix(pkg): one size budget, enforced in CI"
labels: bug, packaging, ci, help wanted
---

## Two conflicting size budgets, neither enforced

**Complexity:** Low (50 points)
**Estimated time:** Half a day

---

### Context

The package configures `size-limit` twice, and the two configurations disagree.

`packages/core/.size-limit.json`:

```json
[
  {
    "path": "dist/index.js",
    "limit": "50 kB",
    "ignore": ["@stellar/stellar-sdk", "@stellar/freighter-api"]
  }
]
```

`packages/core/package.json`:

```json
"size-limit": [{ "path": "dist/index.mjs", "limit": "50 kB" }]
```

Different file — the CJS build in one, the ESM build in the other. Different rules —
one discounts the Stellar and Freighter SDKs, the other counts everything. `size-limit`
resolves a single configuration source, so one of these two is dead, and there is
nothing in the repository indicating which.

It does not matter much today, because neither runs. `pnpm size` exists only as a
script inside `packages/core`, is not reachable from the root, and appears in no
workflow. The budget has never been measured in CI.

The `ignore` list is also now wrong in a way worth noting: `@stellar/freighter-api`
is **not** external in `tsup.config.ts`, so it is bundled into `dist` — telling
size-limit to ignore it means the budget excludes bytes that consumers genuinely
download. `pkg-02` changes this; the two issues need to agree.

---

### Why this matters

A bundle-size budget only does anything if it fails a build. This wave adds
seventeen hooks to a package that advertises itself as a lightweight alternative to
using the raw SDK. Without a measured, enforced number, "lightweight" is a claim in
the README that nothing checks — and by the end of the wave nobody will know what
the number was when it started.

---

### Where this lives

- `packages/core/.size-limit.json` — or the `size-limit` key in
  `packages/core/package.json`; **one of the two is deleted**
- `packages/core/package.json` (`size` script)
- `package.json` (root — a pass-through script)
- `.github/workflows/ci.yml`

---

### Implementation guidelines

- **Pick one config location and delete the other.** The `package.json` key is
  usually the better choice — one fewer file, and it sits next to the `size-limit`
  dependency. Either is defensible; having both is not.
- **Measure both build outputs, not one.** Consumers get the ESM build via a
  bundler and the CJS build via Node. Add an entry for each, with a name, so the
  report says which is which.
- **Set the limits to the measured reality.** Build, run `size-limit`, read the
  numbers, and set each limit slightly above what you measured. Do not keep `50 kB`
  because it is already written down — verify it. If the real size is well under,
  tighten it; if it is over, the current config has been failing silently and the PR
  should say so.
- **Decide the `ignore` question explicitly and write down why.** Ignoring
  externalized peers is correct — the consumer already has them. Ignoring _bundled_
  code is not; it hides real bytes. Since `pkg-02` is moving the wallet SDKs from
  bundled to external, coordinate: if `pkg-02` lands first the ignore list becomes
  right, and if this lands first it needs revisiting. Say in the PR which order you
  assumed.
- **Add `--why` to a separate script** (`size:why`). When someone's PR trips the
  budget, that command tells them what caused it, and a one-line pointer to it in
  the failure is worth more than the budget itself.
- **Expose it from the root** so `pnpm size` works from a clean clone, and **run it
  in CI after the build**. It must fail the job when the budget is exceeded — verify
  by temporarily lowering the limit, watching CI go red, and restoring it. Say in
  the PR that you did.
- Record the measured baseline in the PR description. That number is the reference
  point for the rest of the wave.

---

### Acceptance criteria

- [ ] Exactly one `size-limit` configuration location remains
- [ ] Both `dist/index.js` and `dist/index.mjs` are measured, each with a name
- [ ] Limits are set from measured values, and the measurements are in the PR
- [ ] The `ignore` list is justified in the PR, with the assumed `pkg-02` ordering
      stated
- [ ] `pnpm size` works from the repository root
- [ ] A `size:why` script exists
- [ ] CI runs the size check after the build and fails when the budget is exceeded —
      demonstrated and stated in the PR
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build` all pass locally
- [ ] No file outside "Where this lives" is touched
- [ ] PR description includes `Closes #[issue number]`
- [ ] **Your PR targets the `dev` branch** — work pushed to `main` (or any
      branch other than `dev`) will **not** be merged
- [ ] ⭐ Leave a star on the project — it is small, free, and very much
      appreciated
- [ ] Open your PR **before the wave ends** — anyone without a submitted PR by
      then is automatically unassigned so the task can go to someone else

---

### Reference

- Config A: `packages/core/.size-limit.json`
- Config B: `packages/core/package.json`, the `size-limit` key
- The script nothing calls: `packages/core/package.json`, `scripts.size`
- The externals that decide what counts: `packages/core/tsup.config.ts`
- Related: `pkg-02` (changes what is bundled — coordinate), `ci-01`
- `size-limit`: https://github.com/ai/size-limit

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
- **Follow existing conventions** — match the surrounding config.
- **Use testnet only** in every example and test. Never hardcode a mainnet address.
- **Check the references above** before writing code. If the README and the source
  disagree, the source wins.
- **Do not open a draft PR to ask questions** — ask in the issue comments.
