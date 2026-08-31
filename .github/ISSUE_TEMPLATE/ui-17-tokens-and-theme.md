---
name: "UI-17: Tokens & Theme — design foundation"
about: Define the color, type, spacing, radius, and effect styles for the whole design system in Figma
title: "design(ui): tokens & theme foundation (Figma styles)"
labels: ui, design, figma, foundation
---

## UI-17: Tokens & Theme Design (foundation)

**Figma frame:** _Tokens & Theme Design_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** High (200 points)
**Estimated time:** 3 to 4 days

> 🎨 **This is a design-only issue — you work in Figma, not in the repo.** You do
> not touch any code or files. The deliverable is a finished, published set of
> Figma **styles** (and a tokens frame) in the shared file.

> ⚠️ **This is the foundation issue. It blocks UI-01 through UI-20.** Every other
> UI frame consumes the styles you publish here. This must be finished first.

---

### Context

The design is a **light-mode** system with a defined palette, gradients,
surfaces, a typographic scale, and a spacing/radius/elevation rhythm. Before any
section can be designed consistently, all of those values must live as **shared
Figma styles** so every other frame references a named style instead of a loose
hex or a one-off text setting.

---

### Why this matters

If each contributor eyedrops their own colors and types their own font sizes, the
twenty frames will drift immediately and never look like one product. A single
published style library is what keeps every independently-designed frame on-brand.

---

### What to design (in Figma)

**1. Color styles** — publish a named, semantic palette as Figma color styles:

| Style                                           | Purpose                            |
| ----------------------------------------------- | ---------------------------------- |
| `brand` (+ `brand/hover`, `brand/muted`)        | primary brand / CTA color          |
| `surface` / `surface/raised` / `surface/sunken` | page & card backgrounds            |
| `text/heading` / `text/body` / `text/muted`     | text colors                        |
| `border`                                        | default hairline/border            |
| `success` / `warning` / `danger`                | status colors (badges reuse these) |

- Include any **gradients** from the frame as gradient styles (e.g. `hero/gradient`).

**2. Text styles** — publish the type scale (display / h1 / h2 / h3 / body /
small) as Figma text styles with the exact family, size, line-height, and weight.

**3. Effect styles** — publish the elevation/shadow styles used by cards and the
sticky header.

**4. Layout / spacing** — document the spacing scale and corner radii (card,
pill) on the tokens frame so downstream frames reuse exact values.

**5. A "Tokens & Theme" reference frame** — a single frame that visually lists
every style + its value, so contributors on UI-01…UI-16 can look them up at a
glance.

---

### Deliverables

- A published set of Figma **color / text / effect styles** in the shared file.
- The _Tokens & Theme_ reference frame filled in and organized.
- Styles named **semantically** (`surface/raised`, `text/heading`) — not by value.

---

### Acceptance criteria

- [ ] Every color, gradient, text size, radius, and elevation from the frame is a
      **named, published** Figma style
- [ ] Styles are **semantic** (`text/heading`, `surface`) — not raw (`#FFFFFF`)
- [ ] The _Tokens & Theme_ reference frame lists every style and its value
- [ ] Light mode only; palette is internally consistent
- [ ] Frame + styles shared for review; `Closes #[issue number]`
- [ ] **Your PR targets the `dev` branch** — work pushed to `main` (or any
      branch other than `dev`) will **not** be merged
- [ ] ⭐ Leave a star on the project — it is small, free, and very much
      appreciated
- [ ] Open your PR **before the wave ends** — anyone without a submitted PR by
      then is automatically unassigned so the task can go to someone else

---

### Reference

- Figma file: https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
- Consumed by every UI-01…UI-20 frame

---

### Important rules — read before you start

- **Get assigned first.** Unassigned work is not reviewed.
- **Work only in your assigned frame/styles.** Do not edit or move other
  contributors' frames.
- **This is design-only** — do not touch any code or repo files.
- **Publish semantic styles** — no loose hex, no detached text, no one-off values.
- **Match the brand and the existing frames exactly.** Ask in comments when unsure.
- **Light mode only.** Do not design a dark theme here.
- **Share your Figma frame/style link** in the issue for review.
