---
name: "UI-13: Installation — docs page design"
about: Design the Installation documentation page layout in Figma
title: "design(ui): installation docs page"
labels: ui, design, figma, docs
---

## UI-13: Installation (docs page)

**Figma frame:** _Installation — Docs Page_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** Medium (150 points)
**Estimated time:** 2 to 3 days

> 🎨 **Design-only issue** — you work in Figma, not in code.
> **Depends on:** UI-17 (styles), UI-20 (grid — use the **narrow** reading width).

---

### Context

The first docs page a developer hits: how to install `use-stellar` and its peer
requirements. This issue designs the **docs page template** as it appears on
Installation — the docs shell (sidebar nav + reading column + on-this-page /
right rail) plus the Installation content itself.

> This frame establishes the **docs reading layout** reused by UI-14, UI-15, and
> UI-16. Design the shared docs shell carefully here.

---

### Why this matters

If a developer can't install cleanly, nothing else matters. The page must make the
install command copyable, show package-manager options (npm/pnpm/yarn), and state
peer deps clearly. It also sets the docs template every other doc page inherits.

---

### What to design (in Figma)

- **Docs shell** — left sidebar navigation (docs tree), the centered **narrow**
  reading column (UI-20 narrow container), and an optional right "On this page"
  anchor rail.
- **Installation content** — page title, intro, a **code block with
  package-manager tabs** (npm / pnpm / yarn) and a copy affordance, a peer-deps
  note/callout, and a "next step → Quickstart" link.
- Reusable doc primitives styled from UI-17: headings, paragraph, inline code,
  code block, callout/admonition, and the tabbed code block.

---

### Deliverables

- Desktop docs page (with the shell) + mobile (collapsed sidebar) version.
- The shared docs primitives (code block, tabs, callout) as reusable pieces.

---

### Acceptance criteria

- [ ] Docs shell (sidebar + narrow reading column + anchor rail) designed
- [ ] Installation content: title, intro, PM-tabbed copyable code block, peer-deps
      callout, next-step link
- [ ] Doc primitives (headings, code block, tabs, callout) styled from UI-17
- [ ] Mobile (collapsed sidebar / drawer) designed
- [ ] Uses UI-20 narrow width; no loose hex
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
- Establishes the docs template for UI-14/UI-15/UI-16
- Depends on UI-17, UI-20

---

### Important rules — read before you start

- **Get assigned first.** Unassigned work is not reviewed.
- **Work only in your assigned frame.** Don't edit others' frames.
- **Design-only** — do not touch any code or repo files.
- **Use UI-17 styles + UI-20 narrow grid** — no loose hex.
- **Match the brand and existing frames exactly.** Ask in comments when unsure.
- **Light mode only.**
- **Share your Figma frame link** in the issue for review.
