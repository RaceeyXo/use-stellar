import { checkStellarRuntime, assertStellarRuntime } from "./assertRuntime"

// ── checkStellarRuntime ────────────────────────────────────────────────────

describe("checkStellarRuntime", () => {
  const originalEnv = process.env.NODE_ENV
  const originalBuffer = global.Buffer
  const originalCrypto = global.crypto
  const originalURL = global.URL
  const originalTextEncoder = global.TextEncoder

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
    global.Buffer = originalBuffer
    global.crypto = originalCrypto
    global.URL = originalURL
    global.TextEncoder = originalTextEncoder
  })

  describe("when all globals are present", () => {
    it("returns { passed: true, missing: [] }", () => {
      // Ensure all required globals exist
      ;(global as any).Buffer = Buffer
      ;(global as any).crypto = { getRandomValues: () => {} }
      ;(global as any).URL = URL
      ;(global as any).TextEncoder = TextEncoder

      const result = checkStellarRuntime()

      expect(result.passed).toBe(true)
      expect(result.missing).toEqual([])
    })
  })

  describe("when Buffer is missing", () => {
    it("returns missing entry with global='Buffer'", () => {
      ;(global as any).Buffer = undefined
      ;(global as any).crypto = { getRandomValues: () => {} }
      ;(global as any).URL = URL
      ;(global as any).TextEncoder = TextEncoder

      const result = checkStellarRuntime()

      expect(result.passed).toBe(false)
      const bufferEntry = result.missing.find(m => m.global === "Buffer")
      expect(bufferEntry).toBeDefined()
      expect(bufferEntry?.description).toContain("XDR encoding")
      expect(bufferEntry?.fix).toContain("npm install buffer")
    })
  })

  describe("when crypto.getRandomValues is missing", () => {
    it("returns missing entry with global='crypto.getRandomValues'", () => {
      ;(global as any).Buffer = Buffer
      ;(global as any).crypto = undefined
      ;(global as any).URL = URL
      ;(global as any).TextEncoder = TextEncoder

      const result = checkStellarRuntime()

      expect(result.passed).toBe(false)
      const cryptoEntry = result.missing.find(m => m.global === "crypto.getRandomValues")
      expect(cryptoEntry).toBeDefined()
      expect(cryptoEntry?.description).toContain("cryptographically secure")
      expect(cryptoEntry?.fix).toContain("react-native-get-random-values")
    })

    it("returns missing entry when crypto exists but getRandomValues is missing", () => {
      ;(global as any).Buffer = Buffer
      ;(global as any).crypto = {}
      ;(global as any).URL = URL
      ;(global as any).TextEncoder = TextEncoder

      const result = checkStellarRuntime()

      expect(result.passed).toBe(false)
      const cryptoEntry = result.missing.find(m => m.global === "crypto.getRandomValues")
      expect(cryptoEntry).toBeDefined()
    })
  })

  describe("when URL is missing", () => {
    it("returns missing entry with global='URL'", () => {
      ;(global as any).Buffer = Buffer
      ;(global as any).crypto = { getRandomValues: () => {} }
      ;(global as any).URL = undefined
      ;(global as any).TextEncoder = TextEncoder

      const result = checkStellarRuntime()

      expect(result.passed).toBe(false)
      const urlEntry = result.missing.find(m => m.global === "URL")
      expect(urlEntry).toBeDefined()
      expect(urlEntry?.description).toContain("Horizon API")
      expect(urlEntry?.fix).toContain("react-native-url-polyfill")
    })
  })

  describe("when TextEncoder is missing", () => {
    it("returns missing entry with global='TextEncoder'", () => {
      ;(global as any).Buffer = Buffer
      ;(global as any).crypto = { getRandomValues: () => {} }
      ;(global as any).URL = URL
      ;(global as any).TextEncoder = undefined

      const result = checkStellarRuntime()

      expect(result.passed).toBe(false)
      const textEncoderEntry = result.missing.find(m => m.global === "TextEncoder")
      expect(textEncoderEntry).toBeDefined()
      expect(textEncoderEntry?.description).toContain("XDR operations")
      expect(textEncoderEntry?.fix).toContain("text-encoding")
    })
  })

  describe("when multiple globals are missing", () => {
    it("returns all missing entries", () => {
      ;(global as any).Buffer = undefined
      ;(global as any).crypto = undefined
      ;(global as any).URL = undefined
      ;(global as any).TextEncoder = undefined

      const result = checkStellarRuntime()

      expect(result.passed).toBe(false)
      expect(result.missing).toHaveLength(4)
      expect(result.missing.map(m => m.global)).toEqual([
        "Buffer",
        "crypto.getRandomValues",
        "URL",
        "TextEncoder",
      ])
    })
  })

  describe("each missing entry", () => {
    it("has description and fix properties", () => {
      ;(global as any).Buffer = undefined
      ;(global as any).crypto = undefined
      ;(global as any).URL = undefined
      ;(global as any).TextEncoder = undefined

      const result = checkStellarRuntime()

      result.missing.forEach(entry => {
        expect(entry.global).toBeTruthy()
        expect(entry.description).toBeTruthy()
        expect(entry.fix).toBeTruthy()
        expect(entry.description).not.toContain("npm install")
        expect(entry.fix).toContain("npm install")
      })
    })

    it("fix string mentions the correct npm package", () => {
      ;(global as any).Buffer = undefined
      ;(global as any).crypto = undefined
      ;(global as any).URL = undefined
      ;(global as any).TextEncoder = undefined

      const result = checkStellarRuntime()

      const bufferFix = result.missing.find(m => m.global === "Buffer")?.fix || ""
      const cryptoFix = result.missing.find(m => m.global === "crypto.getRandomValues")?.fix || ""
      const urlFix = result.missing.find(m => m.global === "URL")?.fix || ""
      const textEncoderFix =
        result.missing.find(m => m.global === "TextEncoder")?.fix || ""

      expect(bufferFix).toContain("buffer")
      expect(cryptoFix).toContain("react-native-get-random-values")
      expect(urlFix).toContain("react-native-url-polyfill")
      expect(textEncoderFix).toContain("text-encoding")
    })
  })
})

