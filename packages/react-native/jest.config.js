/**
 * Jest config for @use-stellar/react-native.
 *
 * Tests run in plain Node — no jsdom, so there is no `window` or `document`,
 * matching a React Native JS runtime — and render through
 * @testing-library/react-native (react-test-renderer), never react-dom.
 *
 * `react-native` itself is replaced by a lightweight mock
 * (`src/__mocks__/react-native.ts`): host components as plain strings plus
 * controllable AppState/Linking doubles. That keeps the real native runtime
 * (Flow sources, TurboModules) out of the test process. Core hooks are loaded
 * from `packages/core/src`, so the RN build reuses them rather than a copy.
 */
module.exports = {
  displayName: "react-native",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        isolatedModules: true,
        tsconfig: { jsx: "react-jsx", esModuleInterop: true },
      },
    ],
  },
  moduleNameMapper: {
    "^@use-stellar/core$": "<rootDir>/../core/src/index.ts",
    "^use-stellar$": "<rootDir>/../core/src/index.ts",
    "^@stellar/stellar-sdk$": "<rootDir>/../core/src/__mocks__/@stellar/stellar-sdk.ts",
    "^react-native$": "<rootDir>/src/__mocks__/react-native.ts",
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/src/test-utils/mocks/AsyncStorage.ts",
    "^@react-native-community/netinfo$": "<rootDir>/src/test-utils/mocks/NetInfo.ts",
  },
  setupFilesAfterEnv: ["<rootDir>/src/test-utils/setup.ts"],
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
  clearMocks: true,
}
