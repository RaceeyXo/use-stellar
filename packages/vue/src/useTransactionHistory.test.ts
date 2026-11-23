import { createSSRApp, defineComponent, h, isReadonly, ref, watch } from "vue"
import { renderToString } from "@vue/server-renderer"
import { StellarError, transactionHistoryKey } from "use-stellar/core"
import { createStellarPlugin, type StellarPluginOptions } from "./plugin"
import { createStellarTestHarness, type StellarTestHarness } from "./test-utils"
import { useTransactionHistory, type UseTransactionHistoryReturn } from "./useTransactionHistory"

// The boundary replaced is the SDK's Horizon client, so everything between it
// and the composable runs for real: core's fetcher, its error mapping and the
// shared cache.
jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk")
  return { ...actual, Horizon: { ...actual.Horizon, Server: jest.fn() } }
})

import { Horizon } from "@stellar/stellar-sdk"

const MockHorizonServer = Horizon.Server as unknown as jest.Mock

// Testnet accounts. Never a mainnet address.
const ADDR_A = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"
const ADDR_B = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

// server.transactions().forAccount().limit().order().cursor().call()
const call = jest.fn()
const forAccount = jest.fn()
const limit = jest.fn()
const order = jest.fn()
const cursor = jest.fn()
const builder = { forAccount, limit, order, cursor, call }

/** A transaction record with the fields core's normalizer reads, as in the React hook's tests. */
function record(n: number) {
  return {
    hash: `hash-${n}`,
    ledger: 1000 + n,
    created_at: `2026-01-01T00:00:${String(n).padStart(2, "0")}Z`,
    source_account: ADDR_A,
    fee_charged: "100",
    operation_count: 1,
    successful: true,
    memo: `memo-${n}`,
    memo_type: "text",
  }
}

interface HorizonPage {
  records: ReturnType<typeof record>[]
  next: jest.Mock
  prev: jest.Mock
}

function horizonPage(
  numbers: number[],
  links: Partial<Pick<HorizonPage, "next" | "prev">> = {}
): HorizonPage {
  return { records: numbers.map(record), next: jest.fn(), prev: jest.fn(), ...links }
}

/** An error shaped like the one the SDK throws for an HTTP failure. */
function horizonError(status: number): Error {
  return Object.assign(new Error(`Horizon returned ${status}`), {
    response: { status, data: { status } },
  })
}

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Lets every settled promise and Vue's batched watchers run. */
const flush = (): Promise<void> => new Promise(resolve => setImmediate(resolve))

const hashes = (result: UseTransactionHistoryReturn): string[] =>
  result.transactions.value.map(transaction => transaction.hash)

const harnesses: StellarTestHarness[] = []

function createHarness(options?: StellarPluginOptions): StellarTestHarness {
  const harness = createStellarTestHarness(options)
  harnesses.push(harness)
  return harness
}

beforeEach(() => {
  for (const mock of [call, forAccount, limit, order, cursor, MockHorizonServer]) mock.mockReset()
  for (const step of [forAccount, limit, order, cursor]) step.mockReturnValue(builder)
  MockHorizonServer.mockImplementation(() => ({ transactions: () => builder }))
  call.mockResolvedValue(horizonPage([1]))
})

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    harness.dispose()
    harness.runtime.queryStore.clear()
  }
})

