import { renderHook, act } from "@testing-library/react"
import React from "react"
import { StellarProvider, useStellarContext } from "../context/StellarProvider"
import { useAddTrustline } from "./useAddTrustline"
import { STELLAR_ERROR_CODES } from "../errors"
import type { WalletState } from "../types"

const TEST_ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"
const MOCK_WALLET_STATE: WalletState = {
  connected: true,
  connecting: false,
  address: TEST_ADDRESS,
  network: "testnet",
  wallet: "freighter",
  error: null,
  walletNetwork: "testnet",
  walletName: "Freighter",
}

const mockSignTransaction = jest.fn()
const mockSubmitTransaction = jest.fn()
const mockLoadAccount = jest.fn()
const mockFetchBaseFee = jest.fn()

jest.mock("../wallets", () => ({
  ...jest.requireActual("../wallets"),
  getWalletAdapter: () => ({
    signTransaction: mockSignTransaction,
  }),
}))

jest.mock("../utils", () => ({
  ...jest.requireActual("../utils"),
  getHorizonServer: () => ({
    loadAccount: mockLoadAccount,
    fetchBaseFee: mockFetchBaseFee,
    submitTransaction: mockSubmitTransaction,
  }),
  isBrowser: () => true,
}))

const mockTx = { toXDR: () => "xdr", hash: () => ({ toString: () => "abc123" }) }
const mockSignedTx = { toXDR: () => "signed_xdr" }

// `moduleNameMapper` in jest.config.js redirects "@stellar/stellar-sdk" to the
// manual mock in src/__mocks__, and that redirect applies to
// `jest.requireActual` too — so spreading the "real" module here yielded no
// Networks, Operation, Asset or BASE_FEE, and `Networks.TESTNET` blew up.
// Declare exactly what useAddTrustline imports instead.
//
// Plain functions rather than jest.fn(): `resetMocks: true` wipes mock
// implementations before every test, which would empty this factory out.
// Note `fromXDR` is a *static* on TransactionBuilder, not an instance method.
jest.mock("@stellar/stellar-sdk", () => {
  const TransactionBuilder = Object.assign(
    function TransactionBuilder() {
      const builder = {
        addOperation: () => builder,
        setTimeout: () => builder,
        build: () => mockTx,
      }
      return builder
    },
    { fromXDR: () => mockSignedTx }
  )

  return {
    TransactionBuilder,
    Networks: {
      PUBLIC: "Public Global Stellar Network ; September 2015",
      TESTNET: "Test SDF Network ; September 2015",
    },
    BASE_FEE: "100",
    Operation: { changeTrust: (opts: unknown) => opts },
    Asset: function Asset(code: string, issuer: string) {
      return { code, issuer }
    },
  }
})

const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015"

function Wrapper({ children }: { children: React.ReactNode }) {
  const { setWallet } = useStellarContext()

  React.useEffect(() => {
    setWallet(MOCK_WALLET_STATE)
  }, [setWallet])

  return <>{children}</>
}

function TestProvider({ children }: { children: React.ReactNode }) {
  return (
    <StellarProvider network="testnet">
      <Wrapper>{children}</Wrapper>
    </StellarProvider>
  )
}

const ISSUED_ASSET = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
}

describe("useAddTrustline", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockLoadAccount.mockResolvedValue({ sequenceNumber: () => "123" })
    mockFetchBaseFee.mockResolvedValue(100)
    mockSignTransaction.mockResolvedValue("signed_xdr")
    mockSubmitTransaction.mockResolvedValue({ hash: "tx_hash", successful: true })
  })

  it("successfully adds a trustline", async () => {
    const { result } = renderHook(() => useAddTrustline(), { wrapper: TestProvider })

    let txResult
    await act(async () => {
      txResult = await result.current.addTrustline({ asset: ISSUED_ASSET })
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.result).toEqual({ hash: "tx_hash", status: "success" })
    expect(txResult).toEqual({ hash: "tx_hash", status: "success" })
    expect(mockLoadAccount).toHaveBeenCalledWith(TEST_ADDRESS)
    expect(mockSignTransaction).toHaveBeenCalledWith("xdr", {
      address: TEST_ADDRESS,
      network: "testnet",
      networkPassphrase: TESTNET_PASSPHRASE,
    })
    expect(mockSubmitTransaction).toHaveBeenCalledWith(mockSignedTx)
  })

  it("throws an error if wallet is not connected", async () => {
    const { result } = renderHook(() => useAddTrustline(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <StellarProvider network="testnet">{children}</StellarProvider>
      ),
    })

    const err = (await result.current
      .addTrustline({ asset: ISSUED_ASSET })
      .catch(e => e)) as Error & { code?: string }

    expect(err.message).toBe("Wallet not connected. Call connect() first.")
    expect(err.code).toBe(STELLAR_ERROR_CODES.WALLET_NOT_CONNECTED)
    // Guard-clause failures reject but do not populate `error` state — the hook
    // only records failures raised after the request starts, matching
    // useSendPayment. See the note in the PR if this contract should change.
    expect(result.current.error).toBeNull()
  })

  it("throws an error for native asset", async () => {
    const { result } = renderHook(() => useAddTrustline(), { wrapper: TestProvider })

    const err = (await result.current
      // @ts-expect-error - testing invalid input
      .addTrustline({ asset: "XLM" })
      .catch(e => e)) as Error & { code?: string }

    expect(err.message).toBe(
      "Invalid asset. Trustlines can only be created for issued assets, not XLM."
    )
    expect(err.code).toBe(STELLAR_ERROR_CODES.VALIDATION_ERROR)
    // Guard-clause failure: rejects without populating `error` state.
    expect(result.current.error).toBeNull()
  })

  it("handles transaction submission failure", async () => {
    const submissionError = new Error("Submission failed")
    mockSubmitTransaction.mockRejectedValue(submissionError)
    const { result } = renderHook(() => useAddTrustline(), { wrapper: TestProvider })

    // Inside act(), or the setError in the hook's catch has not been flushed by
    // the time the assertions below read `result.current`.
    await act(async () => {
      await expect(result.current.addTrustline({ asset: ISSUED_ASSET })).rejects.toThrow(
        submissionError
      )
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.result).toBeNull()
    expect(result.current.error).not.toBeNull()
    // "Submission failed" matches no classifier, so toStellarError falls through
    // to UNKNOWN, which preserves the original message.
    expect(result.current.error?.message).toBe("Submission failed")
  })

  it("handles signing rejection", async () => {
    const signingError = new Error("User rejected")
    mockSignTransaction.mockRejectedValue(signingError)
    const { result } = renderHook(() => useAddTrustline(), { wrapper: TestProvider })

    // toStellarError classifies anything containing "rejected" as
    // WALLET_REQUEST_REJECTED and substitutes the standard copy, so the raw
    // "User rejected" string does not survive — the code is what to assert on.
    await act(async () => {
      await expect(result.current.addTrustline({ asset: ISSUED_ASSET })).rejects.toThrow(
        "The request was rejected in the wallet."
      )
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.result).toBeNull()
    expect(result.current.error).not.toBeNull()
    expect(result.current.error?.code).toBe(STELLAR_ERROR_CODES.WALLET_REQUEST_REJECTED)
    expect(signingError.message).toBe("User rejected")
  })

  it("resets state when reset() is called", async () => {
    const { result } = renderHook(() => useAddTrustline(), { wrapper: TestProvider })

    await act(async () => {
      await result.current.addTrustline({ asset: ISSUED_ASSET })
    })

    expect(result.current.result).not.toBeNull()

    act(() => {
      result.current.reset()
    })

    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
