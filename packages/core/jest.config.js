module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  setupFilesAfterEnv: ["@testing-library/jest-dom"],
  moduleNameMapper: {
    "^@stellar/stellar-sdk$": "<rootDir>/src/__mocks__/@stellar/stellar-sdk.ts",
  },
  clearMocks: true,
  // Keep clearMocks to reset call history between tests but preserve
  // implemented mock functions. Removing `resetMocks`/`restoreMocks`
  // prevents jest.resetAllMocks() from stripping module-scope mock
  // implementations which this repo's manual mocks rely on.
}
