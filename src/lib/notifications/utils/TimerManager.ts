/**
 * TimerManager
 * Manages timers to prevent memory leaks and ensure proper cleanup
 */

import { reviewLogger } from '@/lib/monitoring/logger'

/**
 * Timer entry
 */
interface TimerEntry {
  id: string
  timerId: NodeJS.Timeout
  callback: () => void
  scheduledTime: Date
  duration: number
  type: 'timeout' | 'interval'
  metadata?: Record<string, any>
}

/**
 * Timer statistics
 */
interface TimerStats {
  activeTimers: number
  totalCreated: number
  totalCleared: number
  totalFired: number
  memoryUsage: number
}

/**
 * TimerManager class
 * Centralized timer management with automatic cleanup
 */
export class TimerManager {
  private timers: Map<string, TimerEntry> = new Map()
  private stats: TimerStats = {
    activeTimers: 0,
    totalCreated: 0,
    totalCleared: 0,
    totalFired: 0,
    memoryUsage: 0
  }
  private maxTimers = 1000 // Prevent unbounded growth
  private warningThreshold = 500 // Warn when approaching limit
  private cleanupInterval?: NodeJS.Timeout
  private isDestroyed = false

  constructor(private readonly name: string = 'default') {
    // Start periodic cleanup
    this.startPeriodicCleanup()
  }

  /**
   * Schedule a timeout
   */
  setTimeout(
    callback: () => void,
    delay: number,
    id?: string,
    metadata?: Record<string, any>
  ): string {
    if (this.isDestroyed) {
      throw new Error(`TimerManager ${this.name} has been destroyed`)
    }

    // Check timer limit
    if (this.timers.size >= this.maxTimers) {
      reviewLogger.error(`TimerManager ${this.name} reached max timer limit`, {
        maxTimers: this.maxTimers,
        activeTimers: this.timers.size
      })
      throw new Error('Maximum timer limit reached')
    }

    // Generate unique ID if not provided
    const timerId = id || this.generateId()

    // Cancel existing timer with same ID
    if (this.timers.has(timerId)) {
      this.clearTimer(timerId)
    }

    // Wrap callback to track execution
    const wrappedCallback = () => {
      this.timers.delete(timerId)
      this.stats.activeTimers--
      this.stats.totalFired++

      try {
        callback()
      } catch (error) {
        reviewLogger.error(`Timer callback error in ${this.name}`, {
          timerId,
          error
        })
      }
    }

    // Create timeout
    const timeout = setTimeout(wrappedCallback, delay)

    // Store timer entry
    const entry: TimerEntry = {
      id: timerId,
      timerId: timeout,
      callback: wrappedCallback,
      scheduledTime: new Date(Date.now() + delay),
      duration: delay,
      type: 'timeout',
      metadata
    }

    this.timers.set(timerId, entry)
    this.stats.activeTimers++
    this.stats.totalCreated++

    // Warn if approaching limit
    if (this.timers.size > this.warningThreshold) {
      reviewLogger.warn(`TimerManager ${this.name} has ${this.timers.size} active timers`, {
        threshold: this.warningThreshold
      })
    }

    // Update memory usage estimate
    this.updateMemoryUsage()

    return timerId
  }

  /**
   * Schedule an interval
   */
  setInterval(
    callback: () => void,
    delay: number,
    id?: string,
    metadata?: Record<string, any>
  ): string {
    if (this.isDestroyed) {
      throw new Error(`TimerManager ${this.name} has been destroyed`)
    }

    // Check timer limit
    if (this.timers.size >= this.maxTimers) {
      reviewLogger.error(`TimerManager ${this.name} reached max timer limit`, {
        maxTimers: this.maxTimers,
        activeTimers: this.timers.size
      })
      throw new Error('Maximum timer limit reached')
    }

    // Generate unique ID if not provided
    const timerId = id || this.generateId()

    // Cancel existing timer with same ID
    if (this.timers.has(timerId)) {
      this.clearTimer(timerId)
    }

    // Wrap callback to track execution
    let executionCount = 0
    const wrappedCallback = () => {
      executionCount++
      this.stats.totalFired++

      try {
        callback()
      } catch (error) {
        reviewLogger.error(`Interval callback error in ${this.name}`, {
          timerId,
          executionCount,
          error
        })
      }
    }

    // Create interval
    const interval = setInterval(wrappedCallback, delay)

    // Store timer entry
    const entry: TimerEntry = {
      id: timerId,
      timerId: interval,
      callback: wrappedCallback,
      scheduledTime: new Date(Date.now() + delay),
      duration: delay,
      type: 'interval',
      metadata: { ...metadata, executionCount }
    }

    this.timers.set(timerId, entry)
    this.stats.activeTimers++
    this.stats.totalCreated++

    // Update memory usage estimate
    this.updateMemoryUsage()

    return timerId
  }

  /**
   * Clear a specific timer
   */
  clearTimer(id: string): boolean {
    const entry = this.timers.get(id)

    if (!entry) {
      return false
    }

    // Clear the actual timer
    if (entry.type === 'timeout') {
      clearTimeout(entry.timerId)
    } else {
      clearInterval(entry.timerId)
    }

    // Remove from map
    this.timers.delete(id)
    this.stats.activeTimers--
    this.stats.totalCleared++

    // Update memory usage estimate
    this.updateMemoryUsage()

    reviewLogger.debug(`Timer ${id} cleared in ${this.name}`, {
      type: entry.type,
      metadata: entry.metadata
    })

    return true
  }

