// Placeholder so CI has a suite to run until the runes land.

describe("@use-stellar/svelte", () => {
  it("exposes the core cache defaults it will build on", async () => {
    const adapter = await import("../src/index")

    expect(typeof adapter.DEFAULT_STALE_TIME).toBe("number")
    expect(typeof adapter.DEFAULT_GC_TIME).toBe("number")
  })

  it("does not load React", async () => {
    await import("../src/index")

    const loaded = Object.keys(require.cache).map(file => file.split("\\").join("/"))

    expect(loaded.filter(file => file.includes("/node_modules/react/"))).toEqual([])
    expect(loaded.filter(file => file.includes("/node_modules/react-dom/"))).toEqual([])
  })
})
