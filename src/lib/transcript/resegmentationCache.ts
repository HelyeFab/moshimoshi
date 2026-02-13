/**
 * Resegmentation Cache Service
 *
 * Persistent cache for AI resegmentation results keyed by
 * videoId + modelVersion + pipelineVersion.
 *
 * Uses Firestore following the same pattern as TranscriptCacheService.
 */

import { db } from '@/lib/firebase/admin'
import { prepareFirestoreData } from '@/lib/firebase/cleanFirestoreData'
import type { ResegmentedSegment } from './resegmentation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResegmentationCacheEntry {
  /** Composite key: `${videoId}:${modelVersion}:${pipelineVersion}` */
  id: string
  videoId: string
  modelVersion: string
  pipelineVersion: string
  source: 'deterministic' | 'ai'
  segments: ResegmentedSegment[]
  segmentCount: number
  createdAt: Date
  lastAccessed: Date
  accessCount: number
}

export interface ResegmentationCacheKey {
  videoId: string
  modelVersion: string
  pipelineVersion: string
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class ResegmentationCacheService {
  private readonly collection = 'resegmentationCache'

  /**
   * Build deterministic composite key.
   */
  static buildKey(key: ResegmentationCacheKey): string {
    return `${key.videoId}:${key.modelVersion}:${key.pipelineVersion}`
  }

  /**
   * Get cached resegmentation result.
   */
  async get(key: ResegmentationCacheKey): Promise<ResegmentationCacheEntry | null> {
    try {
      if (!db) return null

      const docId = ResegmentationCacheService.buildKey(key)
      const doc = await db.collection(this.collection).doc(docId).get()

      if (!doc.exists) return null

      const data = doc.data() as ResegmentationCacheEntry

      // Update access stats (fire-and-forget)
      this.touchAccessStats(docId).catch(() => {})

      return data
    } catch (error) {
      console.error('[ResegmentationCache] get error:', error)
      return null
    }
  }

  /**
   * Store resegmentation result.
   */
  async set(
    key: ResegmentationCacheKey,
    segments: ResegmentedSegment[],
    source: 'deterministic' | 'ai'
  ): Promise<boolean> {
    try {
      if (!db) {
        console.warn('[ResegmentationCache] Firebase not initialized, skipping cache write')
        return false
      }

      const docId = ResegmentationCacheService.buildKey(key)

      const entry: ResegmentationCacheEntry = {
        id: docId,
        videoId: key.videoId,
        modelVersion: key.modelVersion,
        pipelineVersion: key.pipelineVersion,
        source,
        segments,
        segmentCount: segments.length,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1,
      }

      await db
        .collection(this.collection)
        .doc(docId)
        .set(prepareFirestoreData(entry))

      console.log(
        `[ResegmentationCache] cached ${segments.length} segments for ${key.videoId} (${source})`
      )
      return true
    } catch (error) {
      console.error('[ResegmentationCache] set error:', error)
      return false
    }
  }

  /**
   * Check if a cache entry exists.
   */
  async has(key: ResegmentationCacheKey): Promise<boolean> {
    try {
      if (!db) return false

      const docId = ResegmentationCacheService.buildKey(key)
      const doc = await db.collection(this.collection).doc(docId).get()
      return doc.exists
    } catch (error) {
      console.error('[ResegmentationCache] has error:', error)
      return false
    }
  }

  /**
   * Delete a cache entry.
   */
  async delete(key: ResegmentationCacheKey): Promise<boolean> {
    try {
      if (!db) return false

      const docId = ResegmentationCacheService.buildKey(key)
      await db.collection(this.collection).doc(docId).delete()
      return true
    } catch (error) {
      console.error('[ResegmentationCache] delete error:', error)
      return false
    }
  }

  /**
   * Update access timestamp and counter (fire-and-forget).
   */
  private async touchAccessStats(docId: string): Promise<void> {
    try {
      if (!db) return

      const { FieldValue } = await import('firebase-admin/firestore')
      await db.collection(this.collection).doc(docId).update({
        lastAccessed: new Date(),
        accessCount: FieldValue.increment(1),
      })
    } catch {
      // Silently ignore – access stats are non-critical
    }
  }
}

// Export singleton
export const resegmentationCache = new ResegmentationCacheService()
export { ResegmentationCacheService }
