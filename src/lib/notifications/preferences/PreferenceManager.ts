/**
 * PreferenceManager
 * Manages user notification preferences with caching
 */

import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { reviewLogger } from '@/lib/monitoring/logger'
import {
  NotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationChannel
} from '../types/notifications.types'

/**
 * Preference cache entry
 */
interface PreferenceCacheEntry {
  preferences: NotificationPreferences
  timestamp: number
  userId: string
}

/**
 * PreferenceManager class
 */
export class PreferenceManager {
  private readonly COLLECTION_NAME = 'notifications_preferences'
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private cache: PreferenceCacheEntry | null = null
  private userId: string | null = null
  private unsubscribe: Unsubscribe | null = null

  /**
   * Initialize preference manager for a user
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId

    // Load preferences
    await this.loadPreferences()

    // Set up real-time listener
    this.setupRealtimeListener()

    reviewLogger.info('PreferenceManager initialized', { userId })
  }

  /**
   * Load user preferences
   */
  private async loadPreferences(): Promise<void> {
    if (!this.userId) return

    try {
      // Check cache first
      if (this.isCacheValid()) {
        reviewLogger.debug('Using cached preferences', {
          userId: this.userId,
          cacheAge: Date.now() - this.cache!.timestamp
        })
        return
      }

      // Load from Firestore
      const docRef = doc(db, this.COLLECTION_NAME, this.userId)
      const docSnap = await getDoc(docRef)

      let preferences: NotificationPreferences

      if (docSnap.exists()) {
        preferences = docSnap.data() as NotificationPreferences
        reviewLogger.info('Preferences loaded from Firestore', { userId: this.userId })
      } else {
        // Create default preferences
        preferences = {
          ...DEFAULT_NOTIFICATION_PREFERENCES,
          userId: this.userId,
          updated_at: new Date()
        }

        // Save default preferences
        await this.savePreferences(preferences)
        reviewLogger.info('Created default preferences', { userId: this.userId })
      }

      // Update cache
      this.updateCache(preferences)
    } catch (error) {
      reviewLogger.error('Failed to load preferences', error)

      // Fall back to defaults
      this.updateCache({
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        userId: this.userId,
        updated_at: new Date()
      })
    }
  }

