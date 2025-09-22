/**
 * SLA Dashboard API Endpoint
 * Provides real-time SLA metrics and compliance status
 */

import { NextRequest, NextResponse } from 'next/server'
import { metrics, slaTracker } from '@/lib/monitoring/metrics'
import { createSuccessResponse } from '@/lib/api/error-handler'

// SLA Targets
const SLA_TARGETS = {
  uptime: {
    target: 99.9, // 99.9% uptime
    description: 'Service availability',
    measurement: 'percentage',
  },
  latency_p95: {
    target: 100, // 100ms p95 latency
    description: 'Response time (95th percentile)',
    measurement: 'milliseconds',
  },
  latency_p99: {
    target: 500, // 500ms p99 latency
    description: 'Response time (99th percentile)',
    measurement: 'milliseconds',
  },
  error_rate: {
    target: 0.1, // 0.1% error rate
    description: 'Request error rate',
    measurement: 'percentage',
  },
  sync_success: {
    target: 99.5, // 99.5% sync success
    description: 'Offline sync success rate',
    measurement: 'percentage',
  },
  cache_hit_rate: {
    target: 80, // 80% cache hit rate
    description: 'Cache effectiveness',
    measurement: 'percentage',
  },
}

/**
 * Calculate current SLA metrics
 */
async function calculateCurrentMetrics() {
  // Get metrics from the last hour
  const now = Date.now()
  const oneHourAgo = now - 3600000
  
  // These would normally come from your metrics store
  const currentMetrics = {
    uptime: calculateUptime(oneHourAgo, now),
    latency_p95: getLatencyPercentile(95),
    latency_p99: getLatencyPercentile(99),
    error_rate: calculateErrorRate(oneHourAgo, now),
    sync_success: calculateSyncSuccess(oneHourAgo, now),
    cache_hit_rate: getCacheHitRate(),
  }
  
  return currentMetrics
}

/**
 * Calculate uptime percentage
 */
function calculateUptime(startTime: number, endTime: number): number {
  // Get downtime minutes from metrics
  const totalMinutes = (endTime - startTime) / 60000
  const downtimeMinutes = metrics.getMetric('downtime.minutes') || 0
  
  const uptime = ((totalMinutes - downtimeMinutes) / totalMinutes) * 100
  return Math.max(0, Math.min(100, uptime))
}

/**
 * Get latency percentile
 */
function getLatencyPercentile(percentile: number): number {
  const timings = metrics.getMetric('api.response_time') || []
  if (timings.length === 0) return 0
  
  const sorted = [...timings].sort((a, b) => a - b)
  const index = Math.floor(sorted.length * (percentile / 100))
  return sorted[index] || 0
}

/**
 * Calculate error rate
 */
function calculateErrorRate(_startTime: number, _endTime: number): number {
  const totalRequests = metrics.getMetric('requests.total') || 0
  const errorRequests = metrics.getMetric('requests.errors') || 0
  
  if (totalRequests === 0) return 0
  return (errorRequests / totalRequests) * 100
}

/**
 * Calculate sync success rate
 */
function calculateSyncSuccess(_startTime: number, _endTime: number): number {
  const totalSyncs = metrics.getMetric('sync.total') || 0
  const successfulSyncs = metrics.getMetric('sync.successful') || 0
  
  if (totalSyncs === 0) return 100
  return (successfulSyncs / totalSyncs) * 100
}

/**
 * Get cache hit rate
 */
function getCacheHitRate(): number {
  const cacheHits = metrics.getMetric('cache.hits') || 0
  const cacheMisses = metrics.getMetric('cache.misses') || 0
  const total = cacheHits + cacheMisses
  
  if (total === 0) return 0
  return (cacheHits / total) * 100
}

/**
 * Calculate error budget
 */
function calculateErrorBudget(
  target: number,
  current: number,
  isInverse: boolean = false
): {
  remaining: number
  consumed: number
  status: 'healthy' | 'warning' | 'critical'
} {
  let consumed: number
  
  if (isInverse) {
    // For metrics where lower is better (like error rate)
    consumed = (current / target) * 100
  } else {
    // For metrics where higher is better (like uptime)
    consumed = ((target - current) / (100 - target)) * 100
  }
  
  consumed = Math.max(0, Math.min(100, consumed))
  const remaining = 100 - consumed
  
  let status: 'healthy' | 'warning' | 'critical'
  if (consumed < 50) {
    status = 'healthy'
  } else if (consumed < 80) {
    status = 'warning'
  } else {
    status = 'critical'
  }
  
  return { remaining, consumed, status }
}

interface Compliance {
  current: number;
  target: number;
  compliant: boolean;
  description: string;
  measurement: string;
  errorBudget: {
    remaining: number;
    consumed: number;
    status: 'healthy' | 'warning' | 'critical';
  };
  trend: 'improving' | 'stable' | 'degrading';
}

