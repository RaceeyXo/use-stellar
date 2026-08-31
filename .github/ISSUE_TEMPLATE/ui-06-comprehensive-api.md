---
name: "UI-06: Comprehensive API — design"
about: Design the API grid showcasing every hook with a stability badge in Figma
title: "design(ui): comprehensive API section"
labels: ui, design, figma, landing
---

## UI-06: Comprehensive API

**Figma frame:** _Comprehensive API_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

> 🎨 **Design-only issue** — you work in Figma, not in code.
> **Depends on:** UI-17 (styles), UI-19 (Card/Badge), UI-20 (grid). Use instances/styles.

---

### Context

This section shows the SDK's surface area at a glance: a grid of every hook the
library ships — `useAccount`, `usePayments`, `useSendPayment`, `useWallet`,
`useBalances`, and the rest — each as a card with the hook name, a one-line
description, and a stability `Badge` (`Stable` / `Beta`).

---

### Why this matters

"Is this complete or a toy?" — the API grid answers it. The hook names shown
should reflect the SDK's **real** API, so the design doesn't promise hooks that
don't exist. Ask a maintainer in the comments for the current hook list +
stability if you're unsure.

---

### What to design (in Figma)

- A grid (UI-20) of **Card** instances (UI-19), each an interactive/hover card:
  hook name (mono text style), one-line description, and a `Stable`/`Beta` `Badge`.
- Use the real exported hook names (confirm the list with a maintainer / the
  README / npm page) — don't invent hooks.
- Section heading + intro per the frame; match the frame's columns + mobile
  collapse.

---

### Deliverables

- Desktop API grid + mobile (collapsed) version.

---

### Acceptance criteria

- [ ] Every card maps to a real hook (confirmed with maintainer/README/npm)
- [ ] Each card shows name, description, and a `Stable`/`Beta` `Badge`
- [ ] Built from UI-19 `Card`/`Badge` instances on the UI-20 grid
- [ ] Mobile collapse designed; styles from UI-17 — no loose hex
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
- Hook list: README / https://www.npmjs.com/package/use-stellar (confirm with maintainer)
- Depends on UI-17, UI-19, UI-20

---

### Important rules — read before you start

- **Get assigned first.** Unassigned work is not reviewed.
- **Work only in your assigned frame.** Don't edit others' frames.
- **Design-only** — do not touch any code or repo files.
- **Use UI-17 styles + UI-19/UI-20 components** — no loose hex.
- **Match the brand and existing frames exactly.** Ask in comments when unsure.
- **Light mode only.**
- **Share your Figma frame link** in the issue for review.
