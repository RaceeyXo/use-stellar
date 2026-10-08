import { createStellarError } from "../errors"
import type { StellarError } from "../errors"

/** Called with the new connectivity state whenever it changes. */
export type OnlineListener = (online: boolean) => void

/**
 * Wires a platform's connectivity signal into the manager. Receives a
 * `setOnline` callback to report changes and may return a cleanup function
 * that detaches whatever it attached.
 *
 * The web default listens to `online` / `offline` on `window`. React Native
 * replaces it with `@react-native-community/netinfo` (`rn-07`) — core never
 * imports that library itself.
 */
export type OnlineEventSetup = (setOnline: (online: boolean) => void) => (() => void) | void

/**
 * The web default: `window`'s `online` / `offline` events.
 *
 * Attaches nothing where there is no `window` — a server render has no
 * connectivity to track and is always treated as online.
 */
const webOnlineEvents: OnlineEventSetup = setOnline => {
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") return

  const handleOnline = () => setOnline(true)
  const handleOffline = () => setOnline(false)

  window.addEventListener("online", handleOnline, false)
  window.addEventListener("offline", handleOffline, false)

  return () => {
    window.removeEventListener("online", handleOnline)
    window.removeEventListener("offline", handleOffline)
  }
}

/**
 * Tracks whether the device can reach the network, so queries can pause while
 * offline and catch up once when the connection returns.
 *
 * Framework-neutral: no React, no React Native. A platform supplies its signal
 * through {@link OnlineManager.setEventListener}; until it does, the web
 * default is used.
 *
 * `navigator.onLine === false` reliably means "offline", but `true` only means
 * "has a network interface" — so this is a signal to stop trying, never a
 * promise that a request will succeed.
 */
export class OnlineManager {
  /** `undefined` until a platform reports a state — then `navigator.onLine` is read. */
  private online: boolean | undefined
  private listeners = new Set<OnlineListener>()
  private setup: OnlineEventSetup = webOnlineEvents
  private cleanup: (() => void) | void = undefined

  /**
   * Returns `false` only when the platform says the device is offline.
   * Environments with no signal at all (SSR, tests) are treated as online.
   */
  isOnline(): boolean {
    if (this.online !== undefined) return this.online
    if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean") {
      return navigator.onLine
    }
    return true
  }

  /**
   * Records a connectivity change. Listeners are notified only when the value
   * actually changes, so a repeated `online` event cannot trigger a second
   * round of refetches.
   */
  setOnline(online: boolean): void {
    const previous = this.isOnline()
    this.online = online
    if (previous === online) return

    for (const listener of this.listeners) {
      listener(online)
    }
  }

  /**
   * Subscribes to connectivity changes. The platform signal is attached with
   * the first subscriber and detached with the last, so an app that never
   * mounts a query never registers a window listener.
   */
  subscribe(listener: OnlineListener): () => void {
    this.listeners.add(listener)
    if (this.listeners.size === 1) this.attach()

    return () => {
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.detach()
    }
  }

  /**
   * Replaces the platform signal. Detaches the current one and, if anything is
   * subscribed, attaches the new one immediately. Pass nothing to restore the
   * web default.
   *
   * Any state the previous signal reported is dropped, so a signal that is
   * removed while offline cannot leave every query paused.
   */
  setEventListener(setup: OnlineEventSetup = webOnlineEvents): void {
    this.detach()
    this.online = undefined
    this.setup = setup
    if (this.listeners.size > 0) this.attach()
  }

  private attach(): void {
    this.cleanup = this.setup(online => this.setOnline(online))
  }

  private detach(): void {
    if (typeof this.cleanup === "function") this.cleanup()
    this.cleanup = undefined
  }
}

/** The shared manager every query and write action consults. */
export const onlineManager = new OnlineManager()

/**
 * The error a write action throws when it is called offline.
 *
 * Write actions fail fast rather than wait: a signed transaction is never
 * queued for later, because replaying one after the user has moved on is how
 * a payment goes out twice (`core-07`). The check runs before the account is
 * loaded, so nothing has been built or signed when this is thrown.
 */
export function offlineError(): StellarError {
  return createStellarError(
    "NETWORK_ERROR",
    "You are offline. Nothing was signed or submitted — reconnect and try again."
  )
}
