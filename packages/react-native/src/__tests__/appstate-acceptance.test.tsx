/**
 * AppState Acceptance Test
 * ──────────────────────
 *
 * Demonstrates the harness in action: polling pauses when the app backgrounded.
 *
 * Acceptance Criteria:
 * - Polling begins when component renders
 * - Polling pauses when AppState changes to "background"
 * - No new polling activity while backgrounded
 * - Polling resumes when AppState returns to "active"
 */

import React, { useEffect, useState } from "react"
import { AppState, Text } from "react-native"
import { act } from "@testing-library/react-native"
import { renderWithStellar, setAppState, getAppStateListenerCount } from "../test-utils"
import {
  createMockHorizonServer,
  TESTNET_ADDRESS_A,
} from "../../../core/src/__mocks__/@stellar/stellar-sdk"

const POLL_INTERVAL = 1_000

describe("AppState acceptance: polling pauses when backgrounded", () => {
  let mockServer: ReturnType<typeof createMockHorizonServer>

  beforeEach(() => {
    mockServer = createMockHorizonServer()
  })

  /**
   * Polls an account on an interval while the app is active — the pattern a
   * real polling hook follows, driven by the harness's AppState mock.
   */
  function PollingComponent() {
    const [isActive, setIsActive] = useState(true)

    useEffect(() => {
      const subscription = AppState.addEventListener("change", state => {
        setIsActive(state === "active")
      })
      return () => subscription.remove()
    }, [])

    useEffect(() => {
      if (!isActive) return
      void mockServer.loadAccount(TESTNET_ADDRESS_A)
      const id = setInterval(() => void mockServer.loadAccount(TESTNET_ADDRESS_A), POLL_INTERVAL)
      return () => clearInterval(id)
    }, [isActive])

    return <Text testID="app-state">{isActive ? "active" : "backgrounded"}</Text>
  }

  it("pauses polling when app backgrounded", () => {
    const { getByTestId } = renderWithStellar(<PollingComponent />)

    // Initial poll should occur on render
    expect(getByTestId("app-state")).toHaveTextContent("active")
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(1)

    act(() => jest.advanceTimersByTime(POLL_INTERVAL))
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(2)

    // Background the app: no polls while backgrounded
    act(() => setAppState("background"))
    expect(getByTestId("app-state")).toHaveTextContent("backgrounded")
    act(() => jest.advanceTimersByTime(POLL_INTERVAL * 5))
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(2)

    // Restore to foreground: polling resumes
    act(() => setAppState("active"))
    expect(getByTestId("app-state")).toHaveTextContent("active")
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(3)
    act(() => jest.advanceTimersByTime(POLL_INTERVAL))
    expect(mockServer.loadAccount).toHaveBeenCalledTimes(4)
  })

  it("cleans up listeners on unmount", () => {
    const { unmount } = renderWithStellar(<PollingComponent />)
    const whileMounted = getAppStateListenerCount()
    expect(whileMounted).toBeGreaterThan(0)

    unmount()

    // The component's own AppState listener is removed.
    expect(getAppStateListenerCount()).toBe(whileMounted - 1)
  })
})
