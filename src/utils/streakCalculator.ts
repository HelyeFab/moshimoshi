/**
 * Centralized streak calculation utility
 * Single source of truth for streak calculations across the app
 */

export interface StreakResult {
  currentStreak: number
  bestStreak: number
  isActiveToday: boolean
  lastActivityDate: string | null
}

/**
 * Calculate streak from a record of dates
 * @param dates - Record of date strings (YYYY-MM-DD format) with boolean values
 * @param existingBestStreak - The current best streak to compare against
 * @returns StreakResult with current streak, best streak, and activity status
 */
export function calculateStreakFromDates(
  dates: Record<string, boolean>,
  existingBestStreak: number = 0
): StreakResult {
  // Handle empty or invalid input
  if (!dates || typeof dates !== 'object' || Object.keys(dates).length === 0) {
    return {
      currentStreak: 0,
      bestStreak: existingBestStreak,
      isActiveToday: false,
      lastActivityDate: null
    }
  }

  // Clean and deduplicate dates - only keep valid date strings
  const validDates = Object.entries(dates)
    .filter(([key, value]) => {
      // Check if key is a valid date format (YYYY-MM-DD)
      return key.match(/^\d{4}-\d{2}-\d{2}$/) && value === true
    })
    .map(([key]) => key)

  if (validDates.length === 0) {
    return {
      currentStreak: 0,
      bestStreak: existingBestStreak,
      isActiveToday: false,
      lastActivityDate: null
    }
  }

  // Sort dates in descending order (most recent first)
  const sortedDates = [...new Set(validDates)].sort().reverse()

  // Get today's date in YYYY-MM-DD format
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  // Check if user was active today
  const isActiveToday = sortedDates.includes(todayStr)

  // Calculate current streak
  let currentStreak = 0
  let expectedDate = new Date(today)

  for (const dateStr of sortedDates) {
    const date = new Date(dateStr + 'T00:00:00')
    date.setHours(0, 0, 0, 0)

    // Calculate difference in days
    const daysDiff = Math.floor((expectedDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (daysDiff === 0) {
      // This date matches the expected date (consecutive)
      currentStreak++
      // Move to previous day for next iteration
      expectedDate.setDate(expectedDate.getDate() - 1)
    } else if (currentStreak === 0 && daysDiff === 1) {
      // First check: if today has no activity but yesterday does
      // The streak is still active (user has until end of today)
      currentStreak++
      // Skip today and move to day before yesterday
      expectedDate.setDate(expectedDate.getDate() - 2)
    } else {
      // Gap found - streak is broken
      break
    }
  }

  // Calculate best streak
  const bestStreak = Math.max(existingBestStreak, currentStreak)

  // Get the most recent activity date
  const lastActivityDate = sortedDates[0] || null

  return {
    currentStreak,
    bestStreak,
    isActiveToday,
    lastActivityDate
  }
}

/**
 * Clean nested date structures that might exist in Firebase data
 * Handles the case where dates are stored at wrong nesting level
 * @param data - The raw data object from Firebase
 * @returns Clean dates record
 */
export function cleanNestedDates(data: any): Record<string, boolean> {
  const cleanDates: Record<string, boolean> = {}

  if (!data || typeof data !== 'object') {
    return cleanDates
  }

  // Helper function to extract dates from any level
  const extractDates = (obj: any, prefix: string = '') => {
    if (!obj || typeof obj !== 'object') return

    Object.entries(obj).forEach(([key, value]) => {
      const fullKey = prefix ? `${prefix}.${key}` : key

      // Check if this key looks like a date
      if (key.match(/^\d{4}-\d{2}-\d{2}$/)) {
        cleanDates[key] = true
      }
      // Check if the full key contains a date (like dates.2025-09-17)
      else if (fullKey.includes('.')) {
        const parts = fullKey.split('.')
        const lastPart = parts[parts.length - 1]
        if (lastPart.match(/^\d{4}-\d{2}-\d{2}$/)) {
          cleanDates[lastPart] = true
        }
      }

      // Recursively check nested objects
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Don't recurse into objects that are clearly not date containers
        if (!['currentStreak', 'bestStreak', 'lastActivity', 'lastUpdated'].includes(key)) {
          extractDates(value, fullKey)
        }
      }
    })
  }

  // Start extraction from the root
  extractDates(data)

  return cleanDates
}

/**
 * Merge dates from multiple sources (localStorage, Firebase, etc.)
 * @param sources - Array of date records to merge
 * @returns Merged dates record with all unique dates
 */
export function mergeDateSources(...sources: (Record<string, boolean> | undefined)[]): Record<string, boolean> {
  const mergedDates: Record<string, boolean> = {}

  for (const source of sources) {
    if (source && typeof source === 'object') {
      Object.entries(source).forEach(([date, value]) => {
        if (date.match(/^\d{4}-\d{2}-\d{2}$/) && value === true) {
          mergedDates[date] = true
        }
      })
    }
  }

  return mergedDates
}

/**
 * Check if streak is at risk (no activity today and it's getting late)
 * @param dates - Record of dates
 * @returns Object indicating if streak is at risk and hours remaining
 */
export function checkStreakRisk(dates: Record<string, boolean>): {
  atRisk: boolean
  hoursRemaining: number
  message: string
} {
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // Check if already active today
  if (dates[todayStr]) {
    return {
      atRisk: false,
      hoursRemaining: 24,
      message: 'Streak is safe - you were active today!'
    }
  }

  // Calculate hours remaining in the day
  const endOfDay = new Date(now)
  endOfDay.setHours(23, 59, 59, 999)
  const hoursRemaining = Math.max(0, Math.floor((endOfDay.getTime() - now.getTime()) / (1000 * 60 * 60)))

  // Check if user has a streak to maintain
  const { currentStreak } = calculateStreakFromDates(dates)

  if (currentStreak === 0) {
    return {
      atRisk: false,
      hoursRemaining,
      message: 'No active streak to maintain'
    }
  }

  // Streak is at risk if less than 4 hours remain
  const atRisk = hoursRemaining < 4

  let message = `${hoursRemaining} hours remaining to maintain your ${currentStreak} day streak`
  if (atRisk) {
    message = `⚠️ Streak at risk! Only ${hoursRemaining} hours left to maintain your ${currentStreak} day streak!`
  }

  return {
    atRisk,
    hoursRemaining,
    message
  }
}