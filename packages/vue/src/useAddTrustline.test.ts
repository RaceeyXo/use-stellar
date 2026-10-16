import {
  AddTrustlineAbortedError,
  StellarError,
  type AddTrustlineOptions,
  type TransactionResult,
} from "use-stellar/core"
import { createStellarTestHarness as createHarness, type StellarTestHarness } from "./test-utils"
import { useAddTrustline } from "./useAddTrustline"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  addTrustline: jest.fn(),
  onlineManager: { isOnline: jest.fn(() => true) },
}))

import { addTrustline } from "use-stellar/core"

const mockAddTrustline = addTrustline as jest.Mock
const harnesses: StellarTestHarness[] = []
const options: AddTrustlineOptions = {
  asset: { code: "USDC", issuer: "G" + "A".repeat(55) },
  limit: "1000.0000000",
}

function createHarnessTracked(): StellarTestHarness {
  const harness = createHarness({ network: "testnet" })
  harness.runtime.setWallet({
    connected: true,
    connecting: false,
    address: "G" + "B".repeat(55),
    network: "testnet",
    wallet: "freighter",
    walletName: "Freighter",
    error: null,
    walletNetwork: "testnet",
    walletNetworkPassphrase: harness.runtime.networkConfig.networkPassphrase,
  })
  harnesses.push(harness)
  return harness
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

beforeEach(() => mockAddTrustline.mockReset())

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    harness.dispose()
    harness.runtime.queryStore.clear()
  }
})

test("delegates the exact asset and limit to the shared action", async () => {
  const outcome: TransactionResult = { hash: "abc", status: "success" }
  mockAddTrustline.mockResolvedValue(outcome)
  const harness = createHarnessTracked()
  const state = harness.run(useAddTrustline)

  const promise = state.addTrustline(options)
  expect(state.loading.value).toBe(true)
  await expect(promise).resolves.toEqual(outcome)

  expect(mockAddTrustline).toHaveBeenCalledWith(
    expect.objectContaining({
      network: "testnet",
      networkConfig: harness.runtime.networkConfig,
      wallet: harness.runtime.wallet,
      queryStore: harness.runtime.queryStore,
    }),
    options
  )
  expect(state.result.value).toEqual(outcome)
  expect(state.error.value).toBeNull()
  expect(state.loading.value).toBe(false)
})

test("a newer request wins over an older completion", async () => {
  const first = deferred<TransactionResult>()
  const second = deferred<TransactionResult>()
  mockAddTrustline.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const harness = createHarnessTracked()
  const state = harness.run(useAddTrustline)

  const firstPromise = state.addTrustline(options)
  const secondPromise = state.addTrustline({ ...options, limit: "2000.0000000" })
  second.resolve({ hash: "new", status: "success" })
  await secondPromise
  first.resolve({ hash: "old", status: "success" })
  await firstPromise

  expect(state.result.value).toEqual({ hash: "new", status: "success" })
  expect(state.loading.value).toBe(false)
})

test("reset invalidates an in-flight completion", async () => {
  const pending = deferred<TransactionResult>()
  mockAddTrustline.mockReturnValue(pending.promise)
  const harness = createHarnessTracked()
  const state = harness.run(useAddTrustline)

  const promise = state.addTrustline(options)
  state.reset()
  pending.resolve({ hash: "late", status: "success" })
  await promise

  expect(state.result.value).toBeNull()
  expect(state.error.value).toBeNull()
  expect(state.loading.value).toBe(false)
})

test("does not mutate state after scope disposal", async () => {
  const pending = deferred<TransactionResult>()
  mockAddTrustline.mockReturnValue(pending.promise)
  const harness = createHarnessTracked()
  const state = harness.run(useAddTrustline)

  const promise = state.addTrustline(options)
  harness.dispose()
  pending.resolve({ hash: "late", status: "success" })
  await promise

  expect(state.result.value).toBeNull()
})

test("projects timeout and failed submission outcomes", async () => {
  const timeout = new StellarError("TX_TIMEOUT", "timed out", { hash: "pending-hash" })
  mockAddTrustline.mockRejectedValueOnce(timeout)
  const harness = createHarnessTracked()
  const state = harness.run(useAddTrustline)

  await expect(state.addTrustline(options)).rejects.toBe(timeout)
  expect(state.result.value).toEqual({ hash: "pending-hash", status: "pending" })
  expect(state.error.value).toBe(timeout)

  const failed = Object.assign(new StellarError("TRANSACTION_FAILED", "failed", { hash: "bad" }), {
    isSubmissionFailure: true,
  })
  mockAddTrustline.mockRejectedValueOnce(failed)
  await expect(state.addTrustline(options)).rejects.toBe(failed)
  expect(state.result.value).toEqual({ hash: "bad", status: "failed" })
})

test("preflight failures preserve state and aborted requests match React", async () => {
  const harness = createHarnessTracked()
  const state = harness.run(useAddTrustline)
  mockAddTrustline.mockResolvedValueOnce({ hash: "good", status: "success" })
  await state.addTrustline(options)

  const preflight = Object.assign(new Error("wallet missing"), { isPreflightError: true })
  mockAddTrustline.mockRejectedValueOnce(preflight)
  await expect(state.addTrustline(options)).rejects.toBe(preflight)
  expect(state.result.value).toEqual({ hash: "good", status: "success" })

  mockAddTrustline.mockRejectedValueOnce(new AddTrustlineAbortedError())
  await expect(state.addTrustline(options)).resolves.toEqual({ hash: "", status: "failed" })
})

test("the Vue cache accepts the core account key used after success", async () => {
  const harness = createHarnessTracked()
  const key = ["account", "https://horizon.example", "testnet", "GABC"] as const
  const serialized = JSON.stringify(key)

  await harness.runtime.queryStore.run(serialized, async () => ({ balance: "10" }))
  expect(harness.runtime.queryStore.isFresh(serialized)).toBe(true)

  harness.runtime.queryStore.invalidate(key)
  expect(harness.runtime.queryStore.isFresh(serialized)).toBe(false)
})
