---
name: "UI-07: Simple by Design — design"
about: Design the section that shows how little code use-stellar needs in Figma
title: "design(ui): simple by design section"
labels: ui, design, figma, landing
---

## UI-07: Simple by Design

**Figma frame:** _Simple by Design_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

> 🎨 **Design-only issue** — you work in Figma, not in code.
> **Depends on:** UI-17 (styles), UI-20 (grid). Use styles/grid.

---

### Context

The "show, don't tell" section: a minimal code example proving how little a
developer writes to do something real with `use-stellar` (e.g. fetch an account
or send a payment in a few lines), often paired with a rendered result or
annotations pointing at each line.

---

### Why this matters

The pitch is "declarative, tiny surface area." A clean, believable code sample is
the strongest proof. The snippet should reflect the real API shape (correct hook
names / return values) — confirm with a maintainer or the README if unsure.

---

### What to design (in Figma)

- Section heading + intro per the frame.
- The **code card** — window chrome (dots / filename tab), syntax-colored code
  using UI-17 text/color styles, and a copy affordance if shown.
- The code content should mirror the real `use-stellar` usage (imports, the hook,
  loading/error handling) — keep it plausible and current.
- Any callouts/annotations from the frame.

---

### Deliverables

- Desktop + mobile versions (code card scrolls/wraps gracefully on mobile).

---

### Acceptance criteria

- [ ] Code card + syntax styling match the frame
- [ ] Code content mirrors the real API shape (confirmed with maintainer/README)
- [ ] Copy affordance shown if in the frame
- [ ] Aligned to UI-20 grid; styles from UI-17 — no loose hex
- [ ] Mobile version designed
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
- API reference: README / https://www.npmjs.com/package/use-stellar
- Depends on UI-17, UI-20

---

### Important rules — read before you start

- **Get assigned first.** Unassigned work is not reviewed.
- **Work only in your assigned frame.** Don't edit others' frames.
- **Design-only** — do not touch any code or repo files.
- **Use UI-17 styles + UI-20 grid** — no loose hex.
- **Match the brand and existing frames exactly, keep code plausible.** Ask in comments when unsure.
- **Light mode only.**
- **Share your Figma frame link** in the issue for review.
