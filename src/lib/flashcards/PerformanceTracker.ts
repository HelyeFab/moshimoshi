interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

interface PerformanceReport {
  timestamp: number;
  metrics: {
    [key: string]: {
      avg: number;
      min: number;
      max: number;
      count: number;
      p50: number;
      p95: number;
      p99: number;
    };
  };
  warnings: string[];
  suggestions: string[];
}

export class PerformanceTracker {
  private metrics: Map<string, PerformanceMetric[]> = new Map();
  private activeTimers: Map<string, number> = new Map();
  private performanceObserver: PerformanceObserver | null = null;
  private resourceTimings: PerformanceResourceTiming[] = [];
  private maxMetricsPerType = 1000;

  // Performance thresholds (in ms)
  private thresholds = {
    deckLoad: 100,
    cardFlip: 400,
    syncOperation: 1000,
    indexedDBQuery: 50,
    firebaseWrite: 500,
    componentMount: 200,
    sessionComplete: 100,
    bulkOperation: 2000,
    searchOperation: 300,
    exportOperation: 1000
  };

  constructor() {
    this.setupPerformanceObserver();
  }

  // Setup performance observer for resource timings
  private setupPerformanceObserver(): void {
    if (typeof window === 'undefined' || !window.PerformanceObserver) {
      return;
    }

    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'resource') {
            this.resourceTimings.push(entry as PerformanceResourceTiming);

            // Keep only recent entries
            if (this.resourceTimings.length > 100) {
              this.resourceTimings.shift();
            }
          }

