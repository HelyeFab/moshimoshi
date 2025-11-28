/**
 * Server-Safe SRS Utilities for Drill System
 *
 * These are pure calculation functions extracted from DrillProgressManager
 * for use in API routes (server-side) where IndexedDB is not available.
 *
 * IMPORTANT: This file must NOT import from:
 * - 'idb' or any IndexedDB-related modules
 * - DrillProgressManager or UniversalProgressManager
 * - Any browser-only APIs
 *
 * Created to fix build error introduced in commit be852138 (Nov 8, 2025)
 * where DrillProgressManager (which uses idb) was imported into an API route.
 */

export interface DrillSRSData {
  interval: number;
  easeFactor: number;
  repetitions: number;
  lastReviewedAt: string | null;
  nextReviewAt: string;
  status: 'new' | 'learning' | 'review' | 'mastered';
  lapses: number;
}

/**
 * SM-2 algorithm implementation for SRS interval calculation
 * Pure function - no side effects, no browser APIs
 *
 * @param currentSRS - Current SRS data for the item
 * @param correct - Whether the answer was correct
 * @returns Updated SRS data
 */
export function calculateSM2(currentSRS: DrillSRSData, correct: boolean): DrillSRSData {
  const newSRS = { ...currentSRS };

  if (correct) {
    // Correct answer
    if (newSRS.status === 'new') {
      newSRS.status = 'learning';
      newSRS.interval = 1;
      newSRS.repetitions = 1;
    } else if (newSRS.status === 'learning') {
      newSRS.repetitions++;
      if (newSRS.repetitions >= 2) {
        newSRS.status = 'review';
        newSRS.interval = 3;
      } else {
        newSRS.interval = 1;
      }
    } else {
      // Review status
      newSRS.repetitions++;
      newSRS.interval = Math.round(newSRS.interval * newSRS.easeFactor);

      // Check for mastery (21+ days with good accuracy)
      if (newSRS.interval >= 21 && newSRS.repetitions >= 5) {
        newSRS.status = 'mastered';
      }
    }

    // Increase ease factor slightly on correct
    newSRS.easeFactor = Math.min(2.5, newSRS.easeFactor + 0.1);
  } else {
    // Incorrect answer
    newSRS.lapses++;
    newSRS.repetitions = 0;
    newSRS.interval = 1;
    newSRS.easeFactor = Math.max(1.3, newSRS.easeFactor - 0.2);

    // Demote status
    if (newSRS.status === 'mastered') {
      newSRS.status = 'review';
    } else if (newSRS.status === 'review') {
      newSRS.status = 'learning';
    }
  }

  // Calculate next review date
  newSRS.lastReviewedAt = new Date().toISOString();
  newSRS.nextReviewAt = calculateNextReviewDate(newSRS.interval);

  return newSRS;
}

/**
 * Calculate next review date based on interval
 * Pure function - no side effects, no browser APIs
 *
 * @param intervalDays - Number of days until next review
 * @returns ISO string date for next review
 */
export function calculateNextReviewDate(intervalDays: number): string {
  const now = new Date();
  const next = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  return next.toISOString();
}

/**
 * Create initial SRS data for a new word
 * Pure function - no side effects, no browser APIs
 *
 * @returns Initial SRS data structure
 */
export function createInitialSRSData(): DrillSRSData {
  return {
    interval: 1,
    easeFactor: 2.5,
    repetitions: 0,
    lastReviewedAt: null,
    nextReviewAt: calculateNextReviewDate(1),
    status: 'new',
    lapses: 0
  };
}
