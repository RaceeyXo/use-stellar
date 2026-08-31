---
name: "UI-15: SSR guide — docs page design"
about: Design the Server-Side Rendering guide documentation page layout in Figma
title: "design(ui): SSR guide docs page"
labels: ui, design, figma, docs
---

## UI-15: SSR Guide (docs page)

**Figma frame:** _SSR Guide — Docs Page_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** Medium (150 points)
**Estimated time:** 2 to 3 days

> 🎨 **Design-only issue** — you work in Figma, not in code.
> **Depends on:** UI-17 (styles), UI-20 (narrow grid), UI-13 (docs shell).

---

### Context

A guide page covering how to use `use-stellar` with server-side rendering
(Next.js App Router: client components, the provider boundary, avoiding
server/client hydration mismatches). It reuses the UI-13 docs shell and is
heavier on prose + callouts than the quickstart.

---

### Why this matters

SSR is where most React data hooks trip people up. A clear guide — with `"use
client"` guidance, provider placement, and do/don't callouts — prevents a whole
class of support issues and shows the SDK is production-ready.

---

### What to design (in Figma)

- Reuse the UI-13 docs shell (sidebar + narrow reading column + anchor rail).
- Guide content: page title, intro, several sub-sections with headings, code
  blocks, and prominent **callouts/admonitions** (info / warning / do / don't).
- A comparison or "server vs client" layout if the frame shows one.
- Reuse UI-13 doc primitives; add any callout variants needed and style from UI-17.

---

### Deliverables

- Desktop SSR guide page + mobile version.

---

### Acceptance criteria

- [ ] Reuses the UI-13 docs shell and doc primitives
- [ ] Sub-sections, code blocks, and info/warning/do-don't callouts designed
- [ ] Any server-vs-client comparison layout matches the frame
- [ ] Uses UI-17 styles + UI-20 narrow width; no loose hex
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
- Reuses UI-13 docs shell
- Depends on UI-17, UI-20, UI-13

---

### Important rules — read before you start

- **Get assigned first.** Unassigned work is not reviewed.
- **Work only in your assigned frame.** Don't edit others' frames.
- **Design-only** — do not touch any code or repo files.
- **Reuse the UI-13 docs shell** and UI-17 styles — no loose hex.
- **Match the brand and existing frames exactly.** Ask in comments when unsure.
- **Light mode only.**
- **Share your Figma frame link** in the issue for review.
