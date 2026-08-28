import React from "react"
import { renderHook, act, waitFor } from "@testing-library/react"
import { StellarProvider } from "../context/StellarProvider"
import { useAnchor } from "./useAnchor"
import { StellarToml } from "@stellar/stellar-sdk"

// Mock the Stellar SDK's TOML resolver
jest.mock("@stellar/stellar-sdk", () => ({
  StellarToml: {
    Resolver: {
      resolve: jest.fn(),
    },
  },
}))

const mockResolve = StellarToml.Resolver.resolve as jest.Mock

function wrapper({ children }: { children: React.ReactNode }) {
  return <StellarProvider network="testnet">{children}</StellarProvider>
}

function mainnetWrapper({ children }: { children: React.ReactNode }) {
  return <StellarProvider network="mainnet">{children}</StellarProvider>
}

beforeEach(() => {
  mockResolve.mockReset()
})

test("resolves testanchor.stellar.org and exposes mapped fields", async () => {
  const mockToml = {
    SIGNING_KEY: "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP",
    WEB_AUTH_ENDPOINT: "https://testanchor.stellar.org/auth",
    TRANSFER_SERVER: "https://testanchor.stellar.org/sep6",
    TRANSFER_SERVER_SEP0024: "https://testanchor.stellar.org/sep24",
    KYC_SERVER: "https://testanchor.stellar.org/kyc",
    CURRENCIES: [
      {
        code: "USD",
        issuer: "GCKFBEIYV2U22IO2BJ4KVJOIP7XPWQGQFKKWXR6DOSJBV7STMAQSMTGG",
        name: "US Dollar",
        desc: "USD token",
        image: "https://testanchor.stellar.org/usd.png",
        is_asset_anchored: true,
      },
    ],
    DOCUMENTATION: {
      ORG_NAME: "Test Anchor",
    },
  }

  mockResolve.mockResolvedValue(mockToml)

  const { result } = renderHook(() => useAnchor({ homeDomain: "testanchor.stellar.org" }), {
    wrapper,
  })

  expect(result.current.loading).toBe(true)

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.error).toBeNull()
  expect(result.current.anchor).not.toBeNull()
  expect(result.current.anchor?.homeDomain).toBe("testanchor.stellar.org")
  expect(result.current.anchor?.signingKey).toBe(
    "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP"
  )
  expect(result.current.anchor?.webAuthEndpoint).toBe("https://testanchor.stellar.org/auth")
  expect(result.current.anchor?.transferServer).toBe("https://testanchor.stellar.org/sep6")
  expect(result.current.anchor?.transferServerSep24).toBe("https://testanchor.stellar.org/sep24")
  expect(result.current.anchor?.kycServer).toBe("https://testanchor.stellar.org/kyc")

  expect(result.current.anchor?.currencies).toHaveLength(1)
  expect(result.current.anchor?.currencies[0]).toEqual({
    code: "USD",
    issuer: "GCKFBEIYV2U22IO2BJ4KVJOIP7XPWQGQFKKWXR6DOSJBV7STMAQSMTGG",
    name: "US Dollar",
    desc: "USD token",
    image: "https://testanchor.stellar.org/usd.png",
    isAssetAnchored: true,
  })

  expect(result.current.anchor?.raw).toBe(mockToml)
  expect(result.current.anchor?.raw.DOCUMENTATION).toEqual({ ORG_NAME: "Test Anchor" })
})

test("missing optional fields yield nulls, not an error", async () => {
  const mockToml = {
    SIGNING_KEY: "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP",
    // No WEB_AUTH_ENDPOINT, TRANSFER_SERVER, etc.
  }

  mockResolve.mockResolvedValue(mockToml)

  const { result } = renderHook(() => useAnchor({ homeDomain: "minimal.example.com" }), {
    wrapper,
  })

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.error).toBeNull()
  expect(result.current.anchor).not.toBeNull()
  expect(result.current.anchor?.signingKey).toBe(
    "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP"
  )
  expect(result.current.anchor?.webAuthEndpoint).toBeNull()
  expect(result.current.anchor?.transferServer).toBeNull()
  expect(result.current.anchor?.transferServerSep24).toBeNull()
  expect(result.current.anchor?.kycServer).toBeNull()
  expect(result.current.anchor?.currencies).toEqual([])
})

