import { NETWORK_PASSPHRASES } from "./constants"
import { rabetAdapter } from "./rabetAdapter"

type Handler = (value?: unknown) => void

const connect = jest.fn()
const sign = jest.fn()
const disconnect = jest.fn()
const listeners = new Map<string, Handler>()
const on = jest.fn((event: string, handler: Handler) => listeners.set(event, handler))
const off = jest.fn((event: string, handler: Handler) => {
  if (listeners.get(event) === handler) listeners.delete(event)
})

function installProvider(): void {
  Object.assign(window, {
    rabet: { connect, sign, disconnect, on, off },
  })
}

function removeProvider(): void {
  delete (window as Window & { rabet?: unknown }).rabet
}

beforeEach(() => {
  jest.clearAllMocks()
  listeners.clear()
  installProvider()
  connect.mockResolvedValue({ publicKey: "GABC" })
  sign.mockResolvedValue({ xdr: "signed-xdr" })
})

afterEach(removeProvider)

test("exposes supported Rabet metadata and detects the injected provider", async () => {
  expect(rabetAdapter.metadata).toEqual({
    type: "rabet",
    name: "Rabet",
    supported: true,
    platforms: ["web"],
  })
  await expect(rabetAdapter.isAvailable()).resolves.toBe(true)

  removeProvider()
  await expect(rabetAdapter.isAvailable()).resolves.toBe(false)
})

test("connect returns a canonical connection and rejects unsupported networks", async () => {
  await expect(rabetAdapter.connect("testnet")).resolves.toEqual({
    address: "GABC",
    wallet: "rabet",
    network: "testnet",
    networkPassphrase: NETWORK_PASSPHRASES.testnet,
  })

  await expect(rabetAdapter.connect("custom")).rejects.toMatchObject({
    code: "wallet_network_mismatch",
  })
  expect(connect).toHaveBeenCalledTimes(1)
})

test("maps missing and rejected providers to stable error codes", async () => {
  removeProvider()
  await expect(rabetAdapter.connect("testnet")).rejects.toMatchObject({
    code: "wallet_unavailable",
  })

  installProvider()
  connect.mockRejectedValue(Object.assign(new Error("User rejected request"), { code: 4001 }))
  await expect(rabetAdapter.connect("testnet")).rejects.toMatchObject({
    code: "wallet_access_rejected",
  })
})

test("signs from the supplied passphrase and never infers a custom network", async () => {
  await expect(
    rabetAdapter.signTransaction("raw-xdr", {
      address: "GABC",
      network: "mainnet",
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
    })
  ).resolves.toBe("signed-xdr")
  expect(sign).toHaveBeenCalledWith("raw-xdr", "testnet")

  await expect(
    rabetAdapter.signTransaction("raw-xdr", {
      address: "GABC",
      network: "testnet",
      networkPassphrase: "Private Network ; 2026",
    })
  ).rejects.toMatchObject({ code: "wallet_network_mismatch" })
  expect(sign).toHaveBeenCalledTimes(1)
})

test("maps rejected and failed signatures separately", async () => {
  sign.mockRejectedValueOnce(new Error("User declined"))
  await expect(
    rabetAdapter.signTransaction("raw-xdr", {
      address: "GABC",
      network: "testnet",
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
    })
  ).rejects.toMatchObject({ code: "wallet_access_rejected" })

  sign.mockRejectedValueOnce(new Error("Bridge failure"))
  await expect(
    rabetAdapter.signTransaction("raw-xdr", {
      address: "GABC",
      network: "testnet",
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
    })
  ).rejects.toMatchObject({ code: "wallet_sign_failed" })
})

test("forwards account and network events and removes both listeners", async () => {
  await rabetAdapter.connect("testnet")
  const handler = jest.fn()
  const unsubscribe = rabetAdapter.subscribe!(handler)

  listeners.get("accountChanged")?.("GNEW")
  expect(handler).toHaveBeenLastCalledWith({
    address: "GNEW",
    network: "testnet",
    networkPassphrase: NETWORK_PASSPHRASES.testnet,
  })

  listeners.get("networkChanged")?.("mainnet")
  expect(handler).toHaveBeenLastCalledWith({
    address: "GNEW",
    network: "mainnet",
    networkPassphrase: NETWORK_PASSPHRASES.mainnet,
  })

  unsubscribe()
  expect(off).toHaveBeenCalledTimes(2)
  expect(listeners.size).toBe(0)
})

test("disconnect delegates to the injected provider", async () => {
  await rabetAdapter.disconnect!()
  expect(disconnect).toHaveBeenCalledTimes(1)
})
