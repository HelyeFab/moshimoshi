/**
 * QuietHours
 * Manages quiet hours for notifications
 */

import { reviewLogger } from '@/lib/monitoring/logger'

/**
 * Quiet hours configuration
 */
export interface QuietHoursConfig {
  enabled: boolean
  start: string      // HH:MM format (e.g., "22:00")
  end: string        // HH:MM format (e.g., "08:00")
  timezone: string   // IANA timezone (e.g., "America/New_York")
  days?: number[]    // Optional: specific days of week (0=Sunday, 6=Saturday)
  exceptions?: Date[] // Optional: dates to skip quiet hours
}

/**
 * Time period
 */
export interface TimePeriod {
  start: Date
  end: Date
  crossesMidnight: boolean
}

/**
 * QuietHours class
 */
export class QuietHours {
  private config: QuietHoursConfig

  constructor(config: Partial<QuietHoursConfig> = {}) {
    this.config = {
      enabled: config.enabled || false,
      start: config.start || '22:00',
      end: config.end || '08:00',
      timezone: config.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      days: config.days,
      exceptions: config.exceptions
    }

    // Validate configuration
    this.validateConfig()
  }

  /**
   * Validate quiet hours configuration
   */
  private validateConfig(): void {
    // Validate time format
    if (!this.isValidTimeFormat(this.config.start)) {
      throw new Error(`Invalid start time format: ${this.config.start}`)
    }

    if (!this.isValidTimeFormat(this.config.end)) {
      throw new Error(`Invalid end time format: ${this.config.end}`)
    }

    // Validate days if provided
    if (this.config.days) {
      for (const day of this.config.days) {
        if (day < 0 || day > 6) {
          throw new Error(`Invalid day value: ${day}. Must be 0-6 (Sunday-Saturday)`)
        }
      }
    }

    // Validate timezone
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: this.config.timezone })
    } catch (error) {
      throw new Error(`Invalid timezone: ${this.config.timezone}`)
    }
  }

  /**
   * Check if time string is valid HH:MM format
   */
  private isValidTimeFormat(time: string): boolean {
    const regex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    return regex.test(time)
  }

  /**
   * Check if currently in quiet hours
   */
  isInQuietHours(date: Date = new Date()): boolean {
    if (!this.config.enabled) {
      return false
    }

    // Check if date is an exception
    if (this.isException(date)) {
      return false
    }

    // Check if day is configured for quiet hours
    if (!this.isDayEnabled(date)) {
      return false
    }

    // Get current time in configured timezone
    const localTime = this.getLocalTime(date)

    // Get quiet hours period for the date
    const period = this.getQuietPeriod(date)

    // Check if current time is within quiet hours
    return this.isTimeInPeriod(localTime, period)
  }

  /**
   * Check if date is an exception
   */
  private isException(date: Date): boolean {
    if (!this.config.exceptions || this.config.exceptions.length === 0) {
      return false
    }

    const dateString = date.toDateString()
    return this.config.exceptions.some(exception =>
      exception.toDateString() === dateString
    )
  }

  /**
   * Check if day is enabled for quiet hours
   */
  private isDayEnabled(date: Date): boolean {
    if (!this.config.days || this.config.days.length === 0) {
      return true // All days enabled if not specified
    }

    const dayOfWeek = date.getDay()
    return this.config.days.includes(dayOfWeek)
  }

  /**
   * Get local time in configured timezone
   */
  private getLocalTime(date: Date): Date {
    // Format date in timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.config.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })

    const parts = formatter.formatToParts(date)
    const dateParts: Record<string, string> = {}

    parts.forEach(part => {
      if (part.type !== 'literal') {
        dateParts[part.type] = part.value
      }
    })

    // Create date in local timezone
    return new Date(
      `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}`
    )
  }

  /**
   * Get quiet hours period for a date
   */
  private getQuietPeriod(date: Date): TimePeriod {
    const [startHour, startMinute] = this.config.start.split(':').map(Number)
    const [endHour, endMinute] = this.config.end.split(':').map(Number)

    // Create start time for the date
    const start = new Date(date)
    start.setHours(startHour, startMinute, 0, 0)

    // Create end time
    let end = new Date(date)
    end.setHours(endHour, endMinute, 0, 0)

    // Check if period crosses midnight
    const crossesMidnight = startHour > endHour ||
      (startHour === endHour && startMinute > endMinute)

    if (crossesMidnight) {
      // End time is next day
      end.setDate(end.getDate() + 1)
    }

    return { start, end, crossesMidnight }
  }

  /**
   * Check if time is within period
   */
  private isTimeInPeriod(time: Date, period: TimePeriod): boolean {
    const currentTime = time.getTime()
    const startTime = period.start.getTime()
    const endTime = period.end.getTime()

    if (!period.crossesMidnight) {
      // Simple case: start and end are on same day
      return currentTime >= startTime && currentTime < endTime
    } else {
      // Period crosses midnight
      // Check if we're after start (today) OR before end (tomorrow)
      const todayStart = period.start.getTime()
      const yesterdayStart = new Date(period.start).setDate(period.start.getDate() - 1)
      const tomorrowEnd = period.end.getTime()
      const todayEnd = new Date(period.end).setDate(period.end.getDate() - 1)

      return (currentTime >= todayStart) || (currentTime < todayEnd)
    }
  }

  /**
   * Get next quiet hours start time
   */
  getNextQuietHoursStart(from: Date = new Date()): Date | null {
    if (!this.config.enabled) {
      return null
    }

    let checkDate = new Date(from)

    // Check next 7 days
    for (let i = 0; i < 7; i++) {
      if (this.isDayEnabled(checkDate) && !this.isException(checkDate)) {
        const period = this.getQuietPeriod(checkDate)

        // If start time is in future, return it
        if (period.start.getTime() > from.getTime()) {
          return period.start
        }
      }

      // Move to next day
      checkDate.setDate(checkDate.getDate() + 1)
    }

    return null
  }

  /**
   * Get current quiet hours end time
   */
  getQuietHoursEnd(from: Date = new Date()): Date | null {
    if (!this.config.enabled) {
      return null
    }

    if (!this.isInQuietHours(from)) {
      return null
    }

    const period = this.getQuietPeriod(from)
    return period.end
  }

  /**
   * Get next available notification time
   */
  getNextAvailableTime(from: Date = new Date()): Date {
    if (!this.config.enabled || !this.isInQuietHours(from)) {
      return from
    }

    // Return end of current quiet hours
    const quietEnd = this.getQuietHoursEnd(from)
    return quietEnd || from
  }

  /**
   * Calculate delay until notifications are allowed
   */
  getDelayUntilAllowed(from: Date = new Date()): number {
    const nextTime = this.getNextAvailableTime(from)
    const delay = nextTime.getTime() - from.getTime()
    return Math.max(0, delay)
  }

  /**
   * Check if notification should be delayed
   */
  shouldDelayNotification(
    priority: 'high' | 'normal' | 'low' = 'normal',
    from: Date = new Date()
  ): boolean {
    if (!this.config.enabled) {
      return false
    }

    // High priority notifications bypass quiet hours
    if (priority === 'high') {
      return false
    }

    return this.isInQuietHours(from)
  }

  /**
   * Format quiet hours for display
   */
  formatQuietHours(): string {
    if (!this.config.enabled) {
      return 'Disabled'
    }

    let formatted = `${this.config.start} - ${this.config.end}`

    if (this.config.days && this.config.days.length > 0) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
      const days = this.config.days.map(d => dayNames[d]).join(', ')
      formatted += ` (${days})`
    }

    formatted += ` [${this.config.timezone}]`

    return formatted
  }

  /**
   * Get configuration
   */
  getConfig(): QuietHoursConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<QuietHoursConfig>): void {
    this.config = { ...this.config, ...updates }
    this.validateConfig()

    reviewLogger.info('Quiet hours configuration updated', {
      config: this.config
    })
  }

  /**
   * Enable quiet hours
   */
  enable(): void {
    this.config.enabled = true
    reviewLogger.info('Quiet hours enabled')
  }

  /**
   * Disable quiet hours
   */
  disable(): void {
    this.config.enabled = false
    reviewLogger.info('Quiet hours disabled')
  }

  /**
   * Toggle quiet hours
   */
  toggle(): boolean {
    this.config.enabled = !this.config.enabled
    reviewLogger.info(`Quiet hours ${this.config.enabled ? 'enabled' : 'disabled'}`)
    return this.config.enabled
  }

  /**
   * Add exception date
   */
  addException(date: Date): void {
    if (!this.config.exceptions) {
      this.config.exceptions = []
    }

    // Check if already exists
    const dateString = date.toDateString()
    if (!this.config.exceptions.some(e => e.toDateString() === dateString)) {
      this.config.exceptions.push(date)
      reviewLogger.info('Exception date added to quiet hours', { date: dateString })
    }
  }

  /**
   * Remove exception date
   */
  removeException(date: Date): void {
    if (!this.config.exceptions) {
      return
    }

    const dateString = date.toDateString()
    this.config.exceptions = this.config.exceptions.filter(
      e => e.toDateString() !== dateString
    )

    reviewLogger.info('Exception date removed from quiet hours', { date: dateString })
  }

  /**
   * Clear all exceptions
   */
  clearExceptions(): void {
    this.config.exceptions = []
    reviewLogger.info('All quiet hours exceptions cleared')
  }

  /**
   * Get statistics
   */
  getStats(): {
    enabled: boolean
    currentlyQuiet: boolean
    nextQuietStart: Date | null
    nextQuietEnd: Date | null
    totalQuietHours: number
    daysEnabled: number
    exceptionsCount: number
  } {
    const now = new Date()

    return {
      enabled: this.config.enabled,
      currentlyQuiet: this.isInQuietHours(now),
      nextQuietStart: this.getNextQuietHoursStart(now),
      nextQuietEnd: this.getQuietHoursEnd(now),
      totalQuietHours: this.calculateTotalQuietHours(),
      daysEnabled: this.config.days?.length || 7,
      exceptionsCount: this.config.exceptions?.length || 0
    }
  }

  /**
   * Calculate total quiet hours per day
   */
  private calculateTotalQuietHours(): number {
    const [startHour, startMinute] = this.config.start.split(':').map(Number)
    const [endHour, endMinute] = this.config.end.split(':').map(Number)

    let totalMinutes: number

    if (startHour < endHour || (startHour === endHour && startMinute < endMinute)) {
      // Quiet hours don't cross midnight
      totalMinutes = (endHour * 60 + endMinute) - (startHour * 60 + startMinute)
    } else {
      // Quiet hours cross midnight
      totalMinutes = (24 * 60 - (startHour * 60 + startMinute)) + (endHour * 60 + endMinute)
    }

    return totalMinutes / 60
  }
}

/**
 * Default quiet hours configuration
 */
export const DEFAULT_QUIET_HOURS: QuietHoursConfig = {
  enabled: false,
  start: '22:00',
  end: '08:00',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
}

/**
 * Create quiet hours instance with sensible defaults
 */
export function createQuietHours(config?: Partial<QuietHoursConfig>): QuietHours {
  return new QuietHours({ ...DEFAULT_QUIET_HOURS, ...config })
}