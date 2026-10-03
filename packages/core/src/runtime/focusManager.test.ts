import { FocusManager } from "./focusManager"

describe("FocusManager", () => {
  it("uses document.visibilityState on web and subscribes only while observed", () => {
    let visibility: DocumentVisibilityState = "visible"
    const addEventListener = jest.fn()
    const removeEventListener = jest.fn()
    const doc = {
      get visibilityState() {
        return visibility
      },
      addEventListener,
      removeEventListener,
    } as unknown as Pick<Document, "visibilityState" | "addEventListener" | "removeEventListener">
    const manager = new FocusManager({ platform: "web", document: doc })
    const listener = jest.fn()
    const unsubscribe = manager.subscribe(listener)

    expect(manager.isFocused()).toBe(true)
    expect(addEventListener).toHaveBeenCalledTimes(1)
    expect(addEventListener).toHaveBeenCalledWith("visibilitychange", expect.any(Function))

    visibility = "hidden"
    const handler = addEventListener.mock.calls[0][1] as EventListener
    handler(new Event("visibilitychange"))
    expect(manager.isFocused()).toBe(false)
    expect(listener).toHaveBeenCalledWith(false)

    visibility = "visible"
    handler(new Event("visibilitychange"))
    expect(manager.isFocused()).toBe(true)
    expect(listener).toHaveBeenLastCalledWith(true)

    unsubscribe()
    expect(removeEventListener).toHaveBeenCalledWith("visibilitychange", handler)
  })

  it("keeps server platforms focused and ignores subscriptions and manual changes", () => {
    const manager = new FocusManager({ platform: "server" })
    const listener = jest.fn()
    const unsubscribe = manager.subscribe(listener)

    manager.setFocused(false)

    expect(manager.isFocused()).toBe(true)
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it("notifies native subscribers only on focus transitions and cleans up", () => {
    const manager = new FocusManager({ platform: "native" })
    const listener = jest.fn()
    const unsubscribe = manager.subscribe(listener)

    manager.setFocused(false)
    manager.setFocused(false)
    manager.setFocused(true)
    unsubscribe()
    manager.setFocused(false)

    expect(listener.mock.calls).toEqual([[false], [true]])
  })

  it("allows a native runtime to enable focus updates after server-safe initialization", () => {
    const manager = new FocusManager({ platform: "server" })
    manager.setPlatform("native")
    const listener = jest.fn()
    manager.subscribe(listener)

    manager.setFocused(false)

    expect(manager.isFocused()).toBe(false)
    expect(listener).toHaveBeenCalledWith(false)
  })

  it("keeps subscriptions made before a native runtime switches the platform", () => {
    // React runs child effects before parent effects, so a polling hook
    // subscribes before the native provider calls setPlatform("native").
    const manager = new FocusManager({ platform: "server" })
    const listener = jest.fn()
    manager.subscribe(listener)

    // Switching reports the current state, then AppState changes flow through.
    manager.setPlatform("native")
    manager.setFocused(false)
    manager.setFocused(true)

    expect(listener.mock.calls).toEqual([[true], [false], [true]])
  })

  it("pauses polling while unfocused and resumes once only for stale subscribed queries", () => {
    jest.useFakeTimers()
    try {
      const manager = new FocusManager({ platform: "native" })
      let focused = true
      const poll = jest.fn()
      let stale = true
      let subscribed = true
      let inFlight = false
      let interval: number | undefined
      const beginPolling = () => {
        if (interval !== undefined) clearInterval(interval)
        interval = focused ? (setInterval(poll, 100) as unknown as number) : undefined
      }
      beginPolling()
      const unsubscribe = manager.subscribe(nextFocused => {
        focused = nextFocused
        if (interval !== undefined) clearInterval(interval)
        interval = undefined
        if (!focused) return
        if (subscribed && stale && !inFlight) poll()
        beginPolling()
      })

      manager.setFocused(false)
      jest.advanceTimersByTime(500)
      expect(poll).not.toHaveBeenCalled()

      manager.setFocused(true)
      expect(poll).toHaveBeenCalledTimes(1)
      jest.advanceTimersByTime(99)
      expect(poll).toHaveBeenCalledTimes(1)

      stale = false
      manager.setFocused(false)
      manager.setFocused(true)
      expect(poll).toHaveBeenCalledTimes(1)

      stale = true
      subscribed = false
      manager.setFocused(false)
      manager.setFocused(true)
      expect(poll).toHaveBeenCalledTimes(1)

      subscribed = true
      inFlight = true
      manager.setFocused(false)
      manager.setFocused(true)
      expect(poll).toHaveBeenCalledTimes(1)

      unsubscribe()
      if (interval !== undefined) clearInterval(interval)
    } finally {
      jest.useRealTimers()
    }
  })
})
