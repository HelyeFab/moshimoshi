/**
 * UTC Day Bucket Calculator
 *
 * CRITICAL: Server-side UTC timestamp is ALWAYS the source of truth.
 * Client timezone offset is stored for audit purposes only.
 *
 * This utility prevents the "future date bug" that caused DataSyncProvider to be disabled.
 *
 * Formula: day = floor((server_ts_utc + user_tz_offset_snapshot) / 86400_000)
 *
 * @module utcDayBucket
 */

export interface DayBucketResult {
  /**
   * ISO 8601 date string in YYYY-MM-DD format (UTC-normalized)
   */
  dayString: string

  /**
   * Unix timestamp (ms) of the day's start (00:00:00.000 UTC)
   */
  dayStartTimestamp: number

  /**
   * Unix timestamp (ms) of the day's end (23:59:59.999 UTC)
   */
  dayEndTimestamp: number

  /**
   * User's timezone offset in minutes (for audit only)
   */
  userTimezoneOffset: number

  /**
   * Server timestamp used for calculation (source of truth)
   */
  serverTimestamp: number
}

export interface TimezoneSnapshot {
  /**
   * Timezone offset in minutes from UTC
   * Positive = ahead of UTC (e.g., +540 for Tokyo)
   * Negative = behind UTC (e.g., -300 for New York)
   */
  offsetMinutes: number

  /**
   * Timezone identifier (e.g., 'Asia/Tokyo', 'America/New_York')
   */
  timezoneName?: string

  /**
   * Whether DST is active at the time of snapshot
   */
  isDST?: boolean
}

/**
 * Calculate UTC day bucket from server timestamp
 *
 * @param serverTimestampUtc - Server timestamp in UTC (milliseconds since epoch)
 * @param userTimezone - User's timezone info (for audit logging only)
 * @returns DayBucketResult with normalized day string
 *
 * @example
 * ```typescript
 * // User in Tokyo (UTC+9) completes activity at 23:59 JST on Oct 2
 * // Server time: 2025-10-02T14:59:00Z (Oct 2, 14:59 UTC)
 * const result = utcDayBucket(
 *   new Date('2025-10-02T14:59:00Z').getTime(),
 *   { offsetMinutes: 540, timezoneName: 'Asia/Tokyo' }
 * )
 * // result.dayString = '2025-10-02' (server date wins)
 * ```
 *
 * @example
 * ```typescript
 * // Edge case: Exactly at midnight UTC
 * const result = utcDayBucket(
 *   new Date('2025-10-03T00:00:00.000Z').getTime(),
 *   { offsetMinutes: -300 } // New York (UTC-5)
 * )
 * // result.dayString = '2025-10-03' (new day starts at midnight UTC)
 * ```
 */
export function utcDayBucket(
  serverTimestampUtc: number,
  userTimezone?: TimezoneSnapshot
): DayBucketResult {
  // Validate input
  if (typeof serverTimestampUtc !== 'number' || !isFinite(serverTimestampUtc)) {
    throw new Error(`Invalid server timestamp: ${serverTimestampUtc}`)
  }

  if (serverTimestampUtc < 0) {
    throw new Error(`Server timestamp cannot be negative: ${serverTimestampUtc}`)
  }

  // Future date protection: reject timestamps more than 1 day in the future
  const now = Date.now()
  const oneDayMs = 86400000
  if (serverTimestampUtc > now + oneDayMs) {
    throw new Error(
      `Server timestamp is too far in the future: ${new Date(serverTimestampUtc).toISOString()} ` +
      `(current server time: ${new Date(now).toISOString()})`
    )
  }

  // Calculate day boundaries in UTC
  const serverDate = new Date(serverTimestampUtc)

  // Get UTC day start (00:00:00.000)
  const dayStart = new Date(Date.UTC(
    serverDate.getUTCFullYear(),
    serverDate.getUTCMonth(),
    serverDate.getUTCDate(),
    0, 0, 0, 0
  ))

  // Get UTC day end (23:59:59.999)
  const dayEnd = new Date(Date.UTC(
    serverDate.getUTCFullYear(),
    serverDate.getUTCMonth(),
    serverDate.getUTCDate(),
    23, 59, 59, 999
  ))

  // Format as YYYY-MM-DD (ISO 8601)
  const dayString = serverDate.toISOString().split('T')[0]

  return {
    dayString,
    dayStartTimestamp: dayStart.getTime(),
    dayEndTimestamp: dayEnd.getTime(),
    userTimezoneOffset: userTimezone?.offsetMinutes || 0,
    serverTimestamp: serverTimestampUtc
  }
}

/**
 * Get current UTC day bucket
 * Uses current server time
 *
 * @param userTimezone - Optional user timezone for audit
 * @returns DayBucketResult for current server time
 */
export function getCurrentDayBucket(userTimezone?: TimezoneSnapshot): DayBucketResult {
  return utcDayBucket(Date.now(), userTimezone)
}

/**
 * Parse day string to UTC day bucket
 * Useful for reconstructing day boundaries from stored YYYY-MM-DD strings
 *
 * @param dayString - ISO 8601 date string (YYYY-MM-DD)
 * @returns DayBucketResult for the specified day
 *
 * @example
 * ```typescript
 * const result = parseDayString('2025-10-02')
 * // result.dayStartTimestamp = 2025-10-02T00:00:00.000Z
 * // result.dayEndTimestamp = 2025-10-02T23:59:59.999Z
 * ```
 */
