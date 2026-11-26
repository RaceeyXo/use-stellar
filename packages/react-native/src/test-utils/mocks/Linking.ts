/**
 * React Native Linking Mock
 * ────────────────────────
 * Provides a controllable mock of React Native's Linking module.
 *
 * Enables tests to:
 * - Capture and assert on URL open attempts (e.g., wallet deep links)
 * - Simulate link opening success/failure
 * - Track all URLs opened during a test
 */

type UrlListener = (event: { url: string }) => void

interface MockLinking {
  openedUrls: string[]
  shouldSucceed: boolean
  listeners: Set<UrlListener>
  initialUrl: string | null
  openURL(url: string): Promise<void>
  canOpenURL(url: string): Promise<boolean>
  getInitialURL(): Promise<string | null>
  addEventListener(type: "url", listener: UrlListener): { remove(): void }
  reset(): void
}

/**
 * Singleton mock instance for Linking.
 * Tests inspect openedUrls to verify navigation side effects.
 */
const mockLinking: MockLinking = {
  openedUrls: [],
  shouldSucceed: true,
  listeners: new Set(),
  initialUrl: null,

  async openURL(url: string): Promise<void> {
    if (this.shouldSucceed) {
      this.openedUrls.push(url)
    } else {
      throw new Error(`Failed to open URL: ${url}`)
    }
  },

  async canOpenURL(_url: string): Promise<boolean> {
    return this.shouldSucceed
  },

  async getInitialURL(): Promise<string | null> {
    return this.initialUrl
  },

  addEventListener(_type: "url", listener: UrlListener) {
    this.listeners.add(listener)
    return { remove: () => void this.listeners.delete(listener) }
  },

  reset() {
    this.openedUrls = []
    this.shouldSucceed = true
    this.listeners.clear()
    this.initialUrl = null
  },
}

/**
 * Helper to simulate opening a URL and verify it was recorded.
 *
 * Tests can call this helper and then assert openURL was called:
 *
 * @example
 * await openUrl("https://example.com/auth")
 * expect(getOpenedUrls()).toContain("https://example.com/auth")
 */
export async function openUrl(url: string): Promise<void> {
  return mockLinking.openURL(url)
}

/**
 * Get all URLs that were opened during this test.
 *
 * @example
 * const urls = getOpenedUrls()
 * expect(urls).toHaveLength(1)
 * expect(urls[0]).toMatch(/wallet-connect/)
 */
export function getOpenedUrls(): string[] {
  return [...mockLinking.openedUrls]
}

/**
 * Set whether openURL should succeed or fail.
 *
 * @example
 * setLinkingSuccess(false)
 * await expect(openUrl("...")).rejects.toThrow()
 */
export function setLinkingSuccess(shouldSucceed: boolean): void {
  mockLinking.shouldSucceed = shouldSucceed
}

/**
 * Get the most recently opened URL, if any.
 */
export function getLastOpenedUrl(): string | undefined {
  return mockLinking.openedUrls[mockLinking.openedUrls.length - 1]
}

/**
 * Deliver a deep link to every registered `Linking` "url" listener, as the OS
 * does when the app is opened through its URL scheme while running.
 *
 * @example
 * emitUrl("myapp://stellar/signed?requestId=abc&xdr=AAAA")
 */
export function emitUrl(url: string): void {
  mockLinking.listeners.forEach(listener => listener({ url }))
}

/**
 * Set the URL a cold start was launched with (`Linking.getInitialURL()`).
 */
export function setInitialUrl(url: string | null): void {
  mockLinking.initialUrl = url
}

/**
 * Get the count of registered `Linking` "url" listeners (for test assertions).
 */
export function getLinkingListenerCount(): number {
  return mockLinking.listeners.size
}

/**
 * Clear all opened URLs and listeners and reset to success state.
 * Called by setup.ts beforeEach.
 */
export function resetLinkingMock(): void {
  mockLinking.reset()
}

export default mockLinking
