/**
 * Master Jest Configuration for All Tests
 * Unified coverage reporting across all test suites
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const allTestsConfig = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Projects configuration for running multiple test suites
  projects: [
    // Main Jest configuration for unit tests
    {
      displayName: 'Unit Tests',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      testMatch: [
        '<rootDir>/__tests__/**/*.test.{ts,tsx}',
        '<rootDir>/src/**/*.test.{ts,tsx}',
        '!<rootDir>/src/lib/review-engine/**/*.test.{ts,tsx}',
        '!<rootDir>/src/app/api/review/**/*.test.{ts,tsx}',
        '!<rootDir>/src/components/review/**/*.test.{ts,tsx}',
      ],
      collectCoverageFrom: [
        'src/**/*.{ts,tsx}',
        '!src/lib/review-engine/**',
        '!**/*.test.{ts,tsx}',
        '!**/__tests__/**',
        '!**/*.d.ts',
        '!**/node_modules/**',
      ],
      coverageDirectory: '<rootDir>/coverage/unit',
    },
    // Review Engine tests configuration
    {
      displayName: 'Review Engine Tests',
      preset: 'ts-jest',
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/src/lib/review-engine/__tests__/jest.setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@test-utils/(.*)$': '<rootDir>/src/lib/review-engine/__tests__/test-utils/$1',
      },
      testMatch: [
        '<rootDir>/src/lib/review-engine/**/*.test.{ts,tsx}',
        '<rootDir>/src/app/api/review/**/*.test.{ts,tsx}',
        '<rootDir>/src/components/review/**/*.test.{ts,tsx}',
        '<rootDir>/__tests__/**/review*.test.{ts,tsx}'
      ],
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', {
          tsconfig: '<rootDir>/tsconfig.json',
          useESM: false
        }]
      },
      collectCoverageFrom: [
        'src/lib/review-engine/**/*.{ts,tsx}',
        'src/app/api/review/**/*.{ts,tsx}',
        'src/components/review/**/*.{ts,tsx}',
        '!**/*.test.{ts,tsx}',
        '!**/__tests__/**',
        '!**/*.d.ts',
        '!**/interfaces.ts',
        '!**/types.ts',
        '!**/index.ts'
      ],
      coverageDirectory: '<rootDir>/coverage/review-engine',
    }
  ],

  // Global coverage configuration
  collectCoverage: true,
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary',
    'clover'
  ],

  // Combined coverage directory
  coverageDirectory: '<rootDir>/coverage/combined',

  // Coverage thresholds (lenient for combined report)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },

  // Test timeout
  testTimeout: 15000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,

  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|nanoid|@upstash|uncrypto)/)',
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Watch plugins for better DX
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Reporters
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/combined',
        filename: 'test-report.html',
        pageTitle: 'Moshimoshi Test Report - All Suites',
        expand: true,
        openReport: false
      }
    ]
  ],

  // Parallel execution
  maxWorkers: '75%',

  // Pass with no tests for CI
  passWithNoTests: true,

  // Error on deprecated APIs
  errorOnDeprecated: true,

  // Bail configuration
  bail: false,
};

module.exports = createJestConfig(allTestsConfig);