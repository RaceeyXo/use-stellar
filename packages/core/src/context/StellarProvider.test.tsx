import { renderHook } from "@testing-library/react"
import React from "react"
import { StellarProvider, useStellarContext } from "./StellarProvider"
import { useNetwork } from "../hooks/useNetwork"

// ── Wrapper helpers ────────────────────────────────────────────────────────

function makeWrapper(props: Omit<React.ComponentProps<typeof StellarProvider>, "children">) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(StellarProvider, { ...props, children })
  }
}

// ── Default config ─────────────────────────────────────────────────────────

describe("StellarProvider — default config", () => {
  it("uses testnet as the default network", () => {
    const { result } = renderHook(() => useNetwork(), {
      wrapper: makeWrapper({}),
    })

    expect(result.current.network).toBe("testnet")
    expect(result.current.isTestnet).toBe(true)
    expect(result.current.isMainnet).toBe(false)
  })

  it("resolves the built-in SDF testnet endpoints when no override is given", () => {
    const { result } = renderHook(() => useNetwork(), {
      wrapper: makeWrapper({ network: "testnet" }),
    })

    expect(result.current.networkConfig.horizonUrl).toBe("https://horizon-testnet.stellar.org")
    expect(result.current.networkConfig.sorobanUrl).toBe("https://soroban-testnet.stellar.org")
    expect(result.current.networkConfig.network).toBe("testnet")
  })

  it("resolves the built-in SDF mainnet endpoints when network='mainnet'", () => {
    const { result } = renderHook(() => useNetwork(), {
      wrapper: makeWrapper({ network: "mainnet" }),
    })

    expect(result.current.networkConfig.horizonUrl).toBe("https://horizon.stellar.org")
    expect(result.current.networkConfig.sorobanUrl).toBe("https://soroban.stellar.org")
    expect(result.current.networkConfig.network).toBe("mainnet")
    expect(result.current.isMainnet).toBe(true)
    expect(result.current.isTestnet).toBe(false)
  })
})

// ── Custom config ──────────────────────────────────────────────────────────

describe("StellarProvider — custom networkConfig", () => {
  const CUSTOM_HORIZON = "https://horizon.my-node.example.com"
  const CUSTOM_SOROBAN = "https://rpc.my-node.example.com"

  it("exposes custom horizonUrl via useNetwork()", () => {
    const { result } = renderHook(() => useNetwork(), {
      wrapper: makeWrapper({
        network: "mainnet",
        networkConfig: { horizonUrl: CUSTOM_HORIZON, sorobanUrl: CUSTOM_SOROBAN },
      }),
    })

    expect(result.current.networkConfig.horizonUrl).toBe(CUSTOM_HORIZON)
  })

  it("exposes custom sorobanUrl via useNetwork()", () => {
    const { result } = renderHook(() => useNetwork(), {
      wrapper: makeWrapper({
        network: "mainnet",
        networkConfig: { horizonUrl: CUSTOM_HORIZON, sorobanUrl: CUSTOM_SOROBAN },
      }),
    })

    expect(result.current.networkConfig.sorobanUrl).toBe(CUSTOM_SOROBAN)
  })

  it("preserves the network name in the resolved config", () => {
    const { result } = renderHook(() => useNetwork(), {
      wrapper: makeWrapper({
        network: "mainnet",
        networkConfig: { horizonUrl: CUSTOM_HORIZON, sorobanUrl: CUSTOM_SOROBAN },
      }),
    })

    expect(result.current.networkConfig.network).toBe("mainnet")
    expect(result.current.isMainnet).toBe(true)
  })

  it("works with custom testnet endpoints too", () => {
    const CUSTOM_TESTNET_HORIZON = "https://horizon.private-testnet.example.com"
    const CUSTOM_TESTNET_SOROBAN = "https://rpc.private-testnet.example.com"

    const { result } = renderHook(() => useNetwork(), {
      wrapper: makeWrapper({
        network: "testnet",
        networkConfig: {
          horizonUrl: CUSTOM_TESTNET_HORIZON,
          sorobanUrl: CUSTOM_TESTNET_SOROBAN,
        },
      }),
    })

    expect(result.current.networkConfig.horizonUrl).toBe(CUSTOM_TESTNET_HORIZON)
    expect(result.current.networkConfig.sorobanUrl).toBe(CUSTOM_TESTNET_SOROBAN)
    expect(result.current.isTestnet).toBe(true)
  })

  it("trims whitespace from custom URLs", () => {
    const { result } = renderHook(() => useNetwork(), {
      wrapper: makeWrapper({
        network: "mainnet",
        networkConfig: {
          horizonUrl: "  https://horizon.my-node.example.com  ",
          sorobanUrl: "  https://rpc.my-node.example.com  ",
        },
      }),
    })

    expect(result.current.networkConfig.horizonUrl).toBe(CUSTOM_HORIZON)
    expect(result.current.networkConfig.sorobanUrl).toBe(CUSTOM_SOROBAN)
  })
})

// ── Invalid config ─────────────────────────────────────────────────────────

