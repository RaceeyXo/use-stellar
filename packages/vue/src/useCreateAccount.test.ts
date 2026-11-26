import { StellarError, type CreateAccountOptions, type TransactionResult } from "use-stellar/core"
import { createStellarTestHarness as createHarness, type StellarTestHarness } from "./test-utils"
import { useCreateAccount } from "./useCreateAccount"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  createAccount: jest.fn(),
  onlineManager: { isOnline: jest.fn(() => true) },
}))

import { createAccount } from "use-stellar/core"

const mockCreateAccount = createAccount as jest.Mock
const harnesses: StellarTestHarness[] = []
const options: CreateAccountOptions = {
  destination: "G" + "A".repeat(55),
  startingBalance: "10",
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

beforeEach(() => mockCreateAccount.mockReset())

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    harness.dispose()
    harness.runtime.queryStore.clear()
  }
})

test("delegates to the shared action and projects success", async () => {
  const outcome: TransactionResult = { hash: "abc", status: "success" }
  mockCreateAccount.mockResolvedValue(outcome)
  const harness = createHarnessTracked()
  const state = harness.run(useCreateAccount)

  const promise = state.createAccount(options)
  expect(state.loading.value).toBe(true)
  await expect(promise).resolves.toEqual(outcome)

  expect(mockCreateAccount).toHaveBeenCalledWith(
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
  const first = deferred<TransactionResult>()
  const second = deferred<TransactionResult>()
  mockCreateAccount.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const harness = createHarnessTracked()
  const state = harness.run(useCreateAccount)

  const firstPromise = state.createAccount(options)
  const secondPromise = state.createAccount({ ...options, startingBalance: "20" })
  second.resolve({ hash: "new", status: "success" })
  await secondPromise
  first.resolve({ hash: "old", status: "success" })
  await firstPromise

  expect(state.result.value).toEqual({ hash: "new", status: "success" })
  expect(state.loading.value).toBe(false)
})

test("reset invalidates an in-flight completion", async () => {
  const pending = deferred<TransactionResult>()
  mockCreateAccount.mockReturnValue(pending.promise)
  const harness = createHarnessTracked()
  const state = harness.run(useCreateAccount)

  const promise = state.createAccount(options)
  state.reset()
  pending.resolve({ hash: "late", status: "success" })
  await promise

  expect(state.result.value).toBeNull()
  expect(state.error.value).toBeNull()
  expect(state.loading.value).toBe(false)
})

test("does not mutate state after scope disposal", async () => {
  const pending = deferred<TransactionResult>()
  mockCreateAccount.mockReturnValue(pending.promise)
  const harness = createHarnessTracked()
  const state = harness.run(useCreateAccount)

  const promise = state.createAccount(options)
  harness.dispose()
  pending.resolve({ hash: "late", status: "success" })
  await promise

  expect(state.result.value).toBeNull()
})

test("records timeout and submission failure outcomes", async () => {
  const timeout = new StellarError("TX_TIMEOUT", "timed out", { hash: "pending-hash" })
  mockCreateAccount.mockRejectedValueOnce(timeout)
  const harness = createHarnessTracked()
  const state = harness.run(useCreateAccount)

  await expect(state.createAccount(options)).rejects.toBe(timeout)
  expect(state.result.value).toEqual({ hash: "pending-hash", status: "pending" })
  expect(state.error.value).toBe(timeout)

  const failed = Object.assign(new StellarError("TRANSACTION_FAILED", "failed", { hash: "bad" }), {
    isSubmissionFailure: true,
  })
  mockCreateAccount.mockRejectedValueOnce(failed)
  await expect(state.createAccount(options)).rejects.toBe(failed)
  expect(state.result.value).toBeNull()
})

test("offline never calls the action or changes state", async () => {
  const core = jest.requireMock("use-stellar/core")
  core.onlineManager.isOnline.mockReturnValueOnce(false)
  const state = createHarnessTracked().run(useCreateAccount)
  await expect(state.createAccount(options)).rejects.toMatchObject({ code: "NETWORK_ERROR" })
  expect(mockCreateAccount).not.toHaveBeenCalled()
  expect(state.loading.value).toBe(false)
  expect(state.result.value).toBeNull()
})

test("wallet rejection clears the previous attempt and exposes the shared code", async () => {
  const state = createHarnessTracked().run(useCreateAccount)
  mockCreateAccount.mockResolvedValueOnce({ hash: "old", status: "success" })
  await state.createAccount(options)
  const rejection = new StellarError("WALLET_REQUEST_REJECTED")
  mockCreateAccount.mockRejectedValueOnce(rejection)
  await expect(state.createAccount(options)).rejects.toBe(rejection)
  expect(state.error.value?.code).toBe("WALLET_REQUEST_REJECTED")
  expect(state.result.value).toBeNull()
  expect(state.loading.value).toBe(false)
})
test("an unsuccessful Horizon result is projected as failed without a thrown error", async () => {
  const state = createHarnessTracked().run(useCreateAccount)
  const failed: TransactionResult = { hash: "failed", status: "failed", ledger: 7 }
  mockCreateAccount.mockResolvedValueOnce(failed)
  await expect(state.createAccount(options)).resolves.toEqual(failed)
  expect(state.result.value).toEqual(failed)
  expect(state.error.value).toBeNull()
})
