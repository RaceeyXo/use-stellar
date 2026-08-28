---
name: "UI-18: Buttons & States — component design"
about: Design the button component with all variants, sizes, and interaction states in Figma
title: "design(ui): button component — variants & states"
labels: ui, design, figma, foundation
---

## UI-18: Buttons & States (component)

**Figma frame:** _Buttons & States — Components_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** Medium (150 points)
**Estimated time:** 2 to 3 days

> 🎨 **Design-only issue** — you work in Figma, not in code. Deliverable is a
> published Figma **component** (with variants) in the shared file.

> **Depends on:** UI-17 (styles). Use the published color/text/effect styles — never loose hex.

---

### Context

Almost every frame uses a button — hero CTAs, "Get started" links, form submits.
This issue designs **one** reusable Figma button component that encodes the full
button system: three variants and every interaction state, as component variants.
Downstream section frames drop in instances instead of redrawing buttons.

---

### Why this matters

Buttons are the single most-repeated element. If they drift — different padding,
different hover, missing disabled treatment — the whole product looks unpolished.
Designing it once as a proper variant component keeps every CTA identical.

---

### What to design (in Figma)

A **Button** component using Figma **variants** across these properties:

- **Variant:** `primary` (brand fill, white label), `secondary` (subtle
  surface/outline, brand label), `ghost` (no fill, brand label, hover bg only).
- **Size:** `sm` / `md` / `lg` — mapped to the padding + text-style steps.
- **State:** `default`, `hover`, `active/pressed`, `focus` (visible focus ring
  using the brand style), `disabled` (reduced opacity), `loading` (inline spinner,
  dimmed label).

Use **auto-layout** so the button hugs its label and scales with size. Pull all
fills, text, and rings from UI-17 published styles.

---

### Deliverables

- A published **Button** component with the full variant matrix (variant × size ×
  state) laid out on the frame.
- Auto-layout, semantic layer names, styles referenced (not detached).

---

### Acceptance criteria

- [ ] `primary` / `secondary` / `ghost` designed, matching the frame
- [ ] All six states (default/hover/active/focus/disabled/loading) shown per variant
- [ ] `sm` / `md` / `lg` sizes match the frame's padding + type steps
- [ ] Built as a Figma component with variants + auto-layout
- [ ] All fills/text/rings reference UI-17 styles — no loose hex
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

---

### Important rules — read before you start

- **Get assigned first.** Unassigned work is not reviewed.
- **Work only in your assigned frame/component.** Don't edit others' frames.
- **Design-only** — do not touch any code or repo files.
- **Use UI-17 published styles** — no loose hex, no detached text.
- **Match the brand and existing frames exactly.** Ask in comments when unsure.
- **Light mode only.**
- **Share your Figma frame link** in the issue for review.