describe("the first page", () => {
  test("asks Horizon for the account, newest first, one record over the page size", async () => {
    call.mockResolvedValue(horizonPage([1, 2]))
    const harness = createHarness()
    const result = harness.run(() => useTransactionHistory({ address: ADDR_A }))
    expect(result.loading.value).toBe(true)
    await flush()

    expect(MockHorizonServer).toHaveBeenCalledWith(
      harness.runtime.networkConfig.horizonUrl,
      expect.anything()
    )
    expect(forAccount).toHaveBeenCalledWith(ADDR_A)
    expect(limit).toHaveBeenCalledWith(11)
    expect(order).toHaveBeenCalledWith("desc")
    expect(cursor).not.toHaveBeenCalled()
    expect(result.transactions.value).toEqual([
      {
        hash: "hash-1",
        ledger: 1001,
        createdAt: "2026-01-01T00:00:01Z",
        sourceAccount: ADDR_A,
        fee: "100",
        operationCount: 1,
        successful: true,
        memo: "memo-1",
        memoType: "text",
      },
      {
        hash: "hash-2",
        ledger: 1002,
        createdAt: "2026-01-01T00:00:02Z",
        sourceAccount: ADDR_A,
        fee: "100",
        operationCount: 1,
        successful: true,
        memo: "memo-2",
        memoType: "text",
      },
    ])
    expect(result.loading.value).toBe(false)
    expect(result.error.value).toBeNull()
    expect(result.isStale.value).toBe(false)
    expect(result.hasNext.value).toBe(false)
    expect(result.hasPrev.value).toBe(false)
  })

  test("a full page has no next page; one record more has, and the extra one is not shown", async () => {
    call.mockResolvedValue(horizonPage([1, 2]))
    const full = createHarness().run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    await flush()
    expect(hashes(full)).toEqual(["hash-1", "hash-2"])
    expect(full.hasNext.value).toBe(false)

    call.mockResolvedValue(horizonPage([1, 2, 3]))
    const more = createHarness().run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    await flush()
    expect(limit).toHaveBeenLastCalledWith(3)
    expect(hashes(more)).toEqual(["hash-1", "hash-2"])
    expect(more.hasNext.value).toBe(true)
  })

  test("a cursor is passed to Horizon and means there is a previous page", async () => {
    const result = createHarness().run(() =>
      useTransactionHistory({ address: ADDR_A, cursor: "token-5" })
    )
    await flush()

    expect(cursor).toHaveBeenCalledWith("token-5")
    expect(result.hasPrev.value).toBe(true)
  })

  test("an account with no transactions gives an empty list, not an error", async () => {
    call.mockResolvedValue(horizonPage([]))
    const result = createHarness().run(() => useTransactionHistory({ address: ADDR_A }))
    await flush()

    expect(result.transactions.value).toEqual([])
    expect(result.error.value).toBeNull()
    expect(result.loading.value).toBe(false)
    expect(result.hasNext.value).toBe(false)
  })
})