export async function GET(request: NextRequest) {
  try {
    // Get time range from query params
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || '1h'
    const detailed = searchParams.get('detailed') === 'true'
    
    // Calculate current metrics
    const currentMetrics = await calculateCurrentMetrics()
    
    // Calculate compliance for each SLA
    const compliance: Record<string, Compliance> = {}
    let overallCompliant = true
    
    for (const [metric, config] of Object.entries(SLA_TARGETS)) {
      const current = currentMetrics[metric as keyof typeof currentMetrics]
      const { target, description, measurement } = config
      
      // Check if compliant
      const isInverse = metric === 'error_rate'
      const compliant = isInverse ? current <= target : current >= target
      
      if (!compliant) {
        overallCompliant = false
      }
      
      // Calculate error budget
      const errorBudget = calculateErrorBudget(target, current, isInverse)
      
      // Record in SLA tracker
      slaTracker.record(metric, current)
      
      compliance[metric] = {
        current,
        target,
        compliant,
        description,
        measurement,
        errorBudget,
        trend: calculateTrend(metric),
      }
    }
    
    // Calculate monthly uptime
    const monthlyUptime = calculateMonthlyUptime()
    
    // Get historical data if detailed
    const historical = detailed ? getHistoricalData(period) : undefined
    
    const response = {
      timestamp: new Date().toISOString(),
      period,
      overallCompliant,
      metrics: compliance,
      summary: {
        monthlyUptime,
        incidentsThisMonth: metrics.getMetric('incidents.month') || 0,
        averageResponseTime: getLatencyPercentile(50),
        totalRequests: metrics.getMetric('requests.total') || 0,
      },
      historical,
    }
    
    return createSuccessResponse(response)
  } catch (error) {
    console.error('SLA calculation error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'SLA_CALCULATION_ERROR',
          message: 'Failed to calculate SLA metrics',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * Calculate trend for a metric
 */
function calculateTrend(metric: string): 'improving' | 'stable' | 'degrading' {
  // Get historical values
  const history = slaTracker.getAllCompliance()[metric]
  if (!history) return 'stable'
  
  // Simple trend calculation
  // In production, use more sophisticated trending
  return 'stable'
}

/**
 * Calculate monthly uptime
 */
function calculateMonthlyUptime(): number {
  const now = Date.now()
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000)
  return calculateUptime(thirtyDaysAgo, now)
}

/**
 * Get historical SLA data
 */
interface HistoricalData {
  dataPoints: any[];
  aggregates: {
    min: any;
    max: any;
    avg: any;
  };
}

function getHistoricalData(_period: string): HistoricalData {
  // Return historical data based on period
  // This would query your time-series database
  return {
    dataPoints: [],
    aggregates: {
      min: {},
      max: {},
      avg: {},
    },
  }
}

/**
 * Weekly SLA Report Generator
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    if (action === 'generate-report') {
      // Generate weekly SLA report
      const report = await generateWeeklyReport()
      
      return createSuccessResponse({
        report,
        generated: new Date().toISOString(),
      })
    }
    
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_ACTION',
          message: 'Invalid action specified',
        },
      },
      { status: 400 }
    )
  } catch (error) {
    console.error('SLA report generation error:', error)
    return NextResponse.json(
      {
        error: {
          code: 'REPORT_GENERATION_ERROR',
          message: 'Failed to generate SLA report',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * Generate weekly SLA report
 */
async function generateWeeklyReport() {
  const now = Date.now()
  const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000)
  
  return {
    period: {
      start: new Date(oneWeekAgo).toISOString(),
      end: new Date(now).toISOString(),
    },
    compliance: slaTracker.getAllCompliance(),
    incidents: {
      total: metrics.getMetric('incidents.week') || 0,
      sev1: metrics.getMetric('incidents.sev1.week') || 0,
      sev2: metrics.getMetric('incidents.sev2.week') || 0,
      meanTimeToResolve: metrics.getMetric('incidents.mttr') || 0,
    },
    availability: {
      uptime: calculateUptime(oneWeekAgo, now),
      downtime: metrics.getMetric('downtime.minutes.week') || 0,
      maintenanceWindows: metrics.getMetric('maintenance.windows.week') || 0,
    },
    performance: {
      averageLatency: getLatencyPercentile(50),
      p95Latency: getLatencyPercentile(95),
      p99Latency: getLatencyPercentile(99),
      slowestEndpoints: getSlowTestEndpoints(),
    },
    recommendations: generateRecommendations(),
  }
}

/**
 * Get slowest API endpoints
 */
function getSlowTestEndpoints(): any[] {
  // This would query your metrics store
  return []
}

/**
 * Generate recommendations based on SLA data
 */
function generateRecommendations(): string[] {
  const recommendations: string[] = []
  const compliance = slaTracker.getAllCompliance()
  
  for (const [metric, data] of Object.entries(compliance)) {
    if (!data.compliant) {
      switch (metric) {
        case 'uptime':
          recommendations.push('Consider implementing redundancy and failover mechanisms')
          break
        case 'latency_p95':
          recommendations.push('Optimize database queries and implement caching')
          break
        case 'error_rate':
          recommendations.push('Review error logs and implement better error handling')
          break
        case 'sync_success':
          recommendations.push('Improve offline sync conflict resolution')
          break
        case 'cache_hit_rate':
          recommendations.push('Review cache eviction policies and TTL settings')
          break
      }
    }
  }
  
  return recommendations
}