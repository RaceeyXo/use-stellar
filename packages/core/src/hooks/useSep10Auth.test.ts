// packages/core/src/hooks/useSep10Auth.test.ts

import { renderHook, act } from "@testing-library/react"
import { useSep10Auth } from "./useSep10Auth"
import { useAnchor } from "./useAnchor"
import { useStellarContext } from "../context/StellarProvider"
import { isBrowser } from "../utils"
import { getWalletAdapter } from "../wallets"
import { WebAuth, Networks } from "@stellar/stellar-sdk"

jest.mock("./useAnchor")
jest.mock("../context/StellarProvider")
jest.mock("../utils")
// getWalletAdapter lives in ../wallets; automock it so tests can drive it.
jest.mock("../wallets")

// Mock WebAuth to control strict validation behavior
jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk")
  return {
    ...actual,
    WebAuth: {
      readChallengeTx: jest.fn(),
    },
  }
})

describe("useSep10Auth", () => {
  const mockWallet = {
    connected: true,
    address: "GCQXGSYENBXMSLQ6ZEUTKI472VRITITZXTWEQBOOLMBWD347CPC3XLZ5",
    wallet: "test-wallet",
    walletNetwork: "testnet",
  }

  const mockNetworkConfig = {
    network: "testnet",
    networkPassphrase: Networks.TESTNET,
  }

  const mockSignTransaction = jest.fn()
  const mockFetch = jest.fn()
  global.fetch = mockFetch as unknown as typeof fetch

  beforeEach(() => {
    jest.clearAllMocks()
    ;(isBrowser as jest.Mock).mockReturnValue(true)
    ;(useStellarContext as jest.Mock).mockReturnValue({
      network: "testnet",
      networkConfig: mockNetworkConfig,
      wallet: mockWallet,
    })
    ;(useAnchor as jest.Mock).mockReturnValue({
      anchor: {
        webAuthEndpoint: "https://testanchor.stellar.org/auth",
        signingKey: "GCSIGNINGKEY...",
        homeDomain: "testanchor.stellar.org",
      },
      loading: false,
      error: null,
    })
    ;(getWalletAdapter as jest.Mock).mockReturnValue({
      signTransaction: mockSignTransaction,
    })
  })

  it("completes full round trip against testanchor.stellar.org and returns a JWT", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ transaction: "mock-challenge-xdr" }),
    })

    ;(WebAuth.readChallengeTx as jest.Mock).mockReturnValue({
      clientAccountID: mockWallet.address,
    })

    mockSignTransaction.mockResolvedValue("mock-signed-xdr")

    const futureTime = Math.floor(Date.now() / 1000) + 3600
    const mockJwt = `header.${btoa(JSON.stringify({ exp: futureTime }))}.signature`

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ token: mockJwt }),
    })

    const { result } = renderHook(() => useSep10Auth({ homeDomain: "testanchor.stellar.org" }))

    let token: string | undefined
    await act(async () => {
      token = await result.current.authenticate()
    })

    expect(mockFetch).toHaveBeenCalledTimes(2)
    // Ensures expected signing key comes from useAnchor (GCSIGNINGKEY...)
    expect(WebAuth.readChallengeTx).toHaveBeenCalledWith(
      "mock-challenge-xdr",
      "GCSIGNINGKEY...",
      Networks.TESTNET,
      "testanchor.stellar.org",
      "testanchor.stellar.org"
    )
    // The wallet adapter takes the challenge XDR plus an options object — the
    // passphrase is what binds the signature to a network, so it must be there.
    expect(mockSignTransaction).toHaveBeenCalledWith("mock-challenge-xdr", {
      address: mockWallet.address,
      network: "testnet",
      networkPassphrase: Networks.TESTNET,
    })
    expect(token).toBe(mockJwt)
    expect(result.current.token).toBe(mockJwt)
    expect(result.current.authenticated).toBe(true)
    expect(result.current.expiresAt).toBeInstanceOf(Date)
  })

  it("feeds a tampered challenge and asserts signTransaction was never called", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ transaction: "tampered-challenge-xdr" }),
    })

    ;(WebAuth.readChallengeTx as jest.Mock).mockImplementation(() => {
      throw new Error("Invalid sequence number")
    })

    const { result } = renderHook(() => useSep10Auth({ homeDomain: "testanchor.stellar.org" }))

    await act(async () => {
      await expect(result.current.authenticate()).rejects.toThrow(/Invalid sequence number/)
    })

    expect(mockSignTransaction).not.toHaveBeenCalled() // MUST NOT sign invalid challenge
    expect(result.current.error?.code).toBe("SEP10_VALIDATION_FAILED")
  })

  it("refuses a challenge naming a different account than the connected wallet", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ transaction: "mock-challenge-xdr" }),
    })

    ;(WebAuth.readChallengeTx as jest.Mock).mockReturnValue({
      clientAccountID: "GDIFFERENTACCOUNT...",
    })

    const { result } = renderHook(() => useSep10Auth({ homeDomain: "testanchor.stellar.org" }))

    await act(async () => {
      await expect(result.current.authenticate()).rejects.toThrow(/client account ID mismatch/)
    })

    expect(mockSignTransaction).not.toHaveBeenCalled()
    expect(result.current.error?.code).toBe("SEP10_VALIDATION_FAILED")
  })

  it("clears token on wallet disconnect", async () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600
    const mockJwt = `header.${btoa(JSON.stringify({ exp: futureTime }))}.signature`

    Storage.prototype.getItem = jest.fn(() => mockJwt)
    Storage.prototype.removeItem = jest.fn()

    const { result, rerender } = renderHook(() =>
      useSep10Auth({ homeDomain: "testanchor.stellar.org", persist: true })
    )
    expect(result.current.token).toBe(mockJwt)

    ;(useStellarContext as jest.Mock).mockReturnValue({
      network: "testnet",
      networkConfig: mockNetworkConfig,
      wallet: { ...mockWallet, address: null }, // wallet disconnected
    })

    rerender()

    expect(result.current.token).toBeNull()
    expect(localStorage.removeItem).toHaveBeenCalled()
  })

  it("surfaces WALLET_REQUEST_REJECTED when user rejects signing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ transaction: "mock-challenge-xdr" }),
    })

    ;(WebAuth.readChallengeTx as jest.Mock).mockReturnValue({
      clientAccountID: mockWallet.address,
    })

    mockSignTransaction.mockRejectedValue(new Error("User rejected"))

    const { result } = renderHook(() => useSep10Auth({ homeDomain: "testanchor.stellar.org" }))

    await act(async () => {
      await expect(result.current.authenticate()).rejects.toThrow()
    })

    expect(result.current.error?.code).toBe("WALLET_REQUEST_REJECTED")
  })
})