describe("options", () => {
  test("a ref, a getter and a plain value are accepted, and a change refetches", async () => {
    const address = ref(ADDR_A)
    const pageSize = ref(5)
    const direction = ref<"asc" | "desc">("asc")
    const start = ref<string | undefined>("start")
    createHarness().run(() =>
      useTransactionHistory({
        address,
        limit: () => pageSize.value,
        order: direction,
        cursor: start,
        maxRetries: 0,
      })
    )
    await flush()
    expect(forAccount).toHaveBeenLastCalledWith(ADDR_A)
    expect(limit).toHaveBeenLastCalledWith(6)
    expect(order).toHaveBeenLastCalledWith("asc")
    expect(cursor).toHaveBeenLastCalledWith("start")
    expect(call).toHaveBeenCalledTimes(1)

    // Another account starts from its own first page, as in usePayments.
    cursor.mockClear()
    address.value = ADDR_B
    await flush()
    expect(forAccount).toHaveBeenLastCalledWith(ADDR_B)
    expect(cursor).not.toHaveBeenCalled()
    expect(call).toHaveBeenCalledTimes(2)

    pageSize.value = 20
    await flush()
    expect(limit).toHaveBeenLastCalledWith(21)
    expect(call).toHaveBeenCalledTimes(3)

    direction.value = "desc"
    await flush()
    expect(order).toHaveBeenLastCalledWith("desc")
    expect(call).toHaveBeenCalledTimes(4)

    start.value = "later"
    await flush()
    expect(cursor).toHaveBeenLastCalledWith("later")
    expect(call).toHaveBeenCalledTimes(5)
  })

  test("defaults to the connected wallet and goes idle when it disconnects", async () => {
    const harness = createHarness({ walletAddress: ADDR_A })
    const result = harness.run(() => useTransactionHistory())
    await flush()
    expect(forAccount).toHaveBeenLastCalledWith(ADDR_A)
    expect(hashes(result)).toEqual(["hash-1"])

    harness.runtime.setWalletAddress(null)
    await flush()
    expect(result.transactions.value).toEqual([])
    expect(result.loading.value).toBe(false)
    expect(result.error.value).toBeNull()
    expect(result.hasNext.value).toBe(false)
    expect(result.hasPrev.value).toBe(false)
    expect(call).toHaveBeenCalledTimes(1)

    harness.runtime.setWalletAddress(ADDR_B)
    await flush()
    expect(forAccount).toHaveBeenLastCalledWith(ADDR_B)
    expect(call).toHaveBeenCalledTimes(2)
  })

  test("an explicit address wins over the connected wallet", async () => {
    createHarness({ walletAddress: ADDR_A }).run(() => useTransactionHistory({ address: ADDR_B }))
    await flush()

    expect(forAccount).toHaveBeenCalledTimes(1)
    expect(forAccount).toHaveBeenCalledWith(ADDR_B)
  })

  test.each([
    ["null", null],
    ["an empty string", ""],
    ["blank", "   "],
    ["undefined with no wallet connected", undefined],
  ])("an address that is %s makes no request and reports no error", async (_name, address) => {
    const result = createHarness().run(() => useTransactionHistory({ address }))
    expect(result.loading.value).toBe(false)
    await flush()

    expect(MockHorizonServer).not.toHaveBeenCalled()
    expect(call).not.toHaveBeenCalled()
    expect(result.transactions.value).toEqual([])
    expect(result.loading.value).toBe(false)
    expect(result.error.value).toBeNull()
    expect(result.hasNext.value).toBe(false)
    expect(result.hasPrev.value).toBe(false)
  })

  test("a null address disables the query even when a wallet is connected", async () => {
    const result = createHarness({ walletAddress: ADDR_A }).run(() =>
      useTransactionHistory({ address: () => null })
    )
    await flush()

    expect(call).not.toHaveBeenCalled()
    expect(result.error.value).toBeNull()
  })

  test("an idle composable starts when its address arrives, and stops when it leaves", async () => {
    const address = ref<string | null>(null)
    const result = createHarness().run(() => useTransactionHistory({ address }))
    await flush()
    expect(call).not.toHaveBeenCalled()

    address.value = ADDR_A
    await flush()
    expect(call).toHaveBeenCalledTimes(1)
    expect(hashes(result)).toEqual(["hash-1"])

    address.value = null
    await flush()
    expect(result.transactions.value).toEqual([])
    expect(result.error.value).toBeNull()
    expect(call).toHaveBeenCalledTimes(1)
  })
})

describe("the shared cache", () => {
  test("two composables with the same arguments make one request", async () => {
    const pending = deferred<HorizonPage>()
    call.mockReturnValue(pending.promise)
    const harness = createHarness()
    const first = harness.run(() => useTransactionHistory({ address: ADDR_A }))
    const second = harness.run(() => useTransactionHistory({ address: ADDR_A }))
    await flush()

    // The key is the one the React hook reads under.
    const key = transactionHistoryKey(
      harness.runtime.networkConfig.horizonUrl,
      harness.runtime.networkConfig.network,
      ADDR_A,
      10,
      "desc",
      undefined
    )
    expect(call).toHaveBeenCalledTimes(1)
    expect(harness.runtime.queryStore.getSnapshot(key)?.subscribers).toBe(2)
    expect(first.loading.value).toBe(true)
    expect(second.loading.value).toBe(true)

    pending.resolve(horizonPage([1, 2]))
    await flush()
    expect(hashes(first)).toEqual(["hash-1", "hash-2"])
    expect(hashes(second)).toEqual(["hash-1", "hash-2"])
    expect(call).toHaveBeenCalledTimes(1)
    expect(MockHorizonServer).toHaveBeenCalledTimes(1)
  })

  test("a reader that mounts after the page arrived reuses it", async () => {
    const harness = createHarness()
    harness.run(() => useTransactionHistory({ address: ADDR_A }))
    await flush()
    const late = harness.run(() => useTransactionHistory({ address: ADDR_A }))
    await flush()

    expect(hashes(late)).toEqual(["hash-1"])
    expect(call).toHaveBeenCalledTimes(1)
  })

  test.each([
    ["page size", { limit: 20 }],
    ["order", { order: "asc" as const }],
    ["cursor", { cursor: "token-5" }],
  ])("another %s is another request", async (_name, other) => {
    const harness = createHarness()
    harness.run(() => useTransactionHistory({ address: ADDR_A }))
    harness.run(() => useTransactionHistory({ address: ADDR_A, ...other }))
    await flush()

    expect(call).toHaveBeenCalledTimes(2)
  })
})

