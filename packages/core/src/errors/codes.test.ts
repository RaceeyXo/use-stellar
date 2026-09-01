import {
  STELLAR_ERROR_CODES,
  DEFAULT_ERROR_MESSAGES,
  isStellarErrorCode,
  type StellarErrorCode,
} from "./codes"

describe("STELLAR_ERROR_CODES", () => {
  it("uses each code's value as its own key", () => {
    for (const code of Object.values(STELLAR_ERROR_CODES)) {
      expect(STELLAR_ERROR_CODES[code]).toBe(code)
    }
  })

  it("provides a default message for every code", () => {
    for (const code of Object.values(STELLAR_ERROR_CODES)) {
      expect(DEFAULT_ERROR_MESSAGES[code]).toEqual(expect.any(String))
    }
  })
})

describe("isStellarErrorCode", () => {
  it("accepts every valid code", () => {
    for (const code of Object.values(STELLAR_ERROR_CODES)) {
      expect(isStellarErrorCode(code)).toBe(true)
    }
  })

  it("is a type guard that narrows to StellarErrorCode", () => {
    const value: unknown = STELLAR_ERROR_CODES.WALLET_NOT_CONNECTED
    if (isStellarErrorCode(value)) {
      const narrowed: StellarErrorCode = value
      expect(DEFAULT_ERROR_MESSAGES[narrowed]).toEqual(expect.any(String))
    }
  })

  it.each([null, undefined, 42, {}, [], true])("rejects the non-string %p", value => {
    expect(isStellarErrorCode(value)).toBe(false)
  })

  it.each(["", "NOT_A_CODE", "network_error", "NETWORK", "RATE_LIMITED "])(
    "rejects the string %p",
    value => {
      expect(isStellarErrorCode(value)).toBe(false)
    }
  )
})
