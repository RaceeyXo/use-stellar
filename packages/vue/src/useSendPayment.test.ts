import { StellarError, type SendPaymentOptions, type SendPaymentResult } from "use-stellar/core"
import { createStellarTestHarness as createHarness, type StellarTestHarness } from "./test-utils"
import { useSendPayment } from "./useSendPayment"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  sendPayment: jest.fn(),
  onlineManager: { isOnline: jest.fn(() => true) },
}))

import { sendPayment } from "use-stellar/core"

const mockSendPayment = sendPayment as jest.Mock
const harnesses: StellarTestHarness[] = []
const options: SendPaymentOptions = {
  to: "G" + "A".repeat(55),
  asset: "XLM",
  amount: "10",
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

beforeEach(() => mockSendPayment.mockReset())

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    harness.dispose()
    harness.runtime.queryStore.clear()
  }
})

test("delegates to the shared action and projects success", async () => {
  const outcome: SendPaymentResult = { hash: "abc", status: "success" }
  mockSendPayment.mockResolvedValue(outcome)
  const harness = createHarnessTracked()
  const state = harness.run(useSendPayment)

  const promise = state.send(options)
  expect(state.loading.value).toBe(true)
  await expect(promise).resolves.toEqual(outcome)

  expect(mockSendPayment).toHaveBeenCalledWith(
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

test("a newer send wins over an older completion", async () => {
  const first = deferred<SendPaymentResult>()
  const second = deferred<SendPaymentResult>()
  mockSendPayment.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const harness = createHarnessTracked()
  const state = harness.run(useSendPayment)

  const firstPromise = state.send(options)
  const secondPromise = state.send({ ...options, amount: "20" })
  second.resolve({ hash: "new", status: "success" })
  await secondPromise
  first.resolve({ hash: "old", status: "success" })
  await firstPromise

  expect(state.result.value).toEqual({ hash: "new", status: "success" })
  expect(state.loading.value).toBe(false)
})

test("reset invalidates an in-flight completion", async () => {
  const pending = deferred<SendPaymentResult>()
  mockSendPayment.mockReturnValue(pending.promise)
  const harness = createHarnessTracked()
  const state = harness.run(useSendPayment)

  const promise = state.send(options)
  state.reset()
  pending.resolve({ hash: "late", status: "success" })
  await promise

  expect(state.result.value).toBeNull()
  expect(state.error.value).toBeNull()
  expect(state.loading.value).toBe(false)
})

test("does not mutate state after scope disposal", async () => {
  const pending = deferred<SendPaymentResult>()
  mockSendPayment.mockReturnValue(pending.promise)
  const harness = createHarnessTracked()
  const state = harness.run(useSendPayment)

  const promise = state.send(options)
  harness.dispose()
  pending.resolve({ hash: "late", status: "success" })
  await promise

  expect(state.result.value).toBeNull()
})

test("records timeout and submission failure outcomes", async () => {
  const timeout = new StellarError("TX_TIMEOUT", "timed out", { hash: "pending-hash" })
  mockSendPayment.mockRejectedValueOnce(timeout)
  const harness = createHarnessTracked()
  const state = harness.run(useSendPayment)

  await expect(state.send(options)).rejects.toBe(timeout)
  expect(state.result.value).toEqual({ hash: "pending-hash", status: "pending" })
  expect(state.error.value).toBe(timeout)

  const failed = Object.assign(new StellarError("TRANSACTION_FAILED", "failed", { hash: "bad" }), {
    isSubmissionFailure: true,
  })
  mockSendPayment.mockRejectedValueOnce(failed)
  await expect(state.send(options)).rejects.toBe(failed)
  expect(state.result.value).toEqual({ hash: "bad", status: "failed" })
})

test("preflight failures preserve existing state", async () => {
  const harness = createHarnessTracked()
  const state = harness.run(useSendPayment)
  mockSendPayment.mockResolvedValueOnce({ hash: "good", status: "success" })
  await state.send(options)

  const preflight = Object.assign(new Error("wallet missing"), { isPreflightError: true })
  mockSendPayment.mockRejectedValueOnce(preflight)
  await expect(state.send(options)).rejects.toBe(preflight)

  expect(state.result.value).toEqual({ hash: "good", status: "success" })
  expect(state.error.value).toBeNull()
})

test("the Vue cache accepts the core account key used by the payment action", async () => {
  const harness = createHarnessTracked()
  const key = ["account", "https://horizon.example", "testnet", "GABC"] as const
  const serialized = JSON.stringify(key)

  await harness.runtime.queryStore.run(serialized, async () => ({ balance: "10" }))
  expect(harness.runtime.queryStore.isFresh(serialized)).toBe(true)

  harness.runtime.queryStore.invalidate(key)
  expect(harness.runtime.queryStore.isFresh(serialized)).toBe(false)
})
