module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  // Kept deliberately: several suites drive module-scope mock state (the SDK
  // double, the query store) that is safe across worker processes but not
  // across interleaved files in one process. Revisit with a timing comparison.
  maxWorkers: 1,
  testMatch: [
    '**/*.test.ts',
    '**/*.test.tsx'
  ],
  setupFilesAfterEnv: [
    '@testing-library/jest-dom'
  ],
  moduleNameMapper: {
    '^@stellar/stellar-sdk$': '<rootDir>/src/__mocks__/@stellar/stellar-sdk.ts'
  },
  // `clearMocks` resets call history between tests, which is what the suites
  // want. `resetMocks` additionally strips mock *implementations*, which wipes
  // out the module-scope doubles defined once per file — after the first test
  // in a file they would return `undefined`. `restoreMocks` only affects
  // `jest.spyOn`; a test that needs it calls `jest.restoreAllMocks()` itself,
  // locally, where a reader can see it.
  clearMocks: true,
};
