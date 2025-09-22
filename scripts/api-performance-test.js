#!/usr/bin/env node

/**
 * API Performance Test
 * Tests API endpoint performance against defined budgets
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Mock API endpoints for testing
class MockAPIEndpoint {
  constructor(name, baseLatency = 10, variability = 5) {
    this.name = name;
    this.baseLatency = baseLatency;
    this.variability = variability;
    this.requestCount = 0;
    this.errorRate = 0.001; // 0.1% error rate
  }

  async call() {
    const start = performance.now();
    this.requestCount++;
    
    // Simulate network and processing latency
    const latency = this.baseLatency + (Math.random() - 0.5) * this.variability;
    await this.delay(Math.max(1, latency));
    
    // Simulate occasional errors
    if (Math.random() < this.errorRate) {
      const end = performance.now();
      throw new Error(`Simulated error in ${this.name}`);
    }
    
    const end = performance.now();
    return {
      success: true,
      duration: end - start,
      data: { message: `Response from ${this.name}`, requestId: this.requestCount }
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class APIPerformanceTester {
  constructor() {
    // Define API endpoints based on performance budget
    this.endpoints = {
      // Authentication APIs
      'auth/signin': new MockAPIEndpoint('auth/signin', 150, 30),
      'auth/refresh': new MockAPIEndpoint('auth/refresh', 75, 15),
      'auth/logout': new MockAPIEndpoint('auth/logout', 25, 10),
      
      // Review APIs
      'review/queue': new MockAPIEndpoint('review/queue', 40, 10),
      'review/session': new MockAPIEndpoint('review/session', 150, 25),
      'review/submit': new MockAPIEndpoint('review/submit', 75, 15),
      'review/progress': new MockAPIEndpoint('review/progress', 30, 8),
      
      // Data APIs
      'user/profile': new MockAPIEndpoint('user/profile', 75, 20),
      'lessons/list': new MockAPIEndpoint('lessons/list', 100, 25),
      'stats/calculate': new MockAPIEndpoint('stats/calculate', 150, 40),
      
      // Admin APIs
      'admin/dashboard': new MockAPIEndpoint('admin/dashboard', 400, 80),
      'admin/users': new MockAPIEndpoint('admin/users', 250, 50)
    };

    // Performance targets from budget
    this.targets = {
      'auth/signin': { p95: 200, warning: 150 },
      'auth/refresh': { p95: 100, warning: 75 },
      'auth/logout': { p95: 50, warning: 30 },
      'review/queue': { p95: 50, warning: 40 },
      'review/session': { p95: 200, warning: 150 },
      'review/submit': { p95: 100, warning: 75 },
      'review/progress': { p95: 50, warning: 30 },
      'user/profile': { p95: 100, warning: 75 },
      'lessons/list': { p95: 150, warning: 100 },
      'stats/calculate': { p95: 200, warning: 150 },
      'admin/dashboard': { p95: 500, warning: 400 },
      'admin/users': { p95: 300, warning: 250 }
    };
  }

  async runAPIPerformanceTest() {
    console.log('🚀 Starting API Performance Test\n');

    const testConfigs = [
      { name: 'Light Load', concurrency: 1, requests: 100 },
      { name: 'Medium Load', concurrency: 5, requests: 500 },
      { name: 'Heavy Load', concurrency: 10, requests: 1000 },
      { name: 'Burst Load', concurrency: 20, requests: 500 }
    ];

    const allResults = [];

    for (const config of testConfigs) {
      console.log(`📊 Running ${config.name} test (${config.concurrency} concurrent, ${config.requests} total requests)`);
      const results = await this.runLoadTest(config);
      allResults.push(results);
      
      console.log(`  Completed in ${results.totalDuration.toFixed(2)}s`);
      console.log(`  RPS: ${results.requestsPerSecond.toFixed(2)}`);
      console.log(`  Avg Latency: ${results.overallStats.mean.toFixed(2)}ms`);
      console.log(`  P95 Latency: ${results.overallStats.p95.toFixed(2)}ms`);
      console.log(`  Error Rate: ${(results.errorRate * 100).toFixed(3)}%\n`);
    }

    return this.generateReport(allResults);
  }

  async runLoadTest(config) {
    const startTime = performance.now();
    const results = [];
    const errors = [];
    
    // Create batches for concurrent execution
    const batchSize = config.concurrency;
    const totalBatches = Math.ceil(config.requests / batchSize);
    
    for (let batch = 0; batch < totalBatches; batch++) {
      const batchPromises = [];
      const requestsInBatch = Math.min(batchSize, config.requests - batch * batchSize);
      
      for (let i = 0; i < requestsInBatch; i++) {
        // Randomly select endpoint for each request
        const endpointNames = Object.keys(this.endpoints);
        const randomEndpoint = endpointNames[Math.floor(Math.random() * endpointNames.length)];
        
        batchPromises.push(
          this.makeRequest(randomEndpoint)
            .then(result => results.push({ endpoint: randomEndpoint, ...result }))
            .catch(error => errors.push({ endpoint: randomEndpoint, error: error.message, timestamp: Date.now() }))
        );
      }
      
      await Promise.all(batchPromises);
    }
    
    const endTime = performance.now();
    const totalDuration = (endTime - startTime) / 1000; // Convert to seconds
    
    return this.analyzeResults(config, results, errors, totalDuration);
  }

  async makeRequest(endpointName) {
    const endpoint = this.endpoints[endpointName];
    return await endpoint.call();
  }

  analyzeResults(config, results, errors, totalDuration) {
    const timings = results.map(r => r.duration);
    const sortedTimings = [...timings].sort((a, b) => a - b);
    
    const overallStats = this.calculateStats(sortedTimings);
    
    // Analyze by endpoint
    const endpointStats = {};
    Object.keys(this.endpoints).forEach(endpoint => {
      const endpointResults = results.filter(r => r.endpoint === endpoint);
      if (endpointResults.length > 0) {
        const endpointTimings = endpointResults.map(r => r.duration);
        const sortedEndpointTimings = [...endpointTimings].sort((a, b) => a - b);
        endpointStats[endpoint] = {
          ...this.calculateStats(sortedEndpointTimings),
          requestCount: endpointResults.length,
          target: this.targets[endpoint]
        };
      }
    });

    return {
      config,
      totalRequests: results.length,
      totalErrors: errors.length,
      totalDuration,
      requestsPerSecond: results.length / totalDuration,
      errorRate: errors.length / (results.length + errors.length),
      overallStats,
      endpointStats,
      errors: errors.slice(0, 10), // Keep first 10 errors for analysis
      timings: sortedTimings
    };
  }

  calculateStats(sortedTimings) {
    if (sortedTimings.length === 0) return null;
    
    const length = sortedTimings.length;
    const sum = sortedTimings.reduce((a, b) => a + b, 0);
    
    return {
      count: length,
      mean: sum / length,
      min: sortedTimings[0],
      max: sortedTimings[length - 1],
      p50: sortedTimings[Math.floor(length * 0.5)],
      p75: sortedTimings[Math.floor(length * 0.75)],
      p90: sortedTimings[Math.floor(length * 0.9)],
      p95: sortedTimings[Math.floor(length * 0.95)],
      p99: sortedTimings[Math.floor(length * 0.99)]
    };
  }

  generateReport(testResults) {
    const report = {
      timestamp: new Date().toISOString(),
      testResults,
      summary: this.calculateSummary(testResults),
      endpointSummary: this.calculateEndpointSummary(testResults),
      evaluation: {},
      recommendations: []
    };

    // Evaluate against targets
    report.evaluation = this.evaluatePerformance(report);
    
    // Generate recommendations
    report.recommendations = this.generateRecommendations(report);

    return report;
  }

  calculateSummary(testResults) {
    const allTimings = testResults.flatMap(result => result.timings);
    const sortedTimings = [...allTimings].sort((a, b) => a - b);
    
    const totalRequests = testResults.reduce((sum, result) => sum + result.totalRequests, 0);
    const totalErrors = testResults.reduce((sum, result) => sum + result.totalErrors, 0);
    const avgRPS = testResults.reduce((sum, result) => sum + result.requestsPerSecond, 0) / testResults.length;
    const avgErrorRate = testResults.reduce((sum, result) => sum + result.errorRate, 0) / testResults.length;
    
    return {
      totalRequests,
      totalErrors,
      avgErrorRate,
      avgRequestsPerSecond: avgRPS,
      overallStats: this.calculateStats(sortedTimings)
    };
  }

  calculateEndpointSummary(testResults) {
    const endpointSummary = {};
    
    // Aggregate stats across all test runs for each endpoint
    Object.keys(this.endpoints).forEach(endpoint => {
      const allEndpointTimings = [];
      let totalRequests = 0;
      
      testResults.forEach(result => {
        if (result.endpointStats[endpoint]) {
          const stats = result.endpointStats[endpoint];
          totalRequests += stats.requestCount;
          
          // We can't perfectly reconstruct individual timings, but we can use aggregated stats
          // For a more accurate implementation, we'd store individual timings
        }
      });
      
      if (totalRequests > 0) {
        // Calculate average stats across test runs
        const avgStats = testResults.reduce((acc, result) => {
          if (result.endpointStats[endpoint]) {
            const stats = result.endpointStats[endpoint];
            Object.keys(stats).forEach(key => {
              if (typeof stats[key] === 'number') {
                acc[key] = (acc[key] || 0) + stats[key];
              }
            });
          }
          return acc;
        }, {});
        
        const testCount = testResults.filter(result => result.endpointStats[endpoint]).length;
        Object.keys(avgStats).forEach(key => {
          if (typeof avgStats[key] === 'number') {
            avgStats[key] /= testCount;
          }
        });
        
        endpointSummary[endpoint] = {
          ...avgStats,
          totalRequests,
          target: this.targets[endpoint]
        };
      }
    });
    
    return endpointSummary;
  }

  evaluatePerformance(report) {
    const evaluation = {
      overallP95Passed: report.summary.overallStats.p95 <= 100, // General target
      errorRatePassed: report.summary.avgErrorRate <= 0.01, // 1% error rate threshold
      endpointEvaluations: {},
      overallPassed: false
    };
    
    // Evaluate each endpoint
    let endpointsPassed = 0;
    let totalEndpoints = 0;
    
    Object.entries(report.endpointSummary).forEach(([endpoint, stats]) => {
      totalEndpoints++;
      const target = this.targets[endpoint];
      const passed = stats.p95 <= target.p95;
      
      evaluation.endpointEvaluations[endpoint] = {
        p95Passed: passed,
        actualP95: stats.p95,
        targetP95: target.p95,
        status: stats.p95 <= target.warning ? 'excellent' : 
                stats.p95 <= target.p95 ? 'acceptable' : 'failing'
      };
      
      if (passed) endpointsPassed++;
    });
    
    evaluation.endpointPassRate = endpointsPassed / totalEndpoints;
    evaluation.overallPassed = 
      evaluation.overallP95Passed && 
      evaluation.errorRatePassed && 
      evaluation.endpointPassRate >= 0.8; // 80% of endpoints must pass
    
    return evaluation;
  }

  generateRecommendations(report) {
    const recommendations = [];
    
    if (!report.evaluation.overallP95Passed) {
      recommendations.push({
        type: 'critical',
        message: `Overall P95 latency (${report.summary.overallStats.p95.toFixed(2)}ms) exceeds general target (100ms)`,
        suggestions: [
          'Identify and optimize slowest endpoints',
          'Implement response caching',
          'Review database query performance',
          'Consider API response optimization'
        ]
      });
    }
    
    if (!report.evaluation.errorRatePassed) {
      recommendations.push({
        type: 'critical',
        message: `Error rate (${(report.summary.avgErrorRate * 100).toFixed(2)}%) exceeds threshold (1%)`,
        suggestions: [
          'Investigate error patterns',
          'Implement better error handling',
          'Review system reliability',
          'Add circuit breakers and retries'
        ]
      });
    }
    
    // Check for failing endpoints
    const failingEndpoints = Object.entries(report.evaluation.endpointEvaluations)
      .filter(([, evaluation]) => !evaluation.p95Passed);
    
    if (failingEndpoints.length > 0) {
      recommendations.push({
        type: 'warning',
        message: `${failingEndpoints.length} endpoint(s) failing performance targets`,
        failingEndpoints: failingEndpoints.map(([endpoint, evaluation]) => ({
          endpoint,
          actual: evaluation.actualP95.toFixed(2),
          target: evaluation.targetP95
        })),
        suggestions: [
          'Optimize slow endpoints individually',
          'Review endpoint-specific caching strategies',
          'Consider load balancing improvements',
          'Profile endpoint execution paths'
        ]
      });
    }
    
    // Performance insights
    if (report.summary.avgRequestsPerSecond < 100) {
      recommendations.push({
        type: 'info',
        message: `Low throughput detected (${report.summary.avgRequestsPerSecond.toFixed(2)} RPS)`,
        suggestions: [
          'Consider horizontal scaling',
          'Optimize response serialization',
          'Review connection pooling',
          'Implement request batching where applicable'
        ]
      });
    }
    
    return recommendations;
  }

  printReport(report) {
    console.log('='.repeat(70));
    console.log('📊 API PERFORMANCE TEST REPORT');
    console.log('='.repeat(70));
    
    console.log(`\nOverall Summary:`);
    console.log(`  Total Requests: ${report.summary.totalRequests.toLocaleString()}`);
    console.log(`  Total Errors: ${report.summary.totalErrors}`);
    console.log(`  Error Rate: ${(report.summary.avgErrorRate * 100).toFixed(3)}%`);
    console.log(`  Avg Throughput: ${report.summary.avgRequestsPerSecond.toFixed(2)} RPS`);
    console.log(`  Overall P95: ${report.summary.overallStats.p95.toFixed(2)}ms`);
    console.log(`  Overall Mean: ${report.summary.overallStats.mean.toFixed(2)}ms`);
    
    console.log(`\nLoad Test Results:`);
    report.testResults.forEach(result => {
      console.log(`\n  ${result.config.name}:`);
      console.log(`    Requests: ${result.totalRequests} (${result.config.concurrency} concurrent)`);
      console.log(`    Duration: ${result.totalDuration.toFixed(2)}s`);
      console.log(`    RPS: ${result.requestsPerSecond.toFixed(2)}`);
      console.log(`    P95: ${result.overallStats.p95.toFixed(2)}ms`);
      console.log(`    Error Rate: ${(result.errorRate * 100).toFixed(3)}%`);
    });
    
    console.log(`\nEndpoint Performance:`);
    Object.entries(report.endpointSummary).forEach(([endpoint, stats]) => {
      const evaluation = report.evaluation.endpointEvaluations[endpoint];
      const status = evaluation.p95Passed ? '✅' : '❌';
      const statusText = evaluation.status.charAt(0).toUpperCase() + evaluation.status.slice(1);
      
      console.log(`\n  ${endpoint} (${statusText}):`);
      console.log(`    ${status} P95: ${stats.p95.toFixed(2)}ms (target: ≤${stats.target.p95}ms)`);
      console.log(`    Mean: ${stats.mean.toFixed(2)}ms`);
      console.log(`    Requests: ${stats.totalRequests || stats.requestCount || 0}`);
    });
    
    const status = report.evaluation.overallPassed ? '✅ PASSED' : '❌ FAILED';
    const statusColor = report.evaluation.overallPassed ? '\x1b[32m' : '\x1b[31m';
    
    console.log(`\n${statusColor}${status}\x1b[0m - Performance Evaluation:`);
    console.log(`  Overall P95: ${report.evaluation.overallP95Passed ? '✅' : '❌'}`);
    console.log(`  Error Rate: ${report.evaluation.errorRatePassed ? '✅' : '❌'}`);
    console.log(`  Endpoint Pass Rate: ${report.evaluation.endpointPassRate ? (report.evaluation.endpointPassRate * 100).toFixed(1) : 0}% (${report.evaluation.endpointPassRate >= 0.8 ? '✅' : '❌'})`);
    
    if (report.recommendations.length > 0) {
      console.log(`\n📋 Recommendations:`);
      report.recommendations.forEach(rec => {
        const icon = rec.type === 'critical' ? '🔴' : rec.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`\n  ${icon} ${rec.message}`);
        if (rec.failingEndpoints) {
          rec.failingEndpoints.forEach(ep => {
            console.log(`     - ${ep.endpoint}: ${ep.actual}ms > ${ep.target}ms`);
          });
        }
        rec.suggestions.forEach(suggestion => {
          console.log(`     • ${suggestion}`);
        });
      });
    }
    
    console.log('\n' + '='.repeat(70));
  }

  saveReport(report) {
    const reportDir = 'performance-reports';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `api-performance-${timestamp}.json`);
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportFile}`);
    
    // Also save as latest
    fs.writeFileSync(path.join(reportDir, 'latest-api-performance.json'), JSON.stringify(report, null, 2));
  }
}

// Run the test
async function main() {
  try {
    const tester = new APIPerformanceTester();
    const report = await tester.runAPIPerformanceTest();
    
    tester.printReport(report);
    tester.saveReport(report);
    
    // Exit with appropriate code
    process.exit(report.evaluation.overallPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ API Performance test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { APIPerformanceTester };