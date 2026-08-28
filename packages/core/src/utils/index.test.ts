import { describe, expect, it } from "vitest"
import { StrKey } from "@stellar/stellar-sdk"
import { isValidStellarAddress, getAddressType } from "./index"
const ed = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 1))
const mx = StrKey.encodeMed25519PublicKey(Buffer.alloc(32, 1))
const ct = StrKey.encodeContract(Buffer.alloc(32, 1))
const bad = "G" + "0".repeat(55)
describe("address validation", () => {
  it("validates and classifies", () => {
    expect(isValidStellarAddress(bad)).toBe(false)
    expect(isValidStellarAddress(ed)).toBe(true)
    const mut = ed.slice(0, -1) + (ed.endsWith("A") ? "B" : "A")
    expect(isValidStellarAddress(mut)).toBe(false)
    expect(isValidStellarAddress(mx)).toBe(true)
    expect(isValidStellarAddress(ct)).toBe(true)
    expect(isValidStellarAddress("")).toBe(false)
    expect(isValidStellarAddress(null as unknown as string)).toBe(false)
    expect(isValidStellarAddress(undefined as unknown as string)).toBe(false)
    expect(isValidStellarAddress(123 as unknown as string)).toBe(false)
    expect(getAddressType(ed)).toBe("ed25519")
    expect(getAddressType(mx)).toBe("muxed")
    expect(getAddressType(ct)).toBe("contract")
    expect(getAddressType(bad)).toBeNull()
    expect(getAddressType(null as unknown as string)).toBeNull()
  })
})
