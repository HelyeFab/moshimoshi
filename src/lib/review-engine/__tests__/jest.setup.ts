/**
 * Jest Setup for Universal Review Engine Tests
 * Agent 1: Test Architect
 * 
 * Global test configuration and setup
 */

import '@testing-library/jest-dom';
import './test-utils/customMatchers';
import { TextEncoder, TextDecoder } from 'util';
import { reviewLogger } from '@/lib/monitoring/logger';

// Polyfills for Node environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Setup test database
import { getTestDatabase, resetTestDatabase } from './test-utils/testDatabase';

// Mock timers configuration
beforeAll(() => {
  // Use modern fake timers
  jest.useFakeTimers({
    doNotFake: ['nextTick', 'setImmediate']
  });
});

afterAll(() => {
  jest.useRealTimers();
});

// Reset test database before each test suite
beforeEach(() => {
  resetTestDatabase();
});

// Clear all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
  jest.clearAllTimers();
});

// Global test timeout
jest.setTimeout(10000);

// Suppress console errors in tests (unless debugging)
if (process.env.DEBUG_TESTS !== 'true') {
  global.console = {
    ...console,
    error: jest.fn(),
    warn: jest.fn(),
  };
}

// Mock environment variables
process.env = {
  ...process.env,
  NODE_ENV: 'test',
  NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  FIREBASE_ADMIN_PRIVATE_KEY: 'test-key',
  FIREBASE_ADMIN_CLIENT_EMAIL: 'test@test.com',
  FIREBASE_ADMIN_PROJECT_ID: 'test-project',
  UPSTASH_REDIS_REST_URL: 'http://localhost:6379',
  UPSTASH_REDIS_REST_TOKEN: 'test-token'
};

// Mock fetch for API tests
global.fetch = jest.fn();

// Mock IndexedDB for offline tests
import { IDBFactory } from 'fake-indexeddb';
global.indexedDB = new IDBFactory();

// Performance monitoring
let testStartTime: number;

beforeEach(() => {
  testStartTime = Date.now();
});

afterEach(() => {
  const duration = Date.now() - testStartTime;
  if (duration > 1000) {
    reviewLogger.warn(`⚠️ Slow test detected: ${duration}ms`);
  }
});

// Custom error handler for better test debugging
process.on('unhandledRejection', (reason, promise) => {
  reviewLogger.error('Unhandled Promise Rejection in test:', reason);
  throw reason;
});

// Export test utilities for use in tests
export * from './test-utils/mockFactory';
export * from './test-utils/testDatabase';
export * from './test-utils/customMatchers';