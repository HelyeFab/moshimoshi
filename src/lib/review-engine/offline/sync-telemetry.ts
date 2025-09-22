/**
 * Sync Telemetry and Monitoring System
 * Provides comprehensive metrics and logging for offline sync operations
 */

import { EventEmitter } from 'events';
import { reviewLogger } from '@/lib/monitoring/logger';

export interface SyncEvent {
  type: 'sync_started' | 'sync_completed' | 'sync_failed' | 'conflict_resolved' | 
        'circuit_breaker_tripped' | 'circuit_breaker_reset' | 'queue_cleared' |
        'item_added' | 'item_retried' | 'dead_letter_added';
  timestamp: number;
  details: any;
  duration?: number;
  error?: string;
}

export interface SyncPerformanceMetrics {
  // Timing metrics
  averageSyncTime: number;
  p50SyncTime: number;
  p95SyncTime: number;
  p99SyncTime: number;
  
  // Throughput metrics
  syncRate: number; // syncs per minute
  dataRate: number; // KB per minute
  
  // Reliability metrics
  successRate: number;
  conflictRate: number;
  retryRate: number;
  deadLetterRate: number;
  
  // Circuit breaker metrics
  circuitBreakerTrips: number;
  averageRecoveryTime: number;
  
  // Queue metrics
  averageQueueSize: number;
  maxQueueSize: number;
  averageQueueLatency: number;
}

export interface SyncHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  isOnline: boolean;
  circuitBreakerOpen: boolean;
  queueBacklog: number;
  recentErrors: string[];
  lastSuccessfulSync?: number;
  recommendations: string[];
}

export class SyncTelemetry extends EventEmitter {
  private events: SyncEvent[] = [];
  private syncTimes: number[] = [];
  private dataSizes: number[] = [];
  private queueSizes: number[] = [];
  private circuitBreakerRecoveryTimes: number[] = [];
  
  private readonly MAX_EVENTS = 1000;
  private readonly METRICS_WINDOW = 300000; // 5 minutes
  
  // Counters
  private totalSyncs = 0;
  private successfulSyncs = 0;
  private failedSyncs = 0;
  private conflicts = 0;
  private retries = 0;
  private deadLetters = 0;
  private circuitBreakerTrips = 0;
  
  constructor() {
    super();
    this.startMetricsCollection();
  }
  
  /**
   * Record a sync event
   */
  recordEvent(event: Omit<SyncEvent, 'timestamp'>): void {
    const fullEvent: SyncEvent = {
      ...event,
      timestamp: Date.now()
    };
    
    this.events.push(fullEvent);
    
    // Maintain event buffer size
    if (this.events.length > this.MAX_EVENTS) {
      this.events = this.events.slice(-this.MAX_EVENTS);
    }
    
    // Update counters
    this.updateCounters(fullEvent);
    
    // Emit for real-time monitoring
    this.emit('sync_event', fullEvent);
    
    // Log important events
    this.logEvent(fullEvent);
  }
  
  /**
   * Record sync timing
   */
  recordSyncTime(duration: number, dataSize: number = 0): void {
    this.syncTimes.push(duration);
    this.dataSizes.push(dataSize);
    
    // Maintain window
    const cutoff = Date.now() - this.METRICS_WINDOW;
    this.syncTimes = this.syncTimes.slice(-100);
    this.dataSizes = this.dataSizes.slice(-100);
  }
  
