// Performance monitoring utilities for review engine
import { ReviewEngineMonitor } from './sentry';

export interface PerformanceMetrics {
  // Response times (ms)
  queueLoadTime: number[];
  sessionCreationTime: number[];
  answerSubmissionTime: number[];
  validationTime: number[];
  
  // Cache metrics
  cacheHitRate: number;
  cacheMissRate: number;
  cacheLatency: number[];
  
  // Database metrics
  dbQueryTime: number[];
  dbConnectionPoolSize: number;
  dbSlowQueries: string[];
  
  // Memory usage
  heapUsed: number;
  heapTotal: number;
  external: number;
  
  // Error rates
  errorCount: Map<string, number>;
  errorRate: number;
  
  // Throughput
  requestsPerSecond: number;
  activeConnections: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics;
  private startTime: number;
  private metricsInterval: NodeJS.Timeout | null = null;
  
  private constructor() {
    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();
    this.startMetricsCollection();
  }
  
  static getInstance(): PerformanceMonitor {
    if (!this.instance) {
      this.instance = new PerformanceMonitor();
    }
    return this.instance;
  }
  
  private initializeMetrics(): PerformanceMetrics {
    return {
      queueLoadTime: [],
      sessionCreationTime: [],
      answerSubmissionTime: [],
      validationTime: [],
      cacheHitRate: 0,
      cacheMissRate: 0,
      cacheLatency: [],
      dbQueryTime: [],
      dbConnectionPoolSize: 0,
      dbSlowQueries: [],
      heapUsed: 0,
      heapTotal: 0,
      external: 0,
      errorCount: new Map(),
      errorRate: 0,
      requestsPerSecond: 0,
      activeConnections: 0,
    };
  }
  
