import { StellarError, type PathPaymentOptions, type TransactionResult } from "use-stellar/core"
import { createStellarTestHarness as createHarness, type StellarTestHarness } from "./test-utils"
import { usePathPayment, type UsePathPaymentReturn } from "./usePathPayment"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  pathPayment: jest.fn(),
  onlineManager: { isOnline: jest.fn(() => true) },
}))

import { pathPayment } from "use-stellar/core"

const mockPathPayment = pathPayment as jest.Mock
const harnesses: StellarTestHarness[] = []
const issuer = "G" + "A".repeat(55)
const destination = "G" + "C".repeat(55)
const strictSend: PathPaymentOptions = {
  mode: "strictSend",
  destination,
  sendAsset: "XLM",
  sendAmount: "100",
  destAsset: { code: "USDC", issuer },
  destMin: "24.7500000",
  path: [],
}
const strictReceive: PathPaymentOptions = {
  mode: "strictReceive",
  destination,
  sendAsset: "XLM",
  sendMax: "105",
  destAsset: { code: "USDC", issuer },
  destAmount: "25",
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

beforeEach(() => mockPathPayment.mockReset())

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    harness.dispose()
    harness.runtime.queryStore.clear()
  }
})

test.each([
  ["strict-send", strictSend],
  ["strict-receive", strictReceive],
])("delegates %s options unchanged", async (_name, options) => {
  const outcome: TransactionResult = { hash: "abc", status: "success" }
  mockPathPayment.mockResolvedValue(outcome)
  const harness = createHarnessTracked()
  const state = harness.run(usePathPayment)

  const promise = state.pathPayment(options)
  expect(state.loading.value).toBe(true)
  await expect(promise).resolves.toEqual(outcome)
  expect(mockPathPayment).toHaveBeenCalledWith(
    expect.objectContaining({
      network: "testnet",
      networkConfig: harness.runtime.networkConfig,
      wallet: harness.runtime.wallet,
      queryStore: harness.runtime.queryStore,
    }),
    options
  )
  expect(state.result.value).toEqual(outcome)
  expect(state.loading.value).toBe(false)
})

test("a newer payment wins over an older completion", async () => {
  const first = deferred<TransactionResult>()
  const second = deferred<TransactionResult>()
  mockPathPayment.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const harness = createHarnessTracked()
  const state = harness.run(usePathPayment)

  const firstPromise = state.pathPayment(strictSend)
  const secondPromise = state.pathPayment(strictReceive)
  second.resolve({ hash: "new", status: "success" })
  await secondPromise
  first.resolve({ hash: "old", status: "success" })
  await firstPromise

  expect(state.result.value).toEqual({ hash: "new", status: "success" })
})

test("reset invalidates an in-flight completion", async () => {
  const pending = deferred<TransactionResult>()
  mockPathPayment.mockReturnValue(pending.promise)
  const harness = createHarnessTracked()
  const state = harness.run(usePathPayment)

  const promise = state.pathPayment(strictSend)
  state.reset()
  pending.resolve({ hash: "late", status: "success" })
  await promise

  expect(state.result.value).toBeNull()
  expect(state.error.value).toBeNull()
  expect(state.loading.value).toBe(false)
})

test("does not mutate state after scope disposal", async () => {
  const pending = deferred<TransactionResult>()
  mockPathPayment.mockReturnValue(pending.promise)
  const harness = createHarnessTracked()
  const state = harness.run(usePathPayment)

  const promise = state.pathPayment(strictSend)
  harness.dispose()
  pending.resolve({ hash: "late", status: "success" })
  await promise

  expect(state.result.value).toBeNull()
})

test("records action errors and restores state after preflight failures", async () => {
  const harness = createHarnessTracked()
  const state = harness.run(usePathPayment)
  mockPathPayment.mockResolvedValueOnce({ hash: "good", status: "success" })
  await state.pathPayment(strictSend)

  const preflight = Object.assign(new StellarError("VALIDATION_ERROR", "missing destMin"), {
    isPreflightError: true,
  })
  mockPathPayment.mockRejectedValueOnce(preflight)
  await expect(state.pathPayment(strictSend)).rejects.toBe(preflight)
  expect(state.result.value).toEqual({ hash: "good", status: "success" })
  expect(state.error.value).toBeNull()

  const failure = new StellarError("TRANSACTION_FAILED", "rate moved")
  mockPathPayment.mockRejectedValueOnce(failure)
  await expect(state.pathPayment(strictSend)).rejects.toBe(failure)
  expect(state.error.value).toBe(failure)
  expect(state.loading.value).toBe(false)
})

function assertDiscriminatedUnion(api: UsePathPaymentReturn): void {
  // @ts-expect-error strictReceive accepts sendMax, never destMin
  void api.pathPayment({ ...strictReceive, destMin: "1" })
  // @ts-expect-error strictSend accepts destMin, never sendMax
  void api.pathPayment({ ...strictSend, sendMax: "100" })
}

void assertDiscriminatedUnion
