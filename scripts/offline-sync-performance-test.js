#!/usr/bin/env node

/**
 * Offline Sync Performance Test
 * Tests the offline sync queue performance, reliability, and circuit breaker functionality
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Mock implementations for testing
class MockIndexedDBStorage {
  constructor() {
    this.syncQueue = new Map();
    this.deadLetterQueue = new Map();
    this.nextId = 1;
  }

  async addToSyncQueue(item) {
    const id = this.nextId++;
    this.syncQueue.set(id, { ...item, id });
    return id;
  }

  async getSyncQueueItems(status) {
    return Array.from(this.syncQueue.values()).filter(item => item.status === status);
  }

  async updateSyncQueueItem(item) {
    if (item.id) {
      this.syncQueue.set(item.id, { ...item });
    }
  }

  async deleteSyncQueueItem(id) {
    this.syncQueue.delete(id);
  }

  async moveToDeadLetterQueue(item) {
    const id = this.nextId++;
    this.deadLetterQueue.set(id, { ...item, id, movedAt: Date.now() });
    if (item.id) {
      this.syncQueue.delete(item.id);
    }
  }

  getDeadLetterQueue() {
    return Array.from(this.deadLetterQueue.values());
  }

  clear() {
    this.syncQueue.clear();
    this.deadLetterQueue.clear();
    this.nextId = 1;
  }
}

class MockReviewAPIClient {
  constructor(failureRate = 0.1, latency = 100) {
    this.failureRate = failureRate;
    this.latency = latency;
    this.requestCount = 0;
    this.networkDown = false;
  }

  async createSession(session) {
    return this.mockRequest('createSession', session);
  }

  async updateSession(id, updates) {
    return this.mockRequest('updateSession', { id, ...updates });
  }

  async submitAnswer(data) {
    return this.mockRequest('submitAnswer', data);
  }

  async saveStatistics(statistics) {
    return this.mockRequest('saveStatistics', statistics);
  }

  async updateProgress(progress) {
    return this.mockRequest('updateProgress', progress);
  }

  async mockRequest(method, data) {
    this.requestCount++;
    
    // Simulate network delay
    await this.delay(this.latency + Math.random() * this.latency);
    
    // Simulate network down
    if (this.networkDown) {
      throw new Error('Network is down');
    }
    
    // Simulate random failures
    if (Math.random() < this.failureRate) {
      throw new Error(`API failure in ${method}`);
    }
    
    return { success: true, method, data, id: `${method}_${this.requestCount}` };
  }

  setNetworkDown(down) {
    this.networkDown = down;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class MockSyncQueue {
  constructor(storage, apiClient) {
    this.storage = storage;
    this.apiClient = apiClient;
    this.queue = [];
    this.isProcessing = false;
    this.MAX_RETRIES = 3;
    this.BASE_DELAY = 100;
    this.circuitBreaker = { isOpen: false, failures: 0, threshold: 5 };
    this.metrics = {
      totalAttempts: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      circuitBreakerTrips: 0,
      averageLatency: 0,
      syncRate: 0
    };
    this.latencies = [];
  }

  async add(item) {
    const queueItem = {
      ...item,
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };
    
    await this.storage.addToSyncQueue(queueItem);
    this.queue.push(queueItem);
    
    // Try immediate sync
    if (this.canSync() && !this.isProcessing) {
      this.process();
    }
  }

  async process() {
    if (this.isProcessing || !this.canSync()) return;
    
    this.isProcessing = true;
    
    while (this.queue.length > 0 && this.canSync()) {
      const item = this.queue[0];
      
      try {
        const start = performance.now();
        item.status = 'syncing';
        await this.storage.updateSyncQueueItem(item);
        
        await this.syncItem(item);
        
        const duration = performance.now() - start;
        this.handleSyncSuccess(item, duration);
        
      } catch (error) {
        await this.handleSyncFailure(item, error);
      }
    }
    
    this.isProcessing = false;
  }

  async syncItem(item) {
    this.metrics.totalAttempts++;
    
    switch (item.type) {
      case 'session':
        if (item.action === 'create') {
          return await this.apiClient.createSession(item.data);
        } else {
          return await this.apiClient.updateSession(item.data.id, item.data);
        }
      case 'answer':
        return await this.apiClient.submitAnswer(item.data);
      case 'statistics':
        return await this.apiClient.saveStatistics(item.data);
      case 'progress':
        return await this.apiClient.updateProgress(item.data);
      default:
        throw new Error(`Unknown sync type: ${item.type}`);
    }
  }

  async handleSyncSuccess(item, duration) {
    this.metrics.successfulSyncs++;
    this.latencies.push(duration);
    this.updateAverageLatency();
    
    // Reset circuit breaker on success
    if (this.circuitBreaker.failures > 0) {
      this.circuitBreaker.failures--;
    }
    
    item.status = 'completed';
    await this.storage.updateSyncQueueItem(item);
    this.queue.shift();
    
    if (item.id) {
      await this.storage.deleteSyncQueueItem(item.id);
    }
  }

  async handleSyncFailure(item, error) {
    item.retryCount++;
    item.status = 'failed';
    item.error = error.message;
    
    this.metrics.failedSyncs++;
    this.circuitBreaker.failures++;
    
    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.tripCircuitBreaker();
    }
    
    if (item.retryCount >= this.MAX_RETRIES) {
      await this.storage.moveToDeadLetterQueue(item);
      this.queue.shift();
    } else {
      await this.storage.updateSyncQueueItem(item);
      // Move to end for retry
      this.queue.push(this.queue.shift());
    }
  }

  canSync() {
    return !this.circuitBreaker.isOpen;
  }

  tripCircuitBreaker() {
    this.circuitBreaker.isOpen = true;
    this.metrics.circuitBreakerTrips++;
    
    // Reset after delay
    setTimeout(() => {
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failures = 0;
    }, 5000);
  }

  updateAverageLatency() {
    if (this.latencies.length > 0) {
      const sum = this.latencies.reduce((a, b) => a + b, 0);
      this.metrics.averageLatency = sum / this.latencies.length;
    }
  }

  getMetrics() {
    const totalSyncs = this.metrics.successfulSyncs + this.metrics.failedSyncs;
    return {
      ...this.metrics,
      successRate: totalSyncs > 0 ? this.metrics.successfulSyncs / totalSyncs : 0,
      reliability: totalSyncs > 0 ? (totalSyncs - this.metrics.failedSyncs) / totalSyncs : 0
    };
  }

  getQueueStatus() {
    return {
      pending: this.queue.filter(item => item.status === 'pending').length,
      syncing: this.queue.filter(item => item.status === 'syncing').length,
      failed: this.queue.filter(item => item.status === 'failed').length,
      total: this.queue.length,
      circuitBreakerOpen: this.circuitBreaker.isOpen
    };
  }

  clear() {
    this.queue = [];
    this.circuitBreaker = { isOpen: false, failures: 0, threshold: 5 };
    this.metrics = {
      totalAttempts: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      circuitBreakerTrips: 0,
      averageLatency: 0,
      syncRate: 0
    };
    this.latencies = [];
  }
}

class OfflineSyncPerformanceTester {
  constructor() {
    this.storage = new MockIndexedDBStorage();
  }

  generateTestData(count) {
    const data = [];
    const types = ['session', 'answer', 'statistics', 'progress'];
    const actions = ['create', 'update'];
    
    for (let i = 0; i < count; i++) {
      data.push({
        type: types[Math.floor(Math.random() * types.length)],
        action: actions[Math.floor(Math.random() * actions.length)],
        data: {
          id: `test_${i}`,
          userId: `user_${Math.floor(i / 10)}`,
          content: `Test data ${i}`,
          timestamp: Date.now() - Math.random() * 3600000
        }
      });
    }
    
    return data;
  }

  async runOfflineSyncPerformanceTest() {
    console.log('🚀 Starting Offline Sync Performance Test\n');

    const testScenarios = [
      {
        name: 'Optimal Conditions',
        description: 'Low failure rate, good network',
        failureRate: 0.01,
        latency: 50,
        itemCount: 100,
        networkInterruptions: 0
      },
      {
        name: 'Network Issues',
        description: 'Higher failure rate, variable latency',
        failureRate: 0.1,
        latency: 200,
        itemCount: 100,
        networkInterruptions: 2
      },
      {
        name: 'High Volume',
        description: 'Large queue with normal conditions',
        failureRate: 0.05,
        latency: 100,
        itemCount: 500,
        networkInterruptions: 1
      },
      {
        name: 'Adverse Conditions',
        description: 'High failure rate, slow network',
        failureRate: 0.2,
        latency: 500,
        itemCount: 200,
        networkInterruptions: 3
      },
      {
        name: 'Burst Sync',
        description: 'Many items added simultaneously',
        failureRate: 0.05,
        latency: 100,
        itemCount: 1000,
        networkInterruptions: 0
      }
    ];

    const results = [];

    for (const scenario of testScenarios) {
      console.log(`📊 Running scenario: ${scenario.name}`);
      console.log(`   ${scenario.description}`);
      
      const result = await this.runScenario(scenario);
      results.push(result);
      
      console.log(`   ✅ Completed - Success Rate: ${(result.metrics.successRate * 100).toFixed(1)}%`);
      console.log(`   📈 Sync Rate: ${result.metrics.syncRate.toFixed(2)} items/sec`);
      console.log(`   ⏱️  Avg Latency: ${result.metrics.averageLatency.toFixed(2)}ms`);
      console.log(`   💥 Circuit Breaker Trips: ${result.metrics.circuitBreakerTrips}\n`);
    }

    return this.generateReport(results);
  }

  async runScenario(scenario) {
    // Setup
    this.storage.clear();
    const apiClient = new MockReviewAPIClient(scenario.failureRate, scenario.latency);
    const syncQueue = new MockSyncQueue(this.storage, apiClient);
    
    const testData = this.generateTestData(scenario.itemCount);
    const startTime = performance.now();
    
    // Add all items to queue
    console.log(`   Adding ${scenario.itemCount} items to queue...`);
    for (const item of testData) {
      await syncQueue.add(item);
    }
    
    // Simulate network interruptions
    if (scenario.networkInterruptions > 0) {
      console.log(`   Simulating ${scenario.networkInterruptions} network interruptions...`);
      
      for (let i = 0; i < scenario.networkInterruptions; i++) {
        // Wait a bit, then simulate network down
        await this.delay(Math.random() * 2000 + 1000);
        apiClient.setNetworkDown(true);
        
        // Network down for 1-3 seconds
        await this.delay(Math.random() * 2000 + 1000);
        apiClient.setNetworkDown(false);
      }
    }
    
    // Wait for queue to process
    console.log(`   Processing queue...`);
    let iterations = 0;
    const maxIterations = 100; // Prevent infinite loops
    
    while (syncQueue.queue.length > 0 && iterations < maxIterations) {
      await syncQueue.process();
      await this.delay(100); // Small delay between iterations
      iterations++;
    }
    
    const endTime = performance.now();
    const totalDuration = endTime - startTime;
    
    const finalMetrics = syncQueue.getMetrics();
    const queueStatus = syncQueue.getQueueStatus();
    const deadLetterItems = this.storage.getDeadLetterQueue();
    
    // Calculate sync rate
    const syncRate = finalMetrics.successfulSyncs / (totalDuration / 1000);
    
    return {
      scenario: scenario.name,
      config: scenario,
      duration: totalDuration,
      metrics: {
        ...finalMetrics,
        syncRate,
        reliability: finalMetrics.successfulSyncs / scenario.itemCount,
        completionRate: (scenario.itemCount - queueStatus.total - deadLetterItems.length) / scenario.itemCount
      },
      queueStatus,
      deadLetterCount: deadLetterItems.length,
      unprocessedItems: queueStatus.total
    };
  }

  generateReport(results) {
    const report = {
      timestamp: new Date().toISOString(),
      testResults: results,
      summary: this.calculateSummary(results),
      evaluation: {},
      recommendations: []
    };

    // Performance targets
    const targets = {
      reliability: 0.999,        // 99.9% reliability
      syncRate: 10,              // 10 items/sec minimum
      avgLatency: 1000,          // 1 second average
      completionRate: 0.99,      // 99% completion rate
      maxCircuitBreakerTrips: 2  // Max 2 CB trips per test
    };

    // Evaluate performance
    report.evaluation = this.evaluatePerformance(report, targets);
    report.recommendations = this.generateRecommendations(report, targets);

    return report;
  }

  calculateSummary(results) {
    const totalItems = results.reduce((sum, r) => sum + r.config.itemCount, 0);
    const totalSuccessful = results.reduce((sum, r) => sum + r.metrics.successfulSyncs, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.metrics.failedSyncs, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const totalCircuitBreakerTrips = results.reduce((sum, r) => sum + r.metrics.circuitBreakerTrips, 0);
    
    const avgReliability = results.reduce((sum, r) => sum + r.metrics.reliability, 0) / results.length;
    const avgSyncRate = results.reduce((sum, r) => sum + r.metrics.syncRate, 0) / results.length;
    const avgLatency = results.reduce((sum, r) => sum + r.metrics.averageLatency, 0) / results.length;
    const avgCompletionRate = results.reduce((sum, r) => sum + r.metrics.completionRate, 0) / results.length;

    return {
      totalItems,
      totalSuccessful,
      totalFailed,
      totalDuration,
      totalCircuitBreakerTrips,
      overallSuccessRate: totalItems > 0 ? totalSuccessful / totalItems : 0,
      avgReliability,
      avgSyncRate,
      avgLatency,
      avgCompletionRate,
      scenarioCount: results.length
    };
  }

  evaluatePerformance(report, targets) {
    const summary = report.summary;
    
    return {
      reliabilityPassed: summary.avgReliability >= targets.reliability,
      syncRatePassed: summary.avgSyncRate >= targets.syncRate,
      latencyPassed: summary.avgLatency <= targets.avgLatency,
      completionRatePassed: summary.avgCompletionRate >= targets.completionRate,
      circuitBreakerPassed: summary.totalCircuitBreakerTrips <= targets.maxCircuitBreakerTrips * report.testResults.length,
      overallPassed: false
    };
  }

  generateRecommendations(report, targets) {
    const recommendations = [];
    const summary = report.summary;
    const evaluation = report.evaluation;

    // Check overall pass status
    evaluation.overallPassed = 
      evaluation.reliabilityPassed &&
      evaluation.syncRatePassed &&
      evaluation.latencyPassed &&
      evaluation.completionRatePassed &&
      evaluation.circuitBreakerPassed;

    if (!evaluation.reliabilityPassed) {
      recommendations.push({
        type: 'critical',
        message: `Reliability (${(summary.avgReliability * 100).toFixed(1)}%) below target (${(targets.reliability * 100).toFixed(1)}%)`,
        suggestions: [
          'Implement more robust error handling',
          'Increase retry attempts for critical operations',
          'Add duplicate detection and deduplication',
          'Improve conflict resolution strategies'
        ]
      });
    }

    if (!evaluation.syncRatePassed) {
      recommendations.push({
        type: 'warning',
        message: `Sync rate (${summary.avgSyncRate.toFixed(2)} items/sec) below target (${targets.syncRate} items/sec)`,
        suggestions: [
          'Implement batch processing for similar operations',
          'Optimize API call efficiency',
          'Add parallel processing where safe',
          'Reduce per-item processing overhead'
        ]
      });
    }

    if (!evaluation.latencyPassed) {
      recommendations.push({
        type: 'warning',
        message: `Average latency (${summary.avgLatency.toFixed(2)}ms) exceeds target (${targets.avgLatency}ms)`,
        suggestions: [
          'Optimize API response times',
          'Implement request prioritization',
          'Add request batching',
          'Review network timeout settings'
        ]
      });
    }

    if (!evaluation.completionRatePassed) {
      recommendations.push({
        type: 'critical',
        message: `Completion rate (${(summary.avgCompletionRate * 100).toFixed(1)}%) below target (${(targets.completionRate * 100).toFixed(1)}%)`,
        suggestions: [
          'Review dead letter queue processing',
          'Improve retry logic and backoff strategies',
          'Add manual retry mechanisms for failed items',
          'Implement better failure categorization'
        ]
      });
    }

    if (!evaluation.circuitBreakerPassed) {
      recommendations.push({
        type: 'info',
        message: `Circuit breaker activated ${summary.totalCircuitBreakerTrips} times (max recommended: ${targets.maxCircuitBreakerTrips * report.testResults.length})`,
        suggestions: [
          'Review circuit breaker threshold settings',
          'Implement gradual recovery mechanisms',
          'Add circuit breaker monitoring and alerting',
          'Consider adaptive circuit breaker thresholds'
        ]
      });
    }

    // Performance insights
    const bestScenario = report.testResults.reduce((best, current) => 
      current.metrics.reliability > best.metrics.reliability ? current : best
    );
    
    const worstScenario = report.testResults.reduce((worst, current) => 
      current.metrics.reliability < worst.metrics.reliability ? current : worst
    );

    if (bestScenario !== worstScenario) {
      recommendations.push({
        type: 'info',
        message: `Performance varies significantly between scenarios (${bestScenario.scenario}: ${(bestScenario.metrics.reliability * 100).toFixed(1)}% vs ${worstScenario.scenario}: ${(worstScenario.metrics.reliability * 100).toFixed(1)}%)`,
        suggestions: [
          'Investigate performance differences between scenarios',
          'Implement adaptive sync strategies',
          'Add load-based throttling',
          'Consider scenario-specific optimizations'
        ]
      });
    }

    return recommendations;
  }

  printReport(report) {
    console.log('='.repeat(70));
    console.log('📊 OFFLINE SYNC PERFORMANCE REPORT');
    console.log('='.repeat(70));
    
    console.log(`\nOverall Summary:`);
    console.log(`  Total Items Processed: ${report.summary.totalItems.toLocaleString()}`);
    console.log(`  Total Successful: ${report.summary.totalSuccessful.toLocaleString()}`);
    console.log(`  Total Failed: ${report.summary.totalFailed.toLocaleString()}`);
    console.log(`  Overall Success Rate: ${(report.summary.overallSuccessRate * 100).toFixed(2)}%`);
    console.log(`  Average Reliability: ${(report.summary.avgReliability * 100).toFixed(2)}%`);
    console.log(`  Average Sync Rate: ${report.summary.avgSyncRate.toFixed(2)} items/sec`);
    console.log(`  Average Latency: ${report.summary.avgLatency.toFixed(2)}ms`);
    console.log(`  Circuit Breaker Trips: ${report.summary.totalCircuitBreakerTrips}`);
    
    console.log(`\nScenario Results:`);
    report.testResults.forEach(result => {
      console.log(`\n  ${result.scenario}:`);
      console.log(`    Items: ${result.config.itemCount}, Duration: ${(result.duration / 1000).toFixed(2)}s`);
      console.log(`    Reliability: ${(result.metrics.reliability * 100).toFixed(1)}%`);
      console.log(`    Sync Rate: ${result.metrics.syncRate.toFixed(2)} items/sec`);
      console.log(`    Completion Rate: ${(result.metrics.completionRate * 100).toFixed(1)}%`);
      console.log(`    Dead Letter Items: ${result.deadLetterCount}`);
      console.log(`    Circuit Breaker Trips: ${result.metrics.circuitBreakerTrips}`);
    });
    
    const status = report.evaluation.overallPassed ? '✅ PASSED' : '❌ FAILED';
    const statusColor = report.evaluation.overallPassed ? '\x1b[32m' : '\x1b[31m';
    
    console.log(`\n${statusColor}${status}\x1b[0m - Performance Evaluation:`);
    console.log(`  Reliability: ${report.evaluation.reliabilityPassed ? '✅' : '❌'} ${(report.summary.avgReliability * 100).toFixed(1)}% ≥ 99.9%`);
    console.log(`  Sync Rate: ${report.evaluation.syncRatePassed ? '✅' : '❌'} ${report.summary.avgSyncRate.toFixed(2)} items/sec ≥ 10 items/sec`);
    console.log(`  Latency: ${report.evaluation.latencyPassed ? '✅' : '❌'} ${report.summary.avgLatency.toFixed(2)}ms ≤ 1000ms`);
    console.log(`  Completion Rate: ${report.evaluation.completionRatePassed ? '✅' : '❌'} ${(report.summary.avgCompletionRate * 100).toFixed(1)}% ≥ 99%`);
    console.log(`  Circuit Breaker: ${report.evaluation.circuitBreakerPassed ? '✅' : '❌'} ${report.summary.totalCircuitBreakerTrips} trips`);
    
    if (report.recommendations.length > 0) {
      console.log(`\n📋 Recommendations:`);
      report.recommendations.forEach(rec => {
        const icon = rec.type === 'critical' ? '🔴' : rec.type === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`\n  ${icon} ${rec.message}`);
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
    const reportFile = path.join(reportDir, `offline-sync-performance-${timestamp}.json`);
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportFile}`);
    
    // Also save as latest
    fs.writeFileSync(path.join(reportDir, 'latest-offline-sync-performance.json'), JSON.stringify(report, null, 2));
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the test
async function main() {
  try {
    const tester = new OfflineSyncPerformanceTester();
    const report = await tester.runOfflineSyncPerformanceTest();
    
    tester.printReport(report);
    tester.saveReport(report);
    
    // Exit with appropriate code
    process.exit(report.evaluation.overallPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Offline Sync Performance test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { OfflineSyncPerformanceTester };