  private startMetricsCollection() {
    // Collect metrics every 10 seconds
    this.metricsInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.calculateAggregates();
      this.checkThresholds();
      this.reportMetrics();
    }, 10000);
  }
  
  private collectSystemMetrics() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.metrics.heapUsed = memUsage.heapUsed;
      this.metrics.heapTotal = memUsage.heapTotal;
      this.metrics.external = memUsage.external;
    }
  }
  
  private calculateAggregates() {
    // Calculate error rate
    const totalRequests = this.metrics.queueLoadTime.length + 
                         this.metrics.sessionCreationTime.length + 
                         this.metrics.answerSubmissionTime.length;
    
    const totalErrors = Array.from(this.metrics.errorCount.values())
      .reduce((sum, count) => sum + count, 0);
    
    this.metrics.errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;
    
    // Calculate cache rates
    const cacheTotal = this.metrics.cacheHitRate + this.metrics.cacheMissRate;
    if (cacheTotal > 0) {
      this.metrics.cacheHitRate = this.metrics.cacheHitRate / cacheTotal;
      this.metrics.cacheMissRate = this.metrics.cacheMissRate / cacheTotal;
    }
  }
  
  private checkThresholds() {
    // Check queue load time
    const avgQueueLoadTime = this.average(this.metrics.queueLoadTime);
    if (avgQueueLoadTime > 300) {
      this.alertSlowPerformance('Queue Load', avgQueueLoadTime);
    }
    
    // Check session creation time
    const avgSessionTime = this.average(this.metrics.sessionCreationTime);
    if (avgSessionTime > 1000) {
      this.alertSlowPerformance('Session Creation', avgSessionTime);
    }
    
    // Check cache hit rate
    if (this.metrics.cacheHitRate < 0.8) {
      this.alertLowCacheHitRate(this.metrics.cacheHitRate);
    }
    
    // Check error rate
    if (this.metrics.errorRate > 0.05) {
      this.alertHighErrorRate(this.metrics.errorRate);
    }
    
    // Check memory usage
    const memoryUsagePercent = this.metrics.heapUsed / this.metrics.heapTotal;
    if (memoryUsagePercent > 0.9) {
      this.alertHighMemoryUsage(memoryUsagePercent);
    }
  }
  
  private reportMetrics() {
    const report = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      performance: {
        queueLoad: {
          avg: this.average(this.metrics.queueLoadTime),
          p95: this.percentile(this.metrics.queueLoadTime, 95),
          p99: this.percentile(this.metrics.queueLoadTime, 99),
        },
        sessionCreation: {
          avg: this.average(this.metrics.sessionCreationTime),
          p95: this.percentile(this.metrics.sessionCreationTime, 95),
          p99: this.percentile(this.metrics.sessionCreationTime, 99),
        },
        answerSubmission: {
          avg: this.average(this.metrics.answerSubmissionTime),
          p95: this.percentile(this.metrics.answerSubmissionTime, 95),
          p99: this.percentile(this.metrics.answerSubmissionTime, 99),
        },
      },
      cache: {
        hitRate: this.metrics.cacheHitRate,
        missRate: this.metrics.cacheMissRate,
        avgLatency: this.average(this.metrics.cacheLatency),
      },
      database: {
        avgQueryTime: this.average(this.metrics.dbQueryTime),
        connectionPoolSize: this.metrics.dbConnectionPoolSize,
        slowQueries: this.metrics.dbSlowQueries.slice(-10), // Last 10 slow queries
      },
      memory: {
        heapUsed: this.formatBytes(this.metrics.heapUsed),
        heapTotal: this.formatBytes(this.metrics.heapTotal),
        external: this.formatBytes(this.metrics.external),
      },
      errors: {
        rate: this.metrics.errorRate,
        topErrors: this.getTopErrors(5),
      },
      throughput: {
        rps: this.metrics.requestsPerSecond,
        activeConnections: this.metrics.activeConnections,
      },
    };
    
    // Send to monitoring service
    ReviewEngineMonitor.trackCacheMetrics({
      hitRate: this.metrics.cacheHitRate,
      missRate: this.metrics.cacheMissRate,
      avgLatency: this.average(this.metrics.cacheLatency),
      memoryUsage: this.metrics.heapUsed,
    });
    
    // Log locally in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Performance Report:', JSON.stringify(report, null, 2));
    }
    
    // Clear old metrics to prevent memory leak
    this.clearOldMetrics();
  }
  
  // Public methods for tracking metrics
  
  trackQueueLoad(duration: number) {
    this.metrics.queueLoadTime.push(duration);
  }
  
  trackSessionCreation(duration: number) {
    this.metrics.sessionCreationTime.push(duration);
  }
  
  trackAnswerSubmission(duration: number) {
    this.metrics.answerSubmissionTime.push(duration);
  }
  
  trackValidation(duration: number) {
    this.metrics.validationTime.push(duration);
  }
  
  trackCacheHit() {
    this.metrics.cacheHitRate++;
  }
  
  trackCacheMiss() {
    this.metrics.cacheMissRate++;
  }
  
  trackCacheLatency(duration: number) {
    this.metrics.cacheLatency.push(duration);
  }
  
  trackDatabaseQuery(query: string, duration: number) {
    this.metrics.dbQueryTime.push(duration);
    
    // Track slow queries (> 100ms)
    if (duration > 100) {
      this.metrics.dbSlowQueries.push(`${query} (${duration}ms)`);
    }
  }
  
  trackError(errorType: string) {
    const count = this.metrics.errorCount.get(errorType) || 0;
    this.metrics.errorCount.set(errorType, count + 1);
  }
  
  updateConnectionPool(size: number) {
    this.metrics.dbConnectionPoolSize = size;
  }
  
  updateThroughput(rps: number, connections: number) {
    this.metrics.requestsPerSecond = rps;
    this.metrics.activeConnections = connections;
  }
  
  // Alert methods
  
  private alertSlowPerformance(operation: string, avgTime: number) {
    console.warn(`⚠️ Slow ${operation}: ${avgTime}ms average`);
    ReviewEngineMonitor.trackAPICall(operation, avgTime, 200);
  }
  
  private alertLowCacheHitRate(hitRate: number) {
    console.warn(`⚠️ Low cache hit rate: ${(hitRate * 100).toFixed(2)}%`);
  }
  
  private alertHighErrorRate(errorRate: number) {
    console.error(`🔴 High error rate: ${(errorRate * 100).toFixed(2)}%`);
  }
  
  private alertHighMemoryUsage(usage: number) {
    console.warn(`⚠️ High memory usage: ${(usage * 100).toFixed(2)}%`);
  }
  
  // Utility methods
  
  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
  
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }
  
  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
  
  private getTopErrors(limit: number): Array<{ type: string; count: number }> {
    return Array.from(this.metrics.errorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }));
  }
  
  private clearOldMetrics() {
    // Keep only last 1000 entries to prevent memory leak
    const maxEntries = 1000;
    
    if (this.metrics.queueLoadTime.length > maxEntries) {
      this.metrics.queueLoadTime = this.metrics.queueLoadTime.slice(-maxEntries);
    }
    if (this.metrics.sessionCreationTime.length > maxEntries) {
      this.metrics.sessionCreationTime = this.metrics.sessionCreationTime.slice(-maxEntries);
    }
    if (this.metrics.answerSubmissionTime.length > maxEntries) {
      this.metrics.answerSubmissionTime = this.metrics.answerSubmissionTime.slice(-maxEntries);
    }
    if (this.metrics.cacheLatency.length > maxEntries) {
      this.metrics.cacheLatency = this.metrics.cacheLatency.slice(-maxEntries);
    }
    if (this.metrics.dbQueryTime.length > maxEntries) {
      this.metrics.dbQueryTime = this.metrics.dbQueryTime.slice(-maxEntries);
    }
    if (this.metrics.dbSlowQueries.length > 100) {
      this.metrics.dbSlowQueries = this.metrics.dbSlowQueries.slice(-100);
    }
  }
  
  // Cleanup
  destroy() {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }
}

// Export singleton instance
export const performanceMonitor = PerformanceMonitor.getInstance();