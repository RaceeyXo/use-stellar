module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  maxWorkers: 1,
  testMatch: [
    '**/__tests__/integration/**/*.test.ts'
  ],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
};
