/**
 * Gradual Release Scheduler
 * Manages the scheduled release of pinned items over time
 */

import { PinnedItem, ReleaseScheduleEntry } from './types'

/**
 * Options for scheduling gradual release
 */
export interface GradualReleaseOptions {
  /**
   * Number of items to release per day
   */
  dailyLimit: number
  
  /**
   * Start date for the release schedule
   */
  startDate?: Date
  
  /**
   * Days of the week to release items (0 = Sunday, 6 = Saturday)
   * If not specified, releases every day
   */
  releaseDays?: number[]
  
  /**
   * Whether to skip weekends
   */
  skipWeekends?: boolean
  
  /**
   * Whether to distribute items evenly across batches
   */
  distributeEvenly?: boolean
}

/**
 * Release schedule summary
 */
export interface ReleaseScheduleSummary {
  /**
   * Total items to be released
   */
  totalItems: number
  
  /**
   * Number of batches
   */
  totalBatches: number
  
  /**
   * First release date
   */
  firstReleaseDate: Date
  
  /**
   * Last release date
   */
  lastReleaseDate: Date
  
  /**
   * Items per batch
   */
  itemsPerBatch: number[]
  
  /**
   * Schedule entries
   */
  schedule: ReleaseScheduleEntry[]
}

/**
 * ReleaseScheduler class for managing gradual item releases
 */
export class ReleaseScheduler {
  /**
   * Schedule gradual release for a list of items
   */
  scheduleGradualRelease(
    items: PinnedItem[],
    options: GradualReleaseOptions
  ): ReleaseScheduleSummary {
    if (items.length === 0) {
      return {
        totalItems: 0,
        totalBatches: 0,
        firstReleaseDate: new Date(),
        lastReleaseDate: new Date(),
        itemsPerBatch: [],
        schedule: []
      }
    }
    
    const {
      dailyLimit,
      startDate = new Date(),
      releaseDays,
      skipWeekends = false,
      distributeEvenly = false
    } = options
    
    // Calculate batches
    const batches = this.calculateBatches(items, dailyLimit, distributeEvenly)
    
    // Generate release dates
    const releaseDates = this.generateReleaseDates(
      batches.length,
      startDate,
      releaseDays,
      skipWeekends
    )
    
    // Create schedule entries
    const schedule: ReleaseScheduleEntry[] = []
    let itemIndex = 0
    
    for (let batchNumber = 0; batchNumber < batches.length; batchNumber++) {
      const batchSize = batches[batchNumber]
      const releaseDate = releaseDates[batchNumber]
      
      for (let i = 0; i < batchSize && itemIndex < items.length; i++) {
        schedule.push({
          itemId: items[itemIndex].id,
          releaseDate,
          batchNumber,
          released: false
        })
        itemIndex++
      }
    }
    
    return {
      totalItems: items.length,
      totalBatches: batches.length,
      firstReleaseDate: releaseDates[0],
      lastReleaseDate: releaseDates[releaseDates.length - 1],
      itemsPerBatch: batches,
      schedule
    }
  }
  
  /**
   * Calculate release date for a specific item index
   */
  calculateReleaseDate(
    index: number,
    dailyLimit: number,
    startDate: Date = new Date(),
    skipWeekends: boolean = false
  ): Date {
    const batchNumber = Math.floor(index / dailyLimit)
    return this.addBusinessDays(startDate, batchNumber, skipWeekends)
  }
  
  /**
   * Get items scheduled for release on or before a specific date
   */
  getItemsForDate(
    schedule: ReleaseScheduleEntry[],
    date: Date,
    includeReleased: boolean = false
  ): ReleaseScheduleEntry[] {
    const targetDate = new Date(date)
    targetDate.setHours(23, 59, 59, 999)
    
    return schedule.filter(entry => {
      const isBeforeDate = entry.releaseDate <= targetDate
      const shouldInclude = includeReleased || !entry.released
      return isBeforeDate && shouldInclude
    })
  }
  
  /**
   * Get today's items to release
   */
  getItemsForToday(
    schedule: ReleaseScheduleEntry[],
    includeReleased: boolean = false
  ): ReleaseScheduleEntry[] {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    return schedule.filter(entry => {
      const isToday = entry.releaseDate >= today && entry.releaseDate < tomorrow
      const shouldInclude = includeReleased || !entry.released
      return isToday && shouldInclude
    })
  }
  
  /**
   * Mark items as released
   */
  markAsReleased(schedule: ReleaseScheduleEntry[], itemIds: string[]): void {
    const idSet = new Set(itemIds)
    schedule.forEach(entry => {
      if (idSet.has(entry.itemId)) {
        entry.released = true
      }
    })
  }
  
