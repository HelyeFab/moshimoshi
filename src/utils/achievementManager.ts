/**
 * Achievement Manager
 * Handles achievement and streak data storage across localStorage and Firebase
 * Following the same pattern as preferencesManager.ts
 */

import { EventEmitter } from 'events'
import logger from '@/lib/logger'

export interface AchievementData {
  unlocked: string[] // Achievement IDs
  totalPoints: number
  totalXp: number // Total XP earned (moved from profile)
  currentLevel: string // Current level (moved from profile)
  lessonsCompleted: number // Lessons completed (moved from profile)
  lastUpdated: number
  statistics: {
    percentageComplete: number
    byCategory: Record<string, number>
  }
}

export interface ActivityData {
  dates: Record<string, boolean> // Daily activities for streak
  currentStreak: number
  bestStreak: number
  lastActivity: number
}

export interface AchievementSyncStatus {
  isSyncing: boolean
  lastSyncTime: number | null
  error: string | null
  pendingChanges: boolean
}

class AchievementManager extends EventEmitter {
  private static instance: AchievementManager
  private syncTimeout: NodeJS.Timeout | null = null
  private readonly SYNC_DELAY = 500 // ms - debounce delay
  private syncStatus: AchievementSyncStatus = {
    isSyncing: false,
    lastSyncTime: null,
    error: null,
    pendingChanges: false
  }

  private constructor() {
    super()
  }

  static getInstance(): AchievementManager {
    if (!AchievementManager.instance) {
      AchievementManager.instance = new AchievementManager()
    }
    return AchievementManager.instance
  }

  /**
   * Get sync status for UI indicators
   */
  getSyncStatus(): AchievementSyncStatus {
    return { ...this.syncStatus }
  }

  /**
   * Load achievement data with fallback chain: Firebase → localStorage → default
   */
  async loadAchievements(userId: string, isPremium: boolean): Promise<AchievementData> {
    try {
      // Premium users: Try Firebase first
      if (isPremium) {
        try {
          const firebaseData = await this.loadFromFirebase(userId, 'data')
          if (firebaseData) {
            // Update localStorage with Firebase data
            this.saveToLocalStorage(userId, 'achievements', firebaseData)
            return firebaseData as AchievementData
          }
        } catch (error) {
          console.warn('Failed to load achievements from Firebase:', error)
          this.syncStatus.error = 'Failed to sync with cloud'
        }
      }

      // Fall back to localStorage
      const localData = this.loadFromLocalStorage(userId, 'achievements')
      if (localData) {
        return localData as AchievementData
      }

      // Return default if nothing found
      return this.getDefaultAchievements()
    } finally {
      this.emit('sync.status', this.syncStatus)
    }
  }

  /**
   * Load activity/streak data with fallback chain
   */
  async loadActivities(userId: string, isPremium: boolean): Promise<ActivityData> {
    logger.achievement('loadActivities called', { userId, isPremium })

    try {
      // Premium users: Try Firebase first
      if (isPremium) {
        try {
          logger.achievement('Attempting to load activities from Firebase API...')
          const firebaseData = await this.loadFromFirebase(userId, 'activities')
          logger.achievement('Firebase API response', firebaseData)

          if (firebaseData) {
            // Update localStorage with Firebase data
            logger.achievement('Saving Firebase data to localStorage')
            this.saveToLocalStorage(userId, 'activities', firebaseData)
            return firebaseData as ActivityData
          } else {
            logger.achievement('No data returned from Firebase API')
          }
        } catch (error) {
          console.warn('[AchievementManager] Failed to load activities from Firebase:', error)
          this.syncStatus.error = 'Failed to sync with cloud'
        }
      } else {
        logger.achievement('Not premium, skipping Firebase')
      }

      // Fall back to localStorage
      logger.achievement('Falling back to localStorage...')
      const localData = this.loadFromLocalStorage(userId, 'activities')
      logger.achievement('localStorage data', localData)

      if (localData) {
        return localData as ActivityData
      }

      // Return default if nothing found
      logger.achievement('No data found, returning defaults')
      return this.getDefaultActivities()
    } finally {
      this.emit('sync.status', this.syncStatus)
    }
  }

