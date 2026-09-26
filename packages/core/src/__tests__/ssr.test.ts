/**
 * @jest-environment node
 *
 * Verifies that importing use-stellar in a pure Node environment
 * (no window / DOM) does not crash — the key requirement for SSR
 * in Next.js, Remix, and similar frameworks.
 */

describe("SSR safety — import in Node environment", () => {
  it("can import StellarProvider without crashing", async () => {
    await expect(import("../context/StellarProvider")).resolves.toBeDefined()
  })

  it("can import useWallet without crashing", async () => {
    await expect(import("../hooks/useWallet")).resolves.toBeDefined()
  })

  it("can import useBalance without crashing", async () => {
    await expect(import("../hooks/useBalance")).resolves.toBeDefined()
  })

  it("can import useAccount without crashing", async () => {
    await expect(import("../hooks/useAccount")).resolves.toBeDefined()
  })

  it("can import useSendPayment without crashing", async () => {
    await expect(import("../hooks/useSendPayment")).resolves.toBeDefined()
  })

  it("can import useStreamPayments without crashing", async () => {
    await expect(import("../hooks/useStreamPayments")).resolves.toBeDefined()
  })

  it("can import useTransaction without crashing", async () => {
    await expect(import("../hooks/useTransaction")).resolves.toBeDefined()
  })

  it("can import useNetwork without crashing", async () => {
    await expect(import("../hooks/useNetwork")).resolves.toBeDefined()
  })

  it("can import useAsset without crashing", async () => {
    await expect(import("../hooks/useAsset")).resolves.toBeDefined()
  })

  it("can import useSorobanContract without crashing", async () => {
    await expect(import("../hooks/useSorobanContract")).resolves.toBeDefined()
  })

  it("can import the barrel index without crashing", async () => {
    await expect(import("../index")).resolves.toBeDefined()
  })

  it("isBrowser() returns false in Node", async () => {
    const { isBrowser } = await import("../utils")
    expect(isBrowser()).toBe(false)
  })
})
