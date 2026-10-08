/**
 * Platform capability model for use-stellar.
 *
 * Replaces isBrowser() gating which conflates two questions:
 * - "Is this a server render?" (SSR/Node)
 * - "Is there a DOM?" (browser)
 *
 * React Native is neither a server nor a browser — this model handles all three.
 */

export type PlatformKind = "web" | "server" | "native"

export interface PlatformCapabilities {
  /** The environment kind */
  kind: PlatformKind

  /** Whether wallet connection is allowed in this environment */
  canConnectWallet: boolean

  /** Whether localStorage/sessionStorage is available */
  hasLocalStorage: boolean

  /** Whether the DOM is available */
  hasDom: boolean

  /** Whether this is a server-side render (no persistent connection possible) */
  isServer: boolean

  /** Storage adapter to use — null if no storage available */
  storage: "localStorage" | "asyncStorage" | "memory" | null
}

/** Server-side render / Node.js capabilities: no wallet, no storage, no DOM. */
const SERVER_PLATFORM: PlatformCapabilities = {
  kind: "server",
  canConnectWallet: false,
  hasLocalStorage: false,
  hasDom: false,
  isServer: true,
  storage: null,
}

/**
 * Detect the current platform from available globals.
 * Preserves existing web and SSR behavior exactly.
 *
 * Detection order:
 * 1. If window is defined → web browser
 * 2. If no window but process.versions.node → server/SSR
 * 3. Otherwise → unknown (treated as server for safety)
 */
export function detectPlatform(): PlatformCapabilities {
  // Server-side render or Node.js
  if (typeof window === "undefined") {
    return SERVER_PLATFORM
  }

  // Web browser
  return {
    kind: "web",
    canConnectWallet: true,
    hasLocalStorage: typeof localStorage !== "undefined",
    hasDom: true,
    isServer: false,
    storage: "localStorage",
  }
}

/**
 * Native platform capabilities (React Native / Hermes).
 * Declared by the react-native adapter — never auto-detected here.
 * packages/core must NEVER import react-native.
 */
export const NATIVE_PLATFORM: PlatformCapabilities = {
  kind: "native",
  canConnectWallet: true, // RN CAN connect wallets (no window needed)
  hasLocalStorage: false, // no localStorage on RN
  hasDom: false, // no DOM on RN
  isServer: false, // RN is not SSR
  storage: "asyncStorage", // RN uses AsyncStorage
}

/**
 * Create a custom platform override for adapter packages.
 * e.g. the react-native package passes kind: 'native' to createStellarRuntime.
 */
export function createPlatformCapabilities(
  overrides: Partial<PlatformCapabilities> & { kind: PlatformKind }
): PlatformCapabilities {
  // Start from the requested kind's defaults, apply overrides. Only "web" is
  // detected from globals: a declared "native" platform must not inherit a DOM
  // or localStorage just because the current process happens to have them
  // (jsdom tests, or a web build that bundles the RN adapter).
  const base =
    overrides.kind === "native"
      ? NATIVE_PLATFORM
      : overrides.kind === "server"
        ? SERVER_PLATFORM
        : detectPlatform()

  return {
    ...base,
    ...overrides,
  }
}
