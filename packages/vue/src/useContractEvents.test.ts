import { nextTick, ref } from "vue"
import type {
  ContractEvent,
  ContractEventPoller,
  ContractEventPollerSnapshot,
} from "use-stellar/core"
import { createStellarTestHarness as createHarness, type StellarTestHarness } from "./test-utils"
import { useContractEvents } from "./useContractEvents"

jest.mock("use-stellar/core", () => ({
  ...jest.requireActual("use-stellar/core"),
  createContractEventPoller: jest.fn(),
}))

import { createContractEventPoller } from "use-stellar/core"

const mockCreatePoller = createContractEventPoller as jest.Mock
const CONTRACT_A = "C" + "A".repeat(55)
const CONTRACT_B = "C" + "B".repeat(55)
const harnesses: StellarTestHarness[] = []

interface FakePoller extends ContractEventPoller {
  emit: (snapshot: ContractEventPollerSnapshot) => void
  start: jest.Mock
  stop: jest.Mock
  clear: jest.Mock
  unsubscribe: jest.Mock
}

function fakePoller(): FakePoller {
  let listener: ((snapshot: ContractEventPollerSnapshot) => void) | null = null
  const unsubscribe = jest.fn(() => {
    listener = null
  })
  return {
    start: jest.fn(),
    stop: jest.fn(),
    clear: jest.fn(),
    subscribe: jest.fn(next => {
      listener = next
      return unsubscribe
    }),
    getSnapshot: jest.fn(),
    emit: snapshot => listener?.(snapshot),
    unsubscribe,
  }
}

function createHarnessTracked(): StellarTestHarness {
  const harness = createHarness({ network: "testnet" })
  harnesses.push(harness)
  return harness
}

beforeEach(() => {
  mockCreatePoller.mockReset()
})

afterEach(() => {
  for (const harness of harnesses.splice(0)) {
    harness.dispose()
    harness.runtime.queryStore.clear()
  }
})

test("starts one poller and projects its snapshots", () => {
  const poller = fakePoller()
  mockCreatePoller.mockReturnValue(poller)
  const harness = createHarnessTracked()
  const result = harness.run(() => useContractEvents({ contractIds: [CONTRACT_A] }))
  const event = { id: "event-1" } as ContractEvent

  expect(poller.start).toHaveBeenCalledTimes(1)
  expect(mockCreatePoller).toHaveBeenCalledWith(
    { sorobanUrl: harness.runtime.networkConfig.sorobanUrl },
    expect.objectContaining({ contractIds: [CONTRACT_A], interval: 5_000, bufferSize: 200 })
  )

  poller.emit({ events: [event], latestLedger: 123, loading: false, error: null })
  expect(result.events.value).toEqual([event])
  expect(result.latestLedger.value).toBe(123)
  expect(result.loading.value).toBe(false)
})

test("enabled false and an empty contract list create no poller", async () => {
  const harness = createHarnessTracked()
  const enabled = ref(false)
  const contractIds = ref<string[]>([CONTRACT_A])
  const result = harness.run(() => useContractEvents({ contractIds, enabled }))

  expect(mockCreatePoller).not.toHaveBeenCalled()
  expect(result.events.value).toEqual([])

  enabled.value = true
  contractIds.value = []
  await nextTick()
  expect(mockCreatePoller).not.toHaveBeenCalled()
})

test("recreates and stops the poller when identity inputs change", async () => {
  const first = fakePoller()
  const second = fakePoller()
  mockCreatePoller.mockReturnValueOnce(first).mockReturnValueOnce(second)
  const harness = createHarnessTracked()
  const contractIds = ref([CONTRACT_A])
  const topics = ref([["transfer"]])
  const startLedger = ref(100)
  harness.run(() => useContractEvents({ contractIds, topics, startLedger }))

  contractIds.value = [CONTRACT_B]
  topics.value = [["mint"]]
  startLedger.value = 200
  await nextTick()

  expect(first.unsubscribe).toHaveBeenCalledTimes(1)
  expect(first.stop).toHaveBeenCalledTimes(1)
  expect(second.start).toHaveBeenCalledTimes(1)
  expect(mockCreatePoller).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({
      contractIds: [CONTRACT_B],
      topics: [["mint"]],
      startLedger: 200,
    })
  )
})

test("interval changes replace the poller without leaving the old timer alive", async () => {
  const first = fakePoller()
  const second = fakePoller()
  mockCreatePoller.mockReturnValueOnce(first).mockReturnValueOnce(second)
  const harness = createHarnessTracked()
  const interval = ref(1_000)
  harness.run(() => useContractEvents({ contractIds: [CONTRACT_A], interval }))

  interval.value = 2_000
  await nextTick()

  expect(first.stop).toHaveBeenCalledTimes(1)
  expect(mockCreatePoller).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ interval: 2_000 })
  )
})

test("clear delegates to the active poller and scope disposal cleans it up", () => {
  const poller = fakePoller()
  mockCreatePoller.mockReturnValue(poller)
  const harness = createHarnessTracked()
  const result = harness.run(() => useContractEvents({ contractIds: [CONTRACT_A] }))

  result.clear()
  expect(poller.clear).toHaveBeenCalledTimes(1)

  harness.dispose()
  expect(poller.unsubscribe).toHaveBeenCalledTimes(1)
  expect(poller.stop).toHaveBeenCalledTimes(1)
})
