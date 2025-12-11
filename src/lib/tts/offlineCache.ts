/**
 * Client-side TTS Cache for Offline Support
 * Complements the existing server-side cache with IndexedDB storage
 */

export interface OfflineTTSCacheEntry {
  id: string
  textHash: string
  text: string
  provider: string
  voice: string
  speed: number
  audioBlob: Blob
  mimeType: string
  size: number
  duration: number
  createdAt: Date
  lastAccessed: Date
  accessCount: number
}

export interface OfflineTTSCacheOptions {
  maxSize: number // Maximum cache size in bytes (default: 50MB for news/stories)
  maxAge: number // Maximum age in milliseconds (default: 7 days)
  maxEntries: number // Maximum number of entries (default: 500)
}

const DEFAULT_OPTIONS: OfflineTTSCacheOptions = {
  maxSize: 50 * 1024 * 1024, // 50MB
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxEntries: 500,
}

export class OfflineTTSCache {
  private static instance: OfflineTTSCache | null = null
  private options: OfflineTTSCacheOptions
  private dbName = 'moshimoshi-tts-offline'
  private storeName = 'tts_offline'
  private dbVersion = 1
  private dbPromise: Promise<IDBDatabase> | null = null
  private _isPersisted: boolean | null = null
  private _persistenceChecked = false

  private constructor(options: Partial<OfflineTTSCacheOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
  }

  static getInstance(options: Partial<OfflineTTSCacheOptions> = {}): OfflineTTSCache {
    if (!OfflineTTSCache.instance) {
      OfflineTTSCache.instance = new OfflineTTSCache(options)
    }
    return OfflineTTSCache.instance
  }

  /**
   * Check if persistent storage is available and enabled
   */
  get isPersisted(): boolean | null {
    return this._isPersisted
  }