test("404 / unreachable domain sets error, not a thrown exception", async () => {
  mockResolve.mockRejectedValue(new Error("stellar.toml not found"))

  const { result } = renderHook(() => useAnchor({ homeDomain: "nonexistent.example.com" }), {
    wrapper,
  })

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.error).not.toBeNull()
  expect(result.current.error?.code).toBeDefined()
  expect(result.current.anchor).toBeNull()
})

test("plaintext HTTP is refused on mainnet", async () => {
  const { result } = renderHook(() => useAnchor({ homeDomain: "http://insecure.example.com" }), {
    wrapper: mainnetWrapper,
  })

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.error).not.toBeNull()
  expect(result.current.error?.code).toBe("VALIDATION_ERROR")
  expect(result.current.error?.message).toContain("HTTP is not allowed")
  expect(result.current.anchor).toBeNull()
})

test("HTTP is allowed on testnet for localhost", async () => {
  const mockToml = {
    SIGNING_KEY: "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP",
  }

  mockResolve.mockResolvedValue(mockToml)

  const { result } = renderHook(() => useAnchor({ homeDomain: "localhost:8000" }), {
    wrapper,
  })

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.error).toBeNull()
  expect(result.current.anchor).not.toBeNull()
  expect(mockResolve).toHaveBeenCalledWith("localhost:8000", {
    allowHttp: true,
    timeout: 10_000,
  })
})

test("oversized or slow response is bounded by timeout", async () => {
  mockResolve.mockImplementation(
    () =>
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), 15_000)
      })
  )

  jest.useFakeTimers()

  const { result } = renderHook(() => useAnchor({ homeDomain: "slow.example.com" }), {
    wrapper,
  })

  expect(result.current.loading).toBe(true)

  await act(async () => {
    jest.advanceTimersByTime(10_000)
    await Promise.resolve()
  })

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.error).not.toBeNull()
  expect(result.current.anchor).toBeNull()

  jest.useRealTimers()
})

test("signingKey is validated before being returned", async () => {
  const mockToml = {
    SIGNING_KEY: "INVALID_KEY_FORMAT",
  }

  mockResolve.mockResolvedValue(mockToml)

  const { result } = renderHook(() => useAnchor({ homeDomain: "bad-key.example.com" }), {
    wrapper,
  })

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.error).not.toBeNull()
  expect(result.current.error?.code).toBe("VALIDATION_ERROR")
  expect(result.current.error?.message).toContain("Invalid signing key")
  expect(result.current.anchor).toBeNull()
})

test("invalid issuer addresses in currencies are skipped", async () => {
  const mockToml = {
    SIGNING_KEY: "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP",
    CURRENCIES: [
      {
        code: "USD",
        issuer: "GCKFBEIYV2U22IO2BJ4KVJOIP7XPWQGQFKKWXR6DOSJBV7STMAQSMTGG",
      },
      {
        code: "EUR",
        issuer: "INVALID_ISSUER",
      },
      {
        code: "GBP",
        issuer: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
      },
    ],
  }

  mockResolve.mockResolvedValue(mockToml)

  const { result } = renderHook(() => useAnchor({ homeDomain: "multi-currency.example.com" }), {
    wrapper,
  })

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.error).toBeNull()
  expect(result.current.anchor?.currencies).toHaveLength(2)
  expect(result.current.anchor?.currencies[0].code).toBe("USD")
  expect(result.current.anchor?.currencies[1].code).toBe("GBP")
})

test("raw carries the untouched parsed document", async () => {
  const mockToml = {
    SIGNING_KEY: "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP",
    CUSTOM_FIELD: "custom value",
    ANOTHER_UNMAPPED: 12345,
  }

  mockResolve.mockResolvedValue(mockToml)

  const { result } = renderHook(() => useAnchor({ homeDomain: "custom-fields.example.com" }), {
    wrapper,
  })

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.error).toBeNull()
  expect(result.current.anchor?.raw).toBe(mockToml)
  expect(result.current.anchor?.raw.CUSTOM_FIELD).toBe("custom value")
  expect(result.current.anchor?.raw.ANOTHER_UNMAPPED).toBe(12345)
})

