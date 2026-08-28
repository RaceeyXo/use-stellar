---
name: "UI-10: Roadmap — design"
about: Design the roadmap / what's next section in Figma
title: "design(ui): roadmap section"
labels: ui, design, figma, landing
---

## UI-10: Roadmap

**Figma frame:** _Roadmap_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** Medium (150 points)
**Estimated time:** 2 to 3 days

> 🎨 **Design-only issue** — you work in Figma, not in code.
> **Depends on:** UI-17 (styles), UI-19 (Card/Badge), UI-20 (grid). Use instances/styles.

---

### Context

The roadmap communicates where `use-stellar` is going — shipped, in-progress, and
planned milestones (new hooks, Soroban depth, SSR improvements, etc.). Usually a
timeline or a set of status-badged cards/columns (Now / Next / Later or
Done / In progress / Planned).

---

### Why this matters

A visible roadmap signals the project is alive and maintained, and it invites
contribution (people can pick up "planned" items — which is exactly what these
issues are for). Status must be legible at a glance via badges.

---

### What to design (in Figma)

- The roadmap layout per the frame — a timeline or Now/Next/Later columns.
- Each item as a **Card** (UI-19) with a status **Badge** (`success`/done,
  `beta`/in-progress, `neutral`/planned) reusing UI-17 status colors.
- Section heading + intro per the frame.
- Confirm the actual roadmap items with a maintainer so content is accurate.

---

### Deliverables

- Desktop roadmap + mobile (stacked) version.

---

### Acceptance criteria

- [ ] Roadmap structure (timeline/columns) matches the frame
- [ ] Items are UI-19 `Card`s with clear status `Badge`s
- [ ] Content confirmed with a maintainer (not invented)
- [ ] Aligned to UI-20 grid; styles from UI-17 — no loose hex
- [ ] Mobile stacked version designed
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
