const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jsdom',

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],

  testMatch: [
    '<rootDir>/**/*.test.{ts,tsx,js,jsx}',
    '<rootDir>/**/*.spec.{ts,tsx,js,jsx}',
  ],

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
    '!**/__tests__/**',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],

  coverageDirectory: '<rootDir>/coverage',

  testTimeout: 10000,

  verbose: true,

  clearMocks: true,

  restoreMocks: true,

  transformIgnorePatterns: [
    'node_modules/(?!(uuid|nanoid|@upstash|uncrypto|idb)/)',
  ],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
};

module.exports = createJestConfig(customJestConfig);