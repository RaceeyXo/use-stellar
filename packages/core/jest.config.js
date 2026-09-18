module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  setupFilesAfterEnv: ["@testing-library/jest-dom"],
  moduleNameMapper: {
    "^@stellar/stellar-sdk$": "<rootDir>/src/__mocks__/@stellar/stellar-sdk.ts",
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
