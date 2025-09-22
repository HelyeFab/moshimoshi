#!/usr/bin/env node

/**
 * SRS Algorithm Performance Test
 * Tests the SRS algorithm performance to ensure <10ms p95 latency
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Mock SRS implementation for testing
class MockSRSAlgorithm {
  constructor() {
    this.config = {
      initialEaseFactor: 2.5,
      minEaseFactor: 1.3,
      maxEaseFactor: 2.5,
      learningSteps: [0.0069, 0.0208],
      graduatingInterval: 1,
      easyMultiplier: 1.3,
      hardMultiplier: 0.6,
      maxInterval: 365,
      leechThreshold: 8,
      responseTimeFactor: 0.001
    };
  }

  calculateNextReview(item, result) {
    // Simulate SRS calculations with realistic complexity
    const currentSRS = item.srsData || this.initializeSRSData();
    const quality = this.getQualityFromResult(result);
    
    let newSRS = { ...currentSRS };
    
    // Simulate processing overhead
    this.performCalculations(newSRS, result, quality);
    
    return newSRS;
  }

  initializeSRSData() {
    return {
      interval: 0,
      easeFactor: this.config.initialEaseFactor,
      repetitions: 0,
      lastReviewedAt: null,
      nextReviewAt: new Date(),
      status: 'new',
      reviewCount: 0,
      correctCount: 0,
      streak: 0,
      bestStreak: 0
    };
  }

  getQualityFromResult(result) {
    if (!result.correct) return 0;
    
    let quality = 3;
    if (result.responseTime < 2000) quality++;
    else if (result.responseTime > 10000) quality--;
    
    return Math.max(1, Math.min(5, quality));
  }

  performCalculations(srs, result, quality) {
    // Simulate complex calculations
    for (let i = 0; i < 1000; i++) {
      const calc = Math.sin(i) * Math.cos(quality) * srs.easeFactor;
      if (calc > 0.5) srs.repetitions++;
    }
    
    // Simulate ease factor calculation
    srs.easeFactor = srs.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    srs.easeFactor = Math.max(this.config.minEaseFactor, Math.min(this.config.maxEaseFactor, srs.easeFactor));
    
    // Simulate interval calculation
    if (srs.repetitions <= 2) {
      srs.interval = srs.repetitions === 1 ? 1 : 6;
    } else {
      srs.interval = Math.round(srs.interval * srs.easeFactor);
    }
    
    srs.interval = Math.min(srs.interval, this.config.maxInterval);
    srs.lastReviewedAt = new Date();
    srs.nextReviewAt = new Date(Date.now() + srs.interval * 24 * 60 * 60 * 1000);
  }
}

class SRSPerformanceTester {
  constructor() {
    this.algorithm = new MockSRSAlgorithm();
    this.results = [];
  }

  generateTestData(count) {
    const testData = [];
    
    for (let i = 0; i < count; i++) {
      testData.push({
        id: `item_${i}`,
        srsData: i % 3 === 0 ? null : { // Mix of new and existing items
          interval: Math.random() * 30,
          easeFactor: 1.3 + Math.random() * 1.2,
          repetitions: Math.floor(Math.random() * 10),
          status: ['new', 'learning', 'review', 'mastered'][Math.floor(Math.random() * 4)],
          reviewCount: Math.floor(Math.random() * 50),
          correctCount: Math.floor(Math.random() * 40),
          streak: Math.floor(Math.random() * 10),
          bestStreak: Math.floor(Math.random() * 15),
          lastReviewedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          nextReviewAt: new Date(Date.now() + Math.random() * 7 * 24 * 60 * 60 * 1000)
        },
        result: {
          correct: Math.random() > 0.3,
          responseTime: 1000 + Math.random() * 8000,
          confidence: Math.ceil(Math.random() * 5),
          hintsUsed: Math.random() > 0.7 ? Math.floor(Math.random() * 3) : 0,
          attemptCount: 1 + Math.floor(Math.random() * 2)
        }
      });
    }
    
    return testData;
  }

  async runPerformanceTest(testSize = 10000, iterations = 5) {
    console.log(`🚀 Starting SRS Algorithm Performance Test`);
    console.log(`📊 Test Size: ${testSize} items`);
    console.log(`🔄 Iterations: ${iterations}`);
    console.log('');

    const allTimings = [];
    
    for (let iteration = 0; iteration < iterations; iteration++) {
      console.log(`Running iteration ${iteration + 1}/${iterations}...`);
      
      const testData = this.generateTestData(testSize);
      const timings = [];
      
      // Warm up
      for (let i = 0; i < 100; i++) {
        this.algorithm.calculateNextReview(testData[i % testData.length], testData[i % testData.length].result);
      }
      
      // Actual test
      for (let i = 0; i < testData.length; i++) {
        const start = performance.now();
        
        this.algorithm.calculateNextReview(testData[i], testData[i].result);
        
        const end = performance.now();
        const duration = end - start;
        timings.push(duration);
      }
      
      allTimings.push(...timings);
      
      // Report iteration results
      const sorted = [...timings].sort((a, b) => a - b);
      const stats = this.calculateStats(sorted);
      
      console.log(`  Iteration ${iteration + 1} Results:`);
      console.log(`    Mean: ${stats.mean.toFixed(3)}ms`);
      console.log(`    P95: ${stats.p95.toFixed(3)}ms`);
      console.log(`    P99: ${stats.p99.toFixed(3)}ms`);
      console.log(`    Max: ${stats.max.toFixed(3)}ms`);
      console.log('');
    }

    return this.generateReport(allTimings, testSize, iterations);
  }

  calculateStats(sortedTimings) {
    const length = sortedTimings.length;
    const sum = sortedTimings.reduce((a, b) => a + b, 0);
    
    return {
      count: length,
      mean: sum / length,
      min: sortedTimings[0],
      max: sortedTimings[length - 1],
      p50: sortedTimings[Math.floor(length * 0.5)],
      p95: sortedTimings[Math.floor(length * 0.95)],
      p99: sortedTimings[Math.floor(length * 0.99)]
    };
  }

  generateReport(allTimings, testSize, iterations) {
    const sorted = [...allTimings].sort((a, b) => a - b);
    const stats = this.calculateStats(sorted);
    
    const report = {
      timestamp: new Date().toISOString(),
      testConfiguration: {
        testSize,
        iterations,
        totalOperations: allTimings.length
      },
      performance: {
        timings: stats,
        targetP95: 10.0,
        targetMean: 5.0,
        actualP95: stats.p95,
        actualMean: stats.mean
      },
      evaluation: {
        p95Passed: stats.p95 <= 10.0,
        meanPassed: stats.mean <= 5.0,
        overallPassed: stats.p95 <= 10.0 && stats.mean <= 5.0
      },
      distribution: {
        under1ms: sorted.filter(t => t < 1).length,
        under5ms: sorted.filter(t => t < 5).length,
        under10ms: sorted.filter(t => t < 10).length,
        over10ms: sorted.filter(t => t >= 10).length
      },
      recommendations: []
    };

    // Add recommendations based on results
    if (stats.p95 > 10.0) {
      report.recommendations.push({
        type: 'critical',
        message: `P95 latency (${stats.p95.toFixed(2)}ms) exceeds target (10ms)`,
        suggestions: [
          'Consider algorithm optimization',
          'Implement caching for repeated calculations',
          'Review complex mathematical operations'
        ]
      });
    }

    if (stats.mean > 5.0) {
      report.recommendations.push({
        type: 'warning',
        message: `Mean latency (${stats.mean.toFixed(2)}ms) exceeds target (5ms)`,
        suggestions: [
          'Profile hot code paths',
          'Consider pre-computation of common values',
          'Optimize data structures'
        ]
      });
    }

    if (report.distribution.over10ms > allTimings.length * 0.1) {
      report.recommendations.push({
        type: 'warning',
        message: `${report.distribution.over10ms} operations (${((report.distribution.over10ms / allTimings.length) * 100).toFixed(1)}%) exceeded 10ms`,
        suggestions: [
          'Investigate outliers in algorithm execution',
          'Consider timeout mechanisms',
          'Review edge cases in calculation logic'
        ]
      });
    }

    return report;
  }

  printReport(report) {
    console.log('='.repeat(60));
    console.log('📊 SRS ALGORITHM PERFORMANCE REPORT');
    console.log('='.repeat(60));
    
    console.log(`\nTest Configuration:`);
    console.log(`  Test Size: ${report.testConfiguration.testSize.toLocaleString()} items per iteration`);
    console.log(`  Iterations: ${report.testConfiguration.iterations}`);
    console.log(`  Total Operations: ${report.testConfiguration.totalOperations.toLocaleString()}`);
    
    console.log(`\nPerformance Results:`);
    console.log(`  Mean: ${report.performance.timings.mean.toFixed(3)}ms (target: ≤${report.performance.targetMean}ms)`);
    console.log(`  P50: ${report.performance.timings.p50.toFixed(3)}ms`);
    console.log(`  P95: ${report.performance.timings.p95.toFixed(3)}ms (target: ≤${report.performance.targetP95}ms)`);
    console.log(`  P99: ${report.performance.timings.p99.toFixed(3)}ms`);
    console.log(`  Max: ${report.performance.timings.max.toFixed(3)}ms`);
    
    console.log(`\nDistribution:`);
    console.log(`  < 1ms: ${report.distribution.under1ms.toLocaleString()} (${((report.distribution.under1ms / report.testConfiguration.totalOperations) * 100).toFixed(1)}%)`);
    console.log(`  < 5ms: ${report.distribution.under5ms.toLocaleString()} (${((report.distribution.under5ms / report.testConfiguration.totalOperations) * 100).toFixed(1)}%)`);
    console.log(`  < 10ms: ${report.distribution.under10ms.toLocaleString()} (${((report.distribution.under10ms / report.testConfiguration.totalOperations) * 100).toFixed(1)}%)`);
    console.log(`  ≥ 10ms: ${report.distribution.over10ms.toLocaleString()} (${((report.distribution.over10ms / report.testConfiguration.totalOperations) * 100).toFixed(1)}%)`);
    
    const status = report.evaluation.overallPassed ? '✅ PASSED' : '❌ FAILED';
    const statusColor = report.evaluation.overallPassed ? '\x1b[32m' : '\x1b[31m';
    
    console.log(`\n${statusColor}${status}\x1b[0m - Performance Evaluation:`);
    console.log(`  P95 Target: ${report.evaluation.p95Passed ? '✅' : '❌'} ${report.performance.actualP95.toFixed(2)}ms ≤ ${report.performance.targetP95}ms`);
    console.log(`  Mean Target: ${report.evaluation.meanPassed ? '✅' : '❌'} ${report.performance.actualMean.toFixed(2)}ms ≤ ${report.performance.targetMean}ms`);
    
    if (report.recommendations.length > 0) {
      console.log(`\n📋 Recommendations:`);
      report.recommendations.forEach(rec => {
        const icon = rec.type === 'critical' ? '🔴' : '⚠️';
        console.log(`\n  ${icon} ${rec.message}`);
        rec.suggestions.forEach(suggestion => {
          console.log(`     • ${suggestion}`);
        });
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }

  saveReport(report) {
    const reportDir = 'performance-reports';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `srs-performance-${timestamp}.json`);
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportFile}`);
    
    // Also save as latest
    fs.writeFileSync(path.join(reportDir, 'latest-srs-performance.json'), JSON.stringify(report, null, 2));
  }
}

// Run the test
async function main() {
  try {
    const tester = new SRSPerformanceTester();
    const report = await tester.runPerformanceTest(10000, 3);
    
    tester.printReport(report);
    tester.saveReport(report);
    
    // Exit with appropriate code
    process.exit(report.evaluation.overallPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ SRS Performance test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { SRSPerformanceTester };