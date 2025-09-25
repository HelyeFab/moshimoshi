/**
 * Universal Progress Manager
 * Base class for tracking progress across all content types
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { reviewLogger } from '@/lib/monitoring/logger'
import {
  ProgressEvent,
  ProgressStatus,
  ReviewProgressData,
  ProgressUpdate,
  BatchProgressUpdate,
  ProgressEventMetadata,
  ProgressSessionSummary
} from '../core/progress.types'
import {
  ReviewHistoryEntry,
  ReviewHistoryBatch
} from '../core/review-history.types'
import { getKanaById } from '@/data/kanaData'
import { xpSystem } from '@/lib/gamification/xp-system'

/**
 * IndexedDB schema for progress storage
 */
interface ProgressDBSchema extends DBSchema {
  progress: {
    key: number
    value: {
      id?: number
      userId: string
      contentType: string
      contentId: string
      compositeKey: string // Format: "userId:contentType:contentId"
      data: ReviewProgressData
      updatedAt: Date
      syncedAt?: Date
    }
    indexes: {
      'by-user': string
      'by-content-type': string
      'by-composite-key': string // Composite key string
      'by-sync': Date
    }
  }
  sessions: {
    key: number
    value: {
      id?: number
      sessionId: string
      userId: string
      data: ProgressSessionSummary
      syncedAt?: Date
    }
    indexes: {
      'by-session': string
      'by-user': string
    }
  }
  syncQueue: {
    key: number
    value: {
      id?: number
      type: 'progress' | 'session'
      userId: string
      contentType: string
      data: any
      timestamp: number
      retryCount: number
      status: 'pending' | 'syncing' | 'failed'
    }
    indexes: {
      'by-status': string
      'by-timestamp': number
    }
  }
}

/**
 * Base class for universal progress tracking
 */
export abstract class UniversalProgressManager<T extends ReviewProgressData = ReviewProgressData> {
  protected db: IDBPDatabase<ProgressDBSchema> | null = null
  protected dbName = 'moshimoshi-universal-progress'
  protected dbVersion = 2

  // Sync management
  protected syncTimeout: NodeJS.Timeout | null = null
  protected readonly SYNC_DELAY = 500 // ms
  protected pendingUpdates = new Map<string, Map<string, T>>()

  // Session tracking
  protected currentSession: ProgressSessionSummary | null = null

  // Review history management
  protected reviewHistoryQueue: ReviewHistoryEntry[] = []
  protected historyBatchTimeout: NodeJS.Timeout | null = null
  protected readonly HISTORY_BATCH_SIZE = 10
  protected readonly HISTORY_BATCH_DELAY = 1000 // ms

  /**
   * Initialize IndexedDB
   */
  protected async initDB(): Promise<void> {
    if (this.db) return

    try {
      this.db = await openDB<ProgressDBSchema>(this.dbName, this.dbVersion, {
        upgrade(db, oldVersion, newVersion, transaction) {
          // Handle upgrade from version 1 to version 2
          if (oldVersion < 2) {
            if (db.objectStoreNames.contains('progress')) {
              const progressStore = transaction.objectStore('progress')

              // Delete old composite index if it exists (from version 1)
              if (progressStore.indexNames.contains('by-composite')) {
                progressStore.deleteIndex('by-composite')
              }

              // Create new composite key index
              if (!progressStore.indexNames.contains('by-composite-key')) {
                progressStore.createIndex('by-composite-key', 'compositeKey', {
                  unique: true
                })
              }
            }
          }

          // Create stores if they don't exist
          if (!db.objectStoreNames.contains('progress')) {
            const progressStore = db.createObjectStore('progress', {
              keyPath: 'id',
              autoIncrement: true
            })
            progressStore.createIndex('by-user', 'userId')
            progressStore.createIndex('by-content-type', 'contentType')
            progressStore.createIndex('by-composite-key', 'compositeKey', {
              unique: true
            })
            progressStore.createIndex('by-sync', 'syncedAt')
          }

          // Sessions store
          if (!db.objectStoreNames.contains('sessions')) {
            const sessionsStore = db.createObjectStore('sessions', {
              keyPath: 'id',
              autoIncrement: true
            })
            sessionsStore.createIndex('by-session', 'sessionId', { unique: true })
            sessionsStore.createIndex('by-user', 'userId')
          }

          // Sync queue store
          if (!db.objectStoreNames.contains('syncQueue')) {
            const syncStore = db.createObjectStore('syncQueue', {
              keyPath: 'id',
              autoIncrement: true
            })
            syncStore.createIndex('by-status', 'status')
            syncStore.createIndex('by-timestamp', 'timestamp')
          }
        }
      })

      reviewLogger.info('[UniversalProgressManager] Database initialized')
    } catch (error) {
      reviewLogger.error('[UniversalProgressManager] Failed to initialize database:', error)
      throw error
    }
  }

