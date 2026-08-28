---
name: "UI-16: Error handling — docs page design"
about: Design the Error Handling guide documentation page layout in Figma
title: "design(ui): error handling docs page"
labels: ui, design, figma, docs
---

## UI-16: Error Handling (docs page)

**Figma frame:** _Error Handling — Docs Page_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** Medium (150 points)
**Estimated time:** 2 to 3 days

> 🎨 **Design-only issue** — you work in Figma, not in code.
> **Depends on:** UI-17 (styles), UI-20 (narrow grid), UI-13 (docs shell).

---

### Context

A guide page covering the SDK's error model — the normalized error shape, the
error codes (e.g. wallet-not-connected, no-trustline, account-not-found,
validation, rate-limited), and the recommended pattern for handling `error` from
the hooks. Reuses the UI-13 docs shell; content is prose + code + a reference
table.

---

### Why this matters

Predictable error handling is a headline feature of `use-stellar`. This page has
to make the error codes discoverable and show the canonical handling pattern, so
developers build robust UIs instead of guessing. A clear **error-code reference
table** is central to the design.

---

### What to design (in Figma)

- Reuse the UI-13 docs shell (sidebar + narrow reading column + anchor rail).
- Content: intro to the error model, a **code block** showing the recommended
  `if (error) …` handling pattern, and an **error-code reference table** (code ·
  meaning · how to handle).
- Callouts for common gotchas.
- Design a reusable **table** doc primitive (styled from UI-17) since the
  reference pages (docs line) will reuse it. Confirm the real error codes with a
  maintainer / the codebase so the table is accurate.

---

### Deliverables

- Desktop error-handling page + mobile version.
- A reusable docs **table** primitive.

---

### Acceptance criteria

- [ ] Reuses the UI-13 docs shell and doc primitives
- [ ] Error-model intro + recommended handling code block designed
- [ ] Error-code **reference table** designed (reusable table primitive), codes
      confirmed with maintainer/codebase
- [ ] Callouts for gotchas
- [ ] Uses UI-17 styles + UI-20 narrow width; no loose hex
- [ ] Mobile designed (table scroll/stack handled)
- [ ] Frame shared for review; `Closes #[issue number]`
- [ ] **Your PR targets the `dev` branch** — work pushed to `main` (or any
      branch other than `dev`) will **not** be merged
- [ ] ⭐ Leave a star on the project — it is small, free, and very much
      appreciated
- [ ] Open your PR **before the wave ends** — anyone without a submitted PR by
      then is automatically unassigned so the task can go to someone else

---

### Reference

- Figma file: https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
- Reuses UI-13 docs shell
- Depends on UI-17, UI-20, UI-13

---

### Important rules — read before you start

- **Get assigned first.** Unassigned work is not reviewed.
- **Work only in your assigned frame.** Don't edit others' frames.
- **Design-only** — do not touch any code or repo files.
- **Reuse the UI-13 docs shell** and UI-17 styles — no loose hex.
- **Match the brand and existing frames exactly.** Ask in comments when unsure.
- **Light mode only.**
- **Share your Figma frame link** in the issue for review.
