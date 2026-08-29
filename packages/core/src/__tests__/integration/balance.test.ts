jest.unmock("@stellar/stellar-sdk")
/**
 * @jest-environment node
 */
import { Keypair, Horizon } from "@stellar/stellar-sdk"

// Increase timeout to 60 seconds to allow for network requests and ledger closures
jest.setTimeout(60000)

async function fundWithFriendbot(publicKey: string, retries = 3, delayMs = 2000): Promise<void> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`)
      if (response.ok) {
        return
      }
      const body = await response.text()
      if (i === retries - 1) {
        throw new Error(`Friendbot failed with status ${response.status}: ${body}`)
      }
      console.warn(`Friendbot failed (status ${response.status}), retrying in ${delayMs}ms...`)
    } catch (err) {
      if (i === retries - 1) {
        throw err
      }
      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn(`Friendbot request failed with error: ${errMsg}, retrying in ${delayMs}ms...`)
    }
    await new Promise(resolve => setTimeout(resolve, delayMs))
    delayMs *= 2 // backoff
  }
}

describe("Integration: Balance", () => {
  const server = new Horizon.Server("https://horizon-testnet.stellar.org")

  it("should use the real SDK (unmocked)", () => {
    const key1 = Keypair.random().publicKey()
    const key2 = Keypair.random().publicKey()
    expect(key1).not.toBe(key2)
  })

  it("should fund an account via friendbot and verify the balance", async () => {
    // 1. Generate a new keypair
    const keypair = Keypair.random()
    const publicKey = keypair.publicKey()

    // 2. Fund the account using Friendbot
    await fundWithFriendbot(publicKey)

    // 3. Call Horizon directly to get the balance
    const account = await server.loadAccount(publicKey)

    // Explicitly define the shape we care about to satisfy strict mode
    const nativeBalance = account.balances.find(
      (b: { asset_type: string; balance: string }) => b.asset_type === "native"
    )

    // Friendbot currently funds accounts with some positive XLM
    expect(nativeBalance).toBeDefined()
    expect(parseFloat(nativeBalance!.balance)).toBeGreaterThan(0)
  })
})
