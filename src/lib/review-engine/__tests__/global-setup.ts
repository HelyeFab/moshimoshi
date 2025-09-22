/**
 * Global Setup for Review Engine Tests
 * Runs once before all test suites
 */

import { performance } from 'perf_hooks';
import { reviewLogger } from '@/lib/monitoring/logger';
import fs from 'fs';
import path from 'path';

export default async function globalSetup() {
  reviewLogger.info('\n🚀 Starting Review Engine Test Suite');
  reviewLogger.info('━'.repeat(50));
  
  // Record start time
  const g = global as any;
  g.__TEST_START_TIME__ = performance.now();
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.CI = process.env.CI || 'false';
  
  // Initialize test database schema
  reviewLogger.info('📦 Initializing test database...');
  
  // Create test report directory
  const coverageDir = path.join(process.cwd(), 'coverage', 'review-engine');
  
  if (!fs.existsSync(coverageDir)) {
    fs.mkdirSync(coverageDir, { recursive: true });
  }
  
  // Log test configuration
  reviewLogger.info('⚙️  Test Configuration:');
  reviewLogger.info(`   - Coverage Required: 80%`);
  reviewLogger.info(`   - Parallel Workers: ${process.env.JEST_WORKER_ID ? 'Enabled' : 'Disabled'}`);
  reviewLogger.info(`   - CI Mode: ${process.env.CI === 'true' ? 'Yes' : 'No'}`);
  reviewLogger.info('━'.repeat(50));
  reviewLogger.info('');
  
  return Promise.resolve();
}