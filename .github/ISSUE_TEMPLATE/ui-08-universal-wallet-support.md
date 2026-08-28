---
name: "UI-08: Universal Wallet Support — design"
about: Design the section showcasing supported Stellar wallets in Figma
title: "design(ui): universal wallet support section"
labels: ui, design, figma, landing
---

## UI-08: Universal Wallet Support

**Figma frame:** _Universal Wallet Support_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** Medium (150 points)
**Estimated time:** 2 to 3 days

> 🎨 **Design-only issue** — you work in Figma, not in code.
> **Depends on:** UI-17 (styles), UI-19 (Card), UI-20 (grid). Use instances/styles.

---

### Context

`use-stellar` is wallet-agnostic — it works across the Stellar wallet ecosystem
(Freighter, Albedo, xBull, Rabet, Lobstr, etc., per what the SDK supports). This
section presents those wallets as a grid/row so visitors see their wallet is
covered.

---

### Why this matters

Wallet fragmentation is a real Stellar pain point (called out in UI-04). Showing
broad coverage answers "will my users be able to connect?" Confirm the actual
supported wallet list with a maintainer / the README so the design is accurate.

---

### What to design (in Figma)

- A grid (UI-20) of **Card**/logo tiles (UI-19) — each with the wallet logo +
  name, styled per the frame.
- Use clean vector wallet logos, optically sized and consistent.
- Section heading + intro per the frame.

---

### Deliverables

- Desktop wallet grid + mobile (wrapped/collapsed) version.

---

### Acceptance criteria

- [ ] Wallets shown match the SDK's actual support (confirmed with maintainer/README)
- [ ] Logos are clean vectors, optically sized; tiles built from UI-19 `Card`
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
- Wallet list: README / https://www.npmjs.com/package/use-stellar
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
