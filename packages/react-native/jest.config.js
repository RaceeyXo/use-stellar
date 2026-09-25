module.exports = {
  displayName: "react-native",
  preset: "react-native",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/?(*.)+(spec|test).ts?(x)", "**/*.test.ts", "**/*.test.tsx"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: {
        jsx: "react-jsx",
      },
    }],
  },
  moduleNameMapper: {
    "^@use-stellar/core$": "<rootDir>/../core/src",
    "^@stellar/stellar-sdk$": "<rootDir>/../../core/src/__mocks__/@stellar/stellar-sdk.ts",
    "^use-stellar$": "<rootDir>/../../core/src/index.ts",
    "^react-native$": "<rootDir>/src/__mocks__/react-native.ts",
    "^@react-native-async-storage/async-storage$": "<rootDir>/src/test-utils/mocks/AsyncStorage.ts",
    "^@react-native-community/netinfo$": "<rootDir>/src/test-utils/mocks/NetInfo.ts",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/__mocks__/**",
    "!src/**/__tests__/**",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/test-utils/**",
  ],
  setupFilesAfterEnv: [],
  coverageReporters: ["text-summary", "lcov"],
  coverageDirectory: "coverage",
  clearMocks: true,
  timers: "fake",
}
