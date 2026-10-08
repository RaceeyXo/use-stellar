/** Runtime focus state shared by polling hooks. */
export type FocusPlatform = "web" | "server" | "native"

export type FocusListener = (focused: boolean) => void

export interface FocusManagerOptions {
  platform?: FocusPlatform
  document?: Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">
}

/**
 * Owns focus state without depending on a UI framework or a native runtime.
 * Native adapters can call `setFocused` when their app state changes.
 */
export class FocusManager {
  private platform: FocusPlatform
  private readonly doc?: FocusManagerOptions["document"]
  private readonly listeners = new Set<FocusListener>()
  private focused: boolean
  private listening = false

  constructor(options: FocusManagerOptions = {}) {
    this.doc = options.document ?? (typeof document === "undefined" ? undefined : document)
    this.platform = options.platform ?? (this.doc ? "web" : "server")
    this.focused =
      this.platform === "server" ||
      (this.platform === "web" ? this.doc?.visibilityState !== "hidden" : true)
  }

  isFocused(): boolean {
    return this.platform === "server" || this.focused
  }

  /**
   * Registers a listener. Subscriptions are kept even on a server platform,
   * which never emits: a hook can subscribe before a native adapter calls
   * `setPlatform("native")` (React runs child effects first), and that
   * subscription must still hear AppState changes afterwards.
   */
  subscribe(listener: FocusListener): () => void {
    this.listeners.add(listener)
    this.startListening()
    let subscribed = true
    return () => {
      if (!subscribed) return
      subscribed = false
      this.listeners.delete(listener)
      if (this.listeners.size === 0) this.stopListening()
    }
  }

  /** Set focus directly, for native adapters and deterministic tests. */
  setFocused(focused: boolean): void {
    if (this.platform === "server" || this.focused === focused) return
    this.focused = focused
    this.listeners.forEach(listener => listener(focused))
  }

  /** Configure the runtime after platform capabilities become available. */
  setPlatform(platform: FocusPlatform): void {
    if (this.platform === platform) return
    this.stopListening()
    this.platform = platform
    const nextFocused =
      platform === "server" ||
      (platform === "web" ? this.doc?.visibilityState !== "hidden" : this.focused)
    this.focused = nextFocused
    if (platform !== "server") {
      this.startListening()
      if (this.listeners.size > 0) this.listeners.forEach(listener => listener(nextFocused))
    }
  }

  private readonly onVisibilityChange = (): void => {
    if (this.platform === "web") this.setFocused(this.doc?.visibilityState !== "hidden")
  }

  private startListening(): void {
    if (this.listening || this.platform !== "web" || !this.doc) return
    this.doc.addEventListener("visibilitychange", this.onVisibilityChange)
    this.listening = true
  }

  private stopListening(): void {
    if (!this.listening || !this.doc) return
    this.doc.removeEventListener("visibilitychange", this.onVisibilityChange)
    this.listening = false
  }
}

/** Default environment manager: visible web pages are focused; SSR is always focused. */
export const focusManager = new FocusManager()
