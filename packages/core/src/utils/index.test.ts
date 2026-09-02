import { formatAmount } from "./index"

describe("formatAmount", () => {
  it.each([
    ["922337203685.4775807", "922337203685.4775807"],
    ["-922337203685.4775808", "-922337203685.4775808"],
    ["0.0000001", "0.0000001"],
    ["0.00000001", "0"],
  ])("preserves Stellar boundary amount %s without float precision loss", (amount, expected) => {
    expect(formatAmount(amount)).toBe(expected)
  })

  it("does not strip trailing integer zeros when decimals is zero", () => {
    expect(formatAmount("2500", 0)).toBe("2500")
  })

  it("trims trailing zeros only from the fractional part", () => {
    expect(formatAmount("1.5000000")).toBe("1.5")
  })

  it("truncates fractional digits beyond the requested precision", () => {
    expect(formatAmount("1.23456789")).toBe("1.2345678")
    expect(formatAmount("-12.3456", 2)).toBe("-12.34")
  })

  it.each(["not a number", "", "1e3", ".5", "1."])("returns zero for invalid input %p", amount => {
    expect(formatAmount(amount)).toBe("0")
  })

  it("normalizes zero after truncation", () => {
    expect(formatAmount("0")).toBe("0")
    expect(formatAmount("-0.00000001")).toBe("0")
  })
})