  /**
   * Save achievement data with dual storage strategy
   */
  async saveAchievements(
    userId: string,
    achievements: AchievementData,
    isPremium: boolean
  ): Promise<void> {
    // Always save to localStorage first (immediate)
    this.saveToLocalStorage(userId, 'achievements', achievements)

    // Queue Firebase sync for premium users (debounced)
    if (isPremium) {
      this.queueFirebaseSync(userId, 'data', achievements)
    }

    this.emit('achievements.saved', achievements)
  }

  /**
   * Save activity/streak data with dual storage strategy
   */
  async saveActivities(
    userId: string,
    activities: ActivityData,
    isPremium: boolean
  ): Promise<void> {
    // Always save to localStorage first (immediate)
    this.saveToLocalStorage(userId, 'activities', activities)

    // Queue Firebase sync for premium users (debounced)
    if (isPremium) {
      this.queueFirebaseSync(userId, 'activities', activities)
    }

    this.emit('activities.saved', activities)
  }

  /**
   * Queue Firebase sync with debouncing
   */
  private queueFirebaseSync(
    userId: string,
    docType: 'data' | 'activities',
    data: AchievementData | ActivityData
  ): void {
    // Clear existing timeout
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
    }

    // Mark as having pending changes
    this.syncStatus.pendingChanges = true
    this.emit('sync.status', this.syncStatus)

