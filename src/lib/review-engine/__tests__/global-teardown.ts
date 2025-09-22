/**
 * Global Teardown for Review Engine Tests
 * Runs once after all test suites complete
 */

import { performance } from 'perf_hooks';
import * as fs from 'fs';
import * as path from 'path';
import { reviewLogger } from '@/lib/monitoring/logger';

export default async function globalTeardown() {
  reviewLogger.info('\n━'.repeat(50));
  
  // Calculate total test duration
  const g = global as any;
  const startTime = g.__TEST_START_TIME__;
  if (startTime) {
    const duration = performance.now() - startTime;
    const seconds = (duration / 1000).toFixed(2);
    reviewLogger.info(`⏱️  Total Test Duration: ${seconds}s`);
  }
  
  // Read coverage summary if available
  const coveragePath = path.join(process.cwd(), 'coverage', 'review-engine', 'coverage-summary.json');
  
  if (fs.existsSync(coveragePath)) {
    try {
      const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'));
      const total = coverage.total;
      
      reviewLogger.info('\n📊 Coverage Summary:');
      reviewLogger.info(`   Lines:      ${total.lines.pct}% (${total.lines.covered}/${total.lines.total})`);
      reviewLogger.info(`   Statements: ${total.statements.pct}% (${total.statements.covered}/${total.statements.total})`);
      reviewLogger.info(`   Functions:  ${total.functions.pct}% (${total.functions.covered}/${total.functions.total})`);
      reviewLogger.info(`   Branches:   ${total.branches.pct}% (${total.branches.covered}/${total.branches.total})`);
      
      // Check if coverage meets requirements
      const meetsRequirement = 
        total.lines.pct >= 80 &&
        total.statements.pct >= 80 &&
        total.functions.pct >= 80 &&
        total.branches.pct >= 80;
      
      if (meetsRequirement) {
        reviewLogger.info('\n✅ Coverage requirement met (80% minimum)');
      } else {
        reviewLogger.info('\n❌ Coverage below 80% requirement');
      }
    } catch (error) {
      reviewLogger.info('⚠️  Could not read coverage summary');
    }
  }
  
  // Generate test report summary
  const reportPath = path.join(process.cwd(), 'coverage', 'review-engine', 'test-summary.json');
  const summary = {
    timestamp: new Date().toISOString(),
    duration: g.__TEST_START_TIME__ ? 
      performance.now() - g.__TEST_START_TIME__ : 0,
    environment: {
      node: process.version,
      ci: process.env.CI === 'true'
    }
  };
  
  fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
  
  reviewLogger.info('━'.repeat(50));
  reviewLogger.info('✨ Review Engine Test Suite Complete\n');
  
  // Cleanup
  delete g.__TEST_START_TIME__;
  
  return Promise.resolve();
}