  /**
   * Track a progress event
   */
  async trackProgress(
    contentType: string,
    contentId: string,
    event: ProgressEvent,
    user: any | null,  // Accept any user object with uid property
    isPremium: boolean,
    metadata?: Partial<ProgressEventMetadata>
  ): Promise<void> {
    // Guest users: no storage
    if (!user) {
      reviewLogger.debug('[UniversalProgressManager] Guest user - no storage')
      return
    }

    // Check if uid is in a different property
    const userId = user.uid || (user as any).userId || (user as any).id

    if (!userId) {
      reviewLogger.error('[UniversalProgressManager] User object has no uid/userId/id:', {
        user,
        keys: Object.keys(user),
        values: Object.entries(user).slice(0, 5) // Show first 5 key-value pairs
      })
      return
    }

    // Debug logging
    reviewLogger.info('[UniversalProgressManager] trackProgress called:', {
      hasUser: !!user,
      userUid: user?.uid,
      userType: typeof user,
      userKeys: user ? Object.keys(user) : [],
      userKeysDetail: user ? Object.keys(user).map(k => `${k}: ${typeof (user as any)[k]}`) : [],
      userObject: user,
      contentType,
      contentId,
      event
    })

    // Get or create progress data
    let progress = await this.getProgressItem(userId, contentType, contentId)

    if (!progress) {
      progress = this.createInitialProgress(contentId, contentType) as T
    }

    // Update progress based on event
    progress = this.updateProgressForEvent(progress, event, metadata)

    // Save to storage
    await this.saveProgress(userId, contentType, contentId, progress, isPremium)

    // Track session if applicable
    if (this.currentSession && event !== ProgressEvent.SESSION_START) {
      this.updateSessionForEvent(contentId, event)
    }

    // Add to review history (for premium users)
    if (isPremium) {
      await this.trackReviewHistory(
        userId,
        contentType,
        contentId,
        event,
        isPremium,
        metadata
      )
    }

    // Track XP for completed reviews
    if (event === ProgressEvent.COMPLETED) {
      await this.trackXPForReview(userId, contentType, contentId, metadata)
    }
  }

  /**
   * Create initial progress data
   */
  protected createInitialProgress(contentId: string, contentType: string): T {
    const now = new Date()
    return {
      contentId,
      contentType,
      status: 'not-started',
      viewCount: 0,
      interactionCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      accuracy: 0,
      streak: 0,
      bestStreak: 0,
      pinned: false,
      bookmarked: false,
      flaggedForReview: false,
      createdAt: now,
      updatedAt: now
    } as T
  }

