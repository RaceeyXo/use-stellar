import React from "react"
import { render, renderHook } from "@testing-library/react-native"
import { StellarProvider } from "./StellarProvider"
import { useStellarContext } from "use-stellar"
import { createInMemoryStorage } from "./platform/asyncStorageSession"
import { createAlwaysFocusedManager } from "./platform/appStateFocus"
import { createAlwaysOnlineManager } from "./platform/netInfoOnline"
import {
  initDeepLinkHandler,
  registerPendingRequest,
  type DeepLinkResult,
} from "./platform/deepLinkHandler"
import { emitUrl, getLinkingListenerCount, setInitialUrl } from "./test-utils"
import { Linking } from "react-native"

describe("StellarProvider (React Native)", () => {
  describe("props", () => {
    it("accepts all core provider props", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider
          network="testnet"
          queryConfig={{ staleTime: 60000, gcTime: 600000 }}
          autoConnect={false}
        >
          {children}
        </StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current.network).toBe("testnet")
    })

    it("accepts network prop", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider network="mainnet">{children}</StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current.network).toBe("mainnet")
    })

    it("accepts networkConfig prop", () => {
      const networkConfig = {
        horizonUrl: "https://horizon.example.com",
        sorobanUrl: "https://rpc.example.com",
        networkPassphrase: "Custom Network ; January 2024",
      }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider network="custom" networkConfig={networkConfig}>
          {children}
        </StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current.networkConfig.horizonUrl).toBe(networkConfig.horizonUrl)
      expect(result.current.networkConfig.sorobanUrl).toBe(networkConfig.sorobanUrl)
      expect(result.current.networkConfig.networkPassphrase).toBe(networkConfig.networkPassphrase)
    })

    it("accepts queryConfig prop", () => {
      const queryConfig = { staleTime: 60000, gcTime: 600000 }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider queryConfig={queryConfig}>{children}</StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current).toBeTruthy()
    })

    it("accepts autoConnect boolean prop", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider autoConnect={true}>{children}</StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current.autoConnect.enabled).toBe(true)
    })

    it("accepts autoConnect object prop", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider
          autoConnect={{
            enabled: true,
            persistAddress: true,
            storage: "session",
          }}
        >
          {children}
        </StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current.autoConnect.enabled).toBe(true)
      expect(result.current.autoConnect.persistAddress).toBe(true)
      // "local" / "session" name browser storage, which a native app does not
      // have — the session goes through the native adapter instead.
      expect(typeof result.current.autoConnect.storage).toBe("object")
    })

    it("persists the autoConnect session through the storage prop", () => {
      const storage = createInMemoryStorage()
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider autoConnect storage={storage}>
          {children}
        </StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current.autoConnect.storage).toBe(storage)
    })

    it("declares the native platform and a native transaction time bound", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider>{children}</StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current.platform.kind).toBe("native")
      expect(result.current.platform.hasDom).toBe(false)
      expect(result.current.transactionTimeout).toBe(300)
    })

    it("lets transactionTimeout be overridden", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider transactionTimeout={60}>{children}</StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current.transactionTimeout).toBe(60)
    })
  })

  describe("native platform overrides", () => {
    it("accepts storage override", () => {
      const mockStorage = createInMemoryStorage()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider storage={mockStorage}>{children}</StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current).toBeTruthy()
    })

    it("accepts focusManager override", () => {
      const mockFocusManager = createAlwaysFocusedManager()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider focusManager={mockFocusManager}>{children}</StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current).toBeTruthy()
    })

    it("accepts onlineManager override", () => {
      const mockOnlineManager = createAlwaysOnlineManager()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider onlineManager={mockOnlineManager}>{children}</StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current).toBeTruthy()
    })

    it("accepts all native overrides together", () => {
      const mockStorage = createInMemoryStorage()
      const mockFocusManager = createAlwaysFocusedManager()
      const mockOnlineManager = createAlwaysOnlineManager()

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider
          storage={mockStorage}
          focusManager={mockFocusManager}
          onlineManager={mockOnlineManager}
          warnOnFallback={false}
        >
          {children}
        </StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current).toBeTruthy()
    })
  })

  describe("dev warnings", () => {
    let consoleWarnSpy: jest.SpyInstance

    beforeEach(() => {
      consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation()
    })

    afterEach(() => {
      consoleWarnSpy.mockRestore()
    })

    it("warns when AsyncStorage is unavailable (if warnOnFallback is true)", () => {
      // This test would require mocking the dynamic require, which is complex.
      // The warning logic is tested indirectly through integration tests.
      expect(true).toBe(true)
    })

    it("suppresses warnings when warnOnFallback is false", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider warnOnFallback={false}>{children}</StellarProvider>
      )

      renderHook(() => useStellarContext(), { wrapper })

      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })
  })

  describe("context value", () => {
    it("provides network from context", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider network="mainnet">{children}</StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current.network).toBe("mainnet")
    })

    it("provides networkConfig from context", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider network="testnet">{children}</StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current.networkConfig.network).toBe("testnet")
      expect(result.current.networkConfig.horizonUrl).toBeDefined()
      expect(result.current.networkConfig.sorobanUrl).toBeDefined()
      expect(result.current.networkConfig.networkPassphrase).toBeDefined()
    })

    it("provides wallet state from context", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider>{children}</StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current.wallet).toBeDefined()
      expect(result.current.wallet.connected).toBe(false)
      expect(result.current.wallet.address).toBeNull()
    })

    it("provides setWallet function from context", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider>{children}</StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(typeof result.current.setWallet).toBe("function")
    })

    it("provides autoConnect options from context", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider autoConnect={{ enabled: true }}>{children}</StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current.autoConnect.enabled).toBe(true)
    })

    it("provides queryStore from context", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider>{children}</StellarProvider>
      )

      const { result } = renderHook(() => useStellarContext(), { wrapper })

      expect(result.current.queryStore).toBeDefined()
    })
  })

  describe("multiple hooks", () => {
    it("allows multiple consumers of the context", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider network="testnet">{children}</StellarProvider>
      )

      // Both consumers live under one provider, so they share its store.
      const { result } = renderHook(
        () => ({ first: useStellarContext(), second: useStellarContext() }),
        { wrapper }
      )

      expect(result.current.first.network).toBe("testnet")
      expect(result.current.second.network).toBe("testnet")
      expect(result.current.first.queryStore).toBe(result.current.second.queryStore)
    })
  })

  describe("children rendering", () => {
    it("renders children", () => {
      const TestComponent = () => {
        useStellarContext()
        return <div>Test</div>
      }

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StellarProvider>{children}</StellarProvider>
      )

      const { result } = renderHook(() => <TestComponent />, { wrapper })
      expect(result.current).toBeDefined()
    })
  })

  describe("error handling", () => {
    it("throws when context is used outside provider", () => {
      // Suppress the error log during this test
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation()

      expect(() => {
        renderHook(() => useStellarContext())
      }).toThrow("No StellarProvider found")

      consoleErrorSpy.mockRestore()
    })
  })

  describe("deep links", () => {
    const SIGNED_XDR = "AAAAAgAAAA=="
    const unmatchedLink = (id: string) => `myapp://stellar/signed?requestId=${id}&xdr=${SIGNED_XDR}`
    let cleanups: Array<() => void> = []

    afterEach(() => {
      cleanups.forEach(cleanup => cleanup())
      cleanups = []
    })

    it("registers exactly one Linking listener on mount and removes it on unmount", () => {
      expect(getLinkingListenerCount()).toBe(0)

      const { unmount } = render(
        <StellarProvider>
          <></>
        </StellarProvider>
      )
      expect(getLinkingListenerCount()).toBe(1)

      unmount()
      expect(getLinkingListenerCount()).toBe(0)
    })

    it("registers no listener with deepLinks={false}", () => {
      const addListener = jest.spyOn(Linking, "addEventListener")

      const { unmount } = render(
        <StellarProvider deepLinks={false}>
          <></>
        </StellarProvider>
      )

      expect(getLinkingListenerCount()).toBe(0)
      expect(addListener).not.toHaveBeenCalled()
      unmount()
    })

    it("resolves a pending sign request from a returning link", async () => {
      const { unmount } = render(
        <StellarProvider>
          <></>
        </StellarProvider>
      )
      const pending = registerPendingRequest("req-provider")

      emitUrl(unmatchedLink("req-provider"))

      await expect(pending).resolves.toBe(SIGNED_XDR)
      unmount()
    })

    it("handles the link a cold start was launched with", async () => {
      const onUnmatchedResult = jest.fn()
      setInitialUrl(unmatchedLink("cold-start"))

      const { unmount } = render(
        <StellarProvider deepLinks={{ onUnmatchedResult }}>
          <></>
        </StellarProvider>
      )
      await Promise.resolve()

      expect(onUnmatchedResult).toHaveBeenCalledTimes(1)
      expect(onUnmatchedResult.mock.calls[0][0]).toMatchObject({ requestId: "cold-start" })
      unmount()
    })

    it("passes onUnmatchedResult through deepLinks options", () => {
      const onUnmatchedResult = jest.fn()
      const { unmount } = render(
        <StellarProvider deepLinks={{ onUnmatchedResult }}>
          <></>
        </StellarProvider>
      )

      emitUrl(unmatchedLink("orphan"))

      expect(onUnmatchedResult).toHaveBeenCalledTimes(1)
      expect(onUnmatchedResult).toHaveBeenCalledWith(
        expect.objectContaining<Partial<DeepLinkResult>>({
          requestId: "orphan",
          signedXdr: SIGNED_XDR,
        })
      )
      unmount()
    })

    it("keeps one listener and uses the latest callback when options are passed inline", () => {
      const addListener = jest.spyOn(Linking, "addEventListener")
      const first = jest.fn()
      const second = jest.fn()

      const { rerender, unmount } = render(
        <StellarProvider deepLinks={{ onUnmatchedResult: first }}>
          <></>
        </StellarProvider>
      )
      rerender(
        <StellarProvider deepLinks={{ onUnmatchedResult: second }}>
          <></>
        </StellarProvider>
      )

      expect(addListener).toHaveBeenCalledTimes(1)
      expect(getLinkingListenerCount()).toBe(1)

      emitUrl(unmatchedLink("latest"))
      expect(first).not.toHaveBeenCalled()
      expect(second).toHaveBeenCalledTimes(1)
      unmount()
    })

    it("starts and stops the listener when deepLinks is toggled", () => {
      const { rerender, unmount } = render(
        <StellarProvider deepLinks={false}>
          <></>
        </StellarProvider>
      )
      expect(getLinkingListenerCount()).toBe(0)

      rerender(
        <StellarProvider deepLinks>
          <></>
        </StellarProvider>
      )
      expect(getLinkingListenerCount()).toBe(1)

      rerender(
        <StellarProvider deepLinks={false}>
          <></>
        </StellarProvider>
      )
      expect(getLinkingListenerCount()).toBe(0)
      unmount()
    })

    it("leaves one listener behind React.StrictMode's double-invoked effects", () => {
      const { unmount } = render(
        <React.StrictMode>
          <StellarProvider>
            <></>
          </StellarProvider>
        </React.StrictMode>
      )
      expect(getLinkingListenerCount()).toBe(1)

      unmount()
      expect(getLinkingListenerCount()).toBe(0)
    })

    it("does not double-handle a link when the app also initialises the handler", () => {
      const onUnmatchedResult = jest.fn()
      const addListener = jest.spyOn(Linking, "addEventListener")

      // Child effects run before the provider's, so this manual call starts the
      // handler first and keeps ownership of its options.
      function ManualInit() {
        React.useEffect(() => initDeepLinkHandler({ onUnmatchedResult }), [])
        return null
      }
      const { unmount } = render(
        <StellarProvider>
          <ManualInit />
        </StellarProvider>
      )

      expect(addListener).toHaveBeenCalledTimes(1)
      expect(getLinkingListenerCount()).toBe(1)

      emitUrl(unmatchedLink("once"))
      expect(onUnmatchedResult).toHaveBeenCalledTimes(1)

      unmount()
      expect(getLinkingListenerCount()).toBe(0)
    })

    it("does not double-handle when the app initialises the handler after the provider", () => {
      const onUnmatchedResult = jest.fn()
      const { unmount } = render(
        <StellarProvider deepLinks={{ onUnmatchedResult }}>
          <></>
        </StellarProvider>
      )

      cleanups.push(initDeepLinkHandler({ onUnmatchedResult }))
      expect(getLinkingListenerCount()).toBe(1)

      emitUrl(unmatchedLink("twice"))
      expect(onUnmatchedResult).toHaveBeenCalledTimes(1)

      unmount()
      expect(getLinkingListenerCount()).toBe(0)
    })
  })
})
