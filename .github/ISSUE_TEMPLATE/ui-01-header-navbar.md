---
name: "UI-01: Header navbar — design"
about: Design the sticky top navigation bar (desktop + mobile) in Figma
title: "design(ui): header navbar"
labels: ui, design, figma, landing
---

## UI-01: Header Navbar

**Figma frame:** _Header / Navbar_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

> 🎨 **Design-only issue** — you work in Figma, not in code.
> **Depends on:** UI-17 (styles), UI-18 (Button), UI-20 (grid). Use instances/styles.

---

### Context

The navbar is the first thing every visitor sees and it stays pinned while they
scroll. It carries the brand, the primary navigation (links to the sections
below), external links (GitHub, npm), and the primary CTA.

---

### Why this matters

This is persistent chrome — on screen the entire visit. Any misalignment or a
missing mobile state is immediately visible and undermines trust in the SDK.

---

### What to design (in Figma)

- **Brand** — logo/wordmark on the left.
- **Nav links** — the section links (Features, API, Wallets, Docs, Roadmap,
  Community) per the frame.
- **Actions** — GitHub + npm links and the primary CTA (an instance of the UI-18
  `Button`).
- **Two states of the sticky bar** — top-of-page vs scrolled (subtle border/shadow
  or background change).
- **Mobile** — the collapsed hamburger state **and** the open mobile menu.
- Align everything to the UI-20 grid; pull all colors/text from UI-17 styles.

---

### Deliverables

- Desktop navbar (default + scrolled states).
- Mobile navbar (collapsed + open menu).

---

### Acceptance criteria

- [ ] Brand, nav links, GitHub/npm, and CTA (UI-18 Button instance) all present
- [ ] Default + scrolled sticky states designed
- [ ] Mobile collapsed + open-menu states designed
- [ ] Aligned to UI-20 grid; all colors/text from UI-17 styles — no loose hex
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
