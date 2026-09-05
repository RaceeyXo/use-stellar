// packages/core/src/hooks/useFriendbot.test.tsx

import React from "react"
import { renderHook, act } from "@testing-library/react"
import { useFriendbot } from "./useFriendbot"
import { useStellarContext } from "../context/StellarProvider"

const TESTNET_ACCOUNT = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASUIYIC7FEM"

jest.mock("../context/StellarProvider")

describe("useFriendbot", () => {
  const mockFetch = jest.fn()
  global.fetch = mockFetch as any

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useStellarContext as jest.Mock).mockReturnValue({
      network: "testnet",
      wallet: { address: TESTNET_ACCOUNT }
    })
  })

  it("successfully funds an account via testnet friendbot", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true })
    const { result } = renderHook(() => useFriendbot())

    await act(async () => {
      await result.current.fund()
    })

    expect(mockFetch).toHaveBeenCalledWith(`https://friendbot.stellar.org?addr=${TESTNET_ACCOUNT}`)
    expect(result.current.funded).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it("throws VALIDATION_ERROR instantly when on mainnet without making a request", async () => {
    ;(useStellarContext as jest.Mock).mockReturnValue({
      network: "mainnet", wallet: { address: TESTNET_ACCOUNT }
    })
    const { result } = renderHook(() => useFriendbot())

    await act(async () => {
      await expect(result.current.fund()).rejects.toThrow()
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.error?.name).toBe("VALIDATION_ERROR")
  })

  it("throws WALLET_NOT_CONNECTED when no address is provided and wallet is disconnected", async () => {
    ;(useStellarContext as jest.Mock).mockReturnValue({
      network: "testnet", wallet: { address: null }
    })
    const { result } = renderHook(() => useFriendbot())

    await act(async () => {
      await expect(result.current.fund()).rejects.toThrow()
    })

    expect(result.current.error?.name).toBe("WALLET_NOT_CONNECTED")
  })

  it("rejects an invalid address before spending a request", async () => {
    const { result } = renderHook(() => useFriendbot())

    await act(async () => {
      await expect(result.current.fund("INVALID_ADDRESS_STRING")).rejects.toThrow()
    })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(result.current.error?.name).toBe("VALIDATION_ERROR")
  })

  it("surfaces a distinct ALREADY_FUNDED error when friendbot returns 400", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 })
    const { result } = renderHook(() => useFriendbot())

    await act(async () => {
      await expect(result.current.fund()).rejects.toThrow()
    })

    expect(result.current.error?.name).toBe("ALREADY_FUNDED")
    expect(result.current.funded).toBe(false)
  })
})