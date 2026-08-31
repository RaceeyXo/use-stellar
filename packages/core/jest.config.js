module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  maxWorkers: 1,
  testMatch: [
    '**/*.test.ts',
    '**/*.test.tsx'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/__mocks__/**',
    '!src/**/__tests__/**',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.d.mts',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  coverageDirectory: 'coverage',
  // Set from the measured baseline (see the test-core coverage PR): statements
  // 90.04%, branches 80.4%, functions 76.52%, lines 92.39%. Kept a little below
  // the measured numbers so the threshold ratchets up instead of blocking.
  coverageThreshold: {
    global: {
      statements: 88,
      branches: 78,
      functions: 75,
      lines: 91,
    },
  },
  setupFilesAfterEnv: [
    '@testing-library/jest-dom'
  ],
  moduleNameMapper: {
    '^@stellar/stellar-sdk$': '<rootDir>/src/__mocks__/@stellar/stellar-sdk.ts'
  },
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};