    // Set new timeout
    this.syncTimeout = setTimeout(() => {
      this.syncToFirebase(userId, docType, data)
    }, this.SYNC_DELAY)
  }

  /**
   * Sync to Firebase via API
   */
  private async syncToFirebase(
    userId: string,
    docType: 'data' | 'activities',
    data: AchievementData | ActivityData
  ): Promise<void> {
    try {
      this.syncStatus.isSyncing = true
      this.syncStatus.pendingChanges = false
      this.emit('sync.status', this.syncStatus)

      const endpoint = docType === 'data'
        ? '/api/achievements/data'
        : '/api/achievements/activities'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          lastUpdated: new Date().toISOString()
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to sync to Firebase: ${response.status}`)
      }

      const result = await response.json()
      if (!result.success) {
        throw new Error(result.error || 'Sync failed')
      }

      this.syncStatus.lastSyncTime = Date.now()
      this.syncStatus.error = null
      this.emit('sync.success', { docType, data })
    } catch (error) {
      console.error('Failed to sync to Firebase:', error)
      this.syncStatus.error = error instanceof Error ? error.message : 'Sync failed'
      this.emit('sync.error', error)
    } finally {
      this.syncStatus.isSyncing = false
      this.emit('sync.status', this.syncStatus)
    }
  }

  /**
   * Load from Firebase via API
   */
  private async loadFromFirebase(
    userId: string,
    docType: 'data' | 'activities'
  ): Promise<AchievementData | ActivityData | null> {
    try {
      const endpoint = docType === 'data'
        ? '/api/achievements/data'
        : '/api/achievements/activities'

      logger.api(`Fetching from ${endpoint}`)

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })

      logger.api(`API Response status: ${response.status}`)

      if (!response.ok) {
        if (response.status === 401) {
          console.warn('[AchievementManager] Unauthorized (401) - No session')
          return null
        }
        throw new Error(`Failed to load from Firebase: ${response.status}`)
      }

      const data = await response.json()
      logger.api('API returned data', data)

      // Handle error response
      if (data.error) {
        console.error('[AchievementManager] API returned error:', data.error)
        return null
      }

      return data as AchievementData | ActivityData
    } catch (error) {
      console.error('[AchievementManager] Error loading from Firebase:', error)
      throw error
    }
  }

  /**
   * Save to localStorage
   */
  private saveToLocalStorage(
    userId: string,
    key: 'achievements' | 'activities',
    data: AchievementData | ActivityData
  ): void {
    try {
      const storageKey = `${key}_${userId}`
      localStorage.setItem(storageKey, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save to localStorage:', error)
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromLocalStorage(
    userId: string,
    key: 'achievements' | 'activities'
  ): AchievementData | ActivityData | null {
    try {
      const storageKey = `${key}_${userId}`
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : null
    } catch (error) {
      console.error('Failed to load from localStorage:', error)
      return null
    }
  }

  /**
   * Get default achievement data
   */
  private getDefaultAchievements(): AchievementData {
    return {
      unlocked: [],
      totalPoints: 0,
      totalXp: 0,
      currentLevel: 'beginner',
      lessonsCompleted: 0,
      lastUpdated: Date.now(),
      statistics: {
        percentageComplete: 0,
        byCategory: {}
      }
    }
  }

  /**
   * Get default activity data
   */
  private getDefaultActivities(): ActivityData {
    return {
      dates: {},
      currentStreak: 0,
      bestStreak: 0,
      lastActivity: 0
    }
  }

  /**
   * Clear all achievement data (for logout)
   */
  clearCache(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
      this.syncTimeout = null
    }
    this.syncStatus = {
      isSyncing: false,
      lastSyncTime: null,
      error: null,
      pendingChanges: false
    }
  }

  /**
   * Force sync all pending changes
   */
  async forceSyncAll(userId: string, isPremium: boolean): Promise<void> {
    if (!isPremium) return

    try {
      // Load from localStorage
      const achievements = this.loadFromLocalStorage(userId, 'achievements')
      const activities = this.loadFromLocalStorage(userId, 'activities')

      // Sync to Firebase
      if (achievements) {
        await this.syncToFirebase(userId, 'data', achievements as AchievementData)
      }
      if (activities) {
        await this.syncToFirebase(userId, 'activities', activities as ActivityData)
      }

      this.emit('sync.forced', { userId })
    } catch (error) {
      console.error('Force sync failed:', error)
      throw error
    }
  }

  /**
   * Migrate existing localStorage data to new format
   */
  async migrateExistingData(userId: string, userProfile?: any): Promise<void> {
    try {
      // Check for old format data
      const oldAchievements = localStorage.getItem(`achievements_${userId}`)
      const oldActivities = localStorage.getItem(`activities_${userId}`)
      const bestStreak = localStorage.getItem(`bestStreak_${userId}`)

      if (oldAchievements) {
        // Parse and convert old achievement format
        const parsed = JSON.parse(oldAchievements)
        const newFormat: AchievementData = {
          unlocked: parsed.unlocked ? Array.from(parsed.unlocked) : [],
          totalPoints: parsed.totalPoints || 0,
          // Migrate from old profile fields if they exist
          totalXp: userProfile?.profile?.totalXp || parsed.totalXp || 0,
          currentLevel: userProfile?.profile?.currentLevel || parsed.currentLevel || 'beginner',
          lessonsCompleted: userProfile?.profile?.lessonsCompleted || parsed.lessonsCompleted || 0,
          lastUpdated: Date.now(),
          statistics: parsed.statistics || {
            percentageComplete: 0,
            byCategory: {}
          }
        }
        this.saveToLocalStorage(userId, 'achievements', newFormat)
      } else if (userProfile?.profile) {
        // No achievements but has old profile data - create new achievement data
        const newFormat: AchievementData = {
          unlocked: [],
          totalPoints: 0,
          totalXp: userProfile.profile.totalXp || 0,
          currentLevel: userProfile.profile.currentLevel || 'beginner',
          lessonsCompleted: userProfile.profile.lessonsCompleted || 0,
          lastUpdated: Date.now(),
          statistics: {
            percentageComplete: 0,
            byCategory: {}
          }
        }
        this.saveToLocalStorage(userId, 'achievements', newFormat)
      }

      if (oldActivities) {
        // Convert old activities format
        const dates = JSON.parse(oldActivities)
        const newFormat: ActivityData = {
          dates,
          currentStreak: userProfile?.profile?.currentStreak || 0, // Migrate from old profile
          bestStreak: parseInt(bestStreak || '0'),
          lastActivity: Date.now()
        }
        this.saveToLocalStorage(userId, 'activities', newFormat)
      } else if (userProfile?.profile?.currentStreak !== undefined) {
        // No activities but has streak in profile - create new activity data
        const newFormat: ActivityData = {
          dates: {},
          currentStreak: userProfile.profile.currentStreak || 0,
          bestStreak: parseInt(bestStreak || '0'),
          lastActivity: Date.now()
        }
        this.saveToLocalStorage(userId, 'activities', newFormat)
      }

      this.emit('migration.complete', { userId })
    } catch (error) {
      console.error('Migration failed:', error)
    }
  }
}

export const achievementManager = AchievementManager.getInstance()