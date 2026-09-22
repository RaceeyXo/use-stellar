import { Keypair } from "@stellar/stellar-sdk"

// This test verifies that a module-scoped mock implementation (Keypair.random)
// remains implemented across multiple tests in the same file. On the broken
// config (with resetMocks: true) the second test would fail because Jest
// strips the mock implementation between tests.

test("module-scope mock returns a keypair (first test)", () => {
  const kp = Keypair.random()
  expect(typeof kp).toBe("object")
  expect(typeof kp.publicKey).toBe("function")
  expect(kp.publicKey()).toMatch(/^G[A-Z0-9]{55}$/)
})

test("module-scope mock still returns a keypair (second test)", () => {
  const kp = Keypair.random()
  expect(typeof kp).toBe("object")
  expect(typeof kp.publicKey).toBe("function")
  expect(kp.publicKey()).toMatch(/^G[A-Z0-9]{55}$/)
})
