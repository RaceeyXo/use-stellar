import { StellarError, toStellarError, type WalletState } from "use-stellar/core"
import { createStellarTestHarness, type StellarTestHarness } from "./test-utils"
import { useSorobanWrite } from "./useSorobanWrite"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  invokeContract: jest.fn(),
}))

import { invokeContract } from "use-stellar/core"

const mockInvoke = invokeContract as jest.Mock
const CONTRACT_ID = "CADQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQOBYHA4DQP5KR"
const call = { contractId: CONTRACT_ID, method: "increment" }
const wallet: WalletState = {
  connected: true,
  connecting: false,
  address: "G" + "B".repeat(55),
  network: "testnet",
  wallet: "freighter",
  walletName: "Freighter",
  error: null,
  walletNetwork: "testnet",
  walletNetworkPassphrase: "Test SDF Network ; September 2015",
}

const harnesses: StellarTestHarness[] = []
function setup() {
  const harness = createStellarTestHarness({ network: "testnet" })
  harness.runtime.setWallet(wallet)
  harnesses.push(harness)
  return { harness, state: harness.run(() => useSorobanWrite<number>()) }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(res => (resolve = res))
  return { promise, resolve }
}

beforeEach(() => mockInvoke.mockReset())
afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    harness.dispose()
    harness.runtime.queryStore.clear()
  }
})

test("delegates to the core action with the shared runtime and projects success", async () => {
  mockInvoke.mockResolvedValue({ hash: "h1", result: 7 })
  const { harness, state } = setup()

  const promise = state.invoke(call)
  expect(state.loading.value).toBe(true)
  await expect(promise).resolves.toEqual({ hash: "h1", result: 7 })

  expect(mockInvoke).toHaveBeenCalledWith(
    expect.objectContaining({ queryStore: harness.runtime.queryStore, wallet }),
    call
  )
  expect(state.result.value).toEqual({ hash: "h1", status: "success", result: 7 })
  expect(state.error.value).toBeNull()
  expect(state.loading.value).toBe(false)
})

test("a rejected signature leaves no result and reports the error", async () => {
  mockInvoke.mockRejectedValue(new Error("User declined access"))
  const { state } = setup()
  const caught = await state.invoke(call).catch(e => e)
  expect(caught).toBeInstanceOf(StellarError)
  expect(state.result.value).toBeNull()
  expect(state.error.value).toBe(caught)
  expect(state.error.value?.code).toBe(toStellarError(new Error("User declined access"))?.code)
  expect(state.loading.value).toBe(false)
})

test("TX_TIMEOUT records a pending result with the hash", async () => {
  mockInvoke.mockRejectedValue(new StellarError("TX_TIMEOUT", undefined, { hash: "slow" }))
  const { state } = setup()
  await expect(state.invoke(call)).rejects.toMatchObject({ code: "TX_TIMEOUT" })
  expect(state.result.value).toEqual({ hash: "slow", status: "pending", result: null })
  expect(state.error.value?.code).toBe("TX_TIMEOUT")
})

test("a submission failure records a failed result with the hash", async () => {
  mockInvoke.mockRejectedValue(new StellarError("TRANSACTION_FAILED", undefined, { hash: "bad" }))
  const { state } = setup()
  await expect(state.invoke(call)).rejects.toMatchObject({ code: "TRANSACTION_FAILED" })
  expect(state.result.value).toEqual({ hash: "bad", status: "failed", result: null })
})

test("a stale call cannot overwrite a newer one", async () => {
  const slow = deferred<{ hash: string; result: number }>()
  mockInvoke.mockReturnValueOnce(slow.promise).mockResolvedValueOnce({ hash: "new", result: 2 })
  const { state } = setup()
  const first = state.invoke(call)
  await state.invoke(call)
  slow.resolve({ hash: "old", result: 1 })
  await first
  expect(state.result.value).toEqual({ hash: "new", status: "success", result: 2 })
  expect(state.loading.value).toBe(false)
})

test("an abort rethrows without reporting an error", async () => {
  const abort = Object.assign(new Error("aborted"), { name: "AbortError" })
  mockInvoke.mockRejectedValue(abort)
  const { state } = setup()
  await expect(state.invoke(call)).rejects.toBe(abort)
  expect(state.error.value).toBeNull()
})

test("reset clears state and ignores the in-flight call", async () => {
  const slow = deferred<{ hash: string; result: number }>()
  mockInvoke.mockReturnValueOnce(slow.promise)
  const { state } = setup()
  const pending = state.invoke(call)
  state.reset()
  slow.resolve({ hash: "late", result: 1 })
  await pending
  expect(state.result.value).toBeNull()
  expect(state.loading.value).toBe(false)
})