          if (entry.entryType === 'measure') {
            this.recordMeasure(entry.name, entry.duration);
          }
        }
      });

      this.performanceObserver.observe({
        entryTypes: ['resource', 'measure', 'navigation']
      });
    } catch (error) {
      console.warn('[PerformanceTracker] Failed to setup observer:', error);
    }
  }

  // Start timing an operation
  startTimer(name: string, metadata?: Record<string, any>): void {
    const startTime = performance.now();
    this.activeTimers.set(name, startTime);

    // Also create a performance mark for native tracking
    try {
      performance.mark(`${name}-start`);
    } catch (error) {
      // Ignore if mark fails
    }
  }

  // End timing and record the metric
  endTimer(name: string, metadata?: Record<string, any>): number {
    const startTime = this.activeTimers.get(name);
    if (!startTime) {
      console.warn(`[PerformanceTracker] No start time for: ${name}`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Create performance measure
    try {
      performance.mark(`${name}-end`);
      performance.measure(name, `${name}-start`, `${name}-end`);
    } catch (error) {
      // Ignore if measure fails
    }

    // Record the metric
    this.recordMetric({
      name,
      startTime,
      endTime,
      duration,
      metadata
    });

    // Clean up
    this.activeTimers.delete(name);

    // Check threshold
    this.checkThreshold(name, duration);

    return duration;
  }

  // Record a metric directly
  recordMetric(metric: PerformanceMetric): void {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }

    const metricsList = this.metrics.get(metric.name)!;
    metricsList.push(metric);

    // Maintain size limit
    if (metricsList.length > this.maxMetricsPerType) {
      metricsList.shift();
    }
  }

  // Record a measure from Performance API
  private recordMeasure(name: string, duration: number): void {
    this.recordMetric({
      name,
      startTime: performance.now() - duration,
      endTime: performance.now(),
      duration
    });
  }

  // Check if a metric exceeds threshold
  private checkThreshold(name: string, duration: number): void {
    // Find matching threshold
    const thresholdKey = Object.keys(this.thresholds).find(key =>
      name.toLowerCase().includes(key.toLowerCase())
    );

    if (thresholdKey && duration > this.thresholds[thresholdKey as keyof typeof this.thresholds]) {
      console.warn(
        `[PerformanceTracker] ${name} exceeded threshold: ${duration.toFixed(2)}ms > ${
          this.thresholds[thresholdKey as keyof typeof this.thresholds]
        }ms`
      );
    }
  }

  // Get statistics for a specific metric
  getMetricStats(name: string): {
    avg: number;
    min: number;
    max: number;
    count: number;
    p50: number;
    p95: number;
    p99: number;
    recent: number[];
  } | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) {
      return null;
    }

    const durations = metrics
      .filter(m => m.duration !== undefined)
      .map(m => m.duration!);

    if (durations.length === 0) {
      return null;
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);

    return {
      avg: sum / durations.length,
      min: Math.min(...durations),
      max: Math.max(...durations),
      count: durations.length,
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
      recent: durations.slice(-10)
    };
  }

  // Calculate percentile
  private percentile(sortedArray: number[], p: number): number {
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[Math.max(0, index)];
  }

  // Generate performance report
  generateReport(): PerformanceReport {
    const report: PerformanceReport = {
      timestamp: Date.now(),
      metrics: {},
      warnings: [],
      suggestions: []
    };

    // Collect stats for all metrics
    for (const [name, metrics] of this.metrics.entries()) {
      const stats = this.getMetricStats(name);
      if (stats) {
        report.metrics[name] = {
          avg: stats.avg,
          min: stats.min,
          max: stats.max,
          count: stats.count,
          p50: stats.p50,
          p95: stats.p95,
          p99: stats.p99
        };

        // Check for performance issues
        const thresholdKey = Object.keys(this.thresholds).find(key =>
          name.toLowerCase().includes(key.toLowerCase())
        );

        if (thresholdKey) {
          const threshold = this.thresholds[thresholdKey as keyof typeof this.thresholds];

          if (stats.avg > threshold) {
            report.warnings.push(
              `${name} average (${stats.avg.toFixed(2)}ms) exceeds threshold (${threshold}ms)`
            );
          }

          if (stats.p95 > threshold * 2) {
            report.warnings.push(
              `${name} p95 (${stats.p95.toFixed(2)}ms) is very high`
            );
          }
        }
      }
    }

    // Add suggestions based on findings
    this.generateSuggestions(report);

    return report;
  }

  // Generate performance suggestions
  private generateSuggestions(report: PerformanceReport): void {
    // Check deck load performance
    const deckLoad = report.metrics['deckLoad'];
    if (deckLoad && deckLoad.avg > 200) {
      report.suggestions.push('Consider implementing pagination for deck loading');
    }

    // Check IndexedDB performance
    const dbQueries = Object.entries(report.metrics).filter(([name]) =>
      name.toLowerCase().includes('indexeddb')
    );

    if (dbQueries.some(([_, stats]) => stats.avg > 100)) {
      report.suggestions.push('IndexedDB queries are slow. Consider adding indexes or caching');
    }

    // Check sync performance
    const syncOps = Object.entries(report.metrics).filter(([name]) =>
      name.toLowerCase().includes('sync')
    );

    if (syncOps.some(([_, stats]) => stats.p95 > 5000)) {
      report.suggestions.push('Sync operations are taking too long. Consider batching or queue optimization');
    }

    // Check memory usage (if available)
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      const usedMB = memory.usedJSHeapSize / 1024 / 1024;

      if (usedMB > 100) {
        report.suggestions.push(`High memory usage detected (${usedMB.toFixed(2)}MB). Consider cleanup`);
      }
    }

    // Check resource loading
    const slowResources = this.resourceTimings.filter(r => r.duration > 1000);
    if (slowResources.length > 0) {
      report.suggestions.push(`${slowResources.length} slow resource loads detected`);
    }
  }

  // Get current memory usage
  getMemoryUsage(): {
    usedMB: number;
    totalMB: number;
    percentage: number;
  } | null {
    if (!('memory' in performance)) {
      return null;
    }

    const memory = (performance as any).memory;
    const usedMB = memory.usedJSHeapSize / 1024 / 1024;
    const totalMB = memory.jsHeapSizeLimit / 1024 / 1024;

    return {
      usedMB,
      totalMB,
      percentage: (usedMB / totalMB) * 100
    };
  }

  // Track component lifecycle
  trackComponentMount(componentName: string): () => void {
    this.startTimer(`component-mount-${componentName}`);

    return () => {
      this.endTimer(`component-mount-${componentName}`);
    };
  }

  // Track async operation
  async trackAsync<T>(
    name: string,
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    this.startTimer(name, metadata);

    try {
      const result = await operation();
      this.endTimer(name, { ...metadata, success: true });
      return result;
    } catch (error) {
      this.endTimer(name, { ...metadata, success: false, error: String(error) });
      throw error;
    }
  }

  // Clear all metrics
  clearMetrics(): void {
    this.metrics.clear();
    this.activeTimers.clear();
    this.resourceTimings = [];
  }

  // Export metrics to CSV
  exportToCSV(): string {
    const rows: string[] = [];
    rows.push('Metric,Count,Avg (ms),Min (ms),Max (ms),P50 (ms),P95 (ms),P99 (ms)');

    for (const [name, _] of this.metrics.entries()) {
      const stats = this.getMetricStats(name);
      if (stats) {
        rows.push(
          `"${name}",${stats.count},${stats.avg.toFixed(2)},${stats.min.toFixed(2)},` +
          `${stats.max.toFixed(2)},${stats.p50.toFixed(2)},${stats.p95.toFixed(2)},` +
          `${stats.p99.toFixed(2)}`
        );
      }
    }

    return rows.join('\n');
  }

  // Get performance summary
  getSummary(): {
    totalMetrics: number;
    activeTimers: number;
    avgResponseTime: number;
    memoryUsage: ReturnType<typeof this.getMemoryUsage>;
    slowOperations: Array<{ name: string; duration: number }>;
  } {
    let totalDuration = 0;
    let totalCount = 0;
    const slowOps: Array<{ name: string; duration: number }> = [];

    for (const [name, metrics] of this.metrics.entries()) {
      const stats = this.getMetricStats(name);
      if (stats) {
        totalDuration += stats.avg * stats.count;
        totalCount += stats.count;

        // Find slow operations
        if (stats.max > 1000) {
          slowOps.push({ name, duration: stats.max });
        }
      }
    }

    // Sort slow operations by duration
    slowOps.sort((a, b) => b.duration - a.duration);

    return {
      totalMetrics: this.metrics.size,
      activeTimers: this.activeTimers.size,
      avgResponseTime: totalCount > 0 ? totalDuration / totalCount : 0,
      memoryUsage: this.getMemoryUsage(),
      slowOperations: slowOps.slice(0, 5)
    };
  }

  // Cleanup
  destroy(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect();
    }
    this.clearMetrics();
  }
}

// Export singleton
export const performanceTracker = new PerformanceTracker();