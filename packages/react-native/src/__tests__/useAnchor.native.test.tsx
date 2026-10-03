/**
 * useAnchor on React Native
 * ─────────────────────────
 * Renders the core `useAnchor` hook (re-exported from this package) inside the
 * React Native StellarProvider, with the SDK's stellar.toml resolver mocked.
 *
 * Verifies:
 * - stellar.toml is fetched and parsed on RN (which has no `window`)
 * - Requests abort on domain change and on unmount, under the runtime's
 *   AbortController, and a superseded response never lands
 * - The timeout still applies
 * - The return shape is identical to the web build
 * - No window, document, or react-dom access occurs
 */

import React from "react"
import { act, renderHook } from "@testing-library/react-native"
import { StellarProvider, useAnchor } from "../index"

// Resolves to the same module as "@stellar/stellar-sdk" under Jest's
// moduleNameMapper, so this sees the resolver mocked below.
const { StellarToml } = jest.requireMock("@stellar/stellar-sdk") as {
  StellarToml: { Resolver: { resolve: jest.Mock } }
}

// The shared SDK mock does not stub the resolver; keep everything else from it.
jest.mock("@stellar/stellar-sdk", () => ({
  ...jest.requireActual("@stellar/stellar-sdk"),
  StellarToml: { Resolver: { resolve: jest.fn() } },
}))

// react-dom must never load in a React Native bundle.
jest.mock(
  "react-dom",
  () => {
    throw new Error("react-dom must not be imported on React Native")
  },
  { virtual: true }
)

/** Testnet only. */
const SIGNING_KEY = "GDX76CSVSJMYE7PMG2JI7CMERG4CK3UNKX4G6SXZJCY2NLJEWXA2XRSS"
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

function tomlFor(domain: string) {
  return {
    SIGNING_KEY,
    WEB_AUTH_ENDPOINT: `https://${domain}/auth`,
    TRANSFER_SERVER_SEP0024: `https://${domain}/sep24`,
    CURRENCIES: [{ code: "USDC", issuer: USDC_ISSUER, name: "USD Coin" }],
  }
}

const resolve = StellarToml.Resolver.resolve

/** The runtime's global AbortController, swapped for a recording subclass per test. */
const runtime = globalThis as unknown as { AbortController: typeof AbortController }

/** Every AbortController the hook creates, in order. */
let controllers: AbortController[] = []
const RuntimeAbortController = runtime.AbortController

class RecordingAbortController extends RuntimeAbortController {
  constructor() {
    super()
    controllers.push(this)
  }
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let settle: (value: T) => void = () => {}
  const promise = new Promise<T>(r => (settle = r))
  return { promise, resolve: settle }
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <StellarProvider network="testnet" warnOnFallback={false}>
      {children}
    </StellarProvider>
  )
}

/** Settles pending promises under fake timers. */
async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
}

beforeEach(() => {
  controllers = []
  runtime.AbortController = RecordingAbortController
  resolve.mockReset()
})

afterEach(() => {
  runtime.AbortController = RuntimeAbortController
})

describe("useAnchor on React Native", () => {
  it("fetches and parses stellar.toml without window, document, or react-dom", async () => {
    expect("window" in globalThis).toBe(false)
    expect("document" in globalThis).toBe(false)
    resolve.mockResolvedValue(tomlFor("testanchor.stellar.org"))

    const { result } = renderHook(() => useAnchor({ homeDomain: "TestAnchor.Stellar.org " }), {
      wrapper,
    })
    await flush()

    expect(resolve).toHaveBeenCalledWith("testanchor.stellar.org", {
      allowHttp: true,
      timeout: 10_000,
    })
    expect(result.current.error).toBeNull()
    expect(result.current.anchor).toMatchObject({
      homeDomain: "testanchor.stellar.org",
      signingKey: SIGNING_KEY,
      webAuthEndpoint: "https://testanchor.stellar.org/auth",
      transferServerSep24: "https://testanchor.stellar.org/sep24",
      transferServer: null,
      kycServer: null,
      currencies: [{ code: "USDC", issuer: USDC_ISSUER, name: "USD Coin" }],
    })
  })

  it("returns the same shape as the web build", async () => {
    resolve.mockResolvedValue(tomlFor("testanchor.stellar.org"))

    const { result } = renderHook(() => useAnchor({ homeDomain: "testanchor.stellar.org" }), {
      wrapper,
    })
    await flush()

    expect(Object.keys(result.current).sort()).toEqual(["anchor", "error", "loading", "refetch"])
    expect(typeof result.current.refetch).toBe("function")
  })

  it("aborts the in-flight request when the domain changes", async () => {
    const first = deferred<ReturnType<typeof tomlFor>>()
    const second = deferred<ReturnType<typeof tomlFor>>()
    resolve.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)

    const { result, rerender } = renderHook(
      ({ homeDomain }: { homeDomain: string }) => useAnchor({ homeDomain }),
      { wrapper, initialProps: { homeDomain: "first.example.org" } }
    )
    await flush()
    // Every controller created for the first lookup (the hook's and the
    // fetcher's) is live while it is in flight.
    const firstLookup = [...controllers]
    expect(firstLookup.length).toBeGreaterThan(0)
    expect(firstLookup.every(c => !c.signal.aborted)).toBe(true)

    rerender({ homeDomain: "second.example.org" })
    await flush()

    // The first lookup is aborted; the second is live.
    const secondLookup = controllers.slice(firstLookup.length)
    expect(firstLookup.every(c => c.signal.aborted)).toBe(true)
    expect(secondLookup.length).toBeGreaterThan(0)
    expect(secondLookup.every(c => !c.signal.aborted)).toBe(true)
    expect(result.current.loading).toBe(true)

    // A late answer for the superseded domain never lands.
    await act(async () => first.resolve(tomlFor("first.example.org")))
    await flush()
    expect(result.current.anchor).toBeNull()

    await act(async () => second.resolve(tomlFor("second.example.org")))
    await flush()
    expect(result.current.loading).toBe(false)
    expect(result.current.anchor?.homeDomain).toBe("second.example.org")
    expect(result.current.anchor?.webAuthEndpoint).toBe("https://second.example.org/auth")
  })

  it("aborts the in-flight request on unmount", async () => {
    const pending = deferred<ReturnType<typeof tomlFor>>()
    resolve.mockReturnValueOnce(pending.promise)
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})

    const { unmount } = renderHook(() => useAnchor({ homeDomain: "testanchor.stellar.org" }), {
      wrapper,
    })
    await flush()
    expect(controllers.length).toBeGreaterThan(0)
    expect(controllers.every(c => !c.signal.aborted)).toBe(true)

    unmount()
    expect(controllers.every(c => c.signal.aborted)).toBe(true)

    // Resolving after unmount must not update state (no act/unmounted warnings).
    await act(async () => pending.resolve(tomlFor("testanchor.stellar.org")))
    await flush()
    expect(consoleError).not.toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it("times out a request that never answers", async () => {
    resolve.mockReturnValueOnce(new Promise(() => {}))

    const { result } = renderHook(() => useAnchor({ homeDomain: "slow.example.org" }), {
      wrapper,
    })
    await flush()
    expect(result.current.loading).toBe(true)

    act(() => jest.advanceTimersByTime(10_000))
    await flush()

    expect(result.current.loading).toBe(false)
    expect(result.current.error?.code).toBe("NETWORK_ERROR")
    expect(result.current.error?.message).toMatch(/timed out/)
    // The timeout aborts the fetcher's request.
    expect(controllers.some(c => c.signal.aborted)).toBe(true)
  })
})
