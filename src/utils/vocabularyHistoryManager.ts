/**
 * Vocabulary Search History Manager
 * Manages search history for vocabulary searches with three-tier storage:
 * - Guest: No storage
 * - Free: localStorage only
 * - Premium: localStorage + Firebase sync
 */

import { reviewLogger } from '@/lib/monitoring/logger'

export interface SearchHistoryEntry {
  term: string
  timestamp: Date
  resultCount: number
  searchSource?: 'wanikani' | 'jmdict'
  deviceType?: 'mobile' | 'tablet' | 'desktop'
  clickedResults?: string[]
}

export interface SearchHistoryFirebaseEntry extends SearchHistoryEntry {
  userId: string
  syncedAt?: Date
}

export class VocabularyHistoryManager {
  private static instance: VocabularyHistoryManager
  private readonly STORAGE_KEY = 'vocabularySearchHistory'
  private readonly MAX_HISTORY_ITEMS = 50 // Store more for premium users
  private readonly MAX_LOCAL_ITEMS = 20 // Limit for local storage
  private syncTimeout: NodeJS.Timeout | null = null
  private readonly SYNC_DELAY = 1000 // 1 second delay for batching

  /**
   * Get singleton instance
   */
  static getInstance(): VocabularyHistoryManager {
    if (!this.instance) {
      this.instance = new VocabularyHistoryManager()
    }
    return this.instance
  }

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get device type for tracking
   */
  private getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    if (typeof window === 'undefined') return 'desktop'

