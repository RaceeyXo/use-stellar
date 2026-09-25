const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const tarballName = `use-stellar-${packageJson.version}.tgz`;
const tarballPath = path.join(rootDir, tarballName);

const tempDir = path.join(rootDir, 'smoke-test-fixture');

console.log('--- PACKAGE IMPORT SMOKE TEST ---');
console.log('Package:', packageJson.name);
console.log('Version:', packageJson.version);

// 1. Pack package
try {
  console.log(`\n1. Packaging library (pnpm pack)...`);
  execSync('npx pnpm@10.30.2 pack', { cwd: rootDir, stdio: 'inherit' });
} catch (err) {
  console.error('Failed to pack package:', err.message);
  process.exit(1);
}

// Helper to clean up
function cleanup() {
  console.log('\nCleaning up temporary files...');
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  if (fs.existsSync(tarballPath)) {
    fs.unlinkSync(tarballPath);
  }
}

try {
  // 2. Create fixture directory
  console.log(`\n2. Creating temporary test fixture...`);
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tempDir);

  // 3. Write package.json for fixture
  const fixturePackageJson = {
    name: 'smoke-test-fixture',
    private: true,
    type: 'module',
    dependencies: {
      'use-stellar': `file:${tarballPath}`,
      'react': '^18.2.0',
      'react-dom': '^18.2.0',
      '@stellar/stellar-sdk': '^12.0.0',
      'typescript': '^5.0.0'
    }
  };
  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify(fixturePackageJson, null, 2)
  );

  // 4. Install dependencies
  console.log(`\n3. Installing dependencies in fixture (npm install)...`);
  execSync('npm install --no-audit --no-fund', { cwd: tempDir, stdio: 'inherit' });

  // 5. Write ESM validation test file for root import
  console.log(`\n4. Writing validation test files...`);
  const esmTest = `
import { isValidStellarAddress } from 'use-stellar';
import assert from 'assert';

console.log('Verifying ESM import from root...');
assert.strictEqual(typeof isValidStellarAddress, 'function');
assert.strictEqual(isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN'), true);
assert.strictEqual(isValidStellarAddress('invalid'), false);
console.log('ESM root import test passed successfully!');
`;
  fs.writeFileSync(path.join(tempDir, 'test-esm-root.js'), esmTest);

  // 6. Write ESM validation test file for core import
  const esmCoreTest = `
import { isValidStellarAddress, QueryStore } from 'use-stellar/core';
import assert from 'assert';

console.log('Verifying ESM import from core...');
assert.strictEqual(typeof isValidStellarAddress, 'function');
assert.strictEqual(typeof QueryStore, 'function');
assert.strictEqual(isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN'), true);
console.log('ESM core import test passed successfully!');
`;
  fs.writeFileSync(path.join(tempDir, 'test-esm-core.js'), esmCoreTest);

  // 7. Write CommonJS validation test file for root import
  const cjsTest = `
const { isValidStellarAddress } = require('use-stellar');
const assert = require('assert');

console.log('Verifying CommonJS require from root...');
assert.strictEqual(typeof isValidStellarAddress, 'function');
assert.strictEqual(isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN'), true);
console.log('CommonJS root require test passed successfully!');
`;
  fs.writeFileSync(path.join(tempDir, 'test-cjs-root.cjs'), cjsTest);

  // 8. Write CommonJS validation test file for core import
  const cjsCoreTest = `
const { isValidStellarAddress, QueryStore } = require('use-stellar/core');
const assert = require('assert');

console.log('Verifying CommonJS require from core...');
assert.strictEqual(typeof isValidStellarAddress, 'function');
assert.strictEqual(typeof QueryStore, 'function');
assert.strictEqual(isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN'), true);
console.log('CommonJS core require test passed successfully!');
`;
  fs.writeFileSync(path.join(tempDir, 'test-cjs-core.cjs'), cjsCoreTest);

  // 9. Write TypeScript validation test file for root import
  const tsTest = `
import { isValidStellarAddress, useWallet } from 'use-stellar';
import type { NormalizedPayment, AssetInfo } from 'use-stellar';

const isValid: boolean = isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN');
const sampleAsset: AssetInfo | null = null;
const pendingPayment: NormalizedPayment | null = null;
console.log('TypeScript root import and types resolution OK. Address valid:', isValid, sampleAsset, pendingPayment, typeof useWallet);
`;
  fs.writeFileSync(path.join(tempDir, 'test-ts-root.ts'), tsTest);

  // 10. Write TypeScript validation test file for core import
  const tsCoreTest = `
import { isValidStellarAddress, QueryStore } from 'use-stellar/core';
import type { StellarNetwork, NetworkConfig } from 'use-stellar/core';

const isValid: boolean = isValidStellarAddress('GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOACCWN');
const network: StellarNetwork = 'mainnet';
const config: NetworkConfig | null = null;
console.log('TypeScript core import and types resolution OK. Address valid:', isValid, network, config);
`;
  fs.writeFileSync(path.join(tempDir, 'test-ts-core.ts'), tsCoreTest);

  // 11. Run ESM validation for root
  console.log(`\n5. Executing ESM root import test...`);
  execSync('node test-esm-root.js', { cwd: tempDir, stdio: 'inherit' });

  // 12. Run ESM validation for core
  console.log(`\n6. Executing ESM core import test...`);
  execSync('node test-esm-core.js', { cwd: tempDir, stdio: 'inherit' });

  // 13. Run CommonJS validation for root
  console.log(`\n7. Executing CommonJS root require test...`);
  execSync('node test-cjs-root.cjs', { cwd: tempDir, stdio: 'inherit' });

  // 14. Run CommonJS validation for core
  console.log(`\n8. Executing CommonJS core require test...`);
  execSync('node test-cjs-core.cjs', { cwd: tempDir, stdio: 'inherit' });

  // 15. Run TypeScript Type Resolution validation for root
  console.log(`\n9. Executing TypeScript compiler check for root (tsc)...`);
  // Run under BOTH resolution algorithms. The legacy `node` mode ignores the
  // `exports` map entirely, so on its own it cannot catch a broken map — which
  // is precisely the failure mode that only ever shows up in a consumer's repo.
  // `bundler` and `node16` do consult it, and `node16` is the strict one: it is
  // what surfaces a CJS declaration file being served for the `import`
  // condition ("masquerading as CJS").
  for (const moduleResolution of ['node', 'bundler', 'node16']) {
    // node16 resolution requires a matching `module` setting.
    const moduleFlag = moduleResolution === 'node16' ? '--module node16' : '--module esnext';
    console.log(`  - moduleResolution: ${moduleResolution}`);
    execSync(
      `npx tsc --noEmit --target es2020 ${moduleFlag} --moduleResolution ${moduleResolution} test-ts-root.ts`,
      { cwd: tempDir, stdio: 'inherit' }
    );
  }

  // 16. Run TypeScript Type Resolution validation for core
  console.log(`\n10. Executing TypeScript compiler check for core (tsc)...`);
  for (const moduleResolution of ['node', 'bundler', 'node16']) {
    const moduleFlag = moduleResolution === 'node16' ? '--module node16' : '--module esnext';
    console.log(`  - moduleResolution: ${moduleResolution}`);
    execSync(
      `npx tsc --noEmit --target es2020 ${moduleFlag} --moduleResolution ${moduleResolution} test-ts-core.ts`,
      { cwd: tempDir, stdio: 'inherit' }
    );
  }

  // 17. Verify the "use client" directive is emitted in both root and core files in the packed tarball
  console.log(`\n11. Verifying "use client" directive in packed tarball...`);
  const packedDistDir = path.join(tempDir, 'node_modules', 'use-stellar', 'dist');
  const filesToCheck = ['index.js', 'index.mjs', 'core.js', 'core.mjs'];
  for (const file of filesToCheck) {
    const filePath = path.join(packedDistDir, file);
    assert.ok(fs.existsSync(filePath), `Expected ${file} to exist in packed tarball at ${filePath}`);
    const firstLine = fs.readFileSync(filePath, 'utf8').split('\n')[0].trim();
    assert.ok(
      firstLine.startsWith('"use client"'),
      `Expected ${file} in packed tarball to begin with "use client" directive, but got: ${firstLine}`
    );
    console.log(`  ✓ ${file} begins with "use client"`);
  }

  // 18. Verify core declaration files exist
  console.log(`\n12. Verifying core declaration files in packed tarball...`);
  const declarationFilesToCheck = ['core.d.ts', 'core.d.mts'];
  for (const file of declarationFilesToCheck) {
    const filePath = path.join(packedDistDir, file);
    assert.ok(fs.existsSync(filePath), `Expected ${file} to exist in packed tarball at ${filePath}`);
    console.log(`  ✓ ${file} exists`);
  }

  console.log('\n🎉 ALL SMOKE TESTS PASSED SUCCESSFULLY! Packaging is verified.');
  cleanup();
} catch (err) {
  console.error('\n❌ SMOKE TEST FAILED!');
  console.error(err.message);
  cleanup();
  process.exit(1);
}