  /**
   * Set up real-time listener for preference changes
   */
  private setupRealtimeListener(): void {
    if (!this.userId) return

    const docRef = doc(db, this.COLLECTION_NAME, this.userId)

    this.unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const preferences = snapshot.data() as NotificationPreferences
          this.updateCache(preferences)

          reviewLogger.info('Preferences updated via realtime listener', {
            userId: this.userId
          })
        }
      },
      (error) => {
        reviewLogger.error('Realtime listener error', error)
      }
    )
  }

  /**
   * Get user preferences
   */
  async getPreferences(): Promise<NotificationPreferences | null> {
    if (!this.userId) {
      reviewLogger.warn('Cannot get preferences without userId')
      return null
    }

    // Check if cache is valid
    if (!this.isCacheValid()) {
      await this.loadPreferences()
    }

    return this.cache?.preferences || null
  }

  /**
   * Update user preferences
   */
  async updatePreferences(updates: Partial<NotificationPreferences>): Promise<void> {
    if (!this.userId) {
      reviewLogger.warn('Cannot update preferences without userId')
      return
    }

    try {
      const currentPrefs = await this.getPreferences()
      if (!currentPrefs) return

      const updatedPrefs: NotificationPreferences = {
        ...currentPrefs,
        ...updates,
        updated_at: new Date()
      }

      // Save to Firestore
      await this.savePreferences(updatedPrefs)

      // Update cache
      this.updateCache(updatedPrefs)

      reviewLogger.info('Preferences updated', {
        userId: this.userId,
        changes: Object.keys(updates)
      })
    } catch (error) {
      reviewLogger.error('Failed to update preferences', error)
      throw error
    }
  }

  /**
   * Save preferences to Firestore
   */
  private async savePreferences(preferences: NotificationPreferences): Promise<void> {
    if (!this.userId) return

    await setDoc(
      doc(db, this.COLLECTION_NAME, this.userId),
      preferences,
      { merge: true }
    )
  }

  /**
   * Check if user is in quiet hours
   */
  async isInQuietHours(): Promise<boolean> {
    const prefs = await this.getPreferences()
    if (!prefs || !prefs.quiet_hours.enabled) {
      return false
    }

    const now = new Date()
    const currentTime = now.getHours() * 60 + now.getMinutes() // Minutes since midnight

    const [startHour, startMin] = prefs.quiet_hours.start.split(':').map(Number)
    const [endHour, endMin] = prefs.quiet_hours.end.split(':').map(Number)

    const startTime = startHour * 60 + startMin
    const endTime = endHour * 60 + endMin

    if (startTime <= endTime) {
      // Quiet hours don't cross midnight
      return currentTime >= startTime && currentTime < endTime
    } else {
      // Quiet hours cross midnight
      return currentTime >= startTime || currentTime < endTime
    }
  }

  /**
   * Get quiet hours end time
   */
  async getQuietHoursEnd(): Promise<Date> {
    const prefs = await this.getPreferences()
    if (!prefs || !prefs.quiet_hours.enabled) {
      return new Date() // Return now if quiet hours are disabled
    }

    const now = new Date()
    const [endHour, endMin] = prefs.quiet_hours.end.split(':').map(Number)

    const endTime = new Date(now)
    endTime.setHours(endHour, endMin, 0, 0)

    // If end time has already passed today, set it for tomorrow
    if (endTime <= now) {
      endTime.setDate(endTime.getDate() + 1)
    }

    return endTime
  }

  /**
   * Check if a specific channel is enabled
   */
  async isChannelEnabled(channel: NotificationChannel): Promise<boolean> {
    const prefs = await this.getPreferences()
    return prefs?.channels[channel] || false
  }

  /**
   * Get all enabled channels
   */
  async getEnabledChannels(): Promise<NotificationChannel[]> {
    const prefs = await this.getPreferences()
    if (!prefs) return []

    return Object.entries(prefs.channels)
      .filter(([_, enabled]) => enabled)
      .map(([channel]) => channel as NotificationChannel)
  }

  /**
   * Enable or disable a channel
   */
  async setChannelEnabled(channel: NotificationChannel, enabled: boolean): Promise<void> {
    const prefs = await this.getPreferences()
    if (!prefs) return

    await this.updatePreferences({
      channels: {
        ...prefs.channels,
        [channel]: enabled
      }
    })

    reviewLogger.info('Channel preference updated', {
      channel,
      enabled,
      userId: this.userId
    })
  }

  /**
   * Set quiet hours
   */
  async setQuietHours(enabled: boolean, start?: string, end?: string): Promise<void> {
    const prefs = await this.getPreferences()
    if (!prefs) return

    const updates: Partial<NotificationPreferences> = {
      quiet_hours: {
        ...prefs.quiet_hours,
        enabled
      }
    }

    if (start) {
      updates.quiet_hours!.start = start
    }

    if (end) {
      updates.quiet_hours!.end = end
    }

    await this.updatePreferences(updates)

    reviewLogger.info('Quiet hours updated', {
      enabled,
      start: start || prefs.quiet_hours.start,
      end: end || prefs.quiet_hours.end,
      userId: this.userId
    })
  }

  /**
   * Set batching configuration
   */
  async setBatching(enabled: boolean, windowMinutes?: number): Promise<void> {
    const prefs = await this.getPreferences()
    if (!prefs) return

    const updates: Partial<NotificationPreferences> = {
      batching: {
        enabled,
        window_minutes: windowMinutes || prefs.batching.window_minutes
      }
    }

    await this.updatePreferences(updates)

    reviewLogger.info('Batching preferences updated', {
      enabled,
      windowMinutes: windowMinutes || prefs.batching.window_minutes,
      userId: this.userId
    })
  }

  /**
   * Reset preferences to defaults
   */
  async resetToDefaults(): Promise<void> {
    if (!this.userId) return

    const defaults: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      userId: this.userId,
      updated_at: new Date()
    }

    await this.savePreferences(defaults)
    this.updateCache(defaults)

    reviewLogger.info('Preferences reset to defaults', { userId: this.userId })
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.cache) return false
    if (this.cache.userId !== this.userId) return false

    const age = Date.now() - this.cache.timestamp
    return age < this.CACHE_TTL
  }

  /**
   * Update cache
   */
  private updateCache(preferences: NotificationPreferences): void {
    this.cache = {
      preferences,
      timestamp: Date.now(),
      userId: this.userId!
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache = null
  }

  /**
   * Export preferences (for debugging/backup)
   */
  async exportPreferences(): Promise<NotificationPreferences | null> {
    return await this.getPreferences()
  }

  /**
   * Import preferences
   */
  async importPreferences(preferences: Partial<NotificationPreferences>): Promise<void> {
    await this.updatePreferences(preferences)
  }

  /**
   * Get preference statistics
   */
  async getStatistics(): Promise<any> {
    const prefs = await this.getPreferences()
    if (!prefs) return null

    const enabledChannels = await this.getEnabledChannels()

    return {
      userId: this.userId,
      enabledChannels: enabledChannels.length,
      channels: prefs.channels,
      quietHoursEnabled: prefs.quiet_hours.enabled,
      batchingEnabled: prefs.batching.enabled,
      lastUpdated: prefs.updated_at
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    // Unsubscribe from realtime listener
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }

    // Clear cache
    this.cache = null
    this.userId = null

    reviewLogger.info('PreferenceManager cleanup complete')
  }
}