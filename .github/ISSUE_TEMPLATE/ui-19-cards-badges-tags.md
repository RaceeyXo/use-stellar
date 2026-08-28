---
name: "UI-19: Cards, Badges & Tags — component design"
about: Design the Card, Badge, and Tag components with their variants in Figma
title: "design(ui): card, badge, and tag components"
labels: ui, design, figma, foundation
---

## UI-19: Cards, Badges & Tags (components)

**Figma frame:** _Cards, Badges & Tags — Components_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** Medium (150 points)
**Estimated time:** 2 to 3 days

> 🎨 **Design-only issue** — you work in Figma, not in code. Deliverable is a set
> of published Figma **components** in the shared file.

> **Depends on:** UI-17 (styles). Use published styles — never loose hex.

---

### Context

Cards are the workhorse of this design — the Comprehensive API grid (UI-06), the
Documentation Navigation grid (UI-09), the wallet showcase (UI-08), and the
benefits grid (UI-05) all use cards. Badges label API stability
(`Stable` / `Beta`) and tags categorize. This issue designs the reusable `Card`,
`Badge`, and `Tag` components once so every grid frame uses instances.

---

### Why this matters

Three contributors designing three card grids will produce three subtly different
cards unless there is one shared component. Designing the card, badge, and tag
primitives once keeps every grid consistent and the `Stable`/`Beta` badge
semantics identical everywhere.

---

### What to design (in Figma)

**Card** — the container used across grids.

- Surface fill, border, corner radius, padding, and elevation from UI-17 styles.
- A **default** (static) state and an **interactive/hover** state (elevation or
  border change) for clickable cards used in the API and docs grids.
- Flexible internal composition (title area, body, optional footer/badge slot)
  via auto-layout — not a rigid fixed layout.

**Badge** — the stability/status label, as variants:

- `stable`, `beta`, `neutral`, `success`, `warning`, `danger`.
- Pill shape; `stable` and `beta` are the two the API grid needs — match their
  exact colors, reusing UI-17 status color styles.

**Tag** — a lighter categorization chip:

- Smaller/quieter than a badge, with an optional leading dot/icon slot.

Build all three as Figma components (Badge with variants) using auto-layout.

---

### Deliverables

- Published **Card**, **Badge** (with variants), and **Tag** components.
- A frame showing every state/variant, all referencing UI-17 styles.

---

### Acceptance criteria

- [ ] `Card` designed with a static and an interactive/hover state
- [ ] `Badge` variants incl. `stable` + `beta` match Figma/brand colors
- [ ] `Tag` matches the frame's chip styling
- [ ] Built as Figma components with auto-layout; badge uses variants
- [ ] All fills/text/effects reference UI-17 styles — no loose hex
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
- Styles: UI-17
- Used by: UI-05, UI-06, UI-08, UI-09

---

### Important rules — read before you start

- **Get assigned first.** Unassigned work is not reviewed.
- **Work only in your assigned frame/components.** Don't edit others' frames.
- **Design-only** — do not touch any code or repo files.
- **Use UI-17 published styles** — no loose hex, no detached text.
- **Match the brand and existing frames exactly.** Ask in comments when unsure.
- **Light mode only.**
- **Share your Figma frame link** in the issue for review.
