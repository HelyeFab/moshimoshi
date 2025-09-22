#!/usr/bin/env node

/**
 * Load Testing Script
 * Week 2 - Day 5: Performance Validation
 * Simple Node.js load tester for 1000 concurrent users
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

class LoadTester {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      concurrency: config.concurrency || 1000,
      duration: config.duration || 60000, // 1 minute
      rampUpTime: config.rampUpTime || 30000, // 30 seconds
      ...config
    };
    
    this.stats = {
      requests: 0,
      successful: 0,
      failed: 0,
      totalLatency: 0,
      latencies: [],
      errors: [],
      startTime: null,
      endTime: null,
    };
    
    this.activeConnections = 0;
    this.shouldStop = false;
  }

  /**
   * Make HTTP request
   */
  async makeRequest(endpoint, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(this.config.baseUrl + endpoint);
      const protocol = url.protocol === 'https:' ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LoadTester/1.0',
        },
        timeout: 10000,
      };
      
      if (data) {
        const payload = JSON.stringify(data);
        options.headers['Content-Length'] = Buffer.byteLength(payload);
      }
      
      const startTime = performance.now();
      
      const req = protocol.request(options, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          const latency = performance.now() - startTime;
          
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: body,
            latency: latency,
          });
        });
      });
      
      req.on('error', (error) => {
        const latency = performance.now() - startTime;
        reject({ error, latency });
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject({ error: new Error('Request timeout'), latency: 10000 });
      });
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      
      req.end();
    });
  }

  /**
   * Simulate a user session
   */
  async simulateUser(userId) {
    const scenarios = [
      () => this.browseScenario(userId),
      () => this.reviewScenario(userId),
      () => this.syncScenario(userId),
    ];
    
    while (!this.shouldStop) {
      try {
        // Pick random scenario
        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
        await scenario();
        
        // Random think time (1-3 seconds)
        await this.sleep(Math.random() * 2000 + 1000);
      } catch (error) {
        this.stats.errors.push({
          userId,
          error: error.message || error,
          timestamp: Date.now(),
        });
      }
    }
    
    this.activeConnections--;
  }

  /**
   * Browse scenario
   */
  async browseScenario(userId) {
    const endpoints = [
      '/api/lessons',
      '/api/user/progress',
      '/api/user/stats',
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await this.makeRequest(endpoint);
        this.recordResponse(response);
      } catch (error) {
        this.recordError(error);
      }
    }
  }

  /**
   * Review scenario
   */
  async reviewScenario(userId) {
    try {
      // Get queue
      const queueResponse = await this.makeRequest('/api/review/queue');
      this.recordResponse(queueResponse, 'queue_generation');
      
      // Start session
      const sessionResponse = await this.makeRequest(
        '/api/review/session/start',
        'POST',
        { mode: 'recognition' }
      );
      this.recordResponse(sessionResponse, 'session_creation');
      
      // Submit reviews
      for (let i = 0; i < 5; i++) {
        const reviewResponse = await this.makeRequest(
          '/api/review/submit',
          'POST',
          {
            itemId: `item-${i}`,
            response: Math.random() > 0.3 ? 'correct' : 'incorrect',
          }
        );
        this.recordResponse(reviewResponse);
        
        await this.sleep(500); // Simulate thinking
      }
    } catch (error) {
      this.recordError(error);
    }
  }

  /**
   * Sync scenario
   */
  async syncScenario(userId) {
    try {
      const syncResponse = await this.makeRequest(
        '/api/sync',
        'POST',
        {
          items: Array.from({ length: 10 }, (_, i) => ({
            id: `sync-${Date.now()}-${i}`,
            data: { value: Math.random() },
          })),
        }
      );
      this.recordResponse(syncResponse, 'sync');
    } catch (error) {
      this.recordError(error);
    }
  }

  /**
   * Record response metrics
   */
  recordResponse(response, type = 'general') {
    this.stats.requests++;
    
    if (response.status >= 200 && response.status < 300) {
      this.stats.successful++;
    } else {
      this.stats.failed++;
    }
    
    this.stats.totalLatency += response.latency;
    this.stats.latencies.push({
      type,
      latency: response.latency,
      status: response.status,
      timestamp: Date.now(),
    });
  }

  /**
   * Record error
   */
  recordError(error) {
    this.stats.requests++;
    this.stats.failed++;
    this.stats.errors.push({
      error: error.error?.message || error.message || error,
      latency: error.latency || 0,
      timestamp: Date.now(),
    });
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Start load test
   */
  async start() {
    console.log('🚀 Starting load test...');
    console.log(`Target: ${this.config.concurrency} concurrent users`);
    console.log(`Duration: ${this.config.duration / 1000} seconds`);
    console.log(`Ramp-up: ${this.config.rampUpTime / 1000} seconds`);
    console.log(`Base URL: ${this.config.baseUrl}\n`);
    
    this.stats.startTime = Date.now();
    
    // Ramp up users gradually
    const usersPerSecond = this.config.concurrency / (this.config.rampUpTime / 1000);
    const rampUpInterval = 1000; // Add users every second
    
    const rampUpTimer = setInterval(() => {
      const usersToAdd = Math.min(
        Math.ceil(usersPerSecond),
        this.config.concurrency - this.activeConnections
      );
      
      for (let i = 0; i < usersToAdd; i++) {
        this.activeConnections++;
        this.simulateUser(this.activeConnections);
      }
      
      if (this.activeConnections >= this.config.concurrency) {
        clearInterval(rampUpTimer);
        console.log(`✅ Ramped up to ${this.activeConnections} users`);
      }
    }, rampUpInterval);
    
    // Progress updates
    const progressInterval = setInterval(() => {
      this.printProgress();
    }, 5000);
    
    // Run for specified duration
    await this.sleep(this.config.duration);
    
    // Stop test
    console.log('\n⏹️  Stopping load test...');
    this.shouldStop = true;
    clearInterval(progressInterval);
    
    // Wait for connections to close
    let waitTime = 0;
    while (this.activeConnections > 0 && waitTime < 10000) {
      await this.sleep(100);
      waitTime += 100;
    }
    
    this.stats.endTime = Date.now();
    
    // Generate report
    this.generateReport();
  }

  /**
   * Print progress
   */
  printProgress() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const rps = this.stats.requests / elapsed;
    const successRate = this.stats.requests > 0 
      ? (this.stats.successful / this.stats.requests * 100).toFixed(2)
      : 0;
    
    console.log(
      `[${elapsed.toFixed(0)}s] ` +
      `Users: ${this.activeConnections} | ` +
      `Requests: ${this.stats.requests} | ` +
      `RPS: ${rps.toFixed(1)} | ` +
      `Success: ${successRate}% | ` +
      `Errors: ${this.stats.failed}`
    );
  }

  /**
   * Generate final report
   */
  generateReport() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    const rps = this.stats.requests / duration;
    const successRate = this.stats.successful / this.stats.requests * 100;
    const avgLatency = this.stats.totalLatency / this.stats.requests;
    
    // Calculate percentiles
    const sortedLatencies = this.stats.latencies
      .map(l => l.latency)
      .sort((a, b) => a - b);
    
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] || 0;
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] || 0;
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 LOAD TEST RESULTS');
    console.log('='.repeat(60));
    
    console.log('\n📈 Summary:');
    console.log(`  Duration: ${duration.toFixed(1)}s`);
    console.log(`  Total Requests: ${this.stats.requests}`);
    console.log(`  Successful: ${this.stats.successful}`);
    console.log(`  Failed: ${this.stats.failed}`);
    console.log(`  Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`  Requests/sec: ${rps.toFixed(1)}`);
    
    console.log('\n⚡ Latency:');
    console.log(`  Average: ${avgLatency.toFixed(2)}ms`);
    console.log(`  P50: ${p50.toFixed(2)}ms`);
    console.log(`  P95: ${p95.toFixed(2)}ms`);
    console.log(`  P99: ${p99.toFixed(2)}ms`);
    
    console.log('\n🎯 Performance Targets:');
    console.log(`  ✅ 1000 concurrent users: ${this.config.concurrency >= 1000 ? 'PASS' : 'FAIL'}`);
    console.log(`  ${p95 < 100 ? '✅' : '❌'} P95 < 100ms: ${p95 < 100 ? 'PASS' : 'FAIL'}`);
    console.log(`  ${successRate > 99.9 ? '✅' : '❌'} Success rate > 99.9%: ${successRate > 99.9 ? 'PASS' : 'FAIL'}`);
    console.log(`  ${rps > 1000 ? '✅' : '⚠️'} Throughput > 1000 rps: ${rps > 1000 ? 'PASS' : 'WARNING'}`);
    
    if (this.stats.errors.length > 0) {
      console.log('\n❌ Sample Errors:');
      this.stats.errors.slice(0, 5).forEach(e => {
        console.log(`  - ${e.error}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    
    // Save detailed report
    const fs = require('fs');
    const reportPath = `performance-reports/load-test-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(this.stats, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run the load test
if (require.main === module) {
  const tester = new LoadTester({
    baseUrl: process.env.BASE_URL || 'http://localhost:3000',
    concurrency: parseInt(process.env.CONCURRENCY) || 100, // Start smaller for safety
    duration: parseInt(process.env.DURATION) || 60000,
    rampUpTime: parseInt(process.env.RAMP_UP) || 30000,
  });
  
  tester.start().catch(console.error);
}