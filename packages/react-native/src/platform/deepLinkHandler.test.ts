type UrlListener = (event: { url: string }) => void

const mockListeners = new Set<UrlListener>()
let mockInitialUrl: string | null = null

jest.mock("react-native", () => ({
  Linking: {
    getInitialURL: jest.fn(async () => mockInitialUrl),
    addEventListener: jest.fn((_event: string, listener: UrlListener) => {
      mockListeners.add(listener)
      return { remove: () => mockListeners.delete(listener) }
    }),
  },
}))

import { initDeepLinkHandler, parseDeepLink, registerPendingRequest } from "./deepLinkHandler"

/** A real transaction envelope is base64, so it contains `+`, `/` and `=`. */
const SIGNED_XDR = Buffer.from([251, 255, 190, 0, 0, 0, 2, 62, 255, 63]).toString("base64")

function openLink(url: string) {
  mockListeners.forEach(listener => listener({ url }))
}

describe("parseDeepLink", () => {
  // React Native's built-in URLSearchParams throws "not implemented" from
  // get(). Removing it proves the parser does not depend on it.
  const original = globalThis.URLSearchParams
  beforeAll(() => {
    // @ts-expect-error -- deliberately unavailable for these tests
    delete globalThis.URLSearchParams
  })
  afterAll(() => {
    globalThis.URLSearchParams = original
  })

  it("reads the request id and the signed XDR", () => {
    const result = parseDeepLink(
      `myapp://stellar/signed?requestId=abc123&xdr=${encodeURIComponent(SIGNED_XDR)}`
    )

    expect(result).toEqual({
      requestId: "abc123",
      signedXdr: SIGNED_XDR,
      error: null,
      cancelled: false,
    })
  })

  it("keeps a literal + in the XDR instead of turning it into a space", () => {
    const result = parseDeepLink(`myapp://stellar/signed?requestId=abc123&xdr=${SIGNED_XDR}`)

    expect(result.signedXdr).toBe(SIGNED_XDR)
  })

  it("ignores a fragment after the query", () => {
    const result = parseDeepLink("myapp://stellar/signed?requestId=abc123&error=declined#top")

    expect(result.error).toBe("declined")
  })

  it("reports cancellation", () => {
    expect(parseDeepLink("myapp://x?requestId=a&error=user_cancelled").cancelled).toBe(true)
    expect(parseDeepLink("myapp://x?requestId=a&cancelled=true").cancelled).toBe(true)
  })

  it("lets the first occurrence of a parameter win", () => {
    const result = parseDeepLink("myapp://x?requestId=mine&requestId=theirs")

    expect(result.requestId).toBe("mine")
  })

  it("returns an empty result for a link with no query, or a malformed one", () => {
    const empty = { requestId: null, signedXdr: null, error: null, cancelled: false }

    expect(parseDeepLink("myapp://home")).toEqual(empty)
    expect(parseDeepLink("myapp://x?%E0%A4%A")).toEqual(empty)
  })
})

describe("initDeepLinkHandler", () => {
  let cleanup: () => void = () => {}

  beforeEach(() => {
    mockListeners.clear()
    mockInitialUrl = null
  })

  afterEach(() => {
    cleanup()
  })

  it("resolves the pending request a returning link names", async () => {
    cleanup = initDeepLinkHandler()
    const pending = registerPendingRequest("req-1")

    openLink(`myapp://stellar/signed?requestId=req-1&xdr=${encodeURIComponent(SIGNED_XDR)}`)

    await expect(pending).resolves.toBe(SIGNED_XDR)
  })

  it("rejects when the user cancelled", async () => {
    cleanup = initDeepLinkHandler()
    const pending = registerPendingRequest("req-2")

    openLink("myapp://stellar/signed?requestId=req-2&error=user_cancelled")

    await expect(pending).rejects.toThrow("User cancelled the signing request")
  })

  it("rejects a link whose XDR is not base64", async () => {
    cleanup = initDeepLinkHandler()
    const pending = registerPendingRequest("req-3")

    openLink("myapp://stellar/signed?requestId=req-3&xdr=%3Cscript%3E")

    await expect(pending).rejects.toThrow("malformed signed XDR")
  })

  it("times a request out", async () => {
    cleanup = initDeepLinkHandler()
    const pending = registerPendingRequest("req-4", { timeoutMs: 1_000 })
    const settled = expect(pending).rejects.toThrow("timed out")

    jest.advanceTimersByTime(1_000)

    await settled
  })

  it("hands a result with no pending request to onUnmatchedResult", async () => {
    // The app was killed while the user was in the wallet, and the return link
    // relaunched it: nothing in this process is waiting for the result.
    mockInitialUrl = `myapp://stellar/signed?requestId=lost&xdr=${encodeURIComponent(SIGNED_XDR)}`
    const onUnmatchedResult = jest.fn()

    cleanup = initDeepLinkHandler({ onUnmatchedResult })
    await Promise.resolve()
    await Promise.resolve()

    expect(onUnmatchedResult).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "lost", signedXdr: SIGNED_XDR })
    )
  })

  it("ignores links that are not sign-request callbacks", () => {
    const onUnmatchedResult = jest.fn()
    cleanup = initDeepLinkHandler({ onUnmatchedResult })

    openLink("myapp://settings?tab=profile")

    expect(onUnmatchedResult).not.toHaveBeenCalled()
  })

  it("removes its listener on cleanup", () => {
    cleanup = initDeepLinkHandler()
    expect(mockListeners.size).toBe(1)

    cleanup()

    expect(mockListeners.size).toBe(0)
  })
})
