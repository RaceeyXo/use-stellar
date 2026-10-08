/* eslint-disable */
import { createWalletConnectAdapter } from "./walletConnectAdapter"

describe("walletConnectAdapter", () => {
  it("creates a walletconnect adapter", () => {
    const adapter = createWalletConnectAdapter({
      projectId: "test",
      metadata: {
        name: "Test",
        description: "Test App",
        url: "https://test.com",
        icons: [],
      },
    })

    expect(adapter.metadata.type).toBe("walletconnect")
    expect(adapter.metadata.supported).toBe(true)
    expect(adapter.metadata.platforms).toContain("web")
  })
})
