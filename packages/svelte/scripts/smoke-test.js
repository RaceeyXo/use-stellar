const assert = require("node:assert/strict")
const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const { spawnSync } = require("node:child_process")

const packageDir = path.resolve(__dirname, "..")
const corePackageDir = path.resolve(packageDir, "../core")
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "use-stellar-svelte-smoke-"))

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    shell: process.platform === "win32" && !path.isAbsolute(command),
  })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`)
  }
}

function pack(dir) {
  const before = new Set(fs.readdirSync(tempDir))
  run("pnpm", ["pack", "--pack-destination", tempDir], dir)
  const tarball = fs.readdirSync(tempDir).find(file => file.endsWith(".tgz") && !before.has(file))
  assert.ok(tarball)
  return path.join(tempDir, tarball)
}

const coreTarball = pack(corePackageDir)
const svelteTarball = pack(packageDir)
const fixtureDir = path.join(tempDir, "fixture")
fs.mkdirSync(fixtureDir)
fs.writeFileSync(
  path.join(fixtureDir, "package.json"),
  JSON.stringify(
    {
      name: "use-stellar-svelte-smoke",
      private: true,
      dependencies: {
        "@use-stellar/svelte": `file:${svelteTarball}`,
        "use-stellar": `file:${coreTarball}`,
      },
    },
    null,
    2
  )
)
run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund"], fixtureDir)

const check = `
const assert = require("node:assert/strict");
for (const dependency of ["react", "react-dom"]) {
  assert.throws(() => require.resolve(dependency), { code: "MODULE_NOT_FOUND" });
}
const svelte = require("@use-stellar/svelte");
assert.equal(typeof svelte.createStellarSvelte, "function");
assert.equal(svelte.createStellarSvelte({ network: "testnet" }).network, "testnet");
assert.equal(Object.keys(require.cache).some(file => /[\\\\/]react(?:-dom)?[\\\\/]/.test(file)), false);
`
fs.writeFileSync(path.join(fixtureDir, "check.cjs"), check)
run("node", ["check.cjs"], fixtureDir)
console.log("Svelte tarball loaded without React")