  /**
   * Update progress based on event
   */
  protected updateProgressForEvent(
    progress: T,
    event: ProgressEvent,
    metadata?: Partial<ProgressEventMetadata>
  ): T {
    const updated = { ...progress }
    const now = new Date()

    switch (event) {
      case ProgressEvent.VIEWED:
        updated.viewCount++
        updated.lastViewedAt = now
        if (!updated.firstViewedAt) {
          updated.firstViewedAt = now
          updated.status = 'viewing'
        }
        break

      case ProgressEvent.INTERACTED:
        updated.interactionCount++
        updated.lastInteractedAt = now
        if (updated.status === 'viewing' || updated.status === 'not-started') {
          updated.status = 'learning'
        }
        break

      case ProgressEvent.COMPLETED:
        if (metadata?.correct) {
          updated.correctCount++
          updated.streak++
          if (updated.streak > updated.bestStreak) {
            updated.bestStreak = updated.streak
          }
        } else {
          updated.incorrectCount++
          updated.streak = 0
        }
        // Recalculate accuracy
        const total = updated.correctCount + updated.incorrectCount
        updated.accuracy = total > 0 ? (updated.correctCount / total) * 100 : 0
        break

      case ProgressEvent.SKIPPED:
        // Just track that it was skipped
        break
    }

    updated.updatedAt = now
    return updated
  }

  /**
   * Save progress to storage
   */
  protected async saveProgress(
    userId: string,
    contentType: string,
    contentId: string,
    progress: T,
    isPremium: boolean
  ): Promise<void> {
    // Always save to IndexedDB first (for all authenticated users)
    await this.saveToIndexedDB(userId, contentType, contentId, progress)

    // ONLY premium users sync to Firebase
    if (isPremium) {
      reviewLogger.info('[UniversalProgressManager] Premium user - queuing Firebase sync')
      this.queueFirebaseSync(userId, contentType, contentId, progress)
    } else {
      reviewLogger.debug('[UniversalProgressManager] Free user - saved to IndexedDB only')
    }
  }

