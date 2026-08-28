---
name: "UI-02: Hero section — design"
about: Design the landing hero (headline, subcopy, CTAs, code/visual) in Figma
title: "design(ui): hero section"
labels: ui, design, figma, landing
---

## UI-02: Hero Section

**Figma frame:** _Hero_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

> 🎨 **Design-only issue** — you work in Figma, not in code.
> **Depends on:** UI-17 (styles), UI-18 (Button), UI-20 (grid). Use instances/styles.

---

### Context

The hero is the top band and the most important messaging on the page: it says
what `use-stellar` is in one sentence, shows the one-line install / a taste of the
API, and gives the two next actions (get started, view on GitHub). It sets the
visual tone (gradient, typography) for everything below.

---

### Why this matters

Most visitors decide in seconds. The headline, the CTA hierarchy, and the code
snippet must be crisp and on-brand — this is the frame people screenshot.

---

### What to design (in Figma)

- **Headline + subcopy** using the display/heading text styles from UI-17.
- **Primary + secondary CTAs** as UI-18 `Button` instances.
- **Install line / code taste** — the one-line install (`npm i use-stellar`) or a
  small code snippet card as shown, with a copy affordance if copyable.
- **Hero visual / gradient** — the `hero/gradient` style plus any illustration or
  code card from the frame.
- Align to the UI-20 grid.

---

### Deliverables

- Desktop hero + a mobile version.

---

### Acceptance criteria

- [ ] Headline, subcopy, and CTA hierarchy match the frame's intended copy
- [ ] CTAs are UI-18 Button instances
- [ ] Install line / code card designed
- [ ] Hero gradient/visual uses UI-17 gradient style
- [ ] Desktop + mobile designed; aligned to UI-20 grid — no loose hex
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
- npm: https://www.npmjs.com/package/use-stellar
- Depends on UI-17, UI-18, UI-20

---

### Important rules — read before you start

- **Get assigned first.** Unassigned work is not reviewed.
- **Work only in your assigned frame.** Don't edit others' frames.
- **Design-only** — do not touch any code or repo files.
- **Use UI-17 styles + UI-18/UI-20 components** — no loose hex.
- **Match the brand and existing frames exactly.** Ask in comments when unsure.
- **Light mode only.**
- **Share your Figma frame link** in the issue for review.
