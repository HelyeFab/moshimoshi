/**
 * Versioned Data Types
 *
 * Adds version tracking to all data structures for conflict detection.
 * Fixes Issue #3: No version tracking in legacy mode
 *
 * Design Decisions:
 * - All mutable data structures must implement Versioned
 * - Version increments on every write
 * - Enables optimistic concurrency control
 * - Prevents lost updates in concurrent scenarios
 */

import { ISODateTimeString } from './timestamp.types'

/**
 * Base interface for all versioned data structures
 * Provides optimistic concurrency control
 */
export interface Versioned {
  /**
   * Version number for optimistic locking
   * Increments on every update
   * Used for conflict detection
   */
  version: number

  /**
   * Last update timestamp
   * ISO 8601 format
   */
  updatedAt: ISODateTimeString
}

/**
 * Optimistic state wrapper
 * Tracks both current and optimistic states during updates
 */
export interface OptimisticState<T> {
  /**
   * Current confirmed data (from server)
   */
  data: T

  /**
   * Optimistic data (pending confirmation)
   * Null if no pending update
   */
  optimisticData: T | null

  /**
   * Syncing status
   */
  isSyncing: boolean

  /**
   * Last sync error (if any)
   */
  lastSyncError: Error | null

  /**
   * Timestamp of last successful sync
   */
  lastSyncedAt: ISODateTimeString | null
}

/**
 * Version conflict error
 * Thrown when version mismatch detected
 */
export class VersionConflictError extends Error {
  constructor(
    message: string,
    public expected: number,
    public actual: number
  ) {
    super(message)
    this.name = 'VersionConflictError'
  }
}

/**
 * Conflict resolution strategies
 */
export enum ConflictResolution {
  /**
   * Server wins - discard local changes
   * Safe default for most cases
   */
  SERVER_WINS = 'server_wins',

  /**
   * Client wins - overwrite server
   * Use with caution, can cause data loss
   */
  CLIENT_WINS = 'client_wins',

  /**
   * Merge - attempt to merge changes
   * Complex, requires custom logic
   */
  MERGE = 'merge',

  /**
   * Manual - require user intervention
   * Show conflict UI
   */
  MANUAL = 'manual'
}

/**
 * Versioning utilities
 */
export const VersionUtils = {
  /**
   * Check if version matches expected
   */
  checkVersion(actual: number, expected: number): boolean {
    return actual === expected
  },

  /**
   * Throw if version mismatch
   */
  assertVersion(actual: number, expected: number): void {
    if (!VersionUtils.checkVersion(actual, expected)) {
      throw new VersionConflictError(
        `Version mismatch: expected ${expected}, got ${actual}`,
        expected,
        actual
      )
    }
  },

  /**
   * Increment version
   */
  incrementVersion(version: number): number {
    return version + 1
  },

  /**
   * Create initial versioned data
   */
  createVersioned<T>(data: T): T & Versioned {
    return {
      ...data,
      version: 1,
      updatedAt: new Date().toISOString()
    }
  },

  /**
   * Update versioned data
   */
  updateVersioned<T extends Versioned>(data: T, updates: Partial<T>): T {
    return {
      ...data,
      ...updates,
      version: VersionUtils.incrementVersion(data.version),
      updatedAt: new Date().toISOString()
    }
  }
}