  /**
   * Record queue size
   */
  recordQueueSize(size: number): void {
    this.queueSizes.push(size);
    this.queueSizes = this.queueSizes.slice(-100);
  }
  
  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): SyncPerformanceMetrics {
    const sortedTimes = [...this.syncTimes].sort((a, b) => a - b);
    const successRate = this.totalSyncs > 0 
      ? (this.successfulSyncs / this.totalSyncs) * 100 
      : 100;
    
    return {
      // Timing metrics
      averageSyncTime: this.calculateAverage(this.syncTimes),
      p50SyncTime: this.calculatePercentile(sortedTimes, 50),
      p95SyncTime: this.calculatePercentile(sortedTimes, 95),
      p99SyncTime: this.calculatePercentile(sortedTimes, 99),
      
      // Throughput metrics
      syncRate: this.calculateSyncRate(),
      dataRate: this.calculateDataRate(),
      
      // Reliability metrics
      successRate,
      conflictRate: this.totalSyncs > 0 ? (this.conflicts / this.totalSyncs) * 100 : 0,
      retryRate: this.totalSyncs > 0 ? (this.retries / this.totalSyncs) * 100 : 0,
      deadLetterRate: this.totalSyncs > 0 ? (this.deadLetters / this.totalSyncs) * 100 : 0,
      
      // Circuit breaker metrics
      circuitBreakerTrips: this.circuitBreakerTrips,
      averageRecoveryTime: this.calculateAverage(this.circuitBreakerRecoveryTimes),
      
      // Queue metrics
      averageQueueSize: this.calculateAverage(this.queueSizes),
      maxQueueSize: Math.max(...this.queueSizes, 0),
      averageQueueLatency: this.calculateQueueLatency()
    };
  }
  
  /**
   * Get health status
   */
  getHealthStatus(queueBacklog: number, circuitBreakerOpen: boolean): SyncHealthStatus {
    const metrics = this.getPerformanceMetrics();
    const recentErrors = this.getRecentErrors();
    const lastSuccess = this.getLastSuccessfulSync();
    const timeSinceSuccess = lastSuccess ? Date.now() - lastSuccess : Infinity;
    
    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const recommendations: string[] = [];
    
    if (circuitBreakerOpen || metrics.successRate < 50) {
      status = 'unhealthy';
      recommendations.push('Circuit breaker is open or success rate critically low');
    } else if (metrics.successRate < 90 || queueBacklog > 100) {
      status = 'degraded';
      if (metrics.successRate < 90) {
        recommendations.push('Success rate below 90%, check network stability');
      }
      if (queueBacklog > 100) {
        recommendations.push('Large queue backlog, consider increasing sync frequency');
      }
    }
    
    if (timeSinceSuccess > 300000) { // 5 minutes
      status = 'unhealthy';
      recommendations.push('No successful sync in last 5 minutes');
    }
    
    if (metrics.averageSyncTime > 5000) {
      recommendations.push('High sync latency detected, check server performance');
    }
    
    if (metrics.retryRate > 20) {
      recommendations.push('High retry rate, check for transient errors');
    }
    
    return {
      status,
      isOnline: navigator.onLine,
      circuitBreakerOpen,
      queueBacklog,
      recentErrors,
      lastSuccessfulSync: lastSuccess,
      recommendations
    };
  }
  
  /**
   * Get sync history
   */
  getSyncHistory(limit: number = 50): SyncEvent[] {
    return this.events.slice(-limit);
  }
  
  /**
   * Get error analysis
   */
  getErrorAnalysis(): {
    errorTypes: Map<string, number>;
    errorTrends: { timestamp: number; count: number }[];
    mostCommonErrors: string[];
  } {
    const errorTypes = new Map<string, number>();
    const errorsByMinute = new Map<number, number>();
    
    const failedEvents = this.events.filter(e => e.type === 'sync_failed');
    
    for (const event of failedEvents) {
      const error = event.error || 'Unknown';
      errorTypes.set(error, (errorTypes.get(error) || 0) + 1);
      
      const minute = Math.floor(event.timestamp / 60000);
      errorsByMinute.set(minute, (errorsByMinute.get(minute) || 0) + 1);
    }
    
    const errorTrends = Array.from(errorsByMinute.entries())
      .map(([minute, count]) => ({ timestamp: minute * 60000, count }))
      .sort((a, b) => a.timestamp - b.timestamp);
    
    const mostCommonErrors = Array.from(errorTypes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error]) => error);
    
    return {
      errorTypes,
      errorTrends,
      mostCommonErrors
    };
  }
  
  /**
   * Export metrics for external monitoring
   */
  exportMetrics(): string {
    const metrics = this.getPerformanceMetrics();
    const health = this.getHealthStatus(0, false);
    
    return JSON.stringify({
      timestamp: Date.now(),
      performance: metrics,
      health: health.status,
      counters: {
        totalSyncs: this.totalSyncs,
        successfulSyncs: this.successfulSyncs,
        failedSyncs: this.failedSyncs,
        conflicts: this.conflicts,
        retries: this.retries,
        deadLetters: this.deadLetters
      }
    }, null, 2);
  }
  
  /**
   * Reset all metrics
   */
  reset(): void {
    this.events = [];
    this.syncTimes = [];
    this.dataSizes = [];
    this.queueSizes = [];
    this.circuitBreakerRecoveryTimes = [];
    
    this.totalSyncs = 0;
    this.successfulSyncs = 0;
    this.failedSyncs = 0;
    this.conflicts = 0;
    this.retries = 0;
    this.deadLetters = 0;
    this.circuitBreakerTrips = 0;
    
    this.emit('metrics_reset');
  }
  
  private updateCounters(event: SyncEvent): void {
    switch (event.type) {
      case 'sync_started':
        this.totalSyncs++;
        break;
      case 'sync_completed':
        this.successfulSyncs++;
        break;
      case 'sync_failed':
        this.failedSyncs++;
        break;
      case 'conflict_resolved':
        this.conflicts++;
        break;
      case 'item_retried':
        this.retries++;
        break;
      case 'dead_letter_added':
        this.deadLetters++;
        break;
      case 'circuit_breaker_tripped':
        this.circuitBreakerTrips++;
        break;
      case 'circuit_breaker_reset':
        if (event.details.recoveryTime) {
          this.circuitBreakerRecoveryTimes.push(event.details.recoveryTime);
        }
        break;
    }
  }
  
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  private calculatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }
  
  private calculateSyncRate(): number {
    const recentSyncs = this.events.filter(
      e => e.type === 'sync_completed' && 
      e.timestamp > Date.now() - 60000
    );
    return recentSyncs.length;
  }
  
  private calculateDataRate(): number {
    const recentData = this.dataSizes.slice(-10);
    const totalData = recentData.reduce((sum, size) => sum + size, 0);
    return totalData / 1024; // KB per minute
  }
  
  private calculateQueueLatency(): number {
    const addEvents = this.events.filter(e => e.type === 'item_added');
    const syncEvents = this.events.filter(e => e.type === 'sync_completed');
    
    if (addEvents.length === 0 || syncEvents.length === 0) return 0;
    
    let totalLatency = 0;
    let count = 0;
    
    for (const addEvent of addEvents) {
      const syncEvent = syncEvents.find(
        s => s.timestamp > addEvent.timestamp && 
        s.details.itemId === addEvent.details.itemId
      );
      
      if (syncEvent) {
        totalLatency += syncEvent.timestamp - addEvent.timestamp;
        count++;
      }
    }
    
    return count > 0 ? totalLatency / count : 0;
  }
  
  private getRecentErrors(): string[] {
    return this.events
      .filter(e => e.type === 'sync_failed' && e.timestamp > Date.now() - 300000)
      .map(e => e.error || 'Unknown error')
      .slice(-5);
  }
  
  private getLastSuccessfulSync(): number | undefined {
    const successEvents = this.events
      .filter(e => e.type === 'sync_completed')
      .sort((a, b) => b.timestamp - a.timestamp);
    
    return successEvents[0]?.timestamp;
  }
  
  private logEvent(event: SyncEvent): void {
    const level = event.type === 'sync_failed' || 
                  event.type === 'circuit_breaker_tripped' ? 'error' : 'info';
    
    const message = `[SyncTelemetry] ${event.type}: ${JSON.stringify(event.details)}`;
    
    if (level === 'error') {
      reviewLogger.error(message, event.error);
    } else {
      reviewLogger.info(message);
    }
  }
  
  private startMetricsCollection(): void {
    // Periodically clean old events
    setInterval(() => {
      const cutoff = Date.now() - this.METRICS_WINDOW;
      this.events = this.events.filter(e => e.timestamp > cutoff);
    }, 60000);
  }
}

// Singleton instance
export const syncTelemetry = new SyncTelemetry();