// ── assertStellarRuntime ───────────────────────────────────────────────────

describe("assertStellarRuntime", () => {
  const originalEnv = process.env.NODE_ENV
  const originalBuffer = global.Buffer
  const originalCrypto = global.crypto
  const originalURL = global.URL
  const originalTextEncoder = global.TextEncoder

  beforeEach(() => {
    process.env.NODE_ENV = "development"
  })

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
    global.Buffer = originalBuffer
    global.crypto = originalCrypto
    global.URL = originalURL
    global.TextEncoder = originalTextEncoder
  })

  describe("when all globals are present", () => {
    it("does not throw", () => {
      ;(global as any).Buffer = Buffer
      ;(global as any).crypto = { getRandomValues: () => {} }
      ;(global as any).URL = URL
      ;(global as any).TextEncoder = TextEncoder

      expect(() => assertStellarRuntime()).not.toThrow()
    })
  })

  describe("when Buffer is missing in development", () => {
    it("throws Error with actionable message", () => {
      process.env.NODE_ENV = "development"
      ;(global as any).Buffer = undefined
      ;(global as any).crypto = { getRandomValues: () => {} }
      ;(global as any).URL = URL
      ;(global as any).TextEncoder = TextEncoder

      expect(() => assertStellarRuntime()).toThrow(Error)
    })

    it("error message includes 'import @use-stellar/react-native/polyfills'", () => {
      ;(global as any).Buffer = undefined
      ;(global as any).crypto = { getRandomValues: () => {} }
      ;(global as any).URL = URL
      ;(global as any).TextEncoder = TextEncoder

      expect(() => assertStellarRuntime()).toThrow(/@use-stellar\/react-native\/polyfills/)
    })

    it("error message includes the missing global name", () => {
      ;(global as any).Buffer = undefined
      ;(global as any).crypto = { getRandomValues: () => {} }
      ;(global as any).URL = URL
      ;(global as any).TextEncoder = TextEncoder

      const errorMessage = expect(() => assertStellarRuntime()).toThrow()
      try {
        assertStellarRuntime()
      } catch (e) {
        expect(String(e)).toContain("Buffer")
      }
    })
  })

  describe("when multiple globals are missing in development", () => {
    it("throws Error with all missing entries", () => {
      ;(global as any).Buffer = undefined
      ;(global as any).crypto = undefined
      ;(global as any).URL = undefined
      ;(global as any).TextEncoder = undefined

      try {
        assertStellarRuntime()
        fail("Should have thrown")
      } catch (e) {
        const errorMessage = String(e)
        expect(errorMessage).toContain("Buffer")
        expect(errorMessage).toContain("crypto.getRandomValues")
        expect(errorMessage).toContain("URL")
        expect(errorMessage).toContain("TextEncoder")
      }
    })
  })

  describe("when globals are missing in production", () => {
    it("does NOT throw even if globals missing", () => {
      process.env.NODE_ENV = "production"
      ;(global as any).Buffer = undefined
      ;(global as any).crypto = undefined
      ;(global as any).URL = undefined
      ;(global as any).TextEncoder = undefined

      expect(() => assertStellarRuntime()).not.toThrow()
    })
  })

  describe("performance", () => {
    it("is a no-op in production — no performance overhead", () => {
      process.env.NODE_ENV = "production"
      ;(global as any).Buffer = undefined

      const startTime = performance.now()
      assertStellarRuntime()
      const endTime = performance.now()

      // Should be extremely fast (< 1ms) since it's a no-op
      expect(endTime - startTime).toBeLessThan(1)
    })
  })
})