  /**
   * Get release statistics
   */
  getScheduleStatistics(schedule: ReleaseScheduleEntry[]): {
    total: number
    released: number
    pending: number
    overdue: number
    upcoming: number
    todayCount: number
  } {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    let released = 0
    let pending = 0
    let overdue = 0
    let upcoming = 0
    let todayCount = 0
    
    for (const entry of schedule) {
      if (entry.released) {
        released++
      } else {
        pending++
        
        if (entry.releaseDate < now) {
          overdue++
        } else if (entry.releaseDate >= now && entry.releaseDate < tomorrow) {
          todayCount++
        } else {
          upcoming++
        }
      }
    }
    
    return {
      total: schedule.length,
      released,
      pending,
      overdue,
      upcoming,
      todayCount
    }
  }
  
  /**
   * Reschedule unreleased items
   */
  reschedule(
    schedule: ReleaseScheduleEntry[],
    newStartDate: Date,
    options: GradualReleaseOptions
  ): ReleaseScheduleEntry[] {
    const unreleasedEntries = schedule.filter(entry => !entry.released)
    
    if (unreleasedEntries.length === 0) {
      return schedule
    }
    
    // Generate new dates for unreleased items
    const newDates = this.generateReleaseDates(
      Math.ceil(unreleasedEntries.length / options.dailyLimit),
      newStartDate,
      options.releaseDays,
      options.skipWeekends
    )
    
    // Update release dates
    let dateIndex = 0
    let itemsInBatch = 0
    
    for (const entry of unreleasedEntries) {
      entry.releaseDate = newDates[dateIndex]
      entry.batchNumber = dateIndex
      
      itemsInBatch++
      if (itemsInBatch >= options.dailyLimit) {
        dateIndex++
        itemsInBatch = 0
      }
    }
    
    return schedule
  }
  
  /**
   * Optimize schedule by consolidating gaps
   */
  optimizeSchedule(
    schedule: ReleaseScheduleEntry[],
    dailyLimit: number
  ): ReleaseScheduleEntry[] {
    // Sort by release date and released status
    const sorted = [...schedule].sort((a, b) => {
      if (a.released !== b.released) {
        return a.released ? 1 : -1 // Unreleased first
      }
      return a.releaseDate.getTime() - b.releaseDate.getTime()
    })
    
    // Reassign batch numbers for unreleased items
    const unreleased = sorted.filter(entry => !entry.released)
    const released = sorted.filter(entry => entry.released)
    
    let currentBatch = 0
    let itemsInCurrentBatch = 0
    
    for (const entry of unreleased) {
      entry.batchNumber = currentBatch
      itemsInCurrentBatch++
      
      if (itemsInCurrentBatch >= dailyLimit) {
        currentBatch++
        itemsInCurrentBatch = 0
      }
    }
    
    return [...unreleased, ...released]
  }
  
  // Private helper methods
  
  private calculateBatches(
    items: PinnedItem[],
    dailyLimit: number,
    distributeEvenly: boolean
  ): number[] {
    const totalItems = items.length
    const fullBatches = Math.floor(totalItems / dailyLimit)
    const remainder = totalItems % dailyLimit
    
    const batches: number[] = []
    
    if (distributeEvenly && remainder > 0) {
      // Distribute remainder evenly across batches
      const baseSize = Math.floor(totalItems / (fullBatches + 1))
      const extraItems = totalItems % (fullBatches + 1)
      
      for (let i = 0; i < fullBatches + 1; i++) {
        batches.push(baseSize + (i < extraItems ? 1 : 0))
      }
    } else {
      // Standard batching: full batches + remainder
      for (let i = 0; i < fullBatches; i++) {
        batches.push(dailyLimit)
      }
      if (remainder > 0) {
        batches.push(remainder)
      }
    }
    
    return batches
  }
  
  private generateReleaseDates(
    batchCount: number,
    startDate: Date,
    releaseDays?: number[],
    skipWeekends?: boolean
  ): Date[] {
    const dates: Date[] = []
    let currentDate = new Date(startDate)
    currentDate.setHours(0, 0, 0, 0)
    
    for (let i = 0; i < batchCount; i++) {
      // Find next valid release date
      while (!this.isValidReleaseDate(currentDate, releaseDays, skipWeekends)) {
        currentDate.setDate(currentDate.getDate() + 1)
      }
      
      dates.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return dates
  }
  
  private isValidReleaseDate(
    date: Date,
    releaseDays?: number[],
    skipWeekends?: boolean
  ): boolean {
    const dayOfWeek = date.getDay()
    
    // Check if weekend should be skipped
    if (skipWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return false
    }
    
    // Check if specific release days are set
    if (releaseDays && releaseDays.length > 0) {
      return releaseDays.includes(dayOfWeek)
    }
    
    return true
  }
  
  private addBusinessDays(
    startDate: Date,
    days: number,
    skipWeekends: boolean
  ): Date {
    const date = new Date(startDate)
    let daysAdded = 0
    
    while (daysAdded < days) {
      date.setDate(date.getDate() + 1)
      
      const dayOfWeek = date.getDay()
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      
      if (!skipWeekends || !isWeekend) {
        daysAdded++
      }
    }
    
    return date
  }
}

// Export singleton instance
export const releaseScheduler = new ReleaseScheduler()