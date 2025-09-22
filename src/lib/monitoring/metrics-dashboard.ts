import { ComponentLogger } from './logger';
import * as Sentry from '@sentry/nextjs';

// Metrics storage interface
interface MetricData {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

interface MetricSummary {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

// Time windows for aggregation
enum TimeWindow {
  MINUTE = 60 * 1000,
  FIVE_MINUTES = 5 * 60 * 1000,
  FIFTEEN_MINUTES = 15 * 60 * 1000,
  HOUR = 60 * 60 * 1000,
  DAY = 24 * 60 * 60 * 1000
}

// Metric types
enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TIMER = 'timer'
}

// Custom metrics dashboard
export class MetricsDashboard {
  private static instance: MetricsDashboard;
  private metrics: Map<string, MetricData[]> = new Map();
  private logger: ComponentLogger;
  private flushInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.logger = new ComponentLogger('metrics');
    this.startFlushInterval();
  }

  static getInstance(): MetricsDashboard {
    if (!MetricsDashboard.instance) {
      MetricsDashboard.instance = new MetricsDashboard();
    }
    return MetricsDashboard.instance;
  }

  // Start periodic flush to external services
  private startFlushInterval() {
    this.flushInterval = setInterval(() => {
      this.flush();
    }, TimeWindow.MINUTE);
  }

  // Stop flush interval
  stop() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  // Record a metric
  record(name: string, value: number, type: MetricType = MetricType.GAUGE, tags?: Record<string, string>) {
    const key = this.getMetricKey(name, tags);
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const data: MetricData = {
      timestamp: Date.now(),
      value,
      tags
    };

    this.metrics.get(key)!.push(data);

    // Keep only recent data (last hour)
    this.cleanOldData(key, TimeWindow.HOUR);
  }

  // Get metric summary for a time window
  getSummary(name: string, window: TimeWindow, tags?: Record<string, string>): MetricSummary | null {
    const key = this.getMetricKey(name, tags);
    const data = this.metrics.get(key);

    if (!data || data.length === 0) {
      return null;
    }

    const now = Date.now();
    const relevantData = data.filter(d => d.timestamp >= now - window);

    if (relevantData.length === 0) {
      return null;
    }

    const values = relevantData.map(d => d.value).sort((a, b) => a - b);
    const sum = values.reduce((acc, val) => acc + val, 0);

    return {
      count: values.length,
      sum,
      min: values[0],
      max: values[values.length - 1],
      avg: sum / values.length,
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99)
    };
  }

  // Calculate percentile
  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }

  // Generate metric key
  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name;
    
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    
    return `${name}[${tagString}]`;
  }

  // Clean old data
  private cleanOldData(key: string, maxAge: number) {
    const data = this.metrics.get(key);
    if (!data) return;

    const cutoff = Date.now() - maxAge;
    const filtered = data.filter(d => d.timestamp >= cutoff);
    
    if (filtered.length !== data.length) {
      this.metrics.set(key, filtered);
    }
  }

  // Flush metrics to external services
  private flush() {
    const summaries: Record<string, any> = {};

    this.metrics.forEach((data, key) => {
      const summary = this.getSummary(key, TimeWindow.MINUTE);
      if (summary) {
        summaries[key] = summary;
      }
    });

    if (Object.keys(summaries).length > 0) {
      this.logger.info('Metrics flush', { summaries });
      
      // Send to Sentry for monitoring
      if (process.env.NODE_ENV === 'production') {
        Sentry.captureMessage('Metrics Summary', {
          level: 'info',
          extra: summaries
        });
      }
    }
  }

  // Get all metrics
  getAllMetrics(): Record<string, MetricSummary> {
    const result: Record<string, MetricSummary> = {};

    this.metrics.forEach((_, key) => {
      const summary = this.getSummary(key, TimeWindow.FIVE_MINUTES);
      if (summary) {
        result[key] = summary;
      }
    });

    return result;
  }
}

