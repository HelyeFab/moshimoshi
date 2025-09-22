/**
 * Cache monitoring service
 * Tracks cache performance metrics and health
 */

import { ReviewRedisClient } from '../review-redis-client'

/**
 * Cache metrics structure
 */
export interface CacheMetrics {
  hits: number
  misses: number
  hitRate: number
  avgLatency: number
  memoryUsage: number
  keyCount: number
  errorCount: number
  lastError?: string
}

/**
 * Latency metrics
 */
export interface LatencyMetrics {
  min: number
  max: number
  avg: number
  p50: number
  p95: number
  p99: number
}

/**
 * Memory metrics
 */
export interface MemoryMetrics {
  used: number
  peak: number
  overhead: number
  dataset: number
}

/**
 * Health status
 */
export interface HealthStatus {
  healthy: boolean
  checks: {
    connectivity: boolean
    latency: boolean
    memory: boolean
    errorRate: boolean
  }
  warnings: string[]
  errors: string[]
}

/**
 * Monitoring window
 */
const MONITORING_WINDOW = 5 * 60 * 1000 // 5 minutes

/**
 * Cache monitor implementation
 */
export class CacheMonitor {
  private redis: ReviewRedisClient
  private metrics: Map<string, number[]> = new Map()
  private errors: string[] = []
  private startTime: number = Date.now()
  
  constructor() {
    this.redis = ReviewRedisClient.getInstance()
    this.initializeMetrics()
  }
  
  /**
   * Initialize metrics tracking
   */
  private initializeMetrics(): void {
    this.metrics.set('hits', [])
    this.metrics.set('misses', [])
    this.metrics.set('latencies', [])
    this.metrics.set('errors', [])
  }
  
  /**
   * Record a cache hit
   */
  recordHit(latency: number): void {
    const hits = this.metrics.get('hits') || []
    hits.push(Date.now())
    this.pruneOldMetrics('hits', hits)
    
    const latencies = this.metrics.get('latencies') || []
    latencies.push(latency)
    this.pruneOldMetrics('latencies', latencies)
  }
  
  /**
   * Record a cache miss
   */
  recordMiss(): void {
    const misses = this.metrics.get('misses') || []
    misses.push(Date.now())
    this.pruneOldMetrics('misses', misses)
  }
  
  /**
   * Record an error
   */
  recordError(error: string): void {
    const errors = this.metrics.get('errors') || []
    errors.push(Date.now())
    this.pruneOldMetrics('errors', errors)
    
    this.errors.push(`${new Date().toISOString()}: ${error}`)
    if (this.errors.length > 100) {
      this.errors = this.errors.slice(-100)
    }
  }
  
  /**
   * Prune metrics older than monitoring window
   */
  private pruneOldMetrics(key: string, values: number[]): void {
    const cutoff = Date.now() - MONITORING_WINDOW
    const pruned = key === 'latencies' ? 
      values : // Latencies are already numbers, not timestamps
      values.filter(timestamp => timestamp > cutoff)
    this.metrics.set(key, pruned)
  }
  
  /**
   * Get current metrics
   */
  async getMetrics(): Promise<CacheMetrics> {
    const hits = (this.metrics.get('hits') || []).length
    const misses = (this.metrics.get('misses') || []).length
    const total = hits + misses
    const hitRate = total > 0 ? hits / total : 0
    
    const latencies = this.metrics.get('latencies') || []
    const avgLatency = latencies.length > 0 ?
      latencies.reduce((a, b) => a + b, 0) / latencies.length : 0
    
    const errors = (this.metrics.get('errors') || []).length
    
    // Get Redis info (if available)
    let keyCount = 0
    let memoryUsage = 0
    
    try {
      // Note: Upstash doesn't support INFO command
      // These would need to be tracked differently
      keyCount = await this.estimateKeyCount()
      memoryUsage = await this.estimateMemoryUsage()
    } catch (error) {
      console.error('Error getting Redis info:', error)
    }
    
    return {
      hits,
      misses,
      hitRate,
      avgLatency: Math.round(avgLatency),
      memoryUsage,
      keyCount,
      errorCount: errors,
      lastError: this.errors[this.errors.length - 1]
    }
  }
  
  /**
   * Get hit rate for a specific window
   */
  async getHitRate(windowMinutes: number = 5): Promise<number> {
    const cutoff = Date.now() - (windowMinutes * 60 * 1000)
    const hits = (this.metrics.get('hits') || []).filter(t => t > cutoff).length
    const misses = (this.metrics.get('misses') || []).filter(t => t > cutoff).length
    const total = hits + misses
    
    return total > 0 ? hits / total : 0
  }
  
