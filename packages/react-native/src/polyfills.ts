/**
 * Stellar SDK polyfills for React Native / Hermes.
 *
 * Import this ONCE at the top of your app entry point:
 *   import '@use-stellar/react-native/polyfills'
 *
 * This file is intentionally separate from the main entry so apps opt in explicitly.
 * The main entry (@use-stellar/react-native) NEVER imports this file.
 *
 * Polyfills installed:
 * - crypto.getRandomValues (from 'react-native-get-random-values')
 * - Buffer (from 'buffer' package)
 * - URL / URLSearchParams (from 'react-native-url-polyfill')
 * - TextEncoder / TextDecoder (from 'text-encoding' if missing)
 * - EventSource (from optional peer 'react-native-sse' if missing)
 */

// ── crypto.getRandomValues ─────────────────────────────────────────────
// Required for transaction hashing and keypair generation, and installed
// first: anything loaded after this may capture `crypto` at import time.
//
// MUST use a cryptographically secure implementation.
// react-native-get-random-values uses native crypto — safe for production.

if (typeof global.crypto === "undefined" || typeof global.crypto.getRandomValues === "undefined") {
  require("react-native-get-random-values")
}

// ── Buffer ────────────────────────────────────────────────────────────
// Required by Stellar SDK for XDR encoding and transaction building

if (typeof global.Buffer === "undefined") {
  // Only install if missing — never overwrite existing implementation
  const { Buffer } = require("buffer")

  global.Buffer = Buffer
}

// ── URL / URLSearchParams ─────────────────────────────────────────────
// Required for Horizon API URL construction.
//
// React Native ships a `URL` global of its own, but most of it throws
// "not implemented" (`searchParams.get`, `hostname`, …). So the test is whether
// URL *works*, not whether it exists.

function hasWorkingUrl(): boolean {
  try {
    return new URL("https://example.org/path?key=value").searchParams.get("key") === "value"
  } catch {
    return false
  }
}

if (!hasWorkingUrl()) {
  require("react-native-url-polyfill/auto")
}

// ── TextEncoder / TextDecoder ─────────────────────────────────────────
// Required for string encoding in XDR operations. Checked separately: some
// runtimes ship the encoder without the decoder.

if (typeof global.TextEncoder === "undefined" || typeof global.TextDecoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("text-encoding")

  if (typeof global.TextEncoder === "undefined") global.TextEncoder = TextEncoder
  if (typeof global.TextDecoder === "undefined") global.TextDecoder = TextDecoder
}

// Horizon streams need EventSource. This implementation uses React Native's
// fetch stack instead of Node http/https modules that Metro cannot resolve.
if (typeof global.EventSource === "undefined") {
  try {
    const module = require("react-native-sse")
    const NativeEventSource = module.default ?? module
    const { AppState } = require("react-native")

    type Listener = (event: Event) => void
    type NativeSource = {
      addEventListener: (type: string, listener: Listener) => void
      removeEventListener?: (type: string, listener: Listener) => void
      close: () => void
    }

    class AppStateEventSource {
      static readonly CONNECTING = 0
      static readonly OPEN = 1
      static readonly CLOSED = 2
      readonly CONNECTING = 0
      readonly OPEN = 1
      readonly CLOSED = 2
      readonly url: string
      readonly withCredentials = false
      readyState = AppStateEventSource.CONNECTING
      onopen: Listener | null = null
      onmessage: Listener | null = null
      onerror: Listener | null = null
      private source: NativeSource | null = null
      private closed = false
      private listeners = new Map<string, Set<Listener>>()
      private appStateSubscription?: { remove?: () => void }

      constructor(url: string | URL, private readonly options?: unknown) {
        this.url = String(url)
        this.open()
        this.appStateSubscription = AppState?.addEventListener?.("change", (state: string) => {
          if (state === "active") this.open()
          else this.pause()
        })
      }

      private open() {
        if (this.closed || this.source || AppState?.currentState !== "active") return
        this.readyState = AppStateEventSource.CONNECTING
        this.source = new NativeEventSource(this.url, this.options) as NativeSource
        this.source.addEventListener("open", event => {
          this.readyState = AppStateEventSource.OPEN
          this.onopen?.(event)
        })
        this.source.addEventListener("message", event => this.onmessage?.(event))
        this.source.addEventListener("error", event => this.onerror?.(event))
        this.listeners.forEach((listeners, type) =>
          listeners.forEach(listener => this.source?.addEventListener(type, listener))
        )
      }

      private pause() {
        this.source?.close()
        this.source = null
        this.readyState = AppStateEventSource.CLOSED
      }

      addEventListener(type: string, listener: Listener) {
        const listeners = this.listeners.get(type) ?? new Set<Listener>()
        listeners.add(listener)
        this.listeners.set(type, listeners)
        this.source?.addEventListener(type, listener)
      }

      removeEventListener(type: string, listener: Listener) {
        this.listeners.get(type)?.delete(listener)
        this.source?.removeEventListener?.(type, listener)
      }

      dispatchEvent(): boolean { return false }

      close() {
        this.closed = true
        this.pause()
        this.appStateSubscription?.remove?.()
      }
    }

    global.EventSource = AppStateEventSource as unknown as typeof EventSource
  } catch {
    // Streaming is optional; checkStellarRuntime reports the install command.
  }
}

export {} // mark as module
