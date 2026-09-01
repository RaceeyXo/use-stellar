---
name: "Figma Design (Dark Mode): Responsive Layout Grid"
about: "Grid and breakpoint specs (mobile/tablet/desktop) showing how sections reflow and how spacing scales."
title: "design(ui): dark mode responsive layout grid"
labels: ui, design, figma, foundation
---

## Figma Design (Dark Mode): Responsive Layout Grid

**Figma frame:** _Responsive Layout Grid_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** Medium (150 points)
**Estimated time:** 2 to 3 days

> 🎨 **Design-only issue** — you work in Figma, not in code. Deliverable is a
> documented, published **layout grid** system in the shared file.

> **Depends on:** UI-17 (styles). Use published spacing values.

---

### Context

Grid and breakpoint specs (mobile/tablet/desktop) showing how sections reflow and how spacing scales.

Every landing section and docs page shares the same horizontal rhythm: a max
content width, consistent gutters, and a column grid that collapses predictably
from desktop → tablet → mobile. Defining this once as a **Figma layout grid**
(with named breakpoints) means UI-01…UI-16 never re-guess widths or margins.

---

### Why this matters

If each frame is drawn at its own width with its own margins, the section edges
won't line up and the assembled page will look loose. One documented grid keeps
every band on the same left/right edges and vertical rhythm.

---

### What to design (in Figma)

- **Breakpoints** — define the exact frame widths for **mobile**, **tablet**, and
  **desktop** and label them on the frame.
- **Container** — the max content width and the responsive side gutters at each
  breakpoint (plus a **narrow** reading width for the docs pages UI-13…UI-16).
- **Column grid** — the column count, gutter, and margin at each breakpoint,
  saved as a reusable Figma **layout grid** style (e.g. 12-col desktop → 8 →
  4/1-up), and how multi-up card grids collapse (3-up → 2-up → 1-up).
- **Section rhythm** — the standard vertical spacing between sections and the
  alternating band treatment (default vs muted surface).
- A reference frame showing the grid at all three breakpoints.

---

### Deliverables

- A published Figma **layout grid** style applied to example frames at each
  breakpoint.
- A reference frame documenting breakpoints, container widths, gutters, columns,
  and section spacing.

---

### Acceptance criteria

- [ ] Mobile / tablet / desktop breakpoints defined and labeled
- [ ] Container max-width, gutters, and narrow reading width defined
- [ ] Column grid saved as a reusable Figma layout grid, with collapse rules
- [ ] Section vertical rhythm + muted-band treatment documented
- [ ] Spacing values reference UI-17 — no arbitrary numbers
- [ ] Reference frame shared for review; `Closes #[issue number]`
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
- Consumed by: every UI-01…UI-16 frame

---

### Important rules — read before you start

- **Get assigned first.** Unassigned work is not reviewed.
- **Work only in your assigned frame.** Don't edit others' frames.
- **Design-only** — do not touch any code or repo files.
- **Use UI-17 spacing values** — no arbitrary margins.
- **Match the brand and existing frames exactly.** Ask in comments when unsure.
- **Dark mode only.**
- **Share your Figma frame link** in the issue for review.
