import type { WalletAdapter, WalletChange } from "../types"
import { WalletAdapterError } from "../types"
import { NETWORK_PASSPHRASES } from "../constants"
import { describeWalletAdapter } from "./conformance"

let available = true
let rejectConnect = false
let rejectSign = false
let listener: ((change: WalletChange) => void) | undefined
let unsubscribed = false
let signRequest: unknown[] = []

const change: WalletChange = {
  address: "GCHANGED",
  network: "mainnet",
  networkPassphrase: NETWORK_PASSPHRASES.mainnet,
}

const adapter: WalletAdapter = {
  metadata: {
    type: "contract-fixture",
    name: "Contract fixture",
    supported: true,
    platforms: ["web"],
  },
  async isAvailable() {
    return available
  },
  async connect(network) {
    if (!available) throw new WalletAdapterError("wallet_unavailable", "missing")
    if (rejectConnect) throw new WalletAdapterError("wallet_access_rejected", "rejected")
    return {
      address: "GCONFORMANCE",
      wallet: "contract-fixture",
      network,
      networkPassphrase: NETWORK_PASSPHRASES.testnet,
    }
  },
  async getNetworkDetails(network) {
    return { network, networkPassphrase: NETWORK_PASSPHRASES.testnet }
  },
  async signTransaction(xdr, options) {
    signRequest = [xdr, options]
    if (rejectSign) throw new WalletAdapterError("wallet_sign_failed", "rejected")
    return "signed-xdr"
  },
  async resolveNetwork() {
    return { network: "testnet", networkPassphrase: NETWORK_PASSPHRASES.testnet }
  },
  async canAutoConnect() {
    return true
  },
  subscribe(handler) {
    listener = handler
    return () => {
      unsubscribed = true
    }
  },
}

describeWalletAdapter("fixture", () => adapter, {
  reset() {
    available = true
    rejectConnect = false
    rejectSign = false
    listener = undefined
    unsubscribed = false
    signRequest = []
  },
  arrangeAvailable() {},
  arrangeConnect() {},
  arrangeSign() {},
  expected: {
    type: "contract-fixture",
    name: "Contract fixture",
    network: "testnet",
    networkPassphrase: NETWORK_PASSPHRASES.testnet,
    address: "GCONFORMANCE",
    signedXdr: "signed-xdr",
  },
  unavailable: {
    code: "wallet_unavailable",
    arrangeAvailability() {
      available = false
    },
    arrange() {
      available = false
    },
  },
  accessRejected: {
    code: "wallet_access_rejected",
    arrange() {
      rejectConnect = true
    },
  },
  signRejected: {
    code: "wallet_sign_failed",
    arrange() {
      rejectSign = true
    },
  },
  expectedResolvedNetwork: {
    network: "testnet",
    networkPassphrase: NETWORK_PASSPHRASES.testnet,
  },
  expectedCanAutoConnect: true,
  subscription: {
    change,
    emit() {
      listener?.(change)
    },
    expectUnsubscribed() {
      expect(unsubscribed).toBe(true)
    },
  },
  expectSignRequest(xdr, options) {
    expect(signRequest).toEqual([xdr, options])
  },
})
