module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/test"],
  testMatch: ["**/*.test.ts"],
  clearMocks: true,
  transform: {
    "^.+\.ts$": [
      "ts-jest",
      {
        // The package is ESM; Jest runs CommonJS.
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
          target: "ES2022",
          esModuleInterop: true,
          verbatimModuleSyntax: false,
          isolatedModules: true,
          skipLibCheck: true,
          types: ["jest", "node"],
        },
      },
    ],
  },
  moduleNameMapper: {
    "^use-stellar/core$": "<rootDir>/../core/src/core.ts",
  },
}