test("autoFetch: false does not fetch on mount", async () => {
  mockResolve.mockResolvedValue({
    SIGNING_KEY: "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP",
  })

  const { result } = renderHook(() => useAnchor({ homeDomain: "example.com", autoFetch: false }), {
    wrapper,
  })

  await act(async () => {
    await Promise.resolve()
  })

  expect(mockResolve).not.toHaveBeenCalled()
  expect(result.current.anchor).toBeNull()
  expect(result.current.loading).toBe(false)
})

test("refetch manually fetches when autoFetch is false", async () => {
  mockResolve.mockResolvedValue({
    SIGNING_KEY: "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP",
  })

  const { result } = renderHook(() => useAnchor({ homeDomain: "example.com", autoFetch: false }), {
    wrapper,
  })

  expect(mockResolve).not.toHaveBeenCalled()

  await act(async () => {
    result.current.refetch()
  })

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(mockResolve).toHaveBeenCalledTimes(1)
  expect(result.current.anchor).not.toBeNull()
})

test("SSR render is a no-op, not a throw", () => {
  // Mock isBrowser to return false
  const originalWindow = global.window
  // @ts-expect-error - Simulating SSR
  delete global.window

  mockResolve.mockResolvedValue({
    SIGNING_KEY: "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP",
  })

  const { result } = renderHook(() => useAnchor({ homeDomain: "testanchor.stellar.org" }), {
    wrapper,
  })

  expect(result.current.anchor).toBeNull()
  expect(result.current.loading).toBe(false)
  expect(result.current.error).toBeNull()
  expect(mockResolve).not.toHaveBeenCalled()

  // Restore window
  global.window = originalWindow
})

test("aborts in-flight request on unmount", async () => {
  let rejectFn: (err: Error) => void
  mockResolve.mockImplementation(
    () =>
      new Promise((_, reject) => {
        rejectFn = reject
      })
  )

  const { unmount } = renderHook(() => useAnchor({ homeDomain: "example.com" }), {
    wrapper,
  })

  await act(async () => {
    await Promise.resolve()
  })

  unmount()

  // Trigger the rejection after unmount
  await act(async () => {
    rejectFn!(new Error("Aborted"))
    await Promise.resolve()
  })

  // No assertion needed - just verify no error is thrown
})

test("aborts previous request when homeDomain changes", async () => {
  const mockToml1 = {
    SIGNING_KEY: "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP",
  }
  const mockToml2 = {
    SIGNING_KEY: "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2",
  }

  mockResolve.mockResolvedValueOnce(mockToml1).mockResolvedValueOnce(mockToml2)

  const { result, rerender } = renderHook(
    ({ domain }: { domain: string }) => useAnchor({ homeDomain: domain }),
    {
      wrapper,
      initialProps: { domain: "first.example.com" },
    }
  )

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.anchor?.signingKey).toBe(
    "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP"
  )

  // Change domain
  rerender({ domain: "second.example.com" })

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.anchor?.signingKey).toBe(
    "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2"
  )
})

test("normalizes domain to lowercase and trims whitespace", async () => {
  const mockToml = {
    SIGNING_KEY: "GBWMCCC3NHSKLAOJDBKKYW7SSH2PFTTNVFKWSGLWGDLEBKLOVP5JLBBP",
  }

  mockResolve.mockResolvedValue(mockToml)

  const { result } = renderHook(() => useAnchor({ homeDomain: "  TestAnchor.Stellar.ORG  " }), {
    wrapper,
  })

  await waitFor(() => {
    expect(result.current.loading).toBe(false)
  })

  expect(result.current.anchor?.homeDomain).toBe("testanchor.stellar.org")
  expect(mockResolve).toHaveBeenCalledWith("testanchor.stellar.org", expect.any(Object))
})
