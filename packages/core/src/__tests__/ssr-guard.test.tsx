/**
 * Verifies the behavioral SSR guard: on a server render, useWallet.connect()
 * must set a clear error instead of crashing.
 *
 * Wallet gating goes through the provider's platform capabilities
 * (`detectPlatform()`), so that is what is forced to "server" here, while
 * keeping jsdom so React and @testing-library/react have a stable DOM.
 */

import React from "react"
import { renderHook, act } from "@testing-library/react"

// jest.mock is hoisted to the top of the file by Jest.
jest.mock("../runtime/platform", () => {
  const actual = jest.requireActual("../runtime/platform")
  return {
    ...actual,
    detectPlatform: () => ({
      kind: "server",
      canConnectWallet: false,
      hasLocalStorage: false,
      hasDom: false,
      isServer: true,
      storage: null,
    }),
  }
})

import { StellarProvider } from "../context/StellarProvider"
import { useWallet } from "../hooks/useWallet"

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(StellarProvider, { network: "testnet", children })

describe("SSR guard — useWallet.connect() on a server render", () => {
  it("sets a clear error instead of crashing when window is unavailable", async () => {
    const { result } = renderHook(() => useWallet(), { wrapper })

    await act(async () => {
      await result.current.connect()
    })

    expect(result.current.connected).toBe(false)
    expect(result.current.error?.code).toBe("VALIDATION_ERROR")
    expect(result.current.error?.message).toMatch(/only available in the browser/i)
  })
})
