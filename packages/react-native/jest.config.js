module.exports = {
  preset: "react-native",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  setupFilesAfterEnv: ["<rootDir>/src/test-utils/setup.ts"],
  moduleNameMapper: {
    "^@stellar/stellar-sdk$": "<rootDir>/../../core/src/__mocks__/@stellar/stellar-sdk.ts",
    "^use-stellar$": "<rootDir>/../../core/src/index.ts",
    "^react-native$": "<rootDir>/src/__mocks__/react-native.ts",
    "^@react-native-async-storage/async-storage$": "<rootDir>/src/test-utils/mocks/AsyncStorage.ts",
    "^@react-native-community/netinfo$": "<rootDir>/src/test-utils/mocks/NetInfo.ts",
    "^@walletconnect/react-native-compat$": "<rootDir>/src/test-utils/mocks/WalletConnect.ts",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          jsx: "react",
          allowJs: true,
          esModuleInterop: true,
        },
      },
    ],
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/__mocks__/**",
    "!src/**/__tests__/**",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/test-utils/**",
  ],
  coverageReporters: ["text-summary", "lcov"],
  coverageDirectory: "coverage",
  // Inherit clearMocks strategy from core for consistency
  clearMocks: true,
  timers: "fake",
}
