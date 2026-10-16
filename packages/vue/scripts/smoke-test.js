const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const vuePackageDir = path.resolve(__dirname, "..")
const corePackageDir = path.resolve(vuePackageDir, "../core")
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "use-stellar-vue-smoke-"))

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32" && !path.isAbsolute(command),
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`)
  }
}

function pack(packageDir) {
  const before = new Set(fs.readdirSync(tempDir))
  run("pnpm", ["pack", "--pack-destination", tempDir], packageDir)
  const tarball = fs.readdirSync(tempDir).find(file => file.endsWith(".tgz") && !before.has(file))
  assert.ok(tarball, `pnpm pack did not create a tarball for ${packageDir}`)
  return path.join(tempDir, tarball)
}

try {
  const coreTarball = pack(corePackageDir)
  const vueTarball = pack(vuePackageDir)
  const fixtureDir = path.join(tempDir, "fixture")
  fs.mkdirSync(fixtureDir)

  fs.writeFileSync(
    path.join(fixtureDir, "package.json"),
    `${JSON.stringify(
      {
        name: "use-stellar-vue-package-smoke",
        private: true,
        type: "module",
        dependencies: {
          "@use-stellar/vue": `file:${vueTarball}`,
          "use-stellar": `file:${coreTarball}`,
          vue: "^3.5.0",
        },
      },
      null,
      2
    )}\n`
  )

  // Deliberately avoid peer auto-installation: importing the Vue adapter must
  // work when React and React DOM are genuinely absent from node_modules.
  run(
    "npm",
    ["install", "--legacy-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund"],
    fixtureDir
  )

  const esmCheck = `
import assert from "node:assert/strict";
import { createStellarRuntime, useBalance } from "@use-stellar/vue";
assert.equal(typeof createStellarRuntime, "function");
assert.equal(typeof useBalance, "function");
console.log("Vue ESM entry loaded without React");
`
  const cjsCheck = `
const assert = require("node:assert/strict");
for (const dependency of ["react", "react-dom"]) {
  assert.throws(() => require.resolve(dependency), { code: "MODULE_NOT_FOUND" });
}
const vueAdapter = require("@use-stellar/vue");
assert.equal(typeof vueAdapter.createStellarRuntime, "function");
assert.equal(typeof vueAdapter.useBalance, "function");
assert.equal(
  Object.keys(require.cache).some(file => /[\\\\/]react(?:-dom)?[\\\\/]/.test(file)),
  false,
  "Vue CommonJS import resolved React"
);
console.log("Vue CommonJS entry loaded without React");
`
  fs.writeFileSync(path.join(fixtureDir, "check-esm.mjs"), esmCheck)
  fs.writeFileSync(path.join(fixtureDir, "check-cjs.cjs"), cjsCheck)

  run(process.execPath, ["check-esm.mjs"], fixtureDir)
  run(process.execPath, ["check-cjs.cjs"], fixtureDir)

  const packedDist = path.join(fixtureDir, "node_modules", "@use-stellar", "vue", "dist")
  for (const entry of ["index.js", "index.mjs"]) {
    const source = fs.readFileSync(path.join(packedDist, entry), "utf8")
    assert.doesNotMatch(source, /(?:from\s*|require\s*\()\s*["']react(?:-dom)?["']/)
  }

  console.log("@use-stellar/vue package smoke test passed")
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true })
}
