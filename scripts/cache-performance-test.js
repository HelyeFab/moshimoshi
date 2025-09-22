#!/usr/bin/env node

/**
 * Multi-Tier Cache Performance Test
 * Tests memory cache + Redis caching performance and hit rates
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Mock implementations for testing
class MockMemoryCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const start = performance.now();
    if (this.cache.has(key)) {
      this.hits++;
      const end = performance.now();
      return { value: this.cache.get(key), duration: end - start, hit: true };
    }
    this.misses++;
    const end = performance.now();
    return { value: null, duration: end - start, hit: false };
  }

  set(key, value) {
    const start = performance.now();
    if (this.cache.size >= this.maxSize) {
      // LRU eviction - remove oldest
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
    const end = performance.now();
    return end - start;
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.cache.size,
      maxSize: this.maxSize
    };
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

class MockRedisCache {
  constructor() {
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
    this.networkLatency = 1; // Simulate network latency
  }

  async get(key) {
    const start = performance.now();
    // Simulate network delay
    await this.delay(this.networkLatency);
    
    if (this.cache.has(key)) {
      this.hits++;
      const end = performance.now();
      return { value: this.cache.get(key), duration: end - start, hit: true };
    }
    this.misses++;
    const end = performance.now();
    return { value: null, duration: end - start, hit: false };
  }

  async set(key, value, ttl = 300) {
    const start = performance.now();
    await this.delay(this.networkLatency);
    
    this.cache.set(key, { value, expires: Date.now() + ttl * 1000 });
    
    // Simulate expiration
    setTimeout(() => {
      this.cache.delete(key);
    }, ttl * 1000);
    
    const end = performance.now();
    return end - start;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.cache.size
    };
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
}

class MultiTierCache {
  constructor() {
    this.l1Cache = new MockMemoryCache(500); // Memory cache
    this.l2Cache = new MockRedisCache();     // Redis cache
    this.totalRequests = 0;
    this.l1Hits = 0;
    this.l2Hits = 0;
    this.misses = 0;
  }

  async get(key) {
    const start = performance.now();
    this.totalRequests++;

    // Try L1 (memory) cache first
    const l1Result = this.l1Cache.get(key);
    if (l1Result.hit) {
      this.l1Hits++;
      return {
        value: l1Result.value,
        source: 'l1',
        duration: performance.now() - start,
        hit: true
      };
    }

    // Try L2 (Redis) cache
    const l2Result = await this.l2Cache.get(key);
    if (l2Result.hit) {
      this.l2Hits++;
      // Populate L1 cache
      this.l1Cache.set(key, l2Result.value);
      return {
        value: l2Result.value,
        source: 'l2',
        duration: performance.now() - start,
        hit: true
      };
    }

    // Cache miss
    this.misses++;
    return {
      value: null,
      source: null,
      duration: performance.now() - start,
      hit: false
    };
  }

  async set(key, value, ttl = 300) {
    const start = performance.now();
    
    // Set in both caches
    const l1Duration = this.l1Cache.set(key, value);
    const l2Duration = await this.l2Cache.set(key, value, ttl);
    
    return {
      l1Duration,
      l2Duration,
      totalDuration: performance.now() - start
    };
  }

  getStats() {
    const l1Stats = this.l1Cache.getStats();
    const l2Stats = this.l2Cache.getStats();
    
    return {
      totalRequests: this.totalRequests,
      l1Hits: this.l1Hits,
      l2Hits: this.l2Hits,
      misses: this.misses,
      overallHitRate: this.totalRequests > 0 ? (this.l1Hits + this.l2Hits) / this.totalRequests : 0,
      l1HitRate: this.totalRequests > 0 ? this.l1Hits / this.totalRequests : 0,
      l2HitRate: this.totalRequests > 0 ? this.l2Hits / this.totalRequests : 0,
      l1Stats,
      l2Stats
    };
  }

  clear() {
    this.l1Cache.clear();
    this.l2Cache.clear();
    this.totalRequests = 0;
    this.l1Hits = 0;
    this.l2Hits = 0;
    this.misses = 0;
  }
}

class CachePerformanceTester {
  constructor() {
    this.cache = new MultiTierCache();
    this.results = [];
  }

  generateTestData(count) {
    const data = [];
    for (let i = 0; i < count; i++) {
      data.push({
        key: `key_${i % (count / 3)}`, // Create overlap for cache hits
        value: `value_${i}_${Math.random().toString(36).substring(7)}`
      });
    }
    return data;
  }

  async runCachePerformanceTest() {
    console.log('🚀 Starting Multi-Tier Cache Performance Test\n');

    const testScenarios = [
      { name: 'Cold Cache', preload: 0, requests: 1000 },
      { name: 'Warm Cache (50% hit)', preload: 500, requests: 1000 },
      { name: 'Hot Cache (90% hit)', preload: 900, requests: 1000 },
      { name: 'High Volume', preload: 2000, requests: 5000 },
    ];

    const scenarioResults = [];

    for (const scenario of testScenarios) {
      console.log(`📊 Running scenario: ${scenario.name}`);
      const result = await this.runScenario(scenario);
      scenarioResults.push(result);
      
      console.log(`  L1 Hit Rate: ${(result.performance.l1HitRate * 100).toFixed(1)}%`);
      console.log(`  L2 Hit Rate: ${(result.performance.l2HitRate * 100).toFixed(1)}%`);
      console.log(`  Overall Hit Rate: ${(result.performance.overallHitRate * 100).toFixed(1)}%`);
      console.log(`  Avg Latency: ${result.performance.avgLatency.toFixed(3)}ms`);
      console.log(`  P95 Latency: ${result.performance.p95Latency.toFixed(3)}ms\n`);
    }

    return this.generateReport(scenarioResults);
  }

  async runScenario(scenario) {
    this.cache.clear();
    
    // Preload cache
    console.log(`  Preloading ${scenario.preload} items...`);
    const preloadData = this.generateTestData(scenario.preload);
    for (const item of preloadData) {
      await this.cache.set(item.key, item.value);
    }

    // Run test requests
    console.log(`  Running ${scenario.requests} requests...`);
    const testData = this.generateTestData(scenario.requests);
    const timings = [];
    const operations = [];

    for (let i = 0; i < testData.length; i++) {
      if (Math.random() > 0.7) {
        // 30% writes
        const start = performance.now();
        await this.cache.set(testData[i].key, testData[i].value);
        const duration = performance.now() - start;
        timings.push(duration);
        operations.push({ type: 'write', duration, key: testData[i].key });
      } else {
        // 70% reads
        const result = await this.cache.get(testData[i].key);
        timings.push(result.duration);
        operations.push({ 
          type: 'read', 
          duration: result.duration, 
          hit: result.hit, 
          source: result.source,
          key: testData[i].key 
        });
      }
    }

    const stats = this.cache.getStats();
    const sortedTimings = [...timings].sort((a, b) => a - b);
    
    return {
      scenario: scenario.name,
      configuration: scenario,
      performance: {
        ...stats,
        avgLatency: timings.reduce((a, b) => a + b, 0) / timings.length,
        p50Latency: sortedTimings[Math.floor(sortedTimings.length * 0.5)],
        p95Latency: sortedTimings[Math.floor(sortedTimings.length * 0.95)],
        p99Latency: sortedTimings[Math.floor(sortedTimings.length * 0.99)],
        maxLatency: sortedTimings[sortedTimings.length - 1],
        minLatency: sortedTimings[0]
      },
      operations: {
        reads: operations.filter(op => op.type === 'read').length,
        writes: operations.filter(op => op.type === 'write').length,
        readHits: operations.filter(op => op.type === 'read' && op.hit).length,
        l1Reads: operations.filter(op => op.type === 'read' && op.source === 'l1').length,
        l2Reads: operations.filter(op => op.type === 'read' && op.source === 'l2').length
      },
      timings: sortedTimings
    };
  }

  generateReport(scenarioResults) {
    const report = {
      timestamp: new Date().toISOString(),
      scenarios: scenarioResults,
      summary: {
        avgHitRate: scenarioResults.reduce((sum, s) => sum + s.performance.overallHitRate, 0) / scenarioResults.length,
        avgLatency: scenarioResults.reduce((sum, s) => sum + s.performance.avgLatency, 0) / scenarioResults.length,
        avgP95Latency: scenarioResults.reduce((sum, s) => sum + s.performance.p95Latency, 0) / scenarioResults.length,
      },
      targets: {
        hitRateTarget: 0.8,
        latencyTarget: 10.0,
        p95LatencyTarget: 20.0
      },
      evaluation: {},
      recommendations: []
    };

    // Evaluate against targets
    report.evaluation = {
      hitRatePassed: report.summary.avgHitRate >= report.targets.hitRateTarget,
      latencyPassed: report.summary.avgLatency <= report.targets.latencyTarget,
      p95LatencyPassed: report.summary.avgP95Latency <= report.targets.p95LatencyTarget,
      overallPassed: false
    };

    report.evaluation.overallPassed = 
      report.evaluation.hitRatePassed && 
      report.evaluation.latencyPassed && 
      report.evaluation.p95LatencyPassed;

    // Generate recommendations
    if (!report.evaluation.hitRatePassed) {
      report.recommendations.push({
        type: 'critical',
        message: `Average hit rate (${(report.summary.avgHitRate * 100).toFixed(1)}%) below target (${(report.targets.hitRateTarget * 100).toFixed(1)}%)`,
        suggestions: [
          'Increase memory cache size',
          'Optimize cache key strategies',
          'Review cache TTL settings',
          'Consider cache warming strategies'
        ]
      });
    }

    if (!report.evaluation.latencyPassed) {
      report.recommendations.push({
        type: 'warning',
        message: `Average latency (${report.summary.avgLatency.toFixed(2)}ms) exceeds target (${report.targets.latencyTarget}ms)`,
        suggestions: [
          'Optimize cache lookup algorithms',
          'Review network latency to Redis',
          'Consider connection pooling',
          'Implement async cache operations'
        ]
      });
    }

    if (!report.evaluation.p95LatencyPassed) {
      report.recommendations.push({
        type: 'warning',
        message: `P95 latency (${report.summary.avgP95Latency.toFixed(2)}ms) exceeds target (${report.targets.p95LatencyTarget}ms)`,
        suggestions: [
          'Investigate latency outliers',
          'Implement circuit breakers',
          'Review cache eviction policies',
          'Consider Redis cluster optimization'
        ]
      });
    }

    // Performance insights
    const bestScenario = scenarioResults.reduce((best, current) => 
      current.performance.overallHitRate > best.performance.overallHitRate ? current : best
    );
    
    const worstScenario = scenarioResults.reduce((worst, current) => 
      current.performance.overallHitRate < worst.performance.overallHitRate ? current : worst
    );

    report.insights = {
      bestPerformingScenario: bestScenario.scenario,
      worstPerformingScenario: worstScenario.scenario,
      hitRateRange: {
        min: worstScenario.performance.overallHitRate,
        max: bestScenario.performance.overallHitRate
      },
      l1CacheEffectiveness: scenarioResults.reduce((sum, s) => sum + s.performance.l1HitRate, 0) / scenarioResults.length,
      l2CacheEffectiveness: scenarioResults.reduce((sum, s) => sum + s.performance.l2HitRate, 0) / scenarioResults.length
    };

    return report;
  }

  printReport(report) {
    console.log('='.repeat(70));
    console.log('📊 MULTI-TIER CACHE PERFORMANCE REPORT');
    console.log('='.repeat(70));
    
    console.log(`\nOverall Summary:`);
    console.log(`  Average Hit Rate: ${(report.summary.avgHitRate * 100).toFixed(1)}% (target: ≥${(report.targets.hitRateTarget * 100).toFixed(1)}%)`);
    console.log(`  Average Latency: ${report.summary.avgLatency.toFixed(3)}ms (target: ≤${report.targets.latencyTarget}ms)`);
    console.log(`  Average P95 Latency: ${report.summary.avgP95Latency.toFixed(3)}ms (target: ≤${report.targets.p95LatencyTarget}ms)`);
    
    console.log(`\nCache Layer Performance:`);
    console.log(`  L1 (Memory) Effectiveness: ${(report.insights.l1CacheEffectiveness * 100).toFixed(1)}%`);
    console.log(`  L2 (Redis) Effectiveness: ${(report.insights.l2CacheEffectiveness * 100).toFixed(1)}%`);
    
    console.log(`\nScenario Details:`);
    report.scenarios.forEach(scenario => {
      console.log(`\n  ${scenario.scenario}:`);
      console.log(`    Hit Rate: ${(scenario.performance.overallHitRate * 100).toFixed(1)}% (L1: ${(scenario.performance.l1HitRate * 100).toFixed(1)}%, L2: ${(scenario.performance.l2HitRate * 100).toFixed(1)}%)`);
      console.log(`    Avg Latency: ${scenario.performance.avgLatency.toFixed(3)}ms`);
      console.log(`    P95 Latency: ${scenario.performance.p95Latency.toFixed(3)}ms`);
      console.log(`    Operations: ${scenario.operations.reads} reads, ${scenario.operations.writes} writes`);
    });
    
    const status = report.evaluation.overallPassed ? '✅ PASSED' : '❌ FAILED';
    const statusColor = report.evaluation.overallPassed ? '\x1b[32m' : '\x1b[31m';
    
    console.log(`\n${statusColor}${status}\x1b[0m - Performance Evaluation:`);
    console.log(`  Hit Rate: ${report.evaluation.hitRatePassed ? '✅' : '❌'} ${(report.summary.avgHitRate * 100).toFixed(1)}% ≥ ${(report.targets.hitRateTarget * 100).toFixed(1)}%`);
    console.log(`  Latency: ${report.evaluation.latencyPassed ? '✅' : '❌'} ${report.summary.avgLatency.toFixed(2)}ms ≤ ${report.targets.latencyTarget}ms`);
    console.log(`  P95 Latency: ${report.evaluation.p95LatencyPassed ? '✅' : '❌'} ${report.summary.avgP95Latency.toFixed(2)}ms ≤ ${report.targets.p95LatencyTarget}ms`);
    
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
    
    console.log('\n' + '='.repeat(70));
  }

  saveReport(report) {
    const reportDir = 'performance-reports';
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportFile = path.join(reportDir, `cache-performance-${timestamp}.json`);
    
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportFile}`);
    
    // Also save as latest
    fs.writeFileSync(path.join(reportDir, 'latest-cache-performance.json'), JSON.stringify(report, null, 2));
  }
}

// Run the test
async function main() {
  try {
    const tester = new CachePerformanceTester();
    const report = await tester.runCachePerformanceTest();
    
    tester.printReport(report);
    tester.saveReport(report);
    
    // Exit with appropriate code
    process.exit(report.evaluation.overallPassed ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Cache Performance test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { CachePerformanceTester };