// Review Engine specific metrics
export class ReviewEngineMetrics {
  private dashboard: MetricsDashboard;

  constructor() {
    this.dashboard = MetricsDashboard.getInstance();
  }

  // Track review completion
  trackReviewCompletion(userId: string, sessionId: string, metrics: {
    itemCount: number;
    correctCount: number;
    duration: number;
    avgResponseTime: number;
  }) {
    const accuracy = metrics.correctCount / metrics.itemCount;

    // Record individual metrics
    this.dashboard.record('review.completion.count', 1, MetricType.COUNTER, { userId });
    this.dashboard.record('review.completion.accuracy', accuracy, MetricType.GAUGE, { userId });
    this.dashboard.record('review.completion.duration', metrics.duration, MetricType.TIMER, { userId });
    this.dashboard.record('review.completion.items', metrics.itemCount, MetricType.HISTOGRAM, { userId });
    this.dashboard.record('review.completion.response_time', metrics.avgResponseTime, MetricType.TIMER, { userId });

    // Track performance thresholds
    if (accuracy < 0.6) {
      this.dashboard.record('review.low_accuracy', 1, MetricType.COUNTER, { userId });
    }

    if (metrics.avgResponseTime > 5000) {
      this.dashboard.record('review.slow_response', 1, MetricType.COUNTER, { userId });
    }
  }

  // Track SRS accuracy
  trackSRSAccuracy(algorithm: string, predicted: number, actual: number) {
    const error = Math.abs(predicted - actual);
    
    this.dashboard.record('srs.prediction.error', error, MetricType.HISTOGRAM, { algorithm });
    this.dashboard.record('srs.prediction.count', 1, MetricType.COUNTER, { algorithm });
  }

  // Track queue generation
  trackQueueGeneration(userId: string, metrics: {
    itemCount: number;
    generationTime: number;
    cacheHit: boolean;
    algorithm: string;
  }) {
    this.dashboard.record('queue.generation.time', metrics.generationTime, MetricType.TIMER, {
      algorithm: metrics.algorithm,
      cache: metrics.cacheHit ? 'hit' : 'miss'
    });
    
    this.dashboard.record('queue.generation.size', metrics.itemCount, MetricType.HISTOGRAM, {
      algorithm: metrics.algorithm
    });

    this.dashboard.record('queue.cache.' + (metrics.cacheHit ? 'hit' : 'miss'), 1, MetricType.COUNTER);
  }

  // Track offline sync
  trackOfflineSync(operation: string, metrics: {
    duration: number;
    itemCount: number;
    success: boolean;
    retryCount?: number;
  }) {
    this.dashboard.record('sync.operation.duration', metrics.duration, MetricType.TIMER, {
      operation,
      status: metrics.success ? 'success' : 'failure'
    });

    this.dashboard.record('sync.operation.items', metrics.itemCount, MetricType.HISTOGRAM, {
      operation
    });

    if (metrics.retryCount) {
      this.dashboard.record('sync.retry.count', metrics.retryCount, MetricType.COUNTER, {
        operation
      });
    }

    this.dashboard.record('sync.' + (metrics.success ? 'success' : 'failure'), 1, MetricType.COUNTER, {
      operation
    });
  }

  // Track API performance
  trackAPIPerformance(endpoint: string, method: string, metrics: {
    duration: number;
    statusCode: number;
    cacheHit?: boolean;
  }) {
    this.dashboard.record('api.request.duration', metrics.duration, MetricType.TIMER, {
      endpoint,
      method,
      status: metrics.statusCode.toString()
    });

    this.dashboard.record('api.request.count', 1, MetricType.COUNTER, {
      endpoint,
      method,
      status: metrics.statusCode.toString()
    });

    if (metrics.statusCode >= 400) {
      this.dashboard.record('api.error.count', 1, MetricType.COUNTER, {
        endpoint,
        method,
        status: metrics.statusCode.toString()
      });
    }

    if (metrics.cacheHit !== undefined) {
      this.dashboard.record('api.cache.' + (metrics.cacheHit ? 'hit' : 'miss'), 1, MetricType.COUNTER, {
        endpoint
      });
    }
  }

