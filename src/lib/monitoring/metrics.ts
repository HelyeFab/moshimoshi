/**
 * Production Monitoring & Metrics Collection
 * SRE Implementation for Week 3 Production Deployment
 */

import { EventEmitter } from 'events'

// Metric types
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  SUMMARY = 'summary',
}

// Metric severity levels
export enum Severity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

// Metric categories
export enum MetricCategory {
  PERFORMANCE = 'performance',
  BUSINESS = 'business',
  INFRASTRUCTURE = 'infrastructure',
  SECURITY = 'security',
  USER_EXPERIENCE = 'user_experience',
}

/**
 * Core metrics collector
 */
export class MetricsCollector extends EventEmitter {
  private static instance: MetricsCollector
  private metrics: Map<string, any> = new Map()
  private intervals: Map<string, NodeJS.Timer> = new Map()
  
  private constructor() {
    super()
    this.initializeCollectors()
  }
  
  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector()
    }
    return MetricsCollector.instance
  }
  
  /**
   * Initialize metric collectors
   */
  private initializeCollectors() {
    // Collect system metrics every 10 seconds
    this.intervals.set('system', setInterval(() => {
      this.collectSystemMetrics()
    }, 10000))
    
    // Collect business metrics every minute
    this.intervals.set('business', setInterval(() => {
      this.collectBusinessMetrics()
    }, 60000))
  }
  
  /**
   * Record a counter metric
   */
  increment(
    name: string,
    value: number = 1,
    tags?: Record<string, string>
  ): void {
    const key = this.getMetricKey(name, tags)
    const current = this.metrics.get(key) || 0
    this.metrics.set(key, current + value)
    
    // Emit for real-time monitoring
    this.emit('metric', {
      type: MetricType.COUNTER,
      name,
      value: current + value,
      tags,
      timestamp: Date.now(),
    })
  }
  
  /**
   * Record a gauge metric
   */
  gauge(
    name: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    const key = this.getMetricKey(name, tags)
    this.metrics.set(key, value)
    
    this.emit('metric', {
      type: MetricType.GAUGE,
      name,
      value,
      tags,
      timestamp: Date.now(),
    })
  }
  
  /**
   * Record a timing metric
   */
  timing(
    name: string,
    duration: number,
    tags?: Record<string, string>
  ): void {
    const key = this.getMetricKey(name, tags)
    const timings = this.metrics.get(key) || []
    timings.push(duration)
    
    // Keep last 1000 timings for percentile calculations
    if (timings.length > 1000) {
      timings.shift()
    }
    
    this.metrics.set(key, timings)
    
    // Calculate percentiles
    const sorted = [...timings].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length * 0.5)]
    const p95 = sorted[Math.floor(sorted.length * 0.95)]
    const p99 = sorted[Math.floor(sorted.length * 0.99)]
    
    this.emit('metric', {
      type: MetricType.HISTOGRAM,
      name,
      value: duration,
      percentiles: { p50, p95, p99 },
      tags,
      timestamp: Date.now(),
    })
  }
  
  /**
   * Start a timer for measuring duration
   */
  startTimer(name: string, tags?: Record<string, string>) {
    const start = process.hrtime.bigint()
    
    return {
      end: () => {
        const end = process.hrtime.bigint()
        const duration = Number(end - start) / 1000000 // Convert to ms
        this.timing(name, duration, tags)
        return duration
      },
    }
  }
  
  /**
   * Record an error
   */
  recordError(
    error: Error,
    context?: {
      endpoint?: string
      userId?: string
      sessionId?: string
      [key: string]: any
    }
  ): void {
    this.increment('errors.total', 1, {
      error_type: error.name,
      endpoint: context?.endpoint || 'unknown',
    })
    
    // Emit error event for alerting
    this.emit('error', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      timestamp: Date.now(),
    })
    
    // Check if this is a critical error
    if (this.isCriticalError(error)) {
      this.emit('critical', {
        error,
        context,
        timestamp: Date.now(),
      })
    }
  }
  
  /**
   * Collect system metrics
   */
  private collectSystemMetrics() {
    if (typeof process !== 'undefined') {
      const memUsage = process.memoryUsage()
      
      // Memory metrics
      this.gauge('system.memory.heap_used', memUsage.heapUsed)
      this.gauge('system.memory.heap_total', memUsage.heapTotal)
      this.gauge('system.memory.rss', memUsage.rss)
      this.gauge('system.memory.external', memUsage.external)
      
      // Calculate memory percentage
      const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100
      this.gauge('system.memory.usage_percent', memoryPercent)
      
      // CPU metrics
      const cpuUsage = process.cpuUsage()
      this.gauge('system.cpu.user', cpuUsage.user)
      this.gauge('system.cpu.system', cpuUsage.system)
      
      // Event loop lag (indicator of performance issues)
      const start = Date.now()
      setImmediate(() => {
        const lag = Date.now() - start
        this.gauge('system.event_loop.lag', lag)
      })
    }
  }
  
  /**
   * Collect business metrics
   */
  private async collectBusinessMetrics() {
    // These would be collected from your database/cache
    // Placeholder implementation
    
    // Active sessions
    this.gauge('business.sessions.active', Math.random() * 100)
    
    // Reviews per minute
    this.gauge('business.reviews.per_minute', Math.random() * 50)
    
    // Queue generation success rate
    this.gauge('business.queue.success_rate', 95 + Math.random() * 5)
    
    // Session completion rate
    this.gauge('business.sessions.completion_rate', 70 + Math.random() * 30)
  }
  
  /**
   * Check if error is critical
   */
  private isCriticalError(error: Error): boolean {
    const criticalPatterns = [
      /database.*connection/i,
      /out of memory/i,
      /ENOSPC/,
      /rate limit.*exceeded/i,
      /stripe.*error/i,
      /authentication.*failed/i,
    ]
    
    return criticalPatterns.some(pattern => 
      pattern.test(error.message) || pattern.test(error.name)
    )
  }
  
  /**
   * Generate metric key
   */
  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags) return name
    
    const tagStr = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',')
    
    return `${name}{${tagStr}}`
  }
  
  /**
   * Get current metric value
   */
  getMetric(name: string, tags?: Record<string, string>): any {
    const key = this.getMetricKey(name, tags)
    return this.metrics.get(key)
  }
  
  /**
   * Get all metrics
   */
  getAllMetrics(): Record<string, any> {
    const result: Record<string, any> = {}
    this.metrics.forEach((value, key) => {
      result[key] = value
    })
    return result
  }
  
  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics.clear()
  }
  
  /**
   * Cleanup
   */
  destroy(): void {
    this.intervals.forEach(interval => clearInterval(interval as any))
    this.intervals.clear()
    this.removeAllListeners()
  }
}

