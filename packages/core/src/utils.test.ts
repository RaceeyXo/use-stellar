import {
  isBrowser,
  isValidStellarAddress,
  shortenAddress,
  formatAmount,
  formatAssetCode,
} from "./utils"

// ── isBrowser ─────────────────────────────────────────────────────────────
describe("isBrowser", () => {
  it("returns true in jsdom (window is defined)", () => {
    expect(isBrowser()).toBe(true)
  })
})

// ── isValidStellarAddress ──────────────────────────────────────────────────
describe("isValidStellarAddress", () => {
  const VALID = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"

  it("accepts a valid G address", () => expect(isValidStellarAddress(VALID)).toBe(true))
  it("rejects an S (secret) key", () =>
    expect(isValidStellarAddress("S" + VALID.slice(1))).toBe(false))
  it("rejects an address too short", () => expect(isValidStellarAddress("GABC")).toBe(false))
  it("rejects an empty string", () => expect(isValidStellarAddress("")).toBe(false))
  it("rejects lowercase", () => expect(isValidStellarAddress(VALID.toLowerCase())).toBe(false))
})

// ── shortenAddress ─────────────────────────────────────────────────────────
describe("shortenAddress", () => {
  const ADDR = "GDWT6V543ZVXYNECWWUZ34ZHLJJ6OHGQXVYXJWD6WP7NOF65BT7GSUU5"

  it("returns first and last N chars with ...", () => {
    const result = shortenAddress(ADDR, 4)
    // Derived from ADDR rather than pasted, so swapping the fixture address
    // cannot silently break the assertion.
    expect(result).toBe(`${ADDR.slice(0, 4)}...${ADDR.slice(-4)}`)
  })

  it("defaults to 6 chars each side", () => {
    const result = shortenAddress(ADDR)
    expect(result.startsWith(ADDR.slice(0, 6))).toBe(true)
    expect(result.endsWith(ADDR.slice(-6))).toBe(true)
    expect(result.includes("...")).toBe(true)
  })

  it("returns empty string for empty input", () => {
    expect(shortenAddress("")).toBe("")
  })
})

// ── formatAmount ───────────────────────────────────────────────────────────
describe("formatAmount", () => {
  it("trims trailing zeros", () => expect(formatAmount("1.0000000")).toBe("1"))
  it("keeps significant decimals", () => expect(formatAmount("1.2345000")).toBe("1.2345"))
  it("handles invalid input", () => expect(formatAmount("abc")).toBe("0"))
  it("handles zero", () => expect(formatAmount("0.0000000")).toBe("0"))
})

// ── formatAssetCode ────────────────────────────────────────────────────────
describe("formatAssetCode", () => {
  it("returns XLM for native asset", () => expect(formatAssetCode("XLM")).toBe("XLM"))
  it("returns code for issued asset", () => {
    expect(formatAssetCode({ code: "USDC", issuer: "GABC..." })).toBe("USDC")
  })
})
