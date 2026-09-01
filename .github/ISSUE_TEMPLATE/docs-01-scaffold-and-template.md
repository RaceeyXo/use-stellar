---
name: "Docs 01 — Scaffold the /docs folder and author the hook template"
about: Create the /docs folder tree and write example.md — the template every hook doc must follow
title: "docs: scaffold /docs folder and author example.md template"
labels: documentation, good first issue
---

## Scaffold the `/docs` folder and author the hook documentation template

**Complexity:** Trivial (100 points)
**Estimated time:** half a day
**Blocks:** every other docs issue — nothing else can start until the template exists.

---

### Context

use-stellar has no documentation beyond the npm README. Before anyone can write
per-topic docs, the repo needs a folder tree to hold them and a single template
that guarantees every hook page looks the same. This issue creates both.

You are not writing hook content here. You are laying the foundation that every
other documentation issue copies from. If the template is good, every downstream
doc is consistent. If it is sloppy, every downstream doc inherits the mess.

---

### Scope — files to create

```
docs/
├── getting-started/      (empty folder — filled in later issues)
├── hooks/                (empty folder — filled in later issues)
├── guides/               (empty folder — filled in later issues)
├── reference/            (empty folder — filled in later issues)
└── example.md            (written in THIS issue)
```

Create the four subfolders (commit a `.gitkeep` in each so the empty dirs are
tracked) and the `example.md` file at the root of `docs/`.

---

### `example.md` — required content

Copy this verbatim into `docs/example.md`. Every hook file created in later
issues must follow this structure exactly.

````md
# Hook Documentation Template

This file shows the exact format that every hook documentation file in
`docs/hooks/` must follow. Copy this file and fill in the sections. Do not
invent a new format.

---

## [Hook name]

> One sentence that says exactly what this hook does.

### Installation

```bash
npm install use-stellar @stellar/stellar-sdk
```

### Import

```ts
import { useHookName } from "use-stellar"
```

### Basic usage

```tsx
import { useHookName } from "use-stellar"

function MyComponent() {
  const { data, loading, error } = useHookName()

  if (loading) return <p>Loading...</p>
  if (error) return <p>Error: {error}</p>

  return <p>{data}</p>
}
```

### Parameters

| Parameter | Type     | Required | Default | Description    |
| --------- | -------- | -------- | ------- | -------------- |
| `param1`  | `string` | Yes      | —       | What this does |

If the hook takes no parameters, write: "This hook takes no parameters."

### Return values

| Property  | Type             | Description                                   |
| --------- | ---------------- | --------------------------------------------- |
| `data`    | `T \| null`      | The result. `null` while loading or on error. |
| `loading` | `boolean`        | `true` while the request is in flight.        |
| `error`   | `string \| null` | Error message on failure, `null` on success.  |
| `refetch` | `() => void`     | Manually re-fetch.                            |

### Examples

#### Example 1 — basic usage

```tsx
const { data, loading } = useHookName()
```

#### Example 2 — with options

```tsx
const { data } = useHookName({ option: "value" })
```

#### Example 3 — error handling

```tsx
const { data, error, refetch } = useHookName()

if (error) {
  return (
    <div>
      <p>Something went wrong: {error}</p>
      <button onClick={refetch}>Try again</button>
    </div>
  )
}
```

### TypeScript

```ts
interface HookNameReturn {
  data: ResultType | null
  loading: boolean
  error: string | null
  refetch: () => void
}
```

### Common errors

| Error message            | Cause                    | Fix                                     |
| ------------------------ | ------------------------ | --------------------------------------- |
| `"Wallet not connected"` | Called before connecting | Call `connect()` from `useWallet` first |

### Notes

Caveats and gotchas that do not fit the sections above.

### Related hooks

- [`useRelatedHook`](./use-related-hook.md) — why it is related
````

---

### Writing standards (these apply to every docs issue)

- Write for a React developer who has never touched a blockchain. Never assume
  knowledge of Stellar, Horizon, Soroban, or wallets.
- Every code example must be complete and copy-pasteable. No `// ...`, no
  `<YourComponent>`, no fake imports.
- Every code example must use **testnet** — never hardcode mainnet addresses or
  contract IDs.
- Use the second person — "you", not "the developer".
- Short sentences. One idea per sentence.
- If something can go wrong, document it.
- Never use the words "simple" or "easy".

---

### Suggested execution

```bash
git checkout main && git pull --rebase origin main
git checkout -b docs/scaffold-and-template
mkdir -p docs/getting-started docs/hooks docs/guides docs/reference
# create docs/example.md with the content above
git commit -m "docs: add docs folder structure and example.md template"
```

---

### Acceptance criteria

- [ ] `docs/` exists at the monorepo root
- [ ] `docs/getting-started/`, `docs/hooks/`, `docs/guides/`, `docs/reference/` all exist and are tracked in git
- [ ] `docs/example.md` exists and contains the full template above, unaltered
- [ ] No placeholder text or TODO comments
- [ ] PR description includes `Closes #[issue number]`

---

### Important — read before you start

- **Always make sure your CI/CD passes** before requesting review. A red pipeline will not be reviewed.
- **Pull before you push** — run `git pull --rebase origin main` so your branch is up to date and you avoid conflicts.
- **Do not touch or delete any file that is not part of your designated task.** This issue only creates files under `docs/`. Changing anything else will get the PR closed.
- **Use `docs/example.md` as your reference** for structure and formatting.
- **Use the npm documentation as your API reference:** https://www.npmjs.com/package/use-stellar

---

### Guidelines

- You must be assigned to this issue before starting work
- Do not open a pull request before you are assigned — unassigned PRs will be closed without review
- Do not open a draft PR to ask questions — ask in the issue comments
- PR description must include `Closes #[issue number]`
