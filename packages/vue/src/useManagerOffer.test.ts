import { StellarError, type TransactionResult, type ManageOfferParams } from "use-stellar/core"
import { createStellarTestHarness, type StellarTestHarness } from "./test-utils"
import { useManageOffer, useManagerOffer } from "./useManagerOffer"
jest.mock("use-stellar/core", () => ({ ...jest.requireActual("use-stellar/core"), createOffer: jest.fn(), updateOffer: jest.fn(), cancelOffer: jest.fn(), onlineManager: { isOnline: jest.fn(() => true) } }))
import { createOffer, updateOffer, cancelOffer, onlineManager } from "use-stellar/core"
const create = createOffer as jest.Mock
const update = updateOffer as jest.Mock
const cancel = cancelOffer as jest.Mock
const harnesses: StellarTestHarness[] = []
const params: ManageOfferParams = { selling: "XLM", buying: { code: "USD", issuer: "G" + "A".repeat(55) }, amount: "2", price: "1" }
function harness() { const h = createStellarTestHarness({ network: "testnet" }); harnesses.push(h); return h }
function deferred() { let resolve!: (value: TransactionResult) => void; let reject!: (error: unknown) => void; const promise = new Promise<TransactionResult>((res, rej) => { resolve = res; reject = rej }); return { promise, resolve, reject } }
beforeEach(() => { create.mockReset(); update.mockReset(); cancel.mockReset(); (onlineManager.isOnline as jest.Mock).mockReturnValue(true) })
afterEach(() => { for (const h of harnesses.splice(0)) { h.dispose(); h.runtime.queryStore.clear() } })
test("both spellings expose the same composable; delegates every operation", async () => {
  expect(useManagerOffer).toBe(useManageOffer)
  const h = harness(); const state = h.run(useManageOffer)
  const outcome = { hash: "ok", status: "success" }
  create.mockResolvedValue(outcome); update.mockResolvedValue(outcome); cancel.mockResolvedValue(outcome)
  await state.createOffer(params); await state.updateOffer("42", params); await state.cancelOffer("42")
  expect(create).toHaveBeenCalledWith(h.runtime, params)
  expect(update).toHaveBeenCalledWith(h.runtime, "42", params)
  expect(cancel).toHaveBeenCalledWith(h.runtime, "42")
  expect(state.result.value).toEqual(outcome); expect(state.loading.value).toBe(false)
})
test("offline skips every action", async () => {
  ;(onlineManager.isOnline as jest.Mock).mockReturnValue(false)
  const state = harness().run(useManageOffer)
  await state.createOffer(params); await state.updateOffer("42", params); await state.cancelOffer("42")
  expect(create).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled(); expect(cancel).not.toHaveBeenCalled()
  expect(state.error.value?.code).toBe("NETWORK_ERROR")
})
test("timeout is pending; a wallet rejection returns null and preserves its code", async () => {
  const state = harness().run(useManageOffer)
  create.mockRejectedValueOnce(new StellarError("TX_TIMEOUT", undefined, { hash: "pending" }))
  await expect(state.createOffer(params)).resolves.toBeNull()
  expect(state.result.value).toEqual({ hash: "pending", status: "pending" })
  create.mockRejectedValueOnce(new StellarError("WALLET_REQUEST_REJECTED"))
  await expect(state.createOffer(params)).resolves.toBeNull()
  expect(state.error.value?.code).toBe("WALLET_REQUEST_REJECTED")
})
test("latest request wins over older success and errors", async () => {
  const first = deferred(); const second = deferred(); create.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
  const state = harness().run(useManageOffer)
  const a = state.createOffer(params); const b = state.createOffer(params)
  second.resolve({ hash: "new", status: "success" }); await b
  first.reject(new StellarError("LOW_RESERVE")); await a
  expect(state.result.value?.hash).toBe("new"); expect(state.error.value).toBeNull()
})
test.each(["reset", "dispose"])("%s ignores an in-flight completion", async action => {
  const pending = deferred(); create.mockReturnValue(pending.promise)
  const h = harness(); const state = h.run(useManageOffer); const promise = state.createOffer(params)
  if (action === "reset") state.reset(); else h.dispose()
  pending.resolve({ hash: "late", status: "success" }); await promise
  expect(state.result.value).toBeNull(); expect(state.error.value).toBeNull()
})
