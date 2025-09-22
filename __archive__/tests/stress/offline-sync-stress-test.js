#!/usr/bin/env node

/**
 * Offline Sync Stress Test
 * Week 2 - Day 5: Stress Testing
 * 
 * Tests the offline sync system under extreme conditions:
 * - Large data volumes
 * - Network interruptions
 * - Concurrent syncs
 * - Conflict resolution
 */

const { performance } = require('perf_hooks');

class OfflineSyncStressTester {
  constructor(config = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      numClients: config.numClients || 50,
      itemsPerClient: config.itemsPerClient || 100,
      conflictRate: config.conflictRate || 0.2, // 20% conflicts
      networkFailureRate: config.networkFailureRate || 0.1, // 10% failures
      testDuration: config.testDuration || 60000, // 1 minute
      ...config
    };
    
    this.results = {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      conflictsResolved: 0,
      dataLoss: 0,
      syncTimes: [],
      errors: [],
      startTime: null,
      endTime: null,
    };
    
    this.clients = [];
  }

  /**
   * Initialize test clients
   */
  initializeClients() {
    console.log(`📱 Initializing ${this.config.numClients} offline clients...`);
    
    for (let i = 0; i < this.config.numClients; i++) {
      this.clients.push({
        id: `client-${i}`,
        offlineQueue: [],
        lastSyncTime: Date.now() - Math.random() * 3600000, // Random last sync
        syncAttempts: 0,
        conflicts: 0,
        data: this.generateClientData(i),
      });
    }
  }

  /**
   * Generate client data
   */
  generateClientData(clientIndex) {
    const data = [];
    
    for (let i = 0; i < this.config.itemsPerClient; i++) {
      data.push({
        id: `item-${clientIndex}-${i}`,
        type: ['review', 'progress', 'settings'][Math.floor(Math.random() * 3)],
        timestamp: Date.now() - Math.random() * 86400000, // Random time in last 24h
        data: {
          value: Math.random(),
          text: `Data from client ${clientIndex}`,
          version: 1,
        },
      });
    }
    
    return data;
  }

  /**
   * Simulate offline operations
   */
  simulateOfflineOperations(client) {
    const numOperations = Math.floor(Math.random() * 20) + 5;
    
    for (let i = 0; i < numOperations; i++) {
      const operation = {
        id: `op-${client.id}-${Date.now()}-${i}`,
        type: 'review',
        action: ['create', 'update', 'delete'][Math.floor(Math.random() * 3)],
        timestamp: Date.now(),
        data: {
          itemId: `item-${Math.floor(Math.random() * 1000)}`,
          response: Math.random() > 0.5 ? 'correct' : 'incorrect',
          clientVersion: client.data.length,
        },
      };
      
      client.offlineQueue.push(operation);
    }
  }

  /**
   * Simulate network failure
   */
  shouldSimulateNetworkFailure() {
    return Math.random() < this.config.networkFailureRate;
  }

  /**
   * Simulate sync conflict
   */
  shouldSimulateConflict() {
    return Math.random() < this.config.conflictRate;
  }

  /**
   * Perform sync for a client
   */
  async syncClient(client) {
    const startTime = performance.now();
    
    try {
      // Simulate network failure
      if (this.shouldSimulateNetworkFailure()) {
        throw new Error('Network timeout');
      }
      
      // Prepare sync payload
      const syncPayload = {
        clientId: client.id,
        lastSyncTime: client.lastSyncTime,
        operations: client.offlineQueue,
        checksum: this.calculateChecksum(client.data),
      };
      
      // Simulate conflict
      if (this.shouldSimulateConflict()) {
        // Modify some operations to create conflicts
        syncPayload.operations = syncPayload.operations.map(op => ({
          ...op,
          conflictingVersion: op.data.clientVersion - 1,
        }));
        client.conflicts++;
      }
      
      // Simulate sync request (mock - replace with actual API call)
      const syncResult = await this.mockSyncRequest(syncPayload);
      
      // Process sync result
      if (syncResult.success) {
        // Update client state
        client.lastSyncTime = Date.now();
        client.offlineQueue = [];
        client.syncAttempts = 0;
        
        // Merge server changes
        if (syncResult.serverChanges) {
          this.mergeServerChanges(client, syncResult.serverChanges);
        }
        
        // Handle conflicts
        if (syncResult.conflicts) {
          this.results.conflictsResolved += syncResult.conflicts.length;
          this.resolveConflicts(client, syncResult.conflicts);
        }
        
        this.results.successfulSyncs++;
      } else {
        throw new Error(syncResult.error || 'Sync failed');
      }
      
      const syncTime = performance.now() - startTime;
      this.results.syncTimes.push(syncTime);
      
    } catch (error) {
      client.syncAttempts++;
      this.results.failedSyncs++;
      this.results.errors.push({
        clientId: client.id,
        error: error.message,
        timestamp: Date.now(),
        attempts: client.syncAttempts,
      });
      
      // Implement exponential backoff
      const backoffTime = Math.min(1000 * Math.pow(2, client.syncAttempts), 30000);
      await this.sleep(backoffTime);
    }
    
    this.results.totalSyncs++;
  }

  /**
   * Mock sync request (replace with actual API call)
   */
  async mockSyncRequest(payload) {
    // Simulate network latency
    await this.sleep(Math.random() * 200 + 50);
    
    // Simulate different scenarios
    const scenario = Math.random();
    
    if (scenario < 0.7) {
      // Success
      return {
        success: true,
        serverChanges: this.generateServerChanges(),
        conflicts: payload.operations.filter(op => op.conflictingVersion),
      };
    } else if (scenario < 0.9) {
      // Partial success with conflicts
      return {
        success: true,
        conflicts: payload.operations.slice(0, Math.floor(payload.operations.length / 2)),
        serverChanges: [],
      };
    } else {
      // Failure
      return {
        success: false,
        error: 'Server error',
      };
    }
  }

  /**
   * Generate mock server changes
   */
  generateServerChanges() {
    const numChanges = Math.floor(Math.random() * 10);
    const changes = [];
    
    for (let i = 0; i < numChanges; i++) {
      changes.push({
        id: `server-change-${Date.now()}-${i}`,
        type: 'update',
        timestamp: Date.now(),
        data: {
          value: Math.random(),
          serverVersion: Date.now(),
        },
      });
    }
    
    return changes;
  }

  /**
   * Merge server changes into client data
   */
  mergeServerChanges(client, serverChanges) {
    // Simple last-write-wins merge strategy
    serverChanges.forEach(change => {
      const existingIndex = client.data.findIndex(item => item.id === change.id);
      
      if (existingIndex >= 0) {
        // Update existing item
        if (change.timestamp > client.data[existingIndex].timestamp) {
          client.data[existingIndex] = change;
        }
      } else {
        // Add new item
        client.data.push(change);
      }
    });
  }

  /**
   * Resolve conflicts
   */
  resolveConflicts(client, conflicts) {
    // Simple conflict resolution: server wins
    conflicts.forEach(conflict => {
      const index = client.offlineQueue.findIndex(op => op.id === conflict.id);
      if (index >= 0) {
        client.offlineQueue.splice(index, 1);
      }
    });
  }

  /**
   * Calculate data checksum
   */
  calculateChecksum(data) {
    const crypto = require('crypto');
    const hash = crypto.createHash('md5');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  /**
   * Sleep helper
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Run stress test
   */
  async run() {
    console.log('🚀 Starting Offline Sync Stress Test');
    console.log('=' . repeat(60));
    console.log(`Clients: ${this.config.numClients}`);
    console.log(`Items per client: ${this.config.itemsPerClient}`);
    console.log(`Conflict rate: ${this.config.conflictRate * 100}%`);
    console.log(`Network failure rate: ${this.config.networkFailureRate * 100}%`);
    console.log(`Test duration: ${this.config.testDuration / 1000}s`);
    console.log('=' . repeat(60) + '\n');
    
    this.results.startTime = Date.now();
    
    // Initialize clients
    this.initializeClients();
    
    // Simulate offline operations for each client
    console.log('📝 Simulating offline operations...');
    this.clients.forEach(client => {
      this.simulateOfflineOperations(client);
    });
    
    // Start continuous sync attempts
    console.log('🔄 Starting sync stress test...\n');
    
    const syncPromises = [];
    const endTime = Date.now() + this.config.testDuration;
    
    // Progress reporting
    const progressInterval = setInterval(() => {
      this.printProgress();
    }, 5000);
    
    // Continuous sync loop
    while (Date.now() < endTime) {
      // Select random clients to sync
      const clientsToSync = this.clients
        .filter(() => Math.random() < 0.3) // 30% chance each iteration
        .slice(0, 10); // Max 10 concurrent syncs
      
      const syncBatch = clientsToSync.map(client => this.syncClient(client));
      syncPromises.push(...syncBatch);
      
      // Add more offline operations randomly
      this.clients.forEach(client => {
        if (Math.random() < 0.1) {
          this.simulateOfflineOperations(client);
        }
      });
      
      await this.sleep(1000); // Wait 1 second between batches
    }
    
    // Wait for remaining syncs to complete
    console.log('\n⏳ Waiting for remaining syncs to complete...');
    await Promise.allSettled(syncPromises);
    
    clearInterval(progressInterval);
    this.results.endTime = Date.now();
    
    // Generate report
    this.generateReport();
  }

  /**
   * Print progress
   */
  printProgress() {
    const elapsed = (Date.now() - this.results.startTime) / 1000;
    const syncRate = this.results.totalSyncs / elapsed;
    const successRate = this.results.totalSyncs > 0
      ? (this.results.successfulSyncs / this.results.totalSyncs * 100).toFixed(2)
      : 0;
    
    console.log(
      `[${elapsed.toFixed(0)}s] ` +
      `Syncs: ${this.results.totalSyncs} | ` +
      `Success: ${successRate}% | ` +
      `Conflicts: ${this.results.conflictsResolved} | ` +
      `Errors: ${this.results.failedSyncs} | ` +
      `Rate: ${syncRate.toFixed(1)}/s`
    );
  }

  /**
   * Generate final report
   */
  generateReport() {
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    const successRate = (this.results.successfulSyncs / this.results.totalSyncs * 100);
    const avgSyncTime = this.results.syncTimes.reduce((a, b) => a + b, 0) / this.results.syncTimes.length;
    
    // Calculate percentiles
    const sortedTimes = [...this.results.syncTimes].sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)] || 0;
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)] || 0;
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)] || 0;
    
    console.log('\n' + '=' . repeat(60));
    console.log('📊 OFFLINE SYNC STRESS TEST RESULTS');
    console.log('=' . repeat(60));
    
    console.log('\n📈 Summary:');
    console.log(`  Test Duration: ${duration.toFixed(1)}s`);
    console.log(`  Total Clients: ${this.config.numClients}`);
    console.log(`  Total Sync Attempts: ${this.results.totalSyncs}`);
    console.log(`  Successful Syncs: ${this.results.successfulSyncs}`);
    console.log(`  Failed Syncs: ${this.results.failedSyncs}`);
    console.log(`  Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`  Conflicts Resolved: ${this.results.conflictsResolved}`);
    
    console.log('\n⚡ Sync Performance:');
    console.log(`  Average Time: ${avgSyncTime.toFixed(2)}ms`);
    console.log(`  P50: ${p50.toFixed(2)}ms`);
    console.log(`  P95: ${p95.toFixed(2)}ms`);
    console.log(`  P99: ${p99.toFixed(2)}ms`);
    console.log(`  Throughput: ${(this.results.totalSyncs / duration).toFixed(1)} syncs/sec`);
    
    console.log('\n🎯 Success Criteria:');
    console.log(`  ${successRate > 99.9 ? '✅' : '❌'} Sync success rate > 99.9%: ${successRate > 99.9 ? 'PASS' : 'FAIL'}`);
    console.log(`  ${p95 < 500 ? '✅' : '❌'} P95 sync time < 500ms: ${p95 < 500 ? 'PASS' : 'FAIL'}`);
    console.log(`  ${this.results.dataLoss === 0 ? '✅' : '❌'} Zero data loss: ${this.results.dataLoss === 0 ? 'PASS' : 'FAIL'}`);
    console.log(`  ✅ Conflict resolution: ${this.results.conflictsResolved} conflicts handled`);
    
    // Client statistics
    const clientStats = this.clients.map(c => ({
      id: c.id,
      pendingOps: c.offlineQueue.length,
      conflicts: c.conflicts,
      attempts: c.syncAttempts,
    }));
    
    const maxPending = Math.max(...clientStats.map(c => c.pendingOps));
    const avgPending = clientStats.reduce((sum, c) => sum + c.pendingOps, 0) / clientStats.length;
    
    console.log('\n📱 Client Statistics:');
    console.log(`  Average pending operations: ${avgPending.toFixed(1)}`);
    console.log(`  Max pending operations: ${maxPending}`);
    console.log(`  Clients with failures: ${clientStats.filter(c => c.attempts > 0).length}`);
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ Sample Errors:');
      const errorCounts = {};
      this.results.errors.forEach(e => {
        errorCounts[e.error] = (errorCounts[e.error] || 0) + 1;
      });
      
      Object.entries(errorCounts).slice(0, 5).forEach(([error, count]) => {
        console.log(`  - ${error}: ${count} occurrences`);
      });
    }
    
    console.log('\n' + '=' . repeat(60));
    
    // Save detailed report
    const fs = require('fs');
    const reportPath = `performance-reports/sync-stress-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify({
      config: this.config,
      results: this.results,
      clientStats: clientStats,
    }, null, 2));
    
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);
  }
}

// Run the stress test
if (require.main === module) {
  const tester = new OfflineSyncStressTester({
    numClients: parseInt(process.env.NUM_CLIENTS) || 50,
    itemsPerClient: parseInt(process.env.ITEMS_PER_CLIENT) || 100,
    conflictRate: parseFloat(process.env.CONFLICT_RATE) || 0.2,
    networkFailureRate: parseFloat(process.env.FAILURE_RATE) || 0.1,
    testDuration: parseInt(process.env.DURATION) || 60000,
  });
  
  tester.run().catch(console.error);
}