describe("errors", () => {
  // The codes are the ones the React hook reports for the same failures: both
  // read through core's fetcher, which maps them with toStellarError.
  test.each([
    ["a 404", horizonError(404), "ACCOUNT_NOT_FOUND"],
    ["a 429", horizonError(429), "RATE_LIMITED"],
    ["a network failure", new Error("Network Error"), "NETWORK_ERROR"],
  ])("%s is a StellarError with the code the React hook reports", async (_name, failure, code) => {
    call.mockRejectedValue(failure)
    const result = createHarness().run(() =>
      useTransactionHistory({ address: ADDR_A, maxRetries: 0 })
    )
    await flush()

    expect(result.error.value).toBeInstanceOf(StellarError)
    expect(result.error.value?.code).toBe(code)
    expect(result.transactions.value).toEqual([])
    expect(result.loading.value).toBe(false)
    expect(result.isStale.value).toBe(false)
    expect(call).toHaveBeenCalledTimes(1)
  })

  test("a failure while paging keeps the page on screen and marks it stale", async () => {
    const next = jest.fn().mockRejectedValue(horizonError(429))
    call.mockResolvedValue(horizonPage([1, 2, 3], { next }))
    const result = createHarness().run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    await flush()

    await result.fetchNext()
    expect(result.error.value).toBeInstanceOf(StellarError)
    expect(result.error.value?.code).toBe("RATE_LIMITED")
    expect(hashes(result)).toEqual(["hash-1", "hash-2"])
    expect(result.isStale.value).toBe(true)
    expect(result.loading.value).toBe(false)

    await result.refetch()
    await flush()
    expect(result.error.value).toBeNull()
    expect(result.isStale.value).toBe(false)
  })

  test("the next attempt clears a paging error before it is known to have worked", async () => {
    const retry = deferred<HorizonPage>()
    const next = jest
      .fn()
      .mockRejectedValueOnce(new Error("Network Error"))
      .mockReturnValueOnce(retry.promise)
    call.mockResolvedValue(horizonPage([1, 2, 3], { next }))
    const result = createHarness().run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    await flush()

    await result.fetchNext()
    expect(result.error.value?.code).toBe("NETWORK_ERROR")

    const second = result.fetchNext()
    expect(result.error.value).toBeNull()
    expect(result.loading.value).toBe(true)
    retry.resolve(horizonPage([4, 5]))
    await second
    expect(hashes(result)).toEqual(["hash-4", "hash-5"])
    expect(result.error.value).toBeNull()
  })
})

