import { StellarError, isStellarError } from "./StellarError"
import { DEFAULT_ERROR_MESSAGES, STELLAR_ERROR_CODES } from "./codes"

describe("StellarError", () => {
  it("constructs with a code and resolves the default message", () => {
    const err = new StellarError("NO_TRUSTLINE")
    expect(err.code).toBe("NO_TRUSTLINE")
    expect(err.message).toBe(DEFAULT_ERROR_MESSAGES.NO_TRUSTLINE)
  })

  it("keeps a custom message when one is provided", () => {
    const err = new StellarError("WRONG_NETWORK", "Switch to testnet")
    expect(err.message).toBe("Switch to testnet")
  })

  it("sets name to StellarError", () => {
    const err = new StellarError("UNKNOWN")
    expect(err.name).toBe("StellarError")
  })

  it("is an instance of Error and StellarError", () => {
    const err = new StellarError("NETWORK_ERROR")
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(StellarError)
  })

  it("attaches the raw error and transaction hash options", () => {
    const raw = { response: { status: 429 } }
    const err = new StellarError("RATE_LIMITED", undefined, { raw, hash: "0xabc" })
    expect(err.raw).toBe(raw)
    expect(err.hash).toBe("0xabc")
  })

  it("defaults raw and hash to undefined", () => {
    const err = new StellarError("UNKNOWN")
    expect(err.raw).toBeUndefined()
    expect(err.hash).toBeUndefined()
  })

  it("can be thrown and caught, and still matches instanceof", () => {
    let caught: unknown
    try {
      throw new StellarError("ACCOUNT_NOT_FOUND")
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(StellarError)
    expect(caught).toBeInstanceOf(Error)
    expect((caught as StellarError).code).toBe("ACCOUNT_NOT_FOUND")
    expect((caught as StellarError).message).toBe(DEFAULT_ERROR_MESSAGES.ACCOUNT_NOT_FOUND)
  })

  it("constructs correctly for every known error code", () => {
    for (const code of Object.values(STELLAR_ERROR_CODES)) {
      const err = new StellarError(code)
      expect(err.code).toBe(code)
      expect(err.message).toBe(DEFAULT_ERROR_MESSAGES[code])
    }
  })
})

describe("isStellarError", () => {
  it("recognises real StellarError instances", () => {
    expect(isStellarError(new StellarError("UNKNOWN"))).toBe(true)
  })

  it("recognises a plain object carrying a known code and a message", () => {
    expect(isStellarError({ code: "RATE_LIMITED", message: "slow down" })).toBe(true)
  })

  it("rejects null, primitives, and objects without both code and message", () => {
    expect(isStellarError(null)).toBe(false)
    expect(isStellarError("RATE_LIMITED")).toBe(false)
    expect(isStellarError(42)).toBe(false)
    expect(isStellarError({ code: "RATE_LIMITED" })).toBe(false)
    expect(isStellarError({ message: "no code here" })).toBe(false)
  })

  it("rejects objects carrying an unknown code", () => {
    expect(isStellarError({ code: "NOT_A_CODE", message: "nope" })).toBe(false)
    expect(isStellarError(new Error("plain"))).toBe(false)
  })
})