    const width = window.innerWidth
    if (width < 768) return 'mobile'
    if (width < 1024) return 'tablet'
    return 'desktop'
  }

  /**
   * Save search to history
   */
  async saveSearch(
    term: string,
    resultCount: number,
    searchSource: 'wanikani' | 'jmdict',
    user: any | null,
    isPremium: boolean
  ): Promise<void> {
    // Don't save for guest users
    if (!user) {
      reviewLogger.info('[VocabularyHistory] Skipping save for guest user')
      return
    }

    const entry: SearchHistoryEntry = {
      term,
      timestamp: new Date(),
      resultCount,
      searchSource,
      deviceType: this.getDeviceType()
    }

    // Save to localStorage for all authenticated users
    this.saveToLocalStorage(entry)

    // Premium users: Also sync to Firebase
    if (isPremium) {
      this.scheduleFirebaseSync(user.uid, entry)
    }
  }

  /**
   * Load search history
   */
  async loadHistory(
    user: any | null,
    isPremium: boolean
  ): Promise<SearchHistoryEntry[]> {
    // Guest users: No history
    if (!user) {
      return []
    }

    // Load from localStorage first
    let history = this.loadFromLocalStorage()

    // Premium users: Merge with Firebase data
    if (isPremium) {
      try {
        const firebaseHistory = await this.loadFromFirebase(user.uid)
        history = this.mergeHistories(history, firebaseHistory)
      } catch (error) {
        reviewLogger.error('[VocabularyHistory] Failed to load from Firebase:', error)
        // Fall back to local history on error
      }
    }

    return history
  }

  /**
   * Clear all search history
   */
  async clearHistory(
    user: any | null,
    isPremium: boolean
  ): Promise<void> {
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY)
    }

    // Premium users: Also clear Firebase
    if (user && isPremium) {
      try {
        await this.clearFirebaseHistory(user.uid)
      } catch (error) {
        reviewLogger.error('[VocabularyHistory] Failed to clear Firebase history:', error)
      }
    }
  }

  /**
   * Save to localStorage
   */
  private saveToLocalStorage(entry: SearchHistoryEntry): void {
    if (typeof window === 'undefined') return

    try {
      const existing = this.loadFromLocalStorage()

      // Add new entry at the beginning
      existing.unshift(entry)

      // Limit to MAX_LOCAL_ITEMS
      const limited = existing.slice(0, this.MAX_LOCAL_ITEMS)

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(limited))
    } catch (error) {
      reviewLogger.error('[VocabularyHistory] Failed to save to localStorage:', error)
    }
  }

  /**
   * Load from localStorage
   */
  private loadFromLocalStorage(): SearchHistoryEntry[] {
    if (typeof window === 'undefined') return []

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (!stored) return []

      const parsed = JSON.parse(stored)
      // Convert timestamp strings back to Date objects
      return parsed.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }))
    } catch (error) {
      reviewLogger.error('[VocabularyHistory] Failed to load from localStorage:', error)
      return []
    }
  }

  /**
   * Schedule Firebase sync with debouncing
   */
  private scheduleFirebaseSync(userId: string, entry: SearchHistoryEntry): void {
    // Clear existing timeout
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
    }

    // Schedule new sync
    this.syncTimeout = setTimeout(async () => {
      try {
        await this.syncToFirebase(userId, entry)
      } catch (error) {
        reviewLogger.error('[VocabularyHistory] Firebase sync failed:', error)
      }
    }, this.SYNC_DELAY)
  }

  /**
   * Sync to Firebase via API
   */
  private async syncToFirebase(userId: string, entry: SearchHistoryEntry): Promise<void> {
    try {
      const response = await fetch('/api/vocabulary/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          entry: {
            ...entry,
            userId
          }
        })
      })

      if (!response.ok) {
        throw new Error(`Failed to sync: ${response.status}`)
      }

      reviewLogger.info('[VocabularyHistory] Synced to Firebase successfully')
    } catch (error) {
      reviewLogger.error('[VocabularyHistory] Firebase sync error:', error)
      throw error
    }
  }

  /**
   * Load from Firebase via API
   */
  private async loadFromFirebase(userId: string): Promise<SearchHistoryEntry[]> {
    try {
      const response = await fetch(`/api/vocabulary/history?limit=${this.MAX_HISTORY_ITEMS}`)

      if (!response.ok) {
        throw new Error(`Failed to load: ${response.status}`)
      }

      const data = await response.json()

      // Convert timestamps to Date objects
      return data.history.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }))
    } catch (error) {
      reviewLogger.error('[VocabularyHistory] Failed to load from Firebase:', error)
      throw error
    }
  }

  /**
   * Clear Firebase history via API
   */
  private async clearFirebaseHistory(userId: string): Promise<void> {
    try {
      const response = await fetch('/api/vocabulary/history', {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error(`Failed to clear: ${response.status}`)
      }

      reviewLogger.info('[VocabularyHistory] Firebase history cleared')
    } catch (error) {
      reviewLogger.error('[VocabularyHistory] Failed to clear Firebase history:', error)
      throw error
    }
  }

  /**
   * Merge local and Firebase histories
   */
  private mergeHistories(
    local: SearchHistoryEntry[],
    firebase: SearchHistoryEntry[]
  ): SearchHistoryEntry[] {
    const merged = new Map<string, SearchHistoryEntry>()

    // Create unique key for each entry
    const getKey = (entry: SearchHistoryEntry) =>
      `${entry.term}_${entry.timestamp.getTime()}`

    // Add Firebase entries first (authoritative source)
    firebase.forEach(entry => {
      merged.set(getKey(entry), entry)
    })

    // Add local entries that aren't in Firebase
    local.forEach(entry => {
      const key = getKey(entry)
      if (!merged.has(key)) {
        merged.set(key, entry)
      }
    })

    // Convert back to array and sort by timestamp (newest first)
    return Array.from(merged.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, this.MAX_HISTORY_ITEMS)
  }

  /**
   * Track when a search result is clicked (for analytics)
   */
  async trackResultClick(
    searchTerm: string,
    clickedWord: string,
    user: any | null,
    isPremium: boolean
  ): Promise<void> {
    if (!user || !isPremium) return

    try {
      // Find the most recent search for this term
      const history = this.loadFromLocalStorage()
      const recentSearch = history.find(h => h.term === searchTerm)

      if (recentSearch) {
        // Update with clicked result
        if (!recentSearch.clickedResults) {
          recentSearch.clickedResults = []
        }
        if (!recentSearch.clickedResults.includes(clickedWord)) {
          recentSearch.clickedResults.push(clickedWord)

          // Save updated history
          this.saveToLocalStorage(recentSearch)

          // Sync to Firebase for premium users
          if (isPremium) {
            await this.syncToFirebase(user.uid, recentSearch)
          }
        }
      }
    } catch (error) {
      reviewLogger.error('[VocabularyHistory] Failed to track click:', error)
    }
  }
}

// Export singleton instance
export const vocabularyHistoryManager = VocabularyHistoryManager.getInstance()