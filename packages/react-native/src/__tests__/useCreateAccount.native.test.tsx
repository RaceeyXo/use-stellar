import { mockHorizonServer, TESTNET_ADDRESS_B } from "@stellar/stellar-sdk"
import { useCreateAccount } from "../index"
import { act, renderHookWithStellar, setAppState, setOnline } from "../test-utils"
import { assertNoDomGlobals } from "../test-utils/platform"

// `useCreateAccount` is imperative: it builds, signs and submits a transaction only
// when `createAccount()` is called, so there is no load to await and nothing to
// refetch. Horizon is the SDK mock, so nothing touches the network.
const OPTIONS = { destination: TESTNET_ADDRESS_B, startingBalance: "5" }

describe("useCreateAccount on React Native", () => {
  it("starts idle and returns the web hook shape", () => {
    assertNoDomGlobals()

    const { result, unmount } = renderHookWithStellar(() => useCreateAccount())

    expect(result.current).toMatchObject({ loading: false, error: null, result: null })
    expect(typeof result.current.createAccount).toBe("function")
    expect(typeof result.current.reset).toBe("function")
    unmount()
  })

  it("makes no Horizon request on its own, including across AppState changes", async () => {
    const { result, unmount } = renderHookWithStellar(() => useCreateAccount())

    act(() => setAppState("background"))
    act(() => setAppState("active"))
    await act(async () => {
      await Promise.resolve()
    })

    expect(mockHorizonServer.loadAccount).not.toHaveBeenCalled()
    expect(mockHorizonServer.submitTransaction).not.toHaveBeenCalled()
    expect(result.current.result).toBeNull()
    unmount()
  })

  // On native there is no `window`, and `createAccount()` guards on `isBrowser()`
  // (`typeof window !== "undefined"`), so it rejects with "SSR not supported" before
  // it can reach any check below. That is a web-only API in a hook this package
  // re-exports as working on native. Per the issue the hook is not patched here:
  // this test records what happens today and will fail once the guard is fixed.
  it("currently rejects with the web-only 'SSR not supported' guard", async () => {
    const { result, unmount } = renderHookWithStellar(() => useCreateAccount())

    await act(async () => {
      await expect(result.current.createAccount(OPTIONS)).rejects.toThrow("SSR not supported")
    })

    expect(mockHorizonServer.loadAccount).not.toHaveBeenCalled()
    unmount()
  })

  // Desired native behaviour, which fails today because of the guard above: reach
  // the wallet check and report WALLET_NOT_CONNECTED.
  it.failing("rejects with WALLET_NOT_CONNECTED when no wallet is connected", async () => {
    const { result, unmount } = renderHookWithStellar(() => useCreateAccount())

    await act(async () => {
      await expect(result.current.createAccount(OPTIONS)).rejects.toMatchObject({
        code: "WALLET_NOT_CONNECTED",
      })
    })

    expect(result.current.error?.code).toBe("WALLET_NOT_CONNECTED")
    unmount()
  })

  // Desired native behaviour: fail fast while NetInfo reports offline, never queue.
  // The hook has this check (`onlineManager`), but it sits behind the guard above
  // and behind the wallet check, which a bare provider cannot satisfy.
  it.failing("fails fast while NetInfo reports offline and starts no request", async () => {
    const { result, unmount } = renderHookWithStellar(() => useCreateAccount())
    act(() => setOnline(false))

    await act(async () => {
      await result.current.createAccount(OPTIONS).catch(() => undefined)
    })

    expect(result.current.error?.code).toBe("NETWORK_OFFLINE")
    expect(mockHorizonServer.loadAccount).not.toHaveBeenCalled()
    unmount()
  })

  it("reset() returns the hook to idle", async () => {
    const { result, unmount } = renderHookWithStellar(() => useCreateAccount())

    await act(async () => {
      await result.current.createAccount(OPTIONS).catch(() => undefined)
    })

    act(() => result.current.reset())
    expect(result.current).toMatchObject({ loading: false, error: null, result: null })
    unmount()
  })
})
