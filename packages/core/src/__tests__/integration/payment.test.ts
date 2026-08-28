jest.unmock("@stellar/stellar-sdk")
/**
 * @jest-environment node
 */
import {
  Keypair,
  Horizon,
  TransactionBuilder,
  Networks,
  Asset,
  Operation,
} from "@stellar/stellar-sdk"

jest.setTimeout(120000) // 2 minutes, as we have to fund twice and submit a tx

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

describe("Integration: Payment Flow", () => {
  const server = new Horizon.Server("https://horizon-testnet.stellar.org")

  it("should use the real SDK (unmocked)", () => {
    const key1 = Keypair.random().publicKey()
    const key2 = Keypair.random().publicKey()
    expect(key1).not.toBe(key2)
  })

  it("should successfully send 10 XLM from account A to account B", async () => {
    // 1. Generate keypairs for Alice and Bob
    const alice = Keypair.random()
    const bob = Keypair.random()

    // 2. Fund both accounts via Friendbot
    await fundWithFriendbot(alice.publicKey())
    await fundWithFriendbot(bob.publicKey())

    // 3. Verify Bob's initial balance
    let bobAccount = await server.loadAccount(bob.publicKey())
    const initialBalanceObj = bobAccount.balances.find(
      (b: { asset_type: string; balance: string }) => b.asset_type === "native"
    )
    const initialBalance = parseFloat(initialBalanceObj!.balance)

    // 4. Build and submit the payment transaction from Alice
    const aliceAccount = await server.loadAccount(alice.publicKey())
    const fee = await server.fetchBaseFee()

    const transaction = new TransactionBuilder(aliceAccount, {
      fee: fee.toString(),
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.payment({
          destination: bob.publicKey(),
          asset: Asset.native(),
          amount: "10",
        })
      )
      .setTimeout(30)
      .build()

    // Never let these tests touch mainnet
    expect(Networks.TESTNET).toBe("Test SDF Network ; September 2015")
    expect(transaction.networkPassphrase).toBe(Networks.TESTNET)

    transaction.sign(alice)
    const txResult = await server.submitTransaction(transaction)
    expect(txResult.successful).toBe(true)

    // 5. Verify Bob's balance increased by 10 XLM
    bobAccount = await server.loadAccount(bob.publicKey())
    const finalBalanceObj = bobAccount.balances.find(
      (b: { asset_type: string; balance: string }) => b.asset_type === "native"
    )
    const finalBalance = parseFloat(finalBalanceObj!.balance)

    expect(finalBalance).toBeCloseTo(initialBalance + 10, 5)
  })
})