describe("pagination", () => {
  test("fetchNext follows each page's next link, fetchPrev its prev link", async () => {
    const back = jest.fn().mockResolvedValue(horizonPage([4, 5]))
    const further = jest.fn().mockResolvedValue(horizonPage([7, 8], { prev: back }))
    const next = jest.fn().mockResolvedValue(horizonPage([4, 5, 6], { next: further }))
    call.mockResolvedValue(horizonPage([1, 2, 3], { next }))
    const result = createHarness().run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    await flush()
    expect(hashes(result)).toEqual(["hash-1", "hash-2"])
    expect(result.hasNext.value).toBe(true)
    expect(result.hasPrev.value).toBe(false)

    await result.fetchNext()
    expect(next).toHaveBeenCalledTimes(1)
    // Three records for a page of two: the third is the sign of a further page.
    expect(hashes(result)).toEqual(["hash-4", "hash-5"])
    expect(result.transactions.value[0]).toEqual({
      hash: "hash-4",
      ledger: 1004,
      createdAt: "2026-01-01T00:00:04Z",
      sourceAccount: ADDR_A,
      fee: "100",
      operationCount: 1,
      successful: true,
      memo: "memo-4",
      memoType: "text",
    })
    expect(result.hasNext.value).toBe(true)
    expect(result.hasPrev.value).toBe(true)

    // The second step follows the second page's link, not the first page's again.
    await result.fetchNext()
    expect(next).toHaveBeenCalledTimes(1)
    expect(further).toHaveBeenCalledTimes(1)
    expect(hashes(result)).toEqual(["hash-7", "hash-8"])
    expect(result.hasNext.value).toBe(false)
    expect(result.hasPrev.value).toBe(true)

    await result.fetchPrev()
    expect(back).toHaveBeenCalledTimes(1)
    expect(hashes(result)).toEqual(["hash-4", "hash-5"])
    // Two records for a page of two: nothing before it.
    expect(result.hasPrev.value).toBe(false)
    expect(result.hasNext.value).toBe(true)
    expect(call).toHaveBeenCalledTimes(1)
  })

  test("a previous page with one record more has a page before it", async () => {
    const prev = jest.fn().mockResolvedValue(horizonPage([7, 8, 9]))
    call.mockResolvedValue(horizonPage([1, 2], { prev }))
    const result = createHarness().run(() =>
      useTransactionHistory({ address: ADDR_A, limit: 2, cursor: "token-5" })
    )
    await flush()

    await result.fetchPrev()
    expect(hashes(result)).toEqual(["hash-7", "hash-8"])
    expect(result.hasPrev.value).toBe(true)
    expect(result.hasNext.value).toBe(true)
  })

  test("loading is true while a page is on its way", async () => {
    const pending = deferred<HorizonPage>()
    const next = jest.fn().mockReturnValue(pending.promise)
    call.mockResolvedValue(horizonPage([1, 2, 3], { next }))
    const result = createHarness().run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    await flush()
    expect(result.loading.value).toBe(false)

    const going = result.fetchNext()
    expect(result.loading.value).toBe(true)
    pending.resolve(horizonPage([4]))
    await going
    expect(result.loading.value).toBe(false)
    expect(hashes(result)).toEqual(["hash-4"])
    expect(result.hasNext.value).toBe(false)
  })

  test("stepping past the end keeps the page on screen", async () => {
    const next = jest.fn().mockResolvedValue(horizonPage([]))
    call.mockResolvedValue(horizonPage([1, 2], { next }))
    const result = createHarness().run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    await flush()

    await result.fetchNext()
    expect(hashes(result)).toEqual(["hash-1", "hash-2"])
    expect(result.hasNext.value).toBe(false)
    // As in the React hook: the way back from the empty page stays open.
    expect(result.hasPrev.value).toBe(true)
    expect(result.error.value).toBeNull()
  })

  test("fetchNext and fetchPrev do nothing while there is no page", async () => {
    const result = createHarness().run(() => useTransactionHistory({ address: null }))
    await result.fetchNext()
    await result.fetchPrev()

    expect(call).not.toHaveBeenCalled()
    expect(result.loading.value).toBe(false)
    expect(result.error.value).toBeNull()
  })

  test("a page that arrives after the account changed is dropped", async () => {
    const pending = deferred<HorizonPage>()
    const next = jest.fn().mockReturnValue(pending.promise)
    call.mockResolvedValueOnce(horizonPage([1, 2, 3], { next }))
    call.mockResolvedValueOnce(horizonPage([7, 8]))
    const address = ref(ADDR_A)
    const result = createHarness().run(() => useTransactionHistory({ address, limit: 2 }))
    await flush()

    const going = result.fetchNext()
    address.value = ADDR_B
    await flush()
    expect(hashes(result)).toEqual(["hash-7", "hash-8"])

    pending.resolve(horizonPage([4, 5, 6]))
    await going
    expect(hashes(result)).toEqual(["hash-7", "hash-8"])
    expect(result.hasNext.value).toBe(false)
    expect(result.hasPrev.value).toBe(false)
    expect(result.loading.value).toBe(false)
  })

  test("a failed page that arrives after the account changed is dropped too", async () => {
    const pending = deferred<HorizonPage>()
    const next = jest.fn().mockReturnValue(pending.promise)
    call.mockResolvedValueOnce(horizonPage([1, 2, 3], { next }))
    call.mockResolvedValueOnce(horizonPage([7, 8]))
    const address = ref(ADDR_A)
    const result = createHarness().run(() => useTransactionHistory({ address, limit: 2 }))
    await flush()

    const going = result.fetchNext()
    address.value = ADDR_B
    await flush()
    pending.reject(horizonError(429))
    await going

    expect(result.error.value).toBeNull()
    expect(hashes(result)).toEqual(["hash-7", "hash-8"])
  })

  test("changing the account empties the list at once, not a tick later", async () => {
    const address = ref(ADDR_A)
    const result = createHarness().run(() => useTransactionHistory({ address, limit: 2 }))
    await flush()
    expect(hashes(result)).toEqual(["hash-1"])

    address.value = ADDR_B
    expect(result.transactions.value).toEqual([])
  })

  test("after an account change the old account's links are not followed", async () => {
    const next = jest.fn().mockResolvedValue(horizonPage([4, 5]))
    const arriving = deferred<HorizonPage>()
    call.mockResolvedValueOnce(horizonPage([1, 2, 3], { next }))
    call.mockReturnValueOnce(arriving.promise)
    const address = ref(ADDR_A)
    const result = createHarness().run(() => useTransactionHistory({ address, limit: 2 }))
    await flush()
    expect(result.hasNext.value).toBe(true)

    // The new account's first page has not arrived yet.
    address.value = ADDR_B
    expect(result.hasNext.value).toBe(false)
    await result.fetchNext()
    await result.fetchPrev()
    expect(next).not.toHaveBeenCalled()

    arriving.resolve(horizonPage([7]))
    await flush()
    expect(hashes(result)).toEqual(["hash-7"])
  })

  test("going idle forgets the page: its links, its flags and a paging error", async () => {
    const next = jest.fn().mockRejectedValue(horizonError(429))
    const prev = jest.fn()
    call.mockResolvedValue(horizonPage([1, 2, 3], { next, prev }))
    const harness = createHarness({ walletAddress: ADDR_A })
    const result = harness.run(() => useTransactionHistory({ limit: 2, cursor: "token-5" }))
    await flush()
    await result.fetchNext()
    expect(result.error.value?.code).toBe("RATE_LIMITED")
    expect(result.hasNext.value).toBe(true)
    expect(result.hasPrev.value).toBe(true)

    harness.runtime.setWalletAddress(null)
    await flush()
    expect(result.error.value).toBeNull()
    expect(result.isStale.value).toBe(false)
    expect(result.hasNext.value).toBe(false)
    expect(result.hasPrev.value).toBe(false)

    await result.fetchNext()
    await result.fetchPrev()
    expect(next).toHaveBeenCalledTimes(1)
    expect(prev).not.toHaveBeenCalled()
  })

  test("a page that answers in the same tick as an account change is never shown", async () => {
    const pending = deferred<HorizonPage>()
    const next = jest.fn().mockReturnValue(pending.promise)
    call.mockResolvedValueOnce(horizonPage([1, 2, 3], { next }))
    call.mockResolvedValueOnce(horizonPage([7, 8]))
    const address = ref(ADDR_A)
    const harness = createHarness()
    const result = harness.run(() => useTransactionHistory({ address, limit: 2 }))
    const shown: string[][] = []
    harness.run(() =>
      watch(result.transactions, () => shown.push(hashes(result)), { flush: "sync" })
    )
    await flush()

    const going = result.fetchNext()
    pending.resolve(horizonPage([4, 5, 6]))
    address.value = ADDR_B
    await going
    await flush()

    expect(shown).not.toContainEqual(["hash-4", "hash-5"])
    expect(shown[0]).toEqual(["hash-1", "hash-2"])
    expect(shown[shown.length - 1]).toEqual(["hash-7", "hash-8"])
  })

  test("of two page requests the later one wins when it answers first", async () => {
    const earlier = deferred<HorizonPage>()
    const later = deferred<HorizonPage>()
    const next = jest.fn().mockReturnValueOnce(earlier.promise).mockReturnValueOnce(later.promise)
    call.mockResolvedValue(horizonPage([1, 2, 3], { next }))
    const result = createHarness().run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    await flush()

    const first = result.fetchNext()
    const second = result.fetchNext()
    later.resolve(horizonPage([8, 9]))
    await second
    expect(hashes(result)).toEqual(["hash-8", "hash-9"])
    expect(result.loading.value).toBe(false)

    earlier.resolve(horizonPage([4, 5, 6]))
    await first
    expect(hashes(result)).toEqual(["hash-8", "hash-9"])
    expect(result.hasNext.value).toBe(false)
  })

  test("of two page requests the later one wins when it answers last", async () => {
    const earlier = deferred<HorizonPage>()
    const later = deferred<HorizonPage>()
    const next = jest.fn().mockReturnValueOnce(earlier.promise).mockReturnValueOnce(later.promise)
    call.mockResolvedValue(horizonPage([1, 2, 3], { next }))
    const result = createHarness().run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    await flush()

    const first = result.fetchNext()
    const second = result.fetchNext()
    earlier.resolve(horizonPage([4, 5, 6]))
    await first
    // The earlier answer is dropped, and the later request is still on its way.
    expect(hashes(result)).toEqual(["hash-1", "hash-2"])
    expect(result.loading.value).toBe(true)

    later.resolve(horizonPage([8, 9]))
    await second
    expect(hashes(result)).toEqual(["hash-8", "hash-9"])
    expect(result.loading.value).toBe(false)
  })
})

