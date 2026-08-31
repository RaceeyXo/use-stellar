---
name: "UI-14: Quickstart — docs page design"
about: Design the Quickstart documentation page layout in Figma
title: "design(ui): quickstart docs page"
labels: ui, design, figma, docs
---

## UI-14: Quickstart (docs page)

**Figma frame:** _Quickstart — Docs Page_
**Figma file:** https://www.figma.com/design/BSr242a615D8Lbg6WjT7l1/Use-stellar-design
**Complexity:** Medium (150 points)
**Estimated time:** 2 to 3 days

> 🎨 **Design-only issue** — you work in Figma, not in code.
> **Depends on:** UI-17 (styles), UI-20 (narrow grid), UI-13 (docs shell).

---

### Context

The Quickstart takes a developer from installed → first working call: wrap the app
in the provider, use a hook, render the result. This page reuses the **docs shell
from UI-13** and focuses on a clear, numbered, copy-pasteable walkthrough.

---

### Why this matters

Quickstart is where "time to first success" is won or lost. The steps must be
sequential, each with a copyable code block, and end with a visible result so the
developer knows it worked.

---

### What to design (in Figma)

- Reuse the UI-13 docs shell (sidebar + narrow reading column + anchor rail).
- **Numbered steps** (e.g. 1. Install → 2. Add the provider → 3. Use a hook → 4. See the result), each with a title, short prose, and a copyable code block.
- A **result preview** (rendered output) for the final step per the frame.
- "Next steps" links (Hooks, Guides) at the bottom.
- Reuse the doc primitives from UI-13 (code block, callout, step markers).

---

### Deliverables

- Desktop quickstart page + mobile version.

---

### Acceptance criteria

- [ ] Reuses the UI-13 docs shell and doc primitives
- [ ] Numbered steps with copyable code blocks, in order
- [ ] Final-step result preview designed
- [ ] Next-steps links present
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
