/**
 * @jest-environment node
 *
 * Guards the `rn-03` acceptance criteria against the actual built artifact,
 * not just the source: the shipped CJS bundle must not require `react-dom`,
 * and loading it where there is no `window`/`document` (Node, or React
 * Native's Hermes) must not throw.
 */
import { execSync } from "child_process"
import fs from "fs"
import path from "path"

const packageRoot = path.resolve(__dirname, "../..")
const cjsEntry = path.join(packageRoot, "dist/index.js")

beforeAll(() => {
  if (!fs.existsSync(cjsEntry)) {
    execSync("pnpm exec tsup", { cwd: packageRoot, stdio: "inherit" })
  }
}, 120_000)

describe("built bundle stays free of react-dom", () => {
  it("the CJS bundle does not require or import react-dom", () => {
    const source = fs.readFileSync(cjsEntry, "utf8")
    expect(source).not.toMatch(/require\(["']react-dom/)
    expect(source).not.toMatch(/from\s+["']react-dom/)
  })

  it("loading the bundle with no window/document does not throw", () => {
    expect(typeof window).toBe("undefined")
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- dist/index.js
      // doesn't exist until beforeAll builds it, so this can't be a static import.
      delete require.cache[require.resolve(cjsEntry)]
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require(cjsEntry)
    }).not.toThrow()
  })
})