describe("refetch", () => {
  test("asks Horizon again and returns to the first page", async () => {
    const next = jest.fn().mockResolvedValue(horizonPage([4, 5]))
    call.mockResolvedValue(horizonPage([1, 2, 3], { next }))
    const result = createHarness().run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    await flush()
    await result.fetchNext()
    expect(hashes(result)).toEqual(["hash-4", "hash-5"])

    call.mockResolvedValue(horizonPage([9, 1]))
    await result.refetch()
    await flush()
    expect(call).toHaveBeenCalledTimes(2)
    expect(hashes(result)).toEqual(["hash-9", "hash-1"])
    expect(result.hasNext.value).toBe(false)
    expect(result.hasPrev.value).toBe(false)
  })

  test("drops a page that answers while the refetch is on its way", async () => {
    const page = deferred<HorizonPage>()
    const fresh = deferred<HorizonPage>()
    const next = jest.fn().mockReturnValue(page.promise)
    call.mockResolvedValueOnce(horizonPage([1, 2, 3], { next }))
    call.mockReturnValueOnce(fresh.promise)
    const result = createHarness().run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    await flush()

    const going = result.fetchNext()
    const refetching = result.refetch()
    page.resolve(horizonPage([4, 5, 6]))
    await going
    expect(hashes(result)).toEqual(["hash-1", "hash-2"])

    fresh.resolve(horizonPage([9, 1]))
    await refetching
    await flush()
    expect(hashes(result)).toEqual(["hash-9", "hash-1"])
    expect(result.loading.value).toBe(false)
  })

  test("clears a paging error at once, before Horizon answers", async () => {
    const fresh = deferred<HorizonPage>()
    const next = jest.fn().mockRejectedValue(horizonError(429))
    call.mockResolvedValueOnce(horizonPage([1, 2, 3], { next }))
    call.mockReturnValueOnce(fresh.promise)
    const result = createHarness().run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    await flush()
    await result.fetchNext()
    expect(result.error.value?.code).toBe("RATE_LIMITED")

    const refetching = result.refetch()
    expect(result.error.value).toBeNull()
    fresh.resolve(horizonPage([1, 2]))
    await refetching
  })

  test("another reader's refetch brings this one back to the fresh first page", async () => {
    const page = deferred<HorizonPage>()
    const next = jest.fn().mockReturnValue(page.promise)
    call.mockResolvedValueOnce(horizonPage([1, 2, 3], { next }))
    const harness = createHarness()
    const reader = harness.run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    const other = harness.run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    await flush()

    const going = reader.fetchNext()
    expect(reader.loading.value).toBe(true)
    call.mockResolvedValueOnce(horizonPage([9, 1]))
    await other.refetch()
    await flush()
    // The entry both read changed under the page this reader was waiting for.
    expect(hashes(reader)).toEqual(["hash-9", "hash-1"])
    expect(reader.loading.value).toBe(false)

    page.resolve(horizonPage([4, 5, 6]))
    await going
    expect(hashes(reader)).toEqual(["hash-9", "hash-1"])
    expect(reader.hasNext.value).toBe(false)
  })

  test("another reader's refetch clears this one's paging error", async () => {
    const next = jest.fn().mockRejectedValue(horizonError(429))
    call.mockResolvedValueOnce(horizonPage([1, 2, 3], { next }))
    const harness = createHarness()
    const reader = harness.run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    const other = harness.run(() => useTransactionHistory({ address: ADDR_A, limit: 2 }))
    await flush()
    await reader.fetchNext()
    expect(reader.error.value?.code).toBe("RATE_LIMITED")

    call.mockResolvedValueOnce(horizonPage([9, 1]))
    await other.refetch()
    await flush()
    expect(reader.error.value).toBeNull()
    expect(reader.isStale.value).toBe(false)
  })
})

