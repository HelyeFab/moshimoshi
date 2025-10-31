/**
 * Timestamp Type System
 *
 * Standardizes date handling across the entire application.
 * Fixes Issue #1: Date type inconsistency
 *
 * Design Decisions:
 * - Store dates as ISO strings (yyyy-mm-dd) for date-only values
 * - Store timestamps as ISO 8601 strings for datetime values
 * - Never use JavaScript Date objects in state or storage
 * - Always convert to/from Firestore Timestamp at boundaries
 *
 * Note: This file is safe for both client and server code.
 * Firestore Timestamp handling is done via type-only imports.
 */

/**
 * ISO date string in format: yyyy-mm-dd
 * Example: "2025-10-31"
 */
export type ISODateString = string

/**
 * ISO 8601 datetime string
 * Example: "2025-10-31T14:30:00.000Z"
 */
export type ISODateTimeString = string

/**
 * Firestore timestamp type (generic interface)
 * Can be from firebase-admin or firebase client SDK
 */
export interface FirestoreTimestamp {
  toDate(): Date
  toMillis(): number
}

/**
 * Date serialization utilities
 * Provides consistent conversion between formats
 */
export const DateSerializer = {
  /**
   * Convert Date or Timestamp to ISO date string (yyyy-mm-dd)
   * Used for: lastActivityDate, date-based comparisons
   */
  toISODate: (date: Date | FirestoreTimestamp | null): ISODateString | null => {
    if (!date) return null

    // Check if it's a Firestore Timestamp (has toDate method)
    const jsDate = date instanceof Date ? date : (date as FirestoreTimestamp).toDate()
    return jsDate.toISOString().split('T')[0]
  },

  /**
   * Convert ISO date string to JavaScript Date (at midnight UTC)
   * Used for: date calculations, comparisons
   */
  fromISODate: (str: ISODateString | null): Date | null => {
    if (!str) return null

    // Parse as UTC midnight to avoid timezone issues
    return new Date(`${str}T00:00:00.000Z`)
  },

  /**
   * Convert Date to ISO datetime string
   * Used for: timestamps, updatedAt fields
   */
  toISODateTime: (date: Date | null): ISODateTimeString | null => {
    if (!date) return null
    return date.toISOString()
  },

  /**
   * Convert ISO datetime string to JavaScript Date
   * Used for: parsing stored timestamps
   */
  fromISODateTime: (str: ISODateTimeString | null): Date | null => {
    if (!str) return null
    return new Date(str)
  },

  /**
   * Convert Firestore Timestamp to JavaScript Date
   * Used for: reading from Firestore
   */
  fromTimestamp: (ts: FirestoreTimestamp | null): Date | null => {
    if (!ts) return null
    return ts.toDate()
  },

  /**
   * Get current date as ISO string (yyyy-mm-dd)
   * Always returns UTC date to avoid timezone issues
   */
  getCurrentDateUTC(): ISODateString {
    return new Date().toISOString().split('T')[0]
  },

  /**
   * Get current datetime as ISO string
   */
  getCurrentDateTimeUTC(): ISODateTimeString {
    return new Date().toISOString()
  },

  /**
   * Calculate difference in days between two ISO date strings
   * Returns absolute value
   */
  daysBetween(date1: ISODateString, date2: ISODateString): number {
    const d1 = DateSerializer.fromISODate(date1)
    const d2 = DateSerializer.fromISODate(date2)

    if (!d1 || !d2) return 0

    const diffMs = Math.abs(d2.getTime() - d1.getTime())
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  },

  /**
   * Check if date1 is before date2
   */
  isBefore(date1: ISODateString, date2: ISODateString): boolean {
    return date1 < date2
  },

  /**
   * Check if date1 is after date2
   */
  isAfter(date1: ISODateString, date2: ISODateString): boolean {
    return date1 > date2
  },

  /**
   * Check if two dates are the same
   */
  isSameDay(date1: ISODateString, date2: ISODateString): boolean {
    return date1 === date2
  },

  /**
   * Add days to a date
   */
  addDays(date: ISODateString, days: number): ISODateString {
    const d = DateSerializer.fromISODate(date)
    if (!d) return date

    d.setUTCDate(d.getUTCDate() + days)
    return DateSerializer.toISODate(d)!
  },

  /**
   * Format date for display
   */
  formatDate(date: ISODateString | null, locale: string = 'en-US'): string {
    if (!date) return 'N/A'

    const d = DateSerializer.fromISODate(date)
    if (!d) return 'N/A'

    return d.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  },

  /**
   * Format datetime for display
   */
  formatDateTime(datetime: ISODateTimeString | null, locale: string = 'en-US'): string {
    if (!datetime) return 'N/A'

    const d = DateSerializer.fromISODateTime(datetime)
    if (!d) return 'N/A'

    return d.toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

/**
 * Validation helpers
 */
export const DateValidator = {
  /**
   * Check if string is valid ISO date (yyyy-mm-dd)
   */
  isValidISODate(str: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(str) && !isNaN(Date.parse(str))
  },

  /**
   * Check if string is valid ISO datetime
   */
  isValidISODateTime(str: string): boolean {
    return !isNaN(Date.parse(str))
  }
}
