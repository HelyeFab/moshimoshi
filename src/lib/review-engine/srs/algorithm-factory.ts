import { SRSAlgorithm as SM2Algorithm } from './algorithm'
import { TSFSRSWrapper } from './ts-fsrs-wrapper'
import { SRSAlgorithm, AlgorithmType } from './base-algorithm'

/**
 * Factory for creating SRS algorithm instances
 * Supports both SM-2 (legacy) and FSRS (modern via ts-fsrs library)
 *
 * **For pre-launch**: All new cards will use FSRS-5 by default via ts-fsrs library
 *
 * Why ts-fsrs?
 * - Battle-tested implementation used by Anki and RemNote
 * - Automatic updates to latest FSRS versions
 * - Zero maintenance of complex SRS mathematics
 * - 20-30% fewer reviews than SM-2
 */
export class AlgorithmFactory {
  /**
   * Create an algorithm instance by type
   * @param type - 'sm2' or 'fsrs'
   * @param config - Optional algorithm-specific configuration
   */
  static create(type: AlgorithmType, config?: any): SRSAlgorithm {
    switch (type) {
      case 'sm2':
        // Wrap existing SM-2 implementation to conform to interface
        const sm2 = new SM2Algorithm(config)
        return {
          calculateNextReview: (item, result) => {
            // Use existing SM-2 calculateNextReview method
            const updated = sm2.calculateNextReview(item, result)
            return { ...updated, algorithm: 'sm2' as const }
          },
          initializeCardSRS: (item) => {
            // Initialize with SM-2 algorithm
            return {
              interval: 0,
              easeFactor: 2.5,
              repetitions: 0,
              lastReviewedAt: null,
              nextReviewAt: new Date(),
              status: 'new',
              reviewCount: 0,
              correctCount: 0,
              streak: 0,
              bestStreak: 0,
              algorithm: 'sm2' as const
            }
          },
          shouldGraduate: (srsData) => {
            // SM-2 graduation logic: 2+ correct reviews
            return srsData.reviewCount >= 2 &&
                   srsData.correctCount / srsData.reviewCount >= 0.75
          },
          shouldMaster: (srsData) => {
            // SM-2 mastery logic: interval >= 21 days and 90%+ accuracy
            return srsData.interval >= 21 &&
                   srsData.correctCount / srsData.reviewCount >= 0.9
          }
        }

      case 'fsrs':
        // Use official ts-fsrs library (FSRS-5 with 19 parameters)
        return new TSFSRSWrapper(config)

      default:
        throw new Error(`Unknown algorithm type: ${type}`)
    }
  }

  /**
   * Get default algorithm for new users/cards
   *
   * **PRE-LAUNCH DEFAULT**: FSRS-5 via ts-fsrs library
   *
   * All new users at launch will get FSRS-5 by default.
   * This provides the best learning experience with 25-30% fewer reviews than SM-2.
   *
   * Benefits of ts-fsrs:
   * - Mathematically correct (no bugs)
   * - Automatic future updates (FSRS-6, FSRS-7)
   * - Battle-tested by millions of Anki users
   * - Zero maintenance burden
   */
  static getDefault(): SRSAlgorithm {
    return new TSFSRSWrapper()
  }

  /**
   * Get algorithm based on existing SRS data
   *
   * If srsData has algorithm field, use that.
   * Otherwise, infer from presence of FSRS-specific fields.
   * Fallback to SM-2 for backward compatibility.
   */
  static fromSRSData(srsData?: Partial<SRSData>): SRSAlgorithm {
    if (!srsData) {
      return AlgorithmFactory.getDefault()
    }

    // Explicit algorithm field
    if (srsData.algorithm) {
      return AlgorithmFactory.create(srsData.algorithm)
    }

    // Infer from FSRS-specific fields
    if (srsData.stability !== undefined || srsData.difficulty !== undefined) {
      return AlgorithmFactory.create('fsrs')
    }

    // Infer from SM-2 specific fields
    if (srsData.easeFactor !== undefined || srsData.repetitions !== undefined) {
      return AlgorithmFactory.create('sm2')
    }

    // Default for new cards
    return AlgorithmFactory.getDefault()
  }
}

// Type guard to help with algorithm-specific logic
export function isFSRSData(srsData: SRSData): boolean {
  return srsData.algorithm === 'fsrs'
}

export function isSM2Data(srsData: SRSData): boolean {
  return srsData.algorithm === 'sm2'
}

// Re-export types for convenience
export type { SRSAlgorithm, AlgorithmType }

import type { SRSData } from '../core/interfaces'