  // Track cache performance
  trackCachePerformance(operation: string, metrics: {
    duration: number;
    hit: boolean;
    key: string;
  }) {
    this.dashboard.record('cache.operation.duration', metrics.duration, MetricType.TIMER, {
      operation,
      result: metrics.hit ? 'hit' : 'miss'
    });

    this.dashboard.record('cache.' + (metrics.hit ? 'hit' : 'miss'), 1, MetricType.COUNTER, {
      operation
    });
  }

  // Track database performance
  trackDatabasePerformance(operation: string, collection: string, metrics: {
    duration: number;
    documentCount?: number;
    error?: boolean;
  }) {
    this.dashboard.record('db.query.duration', metrics.duration, MetricType.TIMER, {
      operation,
      collection,
      status: metrics.error ? 'error' : 'success'
    });

    if (metrics.documentCount !== undefined) {
      this.dashboard.record('db.query.documents', metrics.documentCount, MetricType.HISTOGRAM, {
        operation,
        collection
      });
    }

    if (metrics.error) {
      this.dashboard.record('db.error.count', 1, MetricType.COUNTER, {
        operation,
        collection
      });
    }
  }

  // Get dashboard summary
  getDashboardSummary(): {
    review: any;
    api: any;
    sync: any;
    cache: any;
    database: any;
  } {
    const allMetrics = this.dashboard.getAllMetrics();
    
    const categorize = (prefix: string) => {
      const result: Record<string, any> = {};
      Object.entries(allMetrics).forEach(([key, value]) => {
        if (key.startsWith(prefix)) {
          result[key] = value;
        }
      });
      return result;
    };

    return {
      review: categorize('review.'),
      api: categorize('api.'),
      sync: categorize('sync.'),
      cache: categorize('cache.'),
      database: categorize('db.')
    };
  }

  // Generate health score
  getHealthScore(): {
    score: number;
    status: 'healthy' | 'degraded' | 'unhealthy';
    issues: string[];
  } {
    const issues: string[] = [];
    let score = 100;

    const metrics = this.dashboard.getAllMetrics();

    // Check API error rate
    const apiErrors = metrics['api.error.count'];
    const apiTotal = metrics['api.request.count'];
    if (apiErrors && apiTotal) {
      const errorRate = apiErrors.sum / apiTotal.sum;
      if (errorRate > 0.05) {
        issues.push(`High API error rate: ${(errorRate * 100).toFixed(1)}%`);
        score -= 20;
      }
    }

    // Check sync failure rate
    const syncFailures = metrics['sync.failure'];
    const syncSuccess = metrics['sync.success'];
    if (syncFailures && syncSuccess) {
      const failureRate = syncFailures.sum / (syncFailures.sum + syncSuccess.sum);
      if (failureRate > 0.1) {
        issues.push(`High sync failure rate: ${(failureRate * 100).toFixed(1)}%`);
        score -= 25;
      }
    }

    // Check cache hit rate
    const cacheHits = metrics['cache.hit'];
    const cacheMisses = metrics['cache.miss'];
    if (cacheHits && cacheMisses) {
      const hitRate = cacheHits.sum / (cacheHits.sum + cacheMisses.sum);
      if (hitRate < 0.7) {
        issues.push(`Low cache hit rate: ${(hitRate * 100).toFixed(1)}%`);
        score -= 15;
      }
    }

    // Check response times
    const apiDuration = metrics['api.request.duration'];
    if (apiDuration && apiDuration.p95 > 1000) {
      issues.push(`Slow API response time: p95=${apiDuration.p95}ms`);
      score -= 15;
    }

    // Determine status
    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (score >= 80) {
      status = 'healthy';
    } else if (score >= 60) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { score, status, issues };
  }
}

// Export singleton instances
export const metricsDashboard = MetricsDashboard.getInstance();
export const reviewMetrics = new ReviewEngineMetrics();