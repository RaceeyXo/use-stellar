module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  setupFilesAfterEnv: ["@testing-library/jest-dom"],
  moduleNameMapper: {
    "^@stellar/stellar-sdk$": "<rootDir>/src/__mocks__/@stellar/stellar-sdk.ts",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/__mocks__/**",
    "!src/**/__tests__/**",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.d.mts",
  ],
  coverageReporters: ["text-summary", "lcov"],
  coverageDirectory: "coverage",
  // Measured on this tree: statements 85.87%, branches 76.47%, functions
  // 77.45%, lines 88.2%. Held a little under those so the threshold ratchets
  // up as coverage improves instead of blocking the suite today. Re-measure
  // with `pnpm --filter use-stellar test -- --coverage` before raising them.
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 76,
      functions: 77,
      lines: 88,
    },
  },
  // `clearMocks` resets call history between tests, which is what the suites
  // want. `resetMocks` additionally strips mock *implementations*, which wipes
  // out the module-scope doubles defined once per file — after the first test
  // in a file they would return `undefined`. `restoreMocks` only affects
  // `jest.spyOn`; a test that needs it calls `jest.restoreAllMocks()` itself,
  // locally, where a reader can see it.
  clearMocks: true,
  // Keep clearMocks to reset call history between tests but preserve
  // implemented mock functions. Removing `resetMocks`/`restoreMocks`
  // prevents jest.resetAllMocks() from stripping module-scope mock
  // implementations which this repo's manual mocks rely on.
}
