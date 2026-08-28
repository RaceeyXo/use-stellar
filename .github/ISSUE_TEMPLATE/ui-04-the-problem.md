---
name: "UI-04: The Problem — design"
about: Design the problem-statement section that motivates the SDK in Figma
title: "design(ui): the problem section"
labels: ui, design, figma, landing
---

## UI-04: The Problem

**Figma frame:** _The Problem_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** Medium (150 points)
**Estimated time:** 2 to 3 days

> 🎨 **Design-only issue** — you work in Figma, not in code.
> **Depends on:** UI-17 (styles), UI-20 (grid). Use styles/grid.

---

### Context

This section frames the pain `use-stellar` solves: building on Stellar from React
today means hand-wiring the SDK, Horizon calls, loading/error state, wallet
adapters, and pagination yourself. It is the "before" half of the before/after
story that UI-05 ("Why use-stellar?") completes.

---

### Why this matters

People adopt a tool when they feel the problem. Naming the pain precisely — the
boilerplate, the repeated error handling, the wallet fragmentation — earns the
solution that follows. This is a narrative, typographic section; the rhythm and
emphasis are the work.

---

### What to design (in Figma)

- Section heading + the problem copy per the frame.
- The supporting layout — a "messy before" code snippet, a list of pain points,
  or an illustration, as the frame shows. Reproduce that structure.
- If it shows verbose "manual way" code, style it as a code block using UI-17
  styles; keep it readable.
- Consider the muted section band (UI-20) if the frame alternates.

---

### Deliverables

- Desktop + mobile versions of the section.

---

### Acceptance criteria

- [ ] Heading and body copy match the frame's intent
- [ ] Supporting visual/code/list reproduced per the frame
- [ ] Aligned to UI-20 grid; styles from UI-17 — no loose hex
- [ ] Mobile designed
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
- Pairs with UI-05 (Why use-stellar?)
- Depends on UI-17, UI-20

---

### Important rules — read before you start

- **Get assigned first.** Unassigned work is not reviewed.
- **Work only in your assigned frame.** Don't edit others' frames.
- **Design-only** — do not touch any code or repo files.
- **Use UI-17 styles + UI-20 grid** — no loose hex.
- **Match the brand and existing frames exactly.** Ask in comments when unsure.
- **Light mode only.**
- **Share your Figma frame link** in the issue for review.