  /**
   * Check if Storage API is supported
   */
  get isStorageSupported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.storage?.persist
  }

  /**
   * Request persistent storage from the browser
   * Returns true if granted, false otherwise
   */
  async requestPersistence(): Promise<boolean> {
    if (!this.isStorageSupported) {
      console.log('[OfflineTTSCache] Storage API not supported')
      return false
    }

    try {
      const granted = await navigator.storage.persist()
      this._isPersisted = granted
      console.log(`[OfflineTTSCache] Persistent storage: ${granted ? 'granted' : 'denied'}`)
      return granted
    } catch (error) {
      console.warn('[OfflineTTSCache] Failed to request persistence:', error)
      this._isPersisted = false
      return false
    }
  }

  /**
   * Check current persistence status without requesting
   */
  async checkPersistence(): Promise<boolean> {
    if (!this.isStorageSupported) return false

    try {
      this._isPersisted = await navigator.storage.persisted()
      this._persistenceChecked = true
      return this._isPersisted
    } catch (error) {
      console.warn('[OfflineTTSCache] Failed to check persistence:', error)
      return false
    }
  }

  /**
   * Get storage quota information
   */
  async getStorageEstimate(): Promise<{
    usage: number
    quota: number
    percentUsed: number
  } | null> {
    if (!this.isStorageSupported || !navigator.storage.estimate) return null

    try {
      const estimate = await navigator.storage.estimate()
      const usage = estimate.usage || 0
      const quota = estimate.quota || 0
      return {
        usage,
        quota,
        percentUsed: quota > 0 ? (usage / quota) * 100 : 0,
      }
    } catch (error) {
      console.warn('[OfflineTTSCache] Failed to get storage estimate:', error)
      return null
    }
  }

  /**
   * Generate a cache key from TTS parameters
   */
  private async generateCacheKey(
    text: string,
    provider: string,
    voice: string,
    speed: number,
    pitch: number = 0,
    volume: number = 1
  ): Promise<string> {
    const normalizedText = text.trim().toLowerCase()
    const keyString = `${normalizedText}|${provider}|${voice}|${speed}|${pitch}|${volume}`
    return this.hashString(keyString)
  }

  /**
   * Hash function for cache keys
   */
  private async hashString(str: string): Promise<string> {
    const encoder = new TextEncoder()
    const data = encoder.encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  /**
   * Check if audio is cached offline
   */
  async has(
    text: string,
    provider: string,
    voice: string,
    speed: number,
    pitch: number = 0,
    volume: number = 1
  ): Promise<boolean> {
    try {
      const textHash = await this.generateCacheKey(text, provider, voice, speed, pitch, volume)
      const db = await this.getDatabase()
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('textHash')
      const result = await this.promisifyRequest(index.get(textHash))
      return !!result
    } catch (error) {
      console.warn('[OfflineTTSCache] Error checking cache:', error)
      return false
    }
  }

  /**
   * Get cached audio blob and return blob URL
   */
  async get(
    text: string,
    provider: string,
    voice: string,
    speed: number,
    pitch: number = 0,
    volume: number = 1
  ): Promise<{ audioUrl: string; cached: true } | null> {
    try {
      const textHash = await this.generateCacheKey(text, provider, voice, speed, pitch, volume)
      const db = await this.getDatabase()
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('textHash')
      const entry = (await this.promisifyRequest(
        index.get(textHash)
      )) as OfflineTTSCacheEntry | null

      if (entry) {
        // Update access tracking
        entry.lastAccessed = new Date()
        entry.accessCount += 1
        await this.promisifyRequest(store.put(entry))

        // Create blob URL for the cached audio
        const audioUrl = URL.createObjectURL(entry.audioBlob)
        console.log(`[OfflineTTSCache] Cache HIT for: "${text.substring(0, 30)}..."`)

        return { audioUrl, cached: true }
      } else {
        console.log(`[OfflineTTSCache] Cache MISS for: "${text.substring(0, 30)}..."`)
        return null
      }
    } catch (error) {
      console.warn('[OfflineTTSCache] Error getting cache entry:', error)
      return null
    }
  }

  /**
   * Store audio from URL response in offline cache
   */
  async set(
    text: string,
    provider: string,
    voice: string,
    speed: number,
    audioUrl: string,
    duration: number = 0,
    pitch: number = 0,
    volume: number = 1
  ): Promise<void> {
    try {
      // Download the audio data
      const response = await fetch(audioUrl)
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.status}`)
      }

      const audioBlob = await response.blob()
      const textHash = await this.generateCacheKey(text, provider, voice, speed, pitch, volume)
      const now = new Date()

      const entry: OfflineTTSCacheEntry = {
        id: this.generateId(),
        textHash,
        text,
        provider,
        voice,
        speed,
        audioBlob,
        mimeType: audioBlob.type || 'audio/mpeg',
        size: audioBlob.size,
        duration,
        createdAt: now,
        lastAccessed: now,
        accessCount: 1,
      }

      // Check if we need to make space
      await this.ensureSpace(entry.size)

      const db = await this.getDatabase()
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      await this.promisifyRequest(store.put(entry))

      console.log(
        `[OfflineTTSCache] Cached: "${text.substring(0, 30)}..." (${(entry.size / 1024).toFixed(1)}KB)`
      )
    } catch (error) {
      console.warn('[OfflineTTSCache] Error storing cache entry:', error)
    }
  }

  /**
   * Clear old entries to make space
   */
  private async ensureSpace(newEntrySize: number): Promise<void> {
    try {
      const stats = await this.getCacheStats()

      // Check if we need to free space
      if (
        stats.totalSize + newEntrySize > this.options.maxSize ||
        stats.entryCount >= this.options.maxEntries
      ) {
        const entriesToRemove = Math.max(1, Math.floor(stats.entryCount * 0.1)) // Remove 10%
        await this.evictLRU(entriesToRemove)
      }

      // Clean up old entries
      await this.cleanupOldEntries()
    } catch (error) {
      console.warn('[OfflineTTSCache] Error ensuring space:', error)
    }
  }

  /**
   * Remove least recently used entries
   */
  private async evictLRU(count: number): Promise<void> {
    try {
      const db = await this.getDatabase()
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const index = store.index('lastAccessed')

      // Get oldest entries
      const entries: OfflineTTSCacheEntry[] = []
      const request = index.openCursor()

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = event => {
          const cursor = (event.target as IDBRequest).result
          if (cursor && entries.length < count) {
            entries.push(cursor.value)
            cursor.continue()
          } else {
            resolve()
          }
        }
        request.onerror = () => reject(request.error)
      })

      // Remove them
      for (const entry of entries) {
        await this.promisifyRequest(store.delete(entry.id))
        console.log(`[OfflineTTSCache] Evicted: "${entry.text.substring(0, 30)}..."`)
      }
    } catch (error) {
      console.warn('[OfflineTTSCache] Error during LRU eviction:', error)
    }
  }

  /**
   * Remove entries older than maxAge
   */
  private async cleanupOldEntries(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - this.options.maxAge)
      const db = await this.getDatabase()
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)

      const allEntries = (await this.promisifyRequest(store.getAll())) as OfflineTTSCacheEntry[]
      let deletedCount = 0

      for (const entry of allEntries) {
        if (entry.createdAt < cutoffTime) {
          await this.promisifyRequest(store.delete(entry.id))
          deletedCount++
        }
      }

      if (deletedCount > 0) {
        console.log(`[OfflineTTSCache] Cleaned up ${deletedCount} old entries`)
      }
    } catch (error) {
      console.warn('[OfflineTTSCache] Error during cleanup:', error)
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    entryCount: number
    totalSize: number
    oldestEntry?: Date
    newestEntry?: Date
  }> {
    try {
      const db = await this.getDatabase()
      const transaction = db.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const allEntries = (await this.promisifyRequest(store.getAll())) as OfflineTTSCacheEntry[]

      const totalSize = allEntries.reduce((sum, entry) => sum + entry.size, 0)
      const dates = allEntries.map(entry => entry.createdAt)

      return {
        entryCount: allEntries.length,
        totalSize,
        oldestEntry:
          dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : undefined,
        newestEntry:
          dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : undefined,
      }
    } catch (error) {
      console.warn('[OfflineTTSCache] Error getting cache stats:', error)
      return { entryCount: 0, totalSize: 0 }
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const db = await this.getDatabase()
      const transaction = db.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      await this.promisifyRequest(store.clear())
      console.log('[OfflineTTSCache] Cache cleared')
    } catch (error) {
      console.warn('[OfflineTTSCache] Error clearing cache:', error)
    }
  }

  /**
   * Get database instance
   */
  private async getDatabase(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' })
          store.createIndex('textHash', 'textHash', { unique: false })
          store.createIndex('lastAccessed', 'lastAccessed', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
          console.log('[OfflineTTSCache] Created offline TTS cache store')
        }
      }
    })

    // Check persistence status on first init (fire-and-forget)
    if (!this._persistenceChecked) {
      this.checkPersistence().catch(() => {})
    }

    return this.dbPromise
  }

  /**
   * Convert IDBRequest to Promise
   */
  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `tts-offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
