/**
 * IndexedDB Store for Gamification Data
 * Provides local persistence for all users (free tier)
 *
 * Database: "moshimoshi_gamification" v1
 * Store: "userGamification" (keyPath: userId)
 */

const DB_NAME = 'moshimoshi_gamification'
const DB_VERSION = 1
const STORE_NAME = 'userGamification'

export interface GamificationData {
  userId: string
  totalXP: number
  currentStreak: number
  bestStreak: number
  lastActivityDate: string | null
  unlockedAchievements: string[]
  achievementProgress: Record<string, number>
  sessionCount: number
  lastSyncedAt: string | null
  version: number
}

export class IndexedDBStore {
  private db: IDBDatabase | null = null

  /**
   * Open IndexedDB connection and create object store if needed
   */
  async open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'userId' })
          objectStore.createIndex('userId', 'userId', { unique: true })
          console.log('[IndexedDB] Created object store:', STORE_NAME)
        }
      }
    })
  }

  /**
   * Save gamification data for a user
   */
  async save(userId: string, data: GamificationData): Promise<void> {
    try {
      if (!this.db) await this.open()

      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
        const objectStore = transaction.objectStore(STORE_NAME)
        const request = objectStore.put(data)

        request.onsuccess = () => {
          console.log(`[IndexedDB] Saved data for user: ${userId}`)
          resolve()
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.handleQuotaExceeded()
      }
      throw error
    }
  }

  /**
   * Load gamification data for a user
   */
  async load(userId: string): Promise<GamificationData | null> {
    if (!this.db) await this.open()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.get(userId)

      request.onsuccess = () => {
        const data = request.result || null
        if (data) {
          console.log(`[IndexedDB] Loaded data for user: ${userId}`)
        }
        resolve(data)
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Clear gamification data for a specific user
   */
  async clear(userId: string): Promise<void> {
    if (!this.db) await this.open()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.delete(userId)

      request.onsuccess = () => {
        console.log(`[IndexedDB] Cleared data for user: ${userId}`)
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Clear all gamification data (for logout)
   */
  async clearAll(): Promise<void> {
    if (!this.db) await this.open()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const objectStore = transaction.objectStore(STORE_NAME)
      const request = objectStore.clear()

      request.onsuccess = () => {
        console.log('[IndexedDB] Cleared all gamification data')
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Handle quota exceeded errors
   */
  private handleQuotaExceeded(): void {
    console.error('[IndexedDB] Quota exceeded. Clearing old data...')
    // Could implement LRU eviction here in the future
    // For now, just log the error
  }
}

// Singleton instance
export const indexedDBStore = new IndexedDBStore()
