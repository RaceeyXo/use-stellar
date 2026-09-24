---
name: "React Native 01: Replace isBrowser gating with a platform capability model"
about: Stop treating 'no window' as 'server' so wallet connection, storage, and timers work on React Native as well as SSR.
title: "refactor(core): replace isBrowser checks with explicit platform capabilities"
labels: enhancement, react-native, framework-agnostic, refactor
---

## Replace isBrowser gating with a platform capability model

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-02`

---

### Context

Core uses `isBrowser()` (`typeof window !== "undefined"`) to decide whether
wallet connection is allowed. On React Native there is no `window`, so
`useWallet().connect()` always fails with “Wallet connection is only available
in the browser. Move your component to a "use client" boundary”. That message is
wrong for RN, and the gate is at the wrong layer.

The runtime should carry an explicit `platform` capability object — `{ kind:
"web" | "server" | "native", canConnectWallet, storage, … }` — set by each
adapter package. Hooks consult the runtime, not globals.

---

### Why this matters

`isBrowser` conflates two questions: “is this a server render?” and “is there a
DOM?”. RN is neither a server nor a browser. Until this is split, no wallet flow
can work on mobile, and every RN fix would be a special case.

---

### Where this lives

- New: `packages/core/src/runtime/platform.ts`
- New: `packages/core/src/runtime/platform.test.ts`
- Update: `packages/core/src/runtime/StellarRuntime.ts`
- Update: `packages/core/src/hooks/useWallet.ts`
- Update: `packages/core/src/utils/index.ts` (`isBrowser` kept for compatibility)

---

### Implementation guidelines

- Define a `PlatformCapabilities` type and a default `detectPlatform()` for web
  and server that preserves today’s behavior exactly.
- Accept an optional `platform` override in `createStellarRuntime` so the RN
  package can declare `kind: "native"`.
- Replace the `isBrowser()` gate in `useWallet` with
  `runtime.platform.canConnectWallet`; keep the SSR error message for `server`.
- Keep `isBrowser` exported and unchanged for public compatibility.

---

### Acceptance criteria

- [ ] Web and SSR behavior are unchanged (existing SSR tests pass)
- [ ] A runtime created with `kind: "native"` allows `connect()` without `window`
- [ ] The SSR error message is shown only for `server`
- [ ] Platform detection is unit-tested without a DOM
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

---

### Reference

- Current gate: `packages/core/src/hooks/useWallet.ts`
- Helper: `packages/core/src/utils/index.ts` (`isBrowser`)
- Runtime: `vue-02`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Do not import `react-native` or any RN library from `packages/core`.
- Do not change public hook return shapes.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
