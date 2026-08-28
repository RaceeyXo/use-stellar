import { getWalletAdapter, hasWalletAdapter, registerWalletAdapter } from "./registry"
import { WalletAdapterError, type WalletAdapter } from "./types"
import { getNetworkPassphrase } from "../types"

describe("wallet adapter registry", () => {
  it("returns the supported Freighter adapter", () => {
    const adapter = getWalletAdapter("freighter")

    expect(adapter.metadata).toEqual({
      type: "freighter",
      name: "Freighter",
      supported: true,
    })
  })

  it("returns the supported Albedo adapter", async () => {
    const adapter = getWalletAdapter("albedo")

    expect(adapter.metadata).toEqual({
      type: "albedo",
      name: "Albedo",
      supported: true,
    })
  })

  it("returns typed unsupported adapters for known future wallets", async () => {
    const adapter = getWalletAdapter("rabet")

    expect(adapter.metadata.supported).toBe(false)
    await expect(adapter.connect("testnet")).rejects.toMatchObject({
      code: "wallet_unsupported",
      message: "Rabet is not supported yet.",
    })
  })
})

describe("getWalletAdapter — unknown types", () => {
  it("throws a WalletAdapterError instead of returning undefined", () => {
    expect(() => getWalletAdapter("nonsense")).toThrow(WalletAdapterError)
    expect(() => getWalletAdapter("nonsense")).toThrow(/Unknown wallet type "nonsense"/)
  })

  it("names the wallets it does know about", () => {
    try {
      getWalletAdapter("nonsense")
      throw new Error("expected getWalletAdapter to throw")
    } catch (err) {
      expect(err).toBeInstanceOf(WalletAdapterError)
      expect((err as WalletAdapterError).code).toBe("wallet_unsupported")
      expect((err as WalletAdapterError).message).toContain("freighter")
    }
  })
})

describe("registerWalletAdapter", () => {
  /** Testnet-only address. */
  const TEST_ADDRESS = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"

  function createTestAdapter(type = "test-wallet"): WalletAdapter {
    return {
      metadata: { type, name: "Test Wallet", supported: true },
      async isAvailable() {
        return true
      },
      async connect(network) {
        return {
          address: TEST_ADDRESS,
          wallet: type,
          network,
          networkPassphrase: getNetworkPassphrase(network) ?? "",
        }
      },
      async getNetworkDetails(network) {
        return { network, networkPassphrase: getNetworkPassphrase(network) ?? "" }
      },
      async signTransaction() {
        return "signed-xdr"
      },
    }
  }

  it("makes a custom adapter available to getWalletAdapter", async () => {
    const adapter = createTestAdapter("custom-one")
    registerWalletAdapter(adapter)

    expect(getWalletAdapter("custom-one")).toBe(adapter)
    expect(hasWalletAdapter("custom-one")).toBe(true)

    const connection = await getWalletAdapter("custom-one").connect("testnet")
    expect(connection.address).toBe(TEST_ADDRESS)
    expect(connection.network).toBe("testnet")
  })

  it("refuses to overwrite an existing type", () => {
    registerWalletAdapter(createTestAdapter("custom-two"))

    expect(() => registerWalletAdapter(createTestAdapter("custom-two"))).toThrow(
      /already registered for "custom-two"/
    )
  })

  it("overwrites when the override flag is explicit", () => {
    registerWalletAdapter(createTestAdapter("custom-three"))
    const replacement = createTestAdapter("custom-three")

    registerWalletAdapter(replacement, { override: true })

    expect(getWalletAdapter("custom-three")).toBe(replacement)
  })

  it("refuses an adapter with no metadata type", () => {
    const malformed = { metadata: { name: "Broken", supported: true } } as unknown as WalletAdapter

    expect(() => registerWalletAdapter(malformed)).toThrow(/metadata.type/)
  })

  it("refuses an adapter that cannot connect or sign", () => {
    const malformed = {
      metadata: { type: "half-built", name: "Half Built", supported: true },
    } as unknown as WalletAdapter

    expect(() => registerWalletAdapter(malformed)).toThrow(/connect\(\) and signTransaction\(\)/)
  })
})
