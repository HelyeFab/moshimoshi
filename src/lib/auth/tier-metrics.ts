import { CacheTTL, RedisUtils } from '@/lib/redis/client'

const METRICS_TTL_SECONDS = CacheTTL.LONG_TERM
const METRICS_DISABLED = process.env.TIER_CACHE_METRICS?.toLowerCase() === 'false'

function metricKey(name: string): string {
  return `tier_metrics:${name}`
}

export async function recordTierMetricCount(name: string, increment: number = 1): Promise<void> {
  if (METRICS_DISABLED) return
  try {
    await RedisUtils.incrementByWithTTL(metricKey(name), METRICS_TTL_SECONDS, increment)
  } catch (error) {
    console.warn('[TierMetrics] Failed to record count metric:', name, error)
  }
}

export async function recordTierMetricTiming(name: string, durationMs: number): Promise<void> {
  if (METRICS_DISABLED) return
  const rounded = Math.max(0, Math.round(durationMs))
  try {
    await Promise.all([
      RedisUtils.incrementByWithTTL(metricKey(`${name}:sum`), METRICS_TTL_SECONDS, rounded),
      RedisUtils.incrementWithTTL(metricKey(`${name}:count`), METRICS_TTL_SECONDS),
    ])
  } catch (error) {
    console.warn('[TierMetrics] Failed to record timing metric:', name, error)
  }
}

export function getStaleSampleRate(): number {
  const raw = process.env.TIER_CACHE_STALE_SAMPLE_RATE
  if (!raw) return 0
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.min(parsed, 1)
}