describe("StellarProvider — invalid networkConfig", () => {
  // Suppress React's error boundary console output during these tests
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    const consoleErrorMock = console.error as jest.Mock
    consoleErrorMock.mockRestore()
  })

  it("throws when horizonUrl is missing", () => {
    expect(() =>
      renderHook(() => useNetwork(), {
        wrapper: makeWrapper({
          network: "mainnet",
          // @ts-expect-error — intentionally testing runtime validation
          networkConfig: { sorobanUrl: "https://rpc.my-node.example.com" },
        }),
      })
    ).toThrow(/`horizonUrl` is required/)
  })

  it("throws when sorobanUrl is missing", () => {
    expect(() =>
      renderHook(() => useNetwork(), {
        wrapper: makeWrapper({
          network: "mainnet",
          // @ts-expect-error — intentionally testing runtime validation
          networkConfig: { horizonUrl: "https://horizon.my-node.example.com" },
        }),
      })
    ).toThrow(/`sorobanUrl` is required/)
  })

  it("throws when horizonUrl is an empty string", () => {
    expect(() =>
      renderHook(() => useNetwork(), {
        wrapper: makeWrapper({
          network: "mainnet",
          networkConfig: {
            horizonUrl: "",
            sorobanUrl: "https://rpc.my-node.example.com",
          },
        }),
      })
    ).toThrow(/`horizonUrl` is required/)
  })

  it("throws when sorobanUrl is a blank string", () => {
    expect(() =>
      renderHook(() => useNetwork(), {
        wrapper: makeWrapper({
          network: "mainnet",
          networkConfig: {
            horizonUrl: "https://horizon.my-node.example.com",
            sorobanUrl: "   ",
          },
        }),
      })
    ).toThrow(/`sorobanUrl` is required/)
  })

  it("error message includes a usage hint", () => {
    expect(() =>
      renderHook(() => useNetwork(), {
        wrapper: makeWrapper({
          network: "mainnet",
          // @ts-expect-error — intentionally testing runtime validation
          networkConfig: { sorobanUrl: "https://rpc.my-node.example.com" },
        }),
      })
    ).toThrow(/Example:/)
  })
})

// ── useStellarContext outside provider ─────────────────────────────────────

describe("useStellarContext — outside provider", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    const consoleErrorMock = console.error as jest.Mock
    consoleErrorMock.mockRestore()
  })

  it("throws a descriptive error when used outside StellarProvider", () => {
    // renderHook with no wrapper — no provider in the tree
    expect(() => renderHook(() => useNetwork())).toThrow(/No StellarProvider found/)
  })
})

// ── Network passphrases ────────────────────────────────────────────────────

describe("StellarProvider — network passphrases", () => {
  it("resolves the testnet passphrase by default", () => {
    const { result } = renderHook(() => useStellarContext(), { wrapper: makeWrapper({}) })

    expect(result.current.networkConfig.networkPassphrase).toBe("Test SDF Network ; September 2015")
  })

  it("resolves the futurenet passphrase and endpoints", () => {
    const { result } = renderHook(() => useStellarContext(), {
      wrapper: makeWrapper({ network: "futurenet" }),
    })

    expect(result.current.networkConfig.networkPassphrase).toBe(
      "Test SDF Future Network ; October 2022"
    )
    expect(result.current.networkConfig.horizonUrl).toBe("https://horizon-futurenet.stellar.org")
  })

  it("resolves a custom passphrase for a standalone node", () => {
    const { result } = renderHook(() => useStellarContext(), {
      wrapper: makeWrapper({
        network: "custom",
        networkConfig: {
          horizonUrl: "http://localhost:8000",
          sorobanUrl: "http://localhost:8000/soroban/rpc",
          networkPassphrase: "Standalone Network ; February 2017",
        },
      }),
    })

    expect(result.current.networkConfig.networkPassphrase).toBe(
      "Standalone Network ; February 2017"
    )
    expect(result.current.networkConfig.network).toBe("custom")
  })

  it("keeps a known network's passphrase when only the URLs are overridden", () => {
    const { result } = renderHook(() => useStellarContext(), {
      wrapper: makeWrapper({
        network: "testnet",
        networkConfig: {
          horizonUrl: "https://horizon.my-node.com",
          sorobanUrl: "https://rpc.my-node.com",
        },
      }),
    })

    expect(result.current.networkConfig.networkPassphrase).toBe("Test SDF Network ; September 2015")
    expect(result.current.networkConfig.horizonUrl).toBe("https://horizon.my-node.com")
  })

  it("throws at render when a custom network has no passphrase", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})

    expect(() =>
      renderHook(() => useStellarContext(), {
        wrapper: makeWrapper({
          network: "custom",
          networkConfig: {
            horizonUrl: "http://localhost:8000",
            sorobanUrl: "http://localhost:8000/soroban/rpc",
          },
        }),
      })
    ).toThrow(/networkPassphrase/)

    consoleError.mockRestore()
  })

  it("throws at render when a custom network has no networkConfig at all", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {})

    expect(() =>
      renderHook(() => useStellarContext(), {
        wrapper: makeWrapper({ network: "custom" }),
      })
    ).toThrow(/requires a networkConfig/)

    consoleError.mockRestore()
  })
})

describe("StellarProvider — memoized context value", () => {
  it("preserves the context value identity across rerenders with unchanged props", () => {
    const { result, rerender } = renderHook(() => useStellarContext(), {
      wrapper: makeWrapper({ network: "testnet" }),
    })
    const initialValue = result.current

    rerender()

    expect(result.current).toBe(initialValue)
  })

  it("changes the context value identity when the network changes", () => {
    let network: "testnet" | "futurenet" = "testnet"
    function NetworkWrapper({ children }: { children: React.ReactNode }) {
      return <StellarProvider network={network}>{children}</StellarProvider>
    }

    const { result, rerender } = renderHook(() => useStellarContext(), {
      wrapper: NetworkWrapper,
    })
    const initialValue = result.current

    network = "futurenet"
    rerender()

    expect(result.current).not.toBe(initialValue)
    expect(result.current.network).toBe("futurenet")
  })
})