  /**
   * Clear all timers
   */
  clearAll(): void {
    const count = this.timers.size

    this.timers.forEach((entry) => {
      if (entry.type === 'timeout') {
        clearTimeout(entry.timerId)
      } else {
        clearInterval(entry.timerId)
      }
    })

    this.timers.clear()
    this.stats.activeTimers = 0
    this.stats.totalCleared += count

    reviewLogger.info(`Cleared ${count} timers in ${this.name}`)
  }

  /**
   * Clear timers by metadata filter
   */
  clearByMetadata(filter: (metadata: Record<string, any> | undefined) => boolean): number {
    const toRemove: string[] = []

    this.timers.forEach((entry, id) => {
      if (filter(entry.metadata)) {
        toRemove.push(id)
      }
    })

    toRemove.forEach(id => this.clearTimer(id))

    return toRemove.length
  }

  /**
   * Get active timer count
   */
  getActiveCount(): number {
    return this.timers.size
  }

  /**
   * Get timer by ID
   */
  getTimer(id: string): TimerEntry | undefined {
    return this.timers.get(id)
  }

  /**
   * Check if timer exists
   */
  hasTimer(id: string): boolean {
    return this.timers.has(id)
  }

  /**
   * Get all timer IDs
   */
  getTimerIds(): string[] {
    return Array.from(this.timers.keys())
  }

  /**
   * Get statistics
   */
  getStats(): TimerStats {
    return { ...this.stats }
  }

  /**
   * Start periodic cleanup of expired timers
   */
  private startPeriodicCleanup(): void {
    // Run cleanup every 30 seconds
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired()
    }, 30000)
  }

  /**
   * Clean up expired timers (safety mechanism)
   */
  private cleanupExpired(): void {
    const now = Date.now()
    const expired: string[] = []

    this.timers.forEach((entry, id) => {
      // Only clean up timeouts that should have fired
      if (entry.type === 'timeout') {
        const scheduledTime = entry.scheduledTime.getTime()
        const elapsed = now - scheduledTime

        // If more than 1 second past scheduled time, it likely failed
        if (elapsed > 1000) {
          expired.push(id)
        }
      }
    })

    if (expired.length > 0) {
      reviewLogger.warn(`Cleaning up ${expired.length} expired timers in ${this.name}`)
      expired.forEach(id => this.clearTimer(id))
    }
  }

  /**
   * Update memory usage estimate
   */
  private updateMemoryUsage(): void {
    // Rough estimate: 100 bytes per timer entry
    this.stats.memoryUsage = this.timers.size * 100
  }

  /**
   * Generate unique timer ID
   */
  private generateId(): string {
    return `${this.name}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Reschedule an existing timer
   */
  reschedule(id: string, newDelay: number): boolean {
    const entry = this.timers.get(id)

    if (!entry || entry.type !== 'timeout') {
      return false
    }

    // Get original callback and metadata
    const { callback, metadata } = entry

    // Clear old timer
    this.clearTimer(id)

    // Schedule new timer with same ID
    this.setTimeout(callback, newDelay, id, metadata)

    return true
  }

  /**
   * Pause all timers (for testing/debugging)
   */
  pauseAll(): Map<string, TimerEntry> {
    const paused = new Map(this.timers)
    this.clearAll()
    return paused
  }

  /**
   * Resume paused timers
   */
  resumeAll(paused: Map<string, TimerEntry>): void {
    const now = Date.now()

    paused.forEach((entry) => {
      const remaining = entry.scheduledTime.getTime() - now

      if (remaining > 0) {
        if (entry.type === 'timeout') {
          this.setTimeout(entry.callback, remaining, entry.id, entry.metadata)
        } else {
          this.setInterval(entry.callback, entry.duration, entry.id, entry.metadata)
        }
      }
    })
  }

  /**
   * Destroy the timer manager
   */
  destroy(): void {
    if (this.isDestroyed) {
      return
    }

    reviewLogger.info(`Destroying TimerManager ${this.name}`, {
      activeTimers: this.timers.size,
      stats: this.stats
    })

    // Clear all timers
    this.clearAll()

    // Stop cleanup interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }

    // Mark as destroyed
    this.isDestroyed = true
  }

  /**
   * Check if destroyed
   */
  isDestroyed(): boolean {
    return this.isDestroyed
  }
}

/**
 * Global timer manager instances
 */
const timerManagers = new Map<string, TimerManager>()

/**
 * Get or create a timer manager instance
 */
export function getTimerManager(name: string = 'default'): TimerManager {
  if (!timerManagers.has(name)) {
    timerManagers.set(name, new TimerManager(name))
  }
  return timerManagers.get(name)!
}

/**
 * Destroy a timer manager instance
 */
export function destroyTimerManager(name: string = 'default'): void {
  const manager = timerManagers.get(name)
  if (manager) {
    manager.destroy()
    timerManagers.delete(name)
  }
}

/**
 * Destroy all timer managers
 */
export function destroyAllTimerManagers(): void {
  timerManagers.forEach(manager => manager.destroy())
  timerManagers.clear()
}

/**
 * Get all timer manager names
 */
export function getTimerManagerNames(): string[] {
  return Array.from(timerManagers.keys())
}

// Export default instance
export default getTimerManager()