  /**
   * Remove undefined values from an object (Firebase doesn't accept undefined)
   */
  protected cleanForStorage(obj: any): any {
    if (obj === undefined || obj === null) return null
    if (obj instanceof Date) return obj
    if (typeof obj !== 'object') return obj
    if (Array.isArray(obj)) return obj.map(item => this.cleanForStorage(item))

    const cleaned: any = {}
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = this.cleanForStorage(value)
      }
    }
    return cleaned
  }

  /**
   * Save to IndexedDB
   */
  protected async saveToIndexedDB(
    userId: string,
    contentType: string,
    contentId: string,
    progress: T
  ): Promise<void> {
    await this.initDB()
    if (!this.db) {
      reviewLogger.error('[UniversalProgressManager] Database not initialized')
      return
    }

    try {
      // Clean the progress data to remove undefined values
      const cleanedProgress = this.cleanForStorage(progress)

      const compositeKey = `${userId}:${contentType}:${contentId}`
      const existing = await this.db.getFromIndex('progress', 'by-composite-key', compositeKey)

      if (existing) {
        await this.db.put('progress', {
          ...existing,
          data: cleanedProgress,
          updatedAt: new Date()
        })
      } else {
        await this.db.add('progress', {
          userId,
          contentType,
          contentId,
          compositeKey,
          data: cleanedProgress,
          updatedAt: new Date()
        })
      }

      reviewLogger.debug('[UniversalProgressManager] Saved to IndexedDB:', contentId)
    } catch (error) {
      reviewLogger.error('[UniversalProgressManager] Failed to save to IndexedDB:', error)
    }
  }

  /**
   * Queue Firebase sync with debouncing
   */
  protected queueFirebaseSync(
    userId: string,
    contentType: string,
    contentId: string,
    progress: T
  ): void {
    const updateKey = `${contentType}:${userId}`

    if (!this.pendingUpdates.has(updateKey)) {
      this.pendingUpdates.set(updateKey, new Map())
    }

    this.pendingUpdates.get(updateKey)!.set(contentId, progress)

    // Clear existing timeout
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout)
    }

    // Set new timeout for debounced update
    this.syncTimeout = setTimeout(() => {
      this.processPendingUpdates()
    }, this.SYNC_DELAY)
  }

  /**
   * Process pending Firebase updates
   */
  protected async processPendingUpdates(): Promise<void> {
    if (this.pendingUpdates.size === 0) return

    const updates = new Map(this.pendingUpdates)
    this.pendingUpdates.clear()

    for (const [key, items] of updates) {
      const [contentType, userId] = key.split(':')
      await this.syncToFirebase(userId, contentType, items)
    }
  }

  /**
   * Sync to Firebase via server API (Premium users only)
   */
  protected async syncToFirebase(
    userId: string,
    contentType: string,
    items: Map<string, T>
  ): Promise<void> {
    // This method should only be called for premium users
    // The API will verify premium status server-side
    try {
      // Convert Map to array for API
      const itemsArray = Array.from(items.entries())
      const reviewHistory = this.reviewHistoryQueue

      // Call server API to sync progress
      const response = await fetch('/api/progress/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contentType,
          items: itemsArray,
          reviewHistory: reviewHistory.length > 0 ? reviewHistory : undefined
        })
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      // Check if data was actually saved to Firebase
      if (result.storage?.location === 'local') {
        reviewLogger.info('[UniversalProgressManager] Free user - API stored locally only')
      } else if (result.storage?.location === 'both') {
        reviewLogger.info('[UniversalProgressManager] Premium user - synced to Firebase:', {
          contentType,
          itemsCount: result.itemsCount
        })
      }

      // Clear review history queue after successful sync
      if (reviewHistory.length > 0) {
        this.reviewHistoryQueue = []
      }
    } catch (error) {
      reviewLogger.error('[UniversalProgressManager] Failed to sync to Firebase via API:', error)
      // Add to sync queue for retry
      await this.addToSyncQueue(userId, contentType, items)
    }
  }

  /**
   * Add failed sync to queue for retry
   */
  protected async addToSyncQueue(
    userId: string,
    contentType: string,
    items: Map<string, T>
  ): Promise<void> {
    await this.initDB()
    if (!this.db) return

    try {
      await this.db.add('syncQueue', {
        type: 'progress',
        userId,
        contentType,
        data: Object.fromEntries(items),
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending'
      })
    } catch (error) {
      reviewLogger.error('[UniversalProgressManager] Failed to add to sync queue:', error)
    }
  }

  /**
   * Get progress for a specific item
   */
  protected async getProgressItem(
    userId: string,
    contentType: string,
    contentId: string
  ): Promise<T | null> {
    await this.initDB()
    if (!this.db) return null

    try {
      const compositeKey = `${userId}:${contentType}:${contentId}`
      const record = await this.db.getFromIndex('progress', 'by-composite-key', compositeKey)
      return record ? record.data : null
    } catch (error) {
      reviewLogger.error('[UniversalProgressManager] Failed to get progress item:', error)
      return null
    }
  }

  /**
   * Get all progress for a content type
   */
  async getProgress(
    userId: string,
    contentType: string,
    isPremium: boolean
  ): Promise<Map<string, T>> {
    const progressMap = new Map<string, T>()

    // Guest users: no storage
    if (!userId) return progressMap

    // Load from IndexedDB (for all authenticated users)
    const localData = await this.loadFromIndexedDB(userId, contentType)

    // ONLY premium users load from Firebase
    if (isPremium && navigator.onLine) {
      try {
        reviewLogger.info('[UniversalProgressManager] Premium user - loading from Firebase')
        const cloudData = await this.loadFromFirebase(userId, contentType)
        return this.mergeProgress(localData, cloudData)
      } catch (error) {
        reviewLogger.error('[UniversalProgressManager] Failed to load from Firebase:', error)
        return localData
      }
    } else {
      reviewLogger.debug('[UniversalProgressManager] Free user - using IndexedDB data only')
    }

    return localData
  }

  /**
   * Load from IndexedDB
   */
  protected async loadFromIndexedDB(
    userId: string,
    contentType: string
  ): Promise<Map<string, T>> {
    await this.initDB()
    if (!this.db) return new Map()

    try {
      const tx = this.db.transaction('progress', 'readonly')
      const index = tx.store.index('by-composite-key')
      const records = []

      // Get all records for this user and content type
      // The composite key format is "userId:contentType:contentId"
      const prefix = `${userId}:${contentType}:`
      let cursor = await index.openCursor(IDBKeyRange.bound(
        prefix,
        prefix + '\uffff'
      ))

      while (cursor) {
        records.push(cursor.value)
        cursor = await cursor.continue()
      }

      const progressMap = new Map<string, T>()
      for (const record of records) {
        progressMap.set(record.contentId, record.data)
      }

      return progressMap
    } catch (error) {
      reviewLogger.error('[UniversalProgressManager] Failed to load from IndexedDB:', error)
      return new Map()
    }
  }

  /**
   * Load from Firebase via server API
   */
  protected async loadFromFirebase(
    userId: string,
    contentType: string
  ): Promise<Map<string, T>> {
    try {
      // Call server API to get progress
      const response = await fetch(`/api/progress/track?contentType=${encodeURIComponent(contentType)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      const progressMap = new Map<string, T>()

      if (data.items) {
        for (const [contentId, progress] of Object.entries(data.items)) {
          progressMap.set(contentId, progress as T)
        }
      }

      reviewLogger.info('[UniversalProgressManager] Loaded from Firebase via API:', contentType, progressMap.size, 'items')
      return progressMap
    } catch (error) {
      reviewLogger.error('[UniversalProgressManager] Failed to load from Firebase via API:', error)
      return new Map()
    }
  }

  /**
   * Merge local and cloud progress data
   */
  protected mergeProgress(
    local: Map<string, T>,
    cloud: Map<string, T>
  ): Map<string, T> {
    const merged = new Map(local)

    for (const [contentId, cloudItem] of cloud) {
      const localItem = local.get(contentId)

      if (!localItem || cloudItem.updatedAt > localItem.updatedAt) {
        merged.set(contentId, cloudItem)
      }
    }

    return merged
  }

  /**
   * Start a new learning session
   */
  async startSession(
    userId: string,
    contentType: string,
    sessionId?: string,
    user?: any | null
  ): Promise<string> {
    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    this.currentSession = {
      sessionId: id,
      userId,
      contentType,
      startedAt: new Date(),
      duration: 0,
      itemsViewed: [],
      itemsInteracted: [],
      itemsCompleted: [],
      itemsSkipped: [],
      totalItems: 0,
      completionRate: 0,
      accuracy: 0,
      averageResponseTime: 0,
      completed: false,
      syncedToCloud: false
    }

    // Track session start event (only if we have a full user object)
    if (user) {
      await this.trackProgress(
        contentType,
        'session',
        ProgressEvent.SESSION_START,
        user,
        false,
        { sessionId: id }
      )
    }

    return id
  }

  /**
   * Update session for an event
   */
  protected updateSessionForEvent(contentId: string, event: ProgressEvent): void {
    if (!this.currentSession) return

    // Get actual content for kana types
    let actualContent = contentId;
    const contentType = this.currentSession.contentType;

    if (contentType === 'hiragana' || contentType === 'katakana') {
      const kanaChar = getKanaById(contentId);
      if (kanaChar) {
        actualContent = contentType === 'hiragana' ? kanaChar.hiragana : kanaChar.katakana;
      }
    }

    switch (event) {
      case ProgressEvent.VIEWED:
        if (!this.currentSession.itemsViewed.includes(actualContent)) {
          this.currentSession.itemsViewed.push(actualContent)
        }
        break
      case ProgressEvent.INTERACTED:
        if (!this.currentSession.itemsInteracted.includes(actualContent)) {
          this.currentSession.itemsInteracted.push(actualContent)
        }
        break
      case ProgressEvent.COMPLETED:
        if (!this.currentSession.itemsCompleted.includes(actualContent)) {
          this.currentSession.itemsCompleted.push(actualContent)
        }
        break
      case ProgressEvent.SKIPPED:
        if (!this.currentSession.itemsSkipped.includes(actualContent)) {
          this.currentSession.itemsSkipped.push(actualContent)
        }
        break
    }
  }

  /**
   * End the current session
   */
  async endSession(isPremium: boolean): Promise<ProgressSessionSummary | null> {
    if (!this.currentSession) return null

    const session = this.currentSession
    session.endedAt = new Date()
    session.duration = session.endedAt.getTime() - session.startedAt.getTime()
    session.completed = true
    session.totalItems = session.itemsViewed.length
    session.completionRate = session.totalItems > 0
      ? (session.itemsCompleted.length / session.totalItems) * 100
      : 0

    // Save session to storage
    await this.saveSession(session, isPremium)

    this.currentSession = null
    return session
  }

  /**
   * Save session to storage
   */
  protected async saveSession(session: ProgressSessionSummary, isPremium: boolean): Promise<void> {
    await this.initDB()
    if (!this.db) return

    try {
      // Save to IndexedDB
      await this.db.add('sessions', {
        sessionId: session.sessionId,
        userId: session.userId,
        data: session
      })

      // ONLY premium users sync to Firebase
      if (isPremium) {
        try {
          reviewLogger.info('[UniversalProgressManager] Premium user - syncing session to Firebase')

          // Transform session data to match API expectations
          const sessionData = {
            sessionType: 'study', // UniversalProgressManager handles study/practice sessions
            sessionId: session.sessionId,
            characters: session.itemsViewed.map(itemId => ({
              id: itemId,
              character: itemId, // Will be the actual character for kana
              romaji: '', // Could be enhanced with actual romaji
              script: session.contentType,
              correct: session.itemsCompleted.includes(itemId),
              attempts: 1,
              responseTime: 0
            })),
            stats: {
              totalItems: session.totalItems,
              correctItems: session.itemsCompleted.length,
              accuracy: session.accuracy || 0,
              avgResponseTime: 0,
              duration: session.duration
            },
            startedAt: session.startedAt.toISOString(),
            completedAt: session.endedAt?.toISOString() || new Date().toISOString()
          }

          const response = await fetch('/api/sessions/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify(sessionData)
          })

          if (response.ok) {
            const result = await response.json()
            if (result.storage?.location === 'both') {
              session.syncedToCloud = true
              reviewLogger.info('[UniversalProgressManager] Premium user - session synced to cloud:', session.sessionId)
            } else {
              reviewLogger.info('[UniversalProgressManager] Free user - session saved locally only')
            }
          } else {
            reviewLogger.error('[UniversalProgressManager] Failed to sync session, status:', response.status)
          }
        } catch (error) {
          reviewLogger.error('[UniversalProgressManager] Failed to sync session to cloud:', error)
        }
      } else {
        reviewLogger.info('[UniversalProgressManager] Free user - session saved to IndexedDB only')
      }
    } catch (error) {
      reviewLogger.error('[UniversalProgressManager] Failed to save session:', error)
    }
  }

  /**
   * Process sync queue (for offline recovery)
   */
  async processSyncQueue(): Promise<void> {
    await this.initDB()
    if (!this.db) return

    try {
      const tx = this.db.transaction('syncQueue', 'readwrite')
      const pending = await tx.store.index('by-status').getAll('pending')

      for (const item of pending) {
        if (item.type === 'progress') {
          const itemsMap = new Map(Object.entries(item.data))
          await this.syncToFirebase(item.userId, item.contentType, itemsMap)

          // Mark as completed
          if (item.id) {
            await this.db.delete('syncQueue', item.id)
          }
        }
      }
    } catch (error) {
      reviewLogger.error('[UniversalProgressManager] Failed to process sync queue:', error)
    }
  }

  /**
   * Track event in review history (Premium users only)
   */
  protected async trackReviewHistory(
    userId: string,
    contentType: string,
    contentId: string,
    event: ProgressEvent,
    isPremium: boolean,
    metadata?: Partial<ProgressEventMetadata>
  ): Promise<void> {
    // Only track review history for premium users
    if (!isPremium) {
      reviewLogger.debug('[UniversalProgressManager] Free user - skipping review history tracking')
      return
    }
    // Get actual content based on content type
    let actualContent = contentId; // Default to ID if not found

    if (contentType === 'hiragana' || contentType === 'katakana') {
      // For kana, get the actual character from the ID
      const kanaChar = getKanaById(contentId);
      if (kanaChar) {
        actualContent = contentType === 'hiragana' ? kanaChar.hiragana : kanaChar.katakana;
      }
    }
    // For other content types (kanji, vocabulary), the contentId is likely already the actual content

    // Create review history entry
    const entry: ReviewHistoryEntry = {
      userId,
      contentType,
      contentId,
      content: actualContent, // Now contains the actual character
      timestamp: new Date(),
      sessionId: this.currentSession?.sessionId,
      event,
      isPremium,
      deviceType: this.getDeviceType(),
      appVersion: '1.0.0' // TODO: Get from environment
    }

    // Only add optional fields if they have values (Firebase doesn't accept undefined)
    if (metadata?.correct !== undefined) {
      entry.correct = metadata.correct
    }
    if (metadata?.responseTime !== undefined) {
      entry.responseTime = metadata.responseTime
    }
    if (metadata?.interactionType !== undefined) {
      entry.interactionType = metadata.interactionType
    }

    // Add to batch queue
    this.reviewHistoryQueue.push(entry)

    // Process batch if it's full or schedule processing
    if (this.reviewHistoryQueue.length >= this.HISTORY_BATCH_SIZE) {
      await this.flushReviewHistory()
    } else {
      this.scheduleHistoryBatch()
    }
  }

  /**
   * Schedule batch processing of review history
   */
  protected scheduleHistoryBatch(): void {
    if (this.historyBatchTimeout) {
      clearTimeout(this.historyBatchTimeout)
    }

    this.historyBatchTimeout = setTimeout(() => {
      this.flushReviewHistory()
    }, this.HISTORY_BATCH_DELAY)
  }

  /**
   * Flush review history to Firebase
   */
  protected async flushReviewHistory(): Promise<void> {
    // Review history is now handled by the API during syncToFirebase
    // This method is kept for backward compatibility but does nothing
    // The review history queue is sent along with progress updates
    return
  }

  /**
   * Get device type
   */
  protected getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
    if (typeof window === 'undefined') return 'desktop'

    const width = window.innerWidth

    if (width < 768) return 'mobile'
    if (width < 1024) return 'tablet'
    return 'desktop'
  }

  /**
   * Query review history
   */
  async queryReviewHistory(
    userId: string,
    filters: {
      contentType?: string
      event?: ProgressEvent
      startDate?: Date
      endDate?: Date
      limit?: number
    } = {}
  ): Promise<ReviewHistoryEntry[]> {
    try {
      // Build query params
      const params = new URLSearchParams()
      if (filters.contentType) params.append('contentType', filters.contentType)
      if (filters.event) params.append('event', filters.event)
      if (filters.startDate) params.append('startDate', filters.startDate.toISOString())
      if (filters.endDate) params.append('endDate', filters.endDate.toISOString())
      if (filters.limit) params.append('limit', filters.limit.toString())

      const response = await fetch(`/api/review-history/query?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      return data.entries || []
    } catch (error) {
      reviewLogger.error('[UniversalProgressManager] Failed to query review history:', error)
      return []
    }
  }

  /**
   * Track XP for completed review items
   */
  protected async trackXPForReview(
    userId: string,
    contentType: string,
    contentId: string,
    metadata?: Partial<ProgressEventMetadata>
  ): Promise<void> {
    try {
      // Calculate XP based on review result
      const correct = metadata?.correct !== false // Default to correct if not specified
      const responseTime = metadata?.responseTime

      // Base XP values (matching xpCalculator.ts)
      let baseXP = correct ? 10 : 3

      // Apply content type multiplier
      const multipliers: Record<string, number> = {
        hiragana: 1.0,
        katakana: 1.0,
        kanji: 1.5,
        vocabulary: 1.2,
        sentence: 2.0
      }
      const multiplier = multipliers[contentType] || 1.0
      baseXP = Math.floor(baseXP * multiplier)

      // Speed bonus for fast responses (under 2 seconds)
      let bonusXP = 0
      if (correct && responseTime && responseTime < 2000) {
        bonusXP += 5
      }

      const totalXP = baseXP + bonusXP

      // Send XP to server with enhanced tracking
      const sessionId = this.currentSession?.sessionId || `review_${Date.now()}`
      const response = await fetch('/api/xp/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          eventType: 'review_completed',
          amount: totalXP,
          source: `Review: ${contentType} - ${contentId}`,
          metadata: {
            // Required tracking fields
            idempotencyKey: `review_${sessionId}_${contentId}`,
            feature: 'review',

            // Review details
            contentType,
            contentId,
            correct,
            responseTime,
            sessionId,

            // Performance metrics
            baseXP,
            bonusXP,
            multiplier
          }
        })
      })

      if (!response.ok) {
        reviewLogger.error('[UniversalProgressManager] Failed to track XP:', await response.text())
      } else {
        const result = await response.json()
        reviewLogger.debug('[UniversalProgressManager] XP tracked successfully:', result)

        // Store XP gained for UI display (to be picked up by review components)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('xpGained', {
            detail: {
              xpGained: totalXP,
              totalXP: result.data?.totalXP,
              leveledUp: result.data?.leveledUp,
              newLevel: result.data?.currentLevel
            }
          }))
        }
      }
    } catch (error) {
      // XP tracking failure shouldn't break the review flow
      reviewLogger.error('[UniversalProgressManager] Error tracking XP:', error)
    }
  }

  /**
   * Track XP for completed session
   */
  async trackSessionXP(sessionSummary: ProgressSessionSummary): Promise<void> {
    try {
      if (!sessionSummary || !sessionSummary.userId) return

      const accuracy = sessionSummary.stats?.accuracy || 0
      const itemsCompleted = sessionSummary.itemsCompleted || 0

      // Base XP for session completion
      let baseXP = itemsCompleted * 5
      let bonusXP = 0

      // Perfect session bonus
      if (accuracy === 100 && itemsCompleted >= 5) {
        bonusXP += 50
      } else if (accuracy >= 90 && itemsCompleted >= 5) {
        bonusXP += 25
      } else if (accuracy >= 80 && itemsCompleted >= 5) {
        bonusXP += 10
      }

      const totalXP = baseXP + bonusXP

      // Send XP to server with enhanced tracking
      const response = await fetch('/api/xp/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          eventType: accuracy === 100 ? 'perfect_session' : 'review_completed',
          amount: totalXP,
          source: `Session completed: ${itemsCompleted} items (${sessionSummary.contentType})`,
          metadata: {
            // Required tracking fields
            idempotencyKey: `session_${sessionSummary.sessionId}`,
            feature: sessionSummary.contentType || 'review',

            // Session details
            sessionId: sessionSummary.sessionId,
            contentType: sessionSummary.contentType,
            accuracy,
            itemsCompleted,
            duration: sessionSummary.stats?.duration,

            // Performance breakdown
            baseXP,
            bonusXP,
            perfectBonus: accuracy === 100 ? 50 : 0
          }
        })
      })

      if (!response.ok) {
        reviewLogger.error('[UniversalProgressManager] Failed to track session XP:', await response.text())
      }
    } catch (error) {
      reviewLogger.error('[UniversalProgressManager] Error tracking session XP:', error)
    }
  }
}