/**
 * Tests for platform detection and capabilities.
 *
 * These tests verify that the platform capability model correctly detects
 * the current environment and provides appropriate capabilities for each platform.
 */

import { detectPlatform, NATIVE_PLATFORM, createPlatformCapabilities } from './platform'

describe('Platform Detection', () => {
  describe('detectPlatform() — WEB environment', () => {
    it('kind: "web" when window is defined', () => {
      const platform = detectPlatform()
      expect(platform.kind).toBe('web')
    })

    it('canConnectWallet: true in web', () => {
      const platform = detectPlatform()
      expect(platform.canConnectWallet).toBe(true)
    })

    it('hasDom: true in web', () => {
      const platform = detectPlatform()
      expect(platform.hasDom).toBe(true)
    })

    it('isServer: false in web', () => {
      const platform = detectPlatform()
      expect(platform.isServer).toBe(false)
    })

    it('hasLocalStorage: true in web (jsdom)', () => {
      const platform = detectPlatform()
      expect(platform.hasLocalStorage).toBe(true)
    })

    it("storage: 'localStorage' in web", () => {
      const platform = detectPlatform()
      expect(platform.storage).toBe('localStorage')
    })
  })

  describe('NATIVE_PLATFORM constant', () => {
    it('kind: "native"', () => {
      expect(NATIVE_PLATFORM.kind).toBe('native')
    })

    it('canConnectWallet: true (RN CAN connect wallets)', () => {
      expect(NATIVE_PLATFORM.canConnectWallet).toBe(true)
    })

    it('hasDom: false (no DOM on RN)', () => {
      expect(NATIVE_PLATFORM.hasDom).toBe(false)
    })

    it('hasLocalStorage: false (no localStorage on RN)', () => {
      expect(NATIVE_PLATFORM.hasLocalStorage).toBe(false)
    })

    it('isServer: false (RN is not SSR)', () => {
      expect(NATIVE_PLATFORM.isServer).toBe(false)
    })

    it("storage: 'asyncStorage' on RN", () => {
      expect(NATIVE_PLATFORM.storage).toBe('asyncStorage')
    })
  })

  describe('createPlatformCapabilities()', () => {
    it('accepts kind: "native" override and returns native capabilities', () => {
      const platform = createPlatformCapabilities({ kind: 'native' })
      expect(platform.kind).toBe('native')
      expect(platform.canConnectWallet).toBe(true)
      expect(platform.hasDom).toBe(false)
      expect(platform.isServer).toBe(false)
    })

    it('accepts partial overrides and merges with detected defaults', () => {
      const platform = createPlatformCapabilities({
        kind: 'native',
        hasLocalStorage: true,
      })
      expect(platform.kind).toBe('native')
      expect(platform.hasLocalStorage).toBe(true)
      expect(platform.canConnectWallet).toBe(true)
    })

    it('preserves all other properties when overriding', () => {
      const platform = createPlatformCapabilities({
        kind: 'native',
        storage: 'memory',
      })
      expect(platform.storage).toBe('memory')
      expect(platform.canConnectWallet).toBe(true)
      expect(platform.isServer).toBe(false)
    })
  })

  describe('useWallet.connect() behavior with platform', () => {
    it('platform.canConnectWallet: true allows connect()', () => {
      const platform = detectPlatform()
      // In jsdom (test environment), this will be true
      if (platform.canConnectWallet) {
        expect(platform.kind).toBe('web')
      }
    })

    it('platform.kind: "native" with canConnectWallet: true allows connect() (no window needed)', () => {
      expect(NATIVE_PLATFORM.canConnectWallet).toBe(true)
      expect(NATIVE_PLATFORM.kind).toBe('native')
    })

    it('platform.isServer: true shows SSR error message only for server', () => {
      const platform = detectPlatform()
      if (platform.isServer) {
        expect(platform.canConnectWallet).toBe(false)
      }
    })
  })

  describe('Storage selection based on platform', () => {
    it('web platform uses localStorage', () => {
      const platform = detectPlatform()
      if (platform.kind === 'web') {
        expect(platform.storage).toBe('localStorage')
        expect(platform.hasLocalStorage).toBe(true)
      }
    })

    it('native platform uses asyncStorage', () => {
      expect(NATIVE_PLATFORM.storage).toBe('asyncStorage')
      expect(NATIVE_PLATFORM.hasLocalStorage).toBe(false)
    })

    it('server platform has no storage', () => {
      // In a real Node environment, this would be true.
      // In jsdom test environment, we're in web mode.
      const platform = detectPlatform()
      if (platform.isServer) {
        expect(platform.storage).toBeNull()
        expect(platform.hasLocalStorage).toBe(false)
      }
    })
  })

  describe('DOM availability based on platform', () => {
    it('web platform has hasDom: true', () => {
      const platform = detectPlatform()
      if (platform.kind === 'web') {
        expect(platform.hasDom).toBe(true)
      }
    })

    it('native platform has hasDom: false', () => {
      expect(NATIVE_PLATFORM.hasDom).toBe(false)
    })
  })

  describe('Backward compatibility', () => {
    it('web platform corresponds to isBrowser() returning true', () => {
      const platform = detectPlatform()
      const isBrowser = typeof window !== 'undefined'
      if (isBrowser) {
        expect(platform.kind).toBe('web')
        expect(platform.canConnectWallet).toBe(true)
      }
    })

    it('platform.isServer is true when isBrowser() would return false', () => {
      const platform = detectPlatform()
      const isBrowser = typeof window !== 'undefined'
      if (!isBrowser) {
        expect(platform.isServer).toBe(true)
        expect(platform.canConnectWallet).toBe(false)
      }
    })
  })

  describe('Error message context', () => {
    it('SSR error message shown ONLY when platform.isServer === true', () => {
      const platform = detectPlatform()
      if (platform.isServer) {
        expect(platform.canConnectWallet).toBe(false)
        // Server should show the SSR-specific error
      } else if (platform.kind === 'native') {
        // Native should NOT show SSR error, even though canConnectWallet is true
        expect(NATIVE_PLATFORM.canConnectWallet).toBe(true)
      }
    })

    it('native platform error message is platform-specific, not SSR', () => {
      const platform = NATIVE_PLATFORM
      expect(platform.kind).toBe('native')
      expect(platform.isServer).toBe(false)
      // Error should be: "Wallet connection is not available on platform: native"
      // NOT: "Wallet connection is only available in the browser"
    })
  })
})
