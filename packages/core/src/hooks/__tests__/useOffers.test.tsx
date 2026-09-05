
import { renderHook, waitFor, act } from "@testing-library/react"
import { useOffers } from "../useOffers"
import { StellarProvider } from "../../providers/StellarProvider"

const mockServer = {
  offers: () => ({
    forAccount: () => ({
      limit: () => ({
        order: () => ({
          call: vi.fn().mockResolvedValue({
            records: [
              {
                id: "123",
                seller: "GA...TESTNET",
                selling: { asset_type: "native" },
                buying: { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GB...TESTNET" },
                amount: "10.0000000",
                price: "0.5000000",
                price_r: { n: 1, d: 2 },
                paging_token: "pt_123"
              }
            ]
          })
        })
      })
    })
  })
}

describe("useOffers", () => {
  it("fetches and returns a list of active offers", async () => {
    const { result } = renderHook(() => useOffers({ address: "GA...TESTNET" }), {
      wrapper: ({ children }) => (
        <StellarProvider network="testnet" networkConfig={{ horizonUrl: "test", sorobanUrl: "test" }}>
          {children}
        </StellarProvider>
      )
    })

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.offers.length).toBe(1)
    expect(result.current.offers[0].id).toBe("123")
  })
})