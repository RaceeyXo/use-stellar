---
name: "UI-05: Why use-stellar? — design"
about: Design the value-proposition / benefits grid (the "after") in Figma
title: "design(ui): why use-stellar section"
labels: ui, design, figma, landing
---

## UI-05: Why use-stellar?

**Figma frame:** _Why use-stellar?_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

> 🎨 **Design-only issue** — you work in Figma, not in code.
> **Depends on:** UI-17 (styles), UI-19 (Card), UI-20 (grid). Use instances/styles.

---

### Context

The payoff to UI-04: this section makes the case for `use-stellar` — a set of
benefit cards (declarative hooks, built-in loading/error state, wallet-agnostic,
TypeScript-first, SSR-safe). It is the "after" of the before/after and is usually
a grid of benefit cards, each with an icon, title, and one line.

---

### Why this matters

This is where a curious visitor becomes convinced. The benefits must be concrete
and skimmable — icon, headline, one sentence — and the grid perfectly aligned.
High-visibility, high-density section.

---

### What to design (in Figma)

- Section heading + intro line per the frame.
- A grid (UI-20) of benefit **Card** instances (UI-19), each with icon, title,
  and supporting sentence — exact copy from the frame.
- Icons: use the icon set shown in Figma; keep them on a consistent grid/size.
- Match the frame's column count and mobile collapse.

---

### Deliverables

- Desktop grid + mobile (collapsed) version.

---

### Acceptance criteria

- [ ] All benefit cards present with exact copy, icons, and order from the frame
- [ ] Built from UI-19 `Card` instances on the UI-20 grid — not bespoke cards
- [ ] Grid collapse designed for mobile
- [ ] Styles/icons from UI-17 — no loose hex
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
- Pairs with UI-04 (The Problem)
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
