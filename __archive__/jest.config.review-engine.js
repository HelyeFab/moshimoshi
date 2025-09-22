/**
 * Jest Configuration for Universal Review Engine Testing
 * Agent 2: Test Configuration Specialist
 * 
 * Configured for:
 * - 80% minimum coverage requirement
 * - Parallel test execution across 3 agents
 * - Custom matchers and test utilities
 * - Performance monitoring
 */

// Review Engine Jest configuration - using ts-jest for better TypeScript support
const reviewEngineConfig = {
  // Use ts-jest preset for better TypeScript handling
  preset: 'ts-jest',
  
  // Test environment - node for server-side tests
  testEnvironment: 'node',
  
  // Display name for this config
  displayName: 'Review Engine Tests',
  
  // Roots - where to look for tests and modules
  roots: ['<rootDir>/src'],
  
  // Module name mapper for path aliases
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@test-utils/(.*)$': '<rootDir>/src/lib/review-engine/__tests__/test-utils/$1',
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/src/lib/review-engine/__tests__/jest.setup.ts'
  ],

  // Test match patterns - focus on review engine
  testMatch: [
    '<rootDir>/src/lib/review-engine/**/*.test.{ts,tsx}',
    '<rootDir>/src/app/api/review/**/*.test.{ts,tsx}',
    '<rootDir>/src/components/review/**/*.test.{ts,tsx}',
    '<rootDir>/__tests__/**/review*.test.{ts,tsx}'
  ],
  
  // Transform configuration - using ts-jest for TypeScript
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: '<rootDir>/tsconfig.json',
      useESM: false
    }]
  },

  // Coverage configuration - CRITICAL: 80% minimum
  collectCoverage: true,
  collectCoverageFrom: [
    'src/lib/review-engine/**/*.{ts,tsx}',
    'src/app/api/review/**/*.{ts,tsx}',
    'src/components/review/**/*.{ts,tsx}',
    // Exclude test files and types
    '!**/*.test.{ts,tsx}',
    '!**/*.spec.{ts,tsx}',
    '!**/__tests__/**',
    '!**/*.d.ts',
    '!**/interfaces.ts',
    '!**/types.ts',
    '!**/index.ts'
  ],

  // Coverage thresholds - ENFORCE 80% minimum
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Module-specific thresholds for critical components
    './src/lib/review-engine/core/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/lib/review-engine/srs/': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/lib/review-engine/validation/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },

  // Coverage report formats
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov',
    'json-summary'
  ],

  // Coverage directory
  coverageDirectory: '<rootDir>/coverage/review-engine',

  // Parallel execution configuration
  maxWorkers: '50%',

  // Test timeout
  testTimeout: 10000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,

  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(uuid|nanoid|@upstash|uncrypto)/)',
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  // Bail on first test failure (useful for CI)
  bail: false,

  // Error on deprecated APIs
  errorOnDeprecated: true,

  // Notify on completion
  notify: false,

  // Watch plugins for better DX
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/review-engine',
        filename: 'test-report.html',
        pageTitle: 'Review Engine Test Report',
        expand: true,
        openReport: false
      }
    ]
  ]
};

module.exports = reviewEngineConfig;