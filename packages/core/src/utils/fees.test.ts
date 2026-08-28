/**
 * Tests for the fee strategy shared by every hook that builds a Horizon
 * transaction. No network is involved — the base fee source is a stub.
 */

import { DEFAULT_FEE_MULTIPLIER, resolveFee } from "./fees"

function feeSource(baseFee: number | (() => never)) {
  return {
    fetchBaseFee: async () => {
      if (typeof baseFee === "function") return baseFee()
      return baseFee
    },
  }
}

describe("resolveFee — precedence", () => {
  it("uses an explicit fee verbatim, with no multiplier applied", async () => {
    await expect(resolveFee(feeSource(100), { fee: "10000" })).resolves.toBe("10000")
  })

  it("prefers an explicit fee over a multiplier", async () => {
    await expect(resolveFee(feeSource(100), { fee: "10000", feeMultiplier: 3 })).resolves.toBe(
      "10000"
    )
  })

  it("multiplies the fetched base fee when a multiplier is given", async () => {
    await expect(resolveFee(feeSource(100), { feeMultiplier: 10 })).resolves.toBe("1000")
  })

  it("applies the default multiplier when neither is given", async () => {
    await expect(resolveFee(feeSource(100))).resolves.toBe(String(100 * DEFAULT_FEE_MULTIPLIER))
  })

  it("tracks the network's base fee rather than a constant", async () => {
    // During surge pricing Horizon reports a higher floor; the bid follows it.
    await expect(resolveFee(feeSource(2500), { feeMultiplier: 2 })).resolves.toBe("5000")
  })

  it("rounds a fractional result up, never down", async () => {
    await expect(resolveFee(feeSource(101), { feeMultiplier: 1.5 })).resolves.toBe("152")
  })
})

describe("resolveFee — a failing base-fee fetch", () => {
  it("surfaces an error instead of silently bidding the network minimum", async () => {
    const boom = () => {
      throw new Error("Network Error")
    }

    await expect(resolveFee(feeSource(boom))).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    })
  })

  it("points the caller at the escape hatch", async () => {
    const boom = () => {
      throw new Error("Network Error")
    }

    await expect(resolveFee(feeSource(boom))).rejects.toThrow(/Pass an explicit `fee`/)
  })

  it("rejects an unusable base fee rather than building on it", async () => {
    await expect(resolveFee(feeSource(0))).rejects.toMatchObject({ code: "NETWORK_ERROR" })
    await expect(resolveFee(feeSource(Number.NaN))).rejects.toMatchObject({
      code: "NETWORK_ERROR",
    })
  })

  it("still honours an explicit fee when the fetch would fail", async () => {
    const boom = () => {
      throw new Error("Network Error")
    }

    // No fetch is attempted at all when the caller pinned the fee.
    await expect(resolveFee(feeSource(boom), { fee: "5000" })).resolves.toBe("5000")
  })
})

describe("resolveFee — validation", () => {
  it.each(["", "0", "-100", "abc", "1.5", " "])("rejects the fee %p", async fee => {
    await expect(resolveFee(feeSource(100), { fee })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    })
  })

  it("accepts a fee with surrounding whitespace", async () => {
    await expect(resolveFee(feeSource(100), { fee: " 10000 " })).resolves.toBe("10000")
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects the multiplier %p",
    async feeMultiplier => {
      await expect(resolveFee(feeSource(100), { feeMultiplier })).rejects.toMatchObject({
        code: "VALIDATION_ERROR",
      })
    }
  )
})

describe("DEFAULT_FEE_MULTIPLIER", () => {
  it("bids above the network minimum", () => {
    // The whole point: the default must not be 1, which is the floor of the
    // auction and the value that fails under congestion.
    expect(DEFAULT_FEE_MULTIPLIER).toBeGreaterThan(1)
  })
})