/**
 * Performance monitoring decorator
 */
export function monitored(
  metricName?: string,
  tags?: Record<string, string>
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value
    const name = metricName || `${target.constructor.name}.${propertyKey}`
    
    descriptor.value = async function (...args: any[]) {
      const metrics = MetricsCollector.getInstance()
      const timer = metrics.startTimer(name, tags)
      
      try {
        const result = await originalMethod.apply(this, args)
        metrics.increment(`${name}.success`, 1, tags)
        return result
      } catch (error) {
        metrics.increment(`${name}.error`, 1, tags)
        metrics.recordError(error as Error, {
          method: propertyKey,
          ...tags,
        })
        throw error
      } finally {
        timer.end()
      }
    }
    
    return descriptor
  }
}

/**
 * Health check service
 */
export class HealthCheckService {
  private checks: Map<string, () => Promise<boolean>> = new Map()
  
  /**
   * Register a health check
   */
  register(name: string, check: () => Promise<boolean>): void {
    this.checks.set(name, check)
  }
  
  /**
   * Run all health checks
   */
  async checkHealth(): Promise<{
    healthy: boolean
    checks: Record<string, boolean>
    timestamp: number
  }> {
    const results: Record<string, boolean> = {}
    let healthy = true
    
    for (const [name, check] of this.checks) {
      try {
        results[name] = await check()
        if (!results[name]) healthy = false
      } catch (error) {
        results[name] = false
        healthy = false
      }
    }
    
    return {
      healthy,
      checks: results,
      timestamp: Date.now(),
    }
  }
}

/**
 * SLA tracking
 */
export class SLATracker {
  private windows: Map<string, number[]> = new Map()
  private targets: Map<string, number> = new Map()
  
  constructor() {
    // Define SLA targets
    this.targets.set('uptime', 99.9)
    this.targets.set('latency_p95', 100)
    this.targets.set('error_rate', 0.1)
  }
  
  /**
   * Record SLA metric
   */
  record(metric: string, value: number): void {
    const window = this.windows.get(metric) || []
    window.push(value)
    
    // Keep last 1440 minutes (24 hours)
    if (window.length > 1440) {
      window.shift()
    }
    
    this.windows.set(metric, window)
  }
  
  /**
   * Calculate SLA compliance
   */
  getCompliance(metric: string): {
    current: number
    target: number
    compliant: boolean
    percentage: number
  } {
    const window = this.windows.get(metric) || []
    const target = this.targets.get(metric) || 100
    
    if (window.length === 0) {
      return {
        current: 0,
        target,
        compliant: false,
        percentage: 0,
      }
    }
    
    const average = window.reduce((a, b) => a + b, 0) / window.length
    const compliant = metric === 'error_rate' ? 
      average <= target : average >= target
    
    const percentage = metric === 'error_rate' ?
      (1 - average / target) * 100 :
      (average / target) * 100
    
    return {
      current: average,
      target,
      compliant,
      percentage: Math.min(100, percentage),
    }
  }
  
  /**
   * Get all SLA metrics
   */
  getAllCompliance(): Record<string, any> {
    const result: Record<string, any> = {}
    
    for (const metric of this.targets.keys()) {
      result[metric] = this.getCompliance(metric)
    }
    
    return result
  }
}

// Export singleton instances
export const metrics = MetricsCollector.getInstance()
export const healthCheck = new HealthCheckService()
export const slaTracker = new SLATracker()