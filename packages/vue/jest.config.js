module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  clearMocks: true,
  moduleNameMapper: {
    "^use-stellar/core$": "<rootDir>/../core/src/core.ts",
  },
}