  /**
   * Get latency metrics
   */
  async getLatency(): Promise<LatencyMetrics> {
    const latencies = this.metrics.get('latencies') || []
    
    if (latencies.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0
      }
    }
    
    const sorted = [...latencies].sort((a, b) => a - b)
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99)
    }
  }
  
  /**
   * Get memory usage metrics
   */
  async getMemoryUsage(): Promise<MemoryMetrics> {
    // Note: Upstash doesn't provide detailed memory metrics
    // This is a simplified version
    const estimated = await this.estimateMemoryUsage()
    
    return {
      used: estimated,
      peak: estimated, // Would need tracking
      overhead: estimated * 0.1, // Estimate 10% overhead
      dataset: estimated * 0.9
    }
  }
  
  /**
   * Check cache health
   */
  async checkHealth(): Promise<HealthStatus> {
    const warnings: string[] = []
    const errors: string[] = []
    const checks = {
      connectivity: false,
      latency: false,
      memory: false,
      errorRate: false
    }
    
    // Check connectivity
    try {
      const start = Date.now()
      await this.redis.healthCheck()
      const latency = Date.now() - start
      checks.connectivity = true
      
      // Check latency
      if (latency < 100) {
        checks.latency = true
      } else if (latency < 500) {
        warnings.push(`High latency: ${latency}ms`)
      } else {
        errors.push(`Very high latency: ${latency}ms`)
      }
    } catch (error) {
      errors.push('Redis connection failed')
    }
    
    // Check error rate
    const errorCount = (this.metrics.get('errors') || []).length
    const total = (this.metrics.get('hits') || []).length + 
                  (this.metrics.get('misses') || []).length
    const errorRate = total > 0 ? errorCount / total : 0
    
    if (errorRate < 0.01) {
      checks.errorRate = true
    } else if (errorRate < 0.05) {
      warnings.push(`Elevated error rate: ${(errorRate * 100).toFixed(2)}%`)
    } else {
      errors.push(`High error rate: ${(errorRate * 100).toFixed(2)}%`)
    }
    
    // Check memory (simplified)
    checks.memory = true // Would need actual memory monitoring
    
    const healthy = checks.connectivity && checks.latency && 
                   checks.memory && checks.errorRate
    
    return {
      healthy,
      checks,
      warnings,
      errors
    }
  }
  
  /**
   * Report slow operation
   */
  async reportSlowOperation(operation: string, duration: number): Promise<void> {
    const threshold = 1000 // 1 second
    
    if (duration > threshold) {
      const message = `Slow operation: ${operation} took ${duration}ms`
      console.warn(message)
      this.errors.push(`${new Date().toISOString()}: ${message}`)
    }
  }
  
  /**
   * Get monitoring dashboard data
   */
  async getDashboardData(): Promise<{
    metrics: CacheMetrics
    latency: LatencyMetrics
    memory: MemoryMetrics
    health: HealthStatus
    uptime: number
    recentErrors: string[]
  }> {
    const [metrics, latency, memory, health] = await Promise.all([
      this.getMetrics(),
      this.getLatency(),
      this.getMemoryUsage(),
      this.checkHealth()
    ])
    
    return {
      metrics,
      latency,
      memory,
      health,
      uptime: Date.now() - this.startTime,
      recentErrors: this.errors.slice(-10)
    }
  }
  
  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, index)]
  }
  
  /**
   * Estimate key count (simplified)
   */
  private async estimateKeyCount(): Promise<number> {
    // In production, you might track this differently
    // or use a sampling approach
    return 0
  }
  
  /**
   * Estimate memory usage (simplified)
   */
  private async estimateMemoryUsage(): Promise<number> {
    // Rough estimation based on key count and average size
    // In production, you'd track actual sizes
    const keyCount = await this.estimateKeyCount()
    const avgKeySize = 1024 // 1KB average
    return keyCount * avgKeySize
  }
  
  /**
   * Export metrics for external monitoring
   */
  async exportMetrics(): Promise<string> {
    const data = await this.getDashboardData()
    return JSON.stringify(data, null, 2)
  }
  
  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.initializeMetrics()
    this.errors = []
    this.startTime = Date.now()
    console.log('Cache monitor metrics reset')
  }
}