import { TESTNET_ADDRESS_A } from "@stellar/stellar-sdk"
import { act, renderHookWithStellar, setAppState, setOnline } from "../test-utils"
import { assertNoDomGlobals } from "../test-utils/platform"

// `useFriendbot` is not exported from `use-stellar` or `@use-stellar/react-native`
// (on web or native), so it is loaded from core's source. It is `require`d, not
// imported, so `tsc` does not pull core's source into this package's typecheck. It
// still runs inside the native StellarProvider.
interface FriendbotApi {
  fund: (address?: string) => Promise<void>
  loading: boolean
  error: { code: string; message: string } | null
  funded: boolean
}
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useFriendbot } = require("../../../core/src/hooks/useFriendBot") as {
  useFriendbot: () => FriendbotApi
}

// `useFriendbot` is imperative: it calls Friendbot only when `fund()` is called, so
// there is no load to await and nothing to refetch. Friendbot is reached with the
// global `fetch`, which is replaced here so no test touches the network.
const mockFetch = jest.fn()
const originalFetch = globalThis.fetch

function respond(status: number, statusText = "") {
  mockFetch.mockResolvedValue({ ok: status >= 200 && status < 300, status, statusText })
}

describe("useFriendbot on React Native", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    respond(200, "OK")
    globalThis.fetch = mockFetch as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("starts idle and funds a testnet address through Friendbot", async () => {
    assertNoDomGlobals()

    const { result, unmount } = renderHookWithStellar(() => useFriendbot())
    expect(result.current).toMatchObject({ loading: false, error: null, funded: false })

    await act(async () => {
      await result.current.fund(TESTNET_ADDRESS_A)
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch).toHaveBeenCalledWith(
      `https://friendbot.stellar.org?addr=${encodeURIComponent(TESTNET_ADDRESS_A)}`
    )
    expect(result.current).toMatchObject({ loading: false, error: null, funded: true })
    unmount()
  })

  it("uses the futurenet Friendbot on futurenet", async () => {
    const { result, unmount } = renderHookWithStellar(() => useFriendbot(), {
      network: "futurenet",
    })

    await act(async () => {
      await result.current.fund(TESTNET_ADDRESS_A)
    })

    expect(mockFetch.mock.calls[0][0]).toMatch(
      /^https:\/\/friendbot-futurenet\.stellar\.org\?addr=/
    )
    unmount()
  })

  it("does not call Friendbot when the app changes AppState", async () => {
    const { result, unmount } = renderHookWithStellar(() => useFriendbot())

    act(() => setAppState("background"))
    act(() => setAppState("active"))
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.funded).toBe(false)
    unmount()
  })

  it("can fund again after the app returns to the foreground", async () => {
    const { result, unmount } = renderHookWithStellar(() => useFriendbot())

    await act(async () => {
      await result.current.fund(TESTNET_ADDRESS_A)
    })
    act(() => setAppState("background"))
    act(() => setAppState("active"))
    await act(async () => {
      await result.current.fund(TESTNET_ADDRESS_A)
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result.current.funded).toBe(true)
    unmount()
  })

  // Desired native behaviour: fail fast while NetInfo reports offline rather than
  // start a request. `useFriendbot` does not consult `onlineManager`, so the request
  // is still made. `it.failing` passes while that is true and flags when it changes.
  it.failing("starts no request while NetInfo reports offline", async () => {
    const { result, unmount } = renderHookWithStellar(() => useFriendbot())
    act(() => setOnline(false))

    await act(async () => {
      await result.current.fund(TESTNET_ADDRESS_A).catch(() => undefined)
    })

    expect(mockFetch).not.toHaveBeenCalled()
    unmount()
  })

  it("reports a transport failure as an error and recovers on the next call", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"))
    const { result, unmount } = renderHookWithStellar(() => useFriendbot())

    await act(async () => {
      await result.current.fund(TESTNET_ADDRESS_A).catch(() => undefined)
    })
    expect(result.current.error).not.toBeNull()
    expect(result.current.funded).toBe(false)
    expect(result.current.loading).toBe(false)

    respond(200, "OK")
    await act(async () => {
      await result.current.fund(TESTNET_ADDRESS_A)
    })
    expect(result.current.error).toBeNull()
    expect(result.current.funded).toBe(true)
    unmount()
  })

  it("maps Friendbot 400 to ALREADY_FUNDED", async () => {
    respond(400, "Bad Request")
    const { result, unmount } = renderHookWithStellar(() => useFriendbot())

    await act(async () => {
      await expect(result.current.fund(TESTNET_ADDRESS_A)).rejects.toMatchObject({
        code: "ALREADY_FUNDED",
      })
    })

    expect(result.current.error?.code).toBe("ALREADY_FUNDED")
    expect(result.current.funded).toBe(false)
    unmount()
  })

  it("surfaces other Friendbot failures as an error", async () => {
    respond(503, "Service Unavailable")
    const { result, unmount } = renderHookWithStellar(() => useFriendbot())

    await act(async () => {
      await result.current.fund(TESTNET_ADDRESS_A).catch(() => undefined)
    })

    expect(result.current.error?.message).toMatch(/503/)
    unmount()
  })

  it("rejects mainnet with VALIDATION_ERROR before any request", async () => {
    const { result, unmount } = renderHookWithStellar(() => useFriendbot(), {
      network: "mainnet",
    })

    await act(async () => {
      await expect(result.current.fund(TESTNET_ADDRESS_A)).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      })
    })

    expect(mockFetch).not.toHaveBeenCalled()
    unmount()
  })

  it("rejects an invalid address with VALIDATION_ERROR before any request", async () => {
    const { result, unmount } = renderHookWithStellar(() => useFriendbot())

    await act(async () => {
      await expect(result.current.fund("not-an-address")).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      })
    })

    expect(mockFetch).not.toHaveBeenCalled()
    unmount()
  })

  it("rejects with WALLET_NOT_CONNECTED when there is no address and no wallet", async () => {
    const { result, unmount } = renderHookWithStellar(() => useFriendbot())

    await act(async () => {
      await expect(result.current.fund()).rejects.toMatchObject({ code: "WALLET_NOT_CONNECTED" })
    })

    expect(mockFetch).not.toHaveBeenCalled()
    unmount()
  })
})
