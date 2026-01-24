/**
 * Firebase Quota Tracker
 * Redis-based atomic counters for tracking Firestore operations
 * Provides real-time quota monitoring instead of estimates
 */

import { redis } from '@/lib/redis/client'

/**
 * Quota operation types
 */
export type QuotaOperation = 'read' | 'write' | 'delete'

/**
 * Daily quota data
 */
export interface DailyQuota {
  date: string
  reads: number
  writes: number
  deletes: number
  source: 'redis' | 'estimate'
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Get Redis key for quota counter
 */
function getQuotaKey(date: string, operation: QuotaOperation): string {
  return `quota:${date}:${operation}s`
}

/**
 * Increment read counter
 * @param count Number of reads to add (default: 1)
 */
export async function incrementReads(count: number = 1): Promise<void> {
  try {
    const key = getQuotaKey(getTodayKey(), 'read')
    await redis.incrby(key, count)
    // Set 48-hour TTL for automatic cleanup
    await redis.expire(key, 172800)
  } catch (error) {
    console.warn('[QuotaTracker] Failed to increment reads:', error)
  }
}

/**
 * Increment write counter
 * @param count Number of writes to add (default: 1)
 */
export async function incrementWrites(count: number = 1): Promise<void> {
  try {
    const key = getQuotaKey(getTodayKey(), 'write')
    await redis.incrby(key, count)
    await redis.expire(key, 172800)
  } catch (error) {
    console.warn('[QuotaTracker] Failed to increment writes:', error)
  }
}

/**
 * Increment delete counter
 * @param count Number of deletes to add (default: 1)
 */
export async function incrementDeletes(count: number = 1): Promise<void> {
  try {
    const key = getQuotaKey(getTodayKey(), 'delete')
    await redis.incrby(key, count)
    await redis.expire(key, 172800)
  } catch (error) {
    console.warn('[QuotaTracker] Failed to increment deletes:', error)
  }
}

/**
 * Increment quota counter based on operation type
 * @param operation Operation type ('read', 'write', 'delete')
 * @param count Number of operations (default: 1)
 */
export async function incrementQuota(operation: QuotaOperation, count: number = 1): Promise<void> {
  switch (operation) {
    case 'read':
      return incrementReads(count)
    case 'write':
      return incrementWrites(count)
    case 'delete':
      return incrementDeletes(count)
  }
}

/**
 * Get daily quota from Redis
 * @param date Date in YYYY-MM-DD format (default: today)
 * @returns Daily quota data with source indicator
 */
export async function getDailyQuota(date?: string): Promise<DailyQuota> {
  const targetDate = date || getTodayKey()

  try {
    const [reads, writes, deletes] = await Promise.all([
      redis.get(getQuotaKey(targetDate, 'read')),
      redis.get(getQuotaKey(targetDate, 'write')),
      redis.get(getQuotaKey(targetDate, 'delete')),
    ])

    // Check if we have any Redis data
    const hasData = reads !== null || writes !== null || deletes !== null

    return {
      date: targetDate,
      reads: Number(reads) || 0,
      writes: Number(writes) || 0,
      deletes: Number(deletes) || 0,
      source: hasData ? 'redis' : 'estimate',
    }
  } catch (error) {
    console.warn('[QuotaTracker] Failed to get daily quota:', error)
    return {
      date: targetDate,
      reads: 0,
      writes: 0,
      deletes: 0,
      source: 'estimate',
    }
  }
}

/**
 * Get quota for multiple days
 * @param days Number of days to retrieve (default: 7)
 * @returns Array of daily quota data
 */
export async function getQuotaHistory(days: number = 7): Promise<DailyQuota[]> {
  const results: DailyQuota[] = []
  const today = new Date()

  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().slice(0, 10)
    results.push(await getDailyQuota(dateStr))
  }

  return results
}

/**
 * Reset quota counters for a specific date
 * WARNING: Use with caution - typically only for testing
 */
export async function resetDailyQuota(date?: string): Promise<void> {
  const targetDate = date || getTodayKey()

  try {
    await Promise.all([
      redis.del(getQuotaKey(targetDate, 'read')),
      redis.del(getQuotaKey(targetDate, 'write')),
      redis.del(getQuotaKey(targetDate, 'delete')),
    ])
    console.log(`[QuotaTracker] Reset quota for ${targetDate}`)
  } catch (error) {
    console.error('[QuotaTracker] Failed to reset quota:', error)
  }
}

/**
 * Batch increment for multiple operations
 * More efficient than individual increments
 */
export async function batchIncrementQuota(operations: {
  reads?: number
  writes?: number
  deletes?: number
}): Promise<void> {
  const today = getTodayKey()
  const pipeline: Promise<void>[] = []

  if (operations.reads && operations.reads > 0) {
    pipeline.push(incrementReads(operations.reads))
  }
  if (operations.writes && operations.writes > 0) {
    pipeline.push(incrementWrites(operations.writes))
  }
  if (operations.deletes && operations.deletes > 0) {
    pipeline.push(incrementDeletes(operations.deletes))
  }

  await Promise.all(pipeline)
}

// Export a convenience tracker object
export const quotaTracker = {
  incrementReads,
  incrementWrites,
  incrementDeletes,
  incrementQuota,
  getDailyQuota,
  getQuotaHistory,
  resetDailyQuota,
  batchIncrementQuota,
}

export default quotaTracker
