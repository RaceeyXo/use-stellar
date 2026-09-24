---
name: "Vue 16: Extract framework-neutral Soroban read and event services"
about: Move Soroban simulation reads and the contract-events poller out of React hooks so Vue can reuse argument encoding, decoding, and polling.
title: "refactor(core): extract Soroban simulation and event-polling services"
labels: enhancement, vue, framework-agnostic, refactor
---

## Extract framework-neutral Soroban read and event services

**Complexity:** High (200 points)
**Estimated time:** 2 days
**Depends on:** `vue-02`

---

### Context

`useSorobanContract` owns contract-ID validation, argument serialization
(`argsKey`), `ContractSpecLike` argument mapping, anonymous-source simulation,
and result decoding. `useContractEvents` owns an RPC `getEvents` poller with
start-ledger tracking, topic filters, a bounded buffer, and decode-failure
handling.

Extract these into `simulateContractCall(networkConfig, options)` and a
`createContractEventPoller(networkConfig, options)` object with `start`, `stop`,
`clear`, and `subscribe`.

---

### Why this matters

Soroban encoding and ledger-cursor logic are easy to get subtly wrong. A shared
poller also means interval, buffer-size, and backoff fixes land once for React,
Vue, and React Native.

---

### Where this lives

- New: `packages/core/src/queries/soroban.ts`
- New: `packages/core/src/runtime/contractEventPoller.ts`
- New: matching `*.test.ts` files
- Update: `packages/core/src/hooks/useSorobanContract.ts`, `useContractEvents.ts`

---

### Implementation guidelines

- Keep `ANONYMOUS_SIMULATION_SOURCE`, contract-ID validation, and args-key
  serialization identical and export the args-key helper for adapters.
- The poller owns its timer and exposes an immutable snapshot `{ events,
latestLedger, loading, error }` plus `subscribe`.
- Guard against non-positive intervals as today.
- Refactor both React hooks to use the shared services with no API change.

---

### Acceptance criteria

- [ ] Simulation and poller are tested with a mocked RPC server and fake timers
- [ ] Buffer size is enforced and oldest events are dropped first
- [ ] `stop()` clears the timer and prevents late results from being published
- [ ] Existing Soroban hook tests pass unchanged
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass

---

### Reference

- Current hooks: `packages/core/src/hooks/useSorobanContract.ts`, `useContractEvents.ts`
- Soroban key: `sorobanContractKey` in `packages/core/src/cache/keys.ts`

---

### Important rules — read before you start

- Get assigned first and target the `dev` branch.
- Touch only the files listed above unless a maintainer approves otherwise.
- Behavior-preserving extraction only.
- Do not import React or Vue from `packages/core/src/runtime`, `queries`, or
  `actions`.
- Use testnet only in tests and examples.
- Include `Closes #[issue number]` in the PR description.