export function parseDayString(dayString: string): DayBucketResult {
  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayString)) {
    throw new Error(`Invalid day string format: ${dayString}. Expected YYYY-MM-DD`)
  }

  const [year, month, day] = dayString.split('-').map(Number)

  // Validate date components
  if (year < 1970 || year > 2100) {
    throw new Error(`Year out of valid range: ${year}`)
  }
  if (month < 1 || month > 12) {
    throw new Error(`Month out of valid range: ${month}`)
  }
  if (day < 1 || day > 31) {
    throw new Error(`Day out of valid range: ${day}`)
  }

  // Create UTC date at midnight
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))

  // Check if date is valid (handles invalid dates like Feb 30)
  if (date.getUTCDate() !== day || date.getUTCMonth() !== month - 1) {
    throw new Error(`Invalid date: ${dayString}`)
  }

  return utcDayBucket(date.getTime())
}

/**
 * Check if a timestamp falls within a specific day bucket
 *
 * @param timestamp - Timestamp to check (ms)
 * @param dayString - Day string to check against (YYYY-MM-DD)
 * @returns true if timestamp falls within the day
 */
export function isTimestampInDay(timestamp: number, dayString: string): boolean {
  const dayBucket = parseDayString(dayString)
  return timestamp >= dayBucket.dayStartTimestamp &&
         timestamp <= dayBucket.dayEndTimestamp
}

/**
 * Get the day bucket for yesterday (relative to server time)
 */
export function getYesterdayBucket(userTimezone?: TimezoneSnapshot): DayBucketResult {
  const oneDayMs = 86400000
  return utcDayBucket(Date.now() - oneDayMs, userTimezone)
}

/**
 * Get the day bucket for tomorrow (relative to server time)
 */
export function getTomorrowBucket(userTimezone?: TimezoneSnapshot): DayBucketResult {
  const oneDayMs = 86400000
  return utcDayBucket(Date.now() + oneDayMs, userTimezone)
}

/**
 * Calculate days between two day strings
 *
 * @param startDay - Earlier day string (YYYY-MM-DD)
 * @param endDay - Later day string (YYYY-MM-DD)
 * @returns Number of days between (inclusive of start, exclusive of end)
 */
export function daysBetween(startDay: string, endDay: string): number {
  const start = parseDayString(startDay)
  const end = parseDayString(endDay)

  const diffMs = end.dayStartTimestamp - start.dayStartTimestamp
  return Math.floor(diffMs / 86400000)
}

/**
 * Check if two day strings are consecutive
 *
 * @param day1 - First day (YYYY-MM-DD)
 * @param day2 - Second day (YYYY-MM-DD)
 * @returns true if day2 is exactly 1 day after day1
 */
export function areConsecutiveDays(day1: string, day2: string): boolean {
  return daysBetween(day1, day2) === 1
}

/**
 * Get user's local timezone snapshot from browser
 * Use this on the client to capture timezone info for audit purposes
 *
 * @returns TimezoneSnapshot with current timezone info
 */
export function getUserTimezoneSnapshot(): TimezoneSnapshot {
  const now = new Date()
  const offsetMinutes = -now.getTimezoneOffset() // Inverted because getTimezoneOffset is backwards

  // Try to get timezone name
  let timezoneName: string | undefined
  let isDST: boolean | undefined

  try {
    timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone

    // Detect DST by comparing Jan and Jul offsets
    const jan = new Date(now.getFullYear(), 0, 1)
    const jul = new Date(now.getFullYear(), 6, 1)
    const janOffset = -jan.getTimezoneOffset()
    const julOffset = -jul.getTimezoneOffset()

    // If current offset differs from standard offset, DST is active
    const standardOffset = Math.min(janOffset, julOffset)
    isDST = offsetMinutes !== standardOffset
  } catch (e) {
    // Browser doesn't support Intl API
  }

  return {
    offsetMinutes,
    timezoneName,
    isDST
  }
}

/**
 * Validate that a day string is not in the future
 * Throws error if day is more than 1 day ahead of server time
 *
 * @param dayString - Day string to validate (YYYY-MM-DD)
 * @throws Error if day is too far in future
 */
export function validateNotFutureDay(dayString: string): void {
  const today = getCurrentDayBucket()
  const targetDay = parseDayString(dayString)

  // Allow up to 1 day in future (for timezone edge cases)
  const daysDiff = daysBetween(today.dayString, dayString)

  if (daysDiff > 1) {
    throw new Error(
      `Day string is too far in future: ${dayString} ` +
      `(current server day: ${today.dayString}, diff: ${daysDiff} days)`
    )
  }
}

/**
 * Sanitize dates map by removing any future dates
 * Used to clean corrupted data
 *
 * @param dates - Record of date strings with boolean values
 * @returns Cleaned dates map with no future dates
 */
export function sanitizeDatesMap(dates: Record<string, boolean>): Record<string, boolean> {
  const today = getCurrentDayBucket()
  const cleaned: Record<string, boolean> = {}

  for (const [dateStr, value] of Object.entries(dates)) {
    // Skip invalid formats
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue

    // Skip future dates
    try {
      const daysDiff = daysBetween(today.dayString, dateStr)
      if (daysDiff > 1) continue // Skip if more than 1 day in future

      if (value === true) {
        cleaned[dateStr] = true
      }
    } catch (e) {
      // Skip invalid dates
      continue
    }
  }

  return cleaned
}
