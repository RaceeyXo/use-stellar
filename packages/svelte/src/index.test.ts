import { createStellarSvelte, STELLAR_SVELTE_NETWORK } from "./index"

test("defaults to testnet and does not reference React", () => {
  expect(STELLAR_SVELTE_NETWORK).toBe("testnet")
  expect(createStellarSvelte().network).toBe("testnet")
  expect(createStellarSvelte({ network: "testnet" }).network).toBe("testnet")
})
