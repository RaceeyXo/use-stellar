---
name: "UI-09: Documentation navigation — design"
about: Design the documentation navigation grid/section on the landing page in Figma
title: "design(ui): documentation navigation section"
labels: ui, design, figma, landing
---

## UI-09: Documentation Navigation

**Figma frame:** _Documentation Navigation_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** Medium (150 points)
**Estimated time:** 2 to 3 days

> 🎨 **Design-only issue** — you work in Figma, not in code.
> **Depends on:** UI-17 (styles), UI-19 (Card), UI-20 (grid). Use instances/styles.

---

### Context

A section that routes visitors into the docs — a grid of entry-point cards
(Getting Started, Installation, Quickstart, Hooks, Guides, API Reference) that
mirrors the docs structure. It's the bridge from the marketing page to the
documentation.

---

### Why this matters

Once a visitor is convinced, they need an obvious next step. Clear, well-grouped
doc entry cards reduce bounce and get people to their first successful call fast.
The categories should mirror the real docs sections.

---

### What to design (in Figma)

- A grid (UI-20) of **Card** instances (UI-19), each a link card: icon/title,
  short description, and a subtle "arrow"/affordance.
- Group/label per the docs structure (Getting Started, Hooks, Guides, Reference)
  — confirm the sections with a maintainer / the docs folder.
- Section heading + intro per the frame.

---

### Deliverables

- Desktop docs-nav grid + mobile (collapsed) version.

---

### Acceptance criteria

- [ ] Doc entry cards cover the real docs categories (confirmed with maintainer)
- [ ] Each card: icon/title, description, and link affordance
- [ ] Built from UI-19 `Card` instances on the UI-20 grid
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
