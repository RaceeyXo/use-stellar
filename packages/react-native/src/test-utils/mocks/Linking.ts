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

interface MockLinking {
  openedUrls: string[]
  shouldSucceed: boolean
  openURL(url: string): Promise<void>
  canOpenURL(url: string): Promise<boolean>
  reset(): void
}

/**
 * Singleton mock instance for Linking.
 * Tests inspect openedUrls to verify navigation side effects.
 */
const mockLinking: MockLinking = {
  openedUrls: [],
  shouldSucceed: true,

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

  reset() {
    this.openedUrls = []
    this.shouldSucceed = true
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
 * Clear all opened URLs and reset to success state.
 * Called by setup.ts beforeEach.
 */
export function resetLinkingMock(): void {
  mockLinking.reset()
}

export default mockLinking