describe("lifecycle", () => {
  test("disposing the scope stops the watchers and lets go of the cache entry", async () => {
    const address = ref(ADDR_A)
    const harness = createHarness()
    harness.run(() => useTransactionHistory({ address }))
    harness.run(() => useTransactionHistory())
    await flush()
    const key = transactionHistoryKey(
      harness.runtime.networkConfig.horizonUrl,
      harness.runtime.networkConfig.network,
      ADDR_A,
      10,
      "desc",
      undefined
    )
    expect(harness.runtime.queryStore.getSnapshot(key)?.subscribers).toBe(1)
    expect(call).toHaveBeenCalledTimes(1)

    harness.dispose()
    expect(harness.runtime.queryStore.getSnapshot(key)?.subscribers).toBe(0)

    address.value = ADDR_B
    harness.runtime.setWalletAddress(ADDR_B)
    await flush()
    expect(call).toHaveBeenCalledTimes(1)
  })

  test("nothing is fetched while rendering on the server", async () => {
    expect(typeof window).toBe("undefined")
    const app = createSSRApp(
      defineComponent({
        setup() {
          const history = useTransactionHistory({ address: ADDR_A })
          return () =>
            h("p", [
              history.loading.value ? "loading" : "idle",
              ":",
              String(history.transactions.value.length),
            ])
        },
      })
    )
    app.use(createStellarPlugin())
    const html = await renderToString(app)
    await flush()

    expect(html).toContain("idle")
    expect(html).not.toContain("loading")
    expect(MockHorizonServer).not.toHaveBeenCalled()
    expect(call).not.toHaveBeenCalled()
  })

  test("every returned ref is read-only", async () => {
    const result = createHarness().run(() => useTransactionHistory({ address: ADDR_A }))
    await flush()

    for (const name of [
      "transactions",
      "loading",
      "error",
      "isStale",
      "hasNext",
      "hasPrev",
    ] as const) {
      expect(isReadonly(result[name])).toBe(true)
    }
  })
})
