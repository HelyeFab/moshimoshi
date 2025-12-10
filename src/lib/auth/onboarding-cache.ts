// Onboarding Cache Service - Fast lookups for onboarding status
// Uses Redis caching with Firestore fallback (similar to tier-cache pattern)

import { redis } from '@/lib/redis/client'
import { getAdminDb } from '@/lib/firebase/admin'

export interface OnboardingData {
  completed: boolean
  completedAt: Date | null
  learningGoal: 'jlpt' | 'travel' | 'anime' | 'conversation' | null
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | null
}

const DEFAULT_ONBOARDING: OnboardingData = {
  completed: false,
  completedAt: null,
  learningGoal: null,
  experienceLevel: null,
}

/**
 * Onboarding Cache Service
 *
 * Provides fast lookups for user onboarding status to prevent
 * hitting Firestore on every page load. Uses 60-second TTL
 * to balance performance with freshness.
 */
class OnboardingCacheService {
  private readonly TTL = 60 // 60 seconds cache TTL
  private readonly CACHE_PREFIX = 'onboarding:'

  /**
   * Get onboarding status for a user
   * First checks Redis cache, then falls back to Firestore
   */
  async getOnboardingStatus(userId: string): Promise<OnboardingData> {
    if (!userId) {
      console.log('[OnboardingCache] No userId provided')
      return DEFAULT_ONBOARDING
    }

    try {
      // Try Redis cache first
      const cacheKey = `${this.CACHE_PREFIX}${userId}`
      const cached = await redis.get(cacheKey)

      if (cached) {
        console.log(`[OnboardingCache] Cache HIT for user ${userId}`)
        const data = typeof cached === 'string' ? JSON.parse(cached) : cached
        return {
          ...DEFAULT_ONBOARDING,
          ...data,
          completedAt: data.completedAt ? new Date(data.completedAt) : null,
        }
      }

      console.log(`[OnboardingCache] Cache MISS for user ${userId}, fetching from Firestore`)

      // Fetch from Firestore
      const db = getAdminDb()
      const userDoc = await db.collection('users').doc(userId).get()
      const userData = userDoc.data()

      if (!userDoc.exists || !userData) {
        console.log(`[OnboardingCache] User ${userId} not found, returning default`)
        // Cache the default to prevent repeated Firestore lookups
        await this.cacheOnboardingData(userId, DEFAULT_ONBOARDING)
        return DEFAULT_ONBOARDING
      }

      // Extract onboarding data
      const onboardingData: OnboardingData = {
        completed: userData.onboarding?.completed ?? false,
        completedAt: userData.onboarding?.completedAt?.toDate() ?? null,
        learningGoal: userData.onboarding?.learningGoal ?? null,
        experienceLevel: userData.onboarding?.experienceLevel ?? null,
      }

      // Cache the result
      await this.cacheOnboardingData(userId, onboardingData)
      console.log(`[OnboardingCache] Cached onboarding for user ${userId}`)

      return onboardingData
    } catch (error) {
      console.error(`[OnboardingCache] Error getting onboarding for user ${userId}:`, error)
      return DEFAULT_ONBOARDING
    }
  }

  /**
   * Check if user has completed onboarding (convenience method)
   */
  async hasCompletedOnboarding(userId: string): Promise<boolean> {
    const status = await this.getOnboardingStatus(userId)
    return status.completed
  }

  /**
   * Cache onboarding data in Redis
   */
  private async cacheOnboardingData(userId: string, data: OnboardingData): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${userId}`
      const cacheData = {
        ...data,
        completedAt: data.completedAt?.toISOString() ?? null,
      }
      await redis.setex(cacheKey, this.TTL, JSON.stringify(cacheData))
    } catch (error) {
      console.error(`[OnboardingCache] Error caching onboarding for user ${userId}:`, error)
    }
  }

  /**
   * Invalidate cached onboarding data (call when onboarding is completed)
   */
  async invalidate(userId: string): Promise<void> {
    if (!userId) return

    try {
      const cacheKey = `${this.CACHE_PREFIX}${userId}`
      await redis.del(cacheKey)
      console.log(`[OnboardingCache] Invalidated cache for user ${userId}`)
    } catch (error) {
      console.error(`[OnboardingCache] Error invalidating cache for user ${userId}:`, error)
    }
  }

  /**
   * Set onboarding as completed and cache immediately
   */
  async markCompleted(
    userId: string,
    data: {
      learningGoal: 'jlpt' | 'travel' | 'anime' | 'conversation'
      experienceLevel: 'beginner' | 'intermediate' | 'advanced'
    }
  ): Promise<void> {
    const onboardingData: OnboardingData = {
      completed: true,
      completedAt: new Date(),
      learningGoal: data.learningGoal,
      experienceLevel: data.experienceLevel,
    }

    // Update cache immediately for fast reads
    await this.cacheOnboardingData(userId, onboardingData)
    console.log(`[OnboardingCache] Marked onboarding complete for user ${userId}`)
  }
}

// Export singleton instance
export const onboardingCache = new OnboardingCacheService()
export default onboardingCache
