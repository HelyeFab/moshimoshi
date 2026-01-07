/**
 * Anki Media Sync Manager
 *
 * Background sync queue processor for Anki media files.
 * Follows the same architecture as ListManager.ts for consistency.
 *
 * Features:
 * - Background queue processing (5s interval)
 * - Exponential backoff retry (1s → 2s → 4s → 8s → 16s)
 * - Circuit breaker (5 failures → 30s pause)
 * - Network state awareness
 * - Concurrent upload limiting (max 3 simultaneous)
 *
 * Reference: /src/lib/lists/ListManager.ts
 */

import { AnkiMediaStore } from './mediaStore'
import { AnkiMediaUploader } from './mediaUploader'
import type { MediaSyncJob, MediaSyncStatus } from '@/types/ankiMedia'

export class AnkiMediaManager {
  private static instance: AnkiMediaManager
  private mediaStore: AnkiMediaStore
  private uploader: AnkiMediaUploader
  private isProcessing: boolean = false
  private syncTimer: NodeJS.Timeout | null = null
  private circuitBreakerFailures: number = 0
  private circuitBreakerResetTime: number = 0
  private pendingSyncLock: Set<string> = new Set()

  // Constants (same as ListManager.ts)
  private readonly SYNC_INTERVAL = 5000  // 5 seconds
  private readonly MAX_RETRIES = 5
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5
  private readonly CIRCUIT_BREAKER_RESET_MS = 30000  // 30 seconds
  private readonly MAX_CONCURRENT_UPLOADS = 3

  private syncStatus: MediaSyncStatus = {
    isOnline: true,
    syncState: 'idle',
    pendingCount: 0,
    failedCount: 0,
    lastSyncTime: null,
    lastError: null
  }

  private constructor() {
    this.mediaStore = AnkiMediaStore.getInstance()
    this.uploader = new AnkiMediaUploader()
    this.initializeSync()
  }

  static getInstance(): AnkiMediaManager {
    if (!this.instance) {
      this.instance = new AnkiMediaManager()
    }
    return this.instance
  }

  /**
   * Initialize sync system with network monitoring
   */
  private async initializeSync(): Promise<void> {
    console.log('[AnkiMediaManager] Initializing sync system')

    // Start sync timer
    this.startSyncTimer()

    // Setup network online/offline detection
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[AnkiMediaManager] Network online, triggering sync')
        this.syncStatus.isOnline = true
        this.scheduleImmediateSync()
      })

      window.addEventListener('offline', () => {
        console.log('[AnkiMediaManager] Network offline')
        this.syncStatus.isOnline = false
        this.syncStatus.syncState = 'error'
        this.syncStatus.lastError = 'Network offline'
      })

      this.syncStatus.isOnline = navigator.onLine
    }
  }

  /**
   * Start periodic sync timer (5s interval)
   */
  private startSyncTimer(): void {
    if (this.syncTimer) {
      console.log('[AnkiMediaManager] Sync timer already running')
      return
    }

    console.log('[AnkiMediaManager] Starting sync timer (5s interval)')
    this.syncTimer = setInterval(() => {
      this.processQueue()
    }, this.SYNC_INTERVAL)

    // Process immediately on start
    this.processQueue()
  }

  /**
   * Stop sync timer
   */
  private stopSyncTimer(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = null
      console.log('[AnkiMediaManager] Stopped sync timer')
    }
  }

  /**
   * Schedule immediate sync (for manual triggers)
   */
  private scheduleImmediateSync(): void {
    console.log('[AnkiMediaManager] Scheduling immediate sync')
    this.processQueue()
  }

  /**
   * Main sync queue processor
   * Runs every 5 seconds
   *
   * @param forceManual - If true, indicates this is a manual user action
   *
   * CRITICAL: Must handle:
   * - Circuit breaker check
   * - Network offline check
   * - Concurrent upload limiting
   * - Exponential backoff for scheduled jobs
   */
  private async processQueue(forceManual: boolean = false): Promise<void> {
    if (forceManual) {
      console.log('[AnkiMediaManager] Manual sync requested')
    }

    if (this.isProcessing) {
      console.log('[AnkiMediaManager] Already processing, skipping')
      return
    }

    if (!navigator.onLine) {
      console.log('[AnkiMediaManager] Offline, skipping sync')
      return
    }

    // Circuit breaker check
    const now = Date.now()
    if (this.circuitBreakerFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      if (now < this.circuitBreakerResetTime) {
        console.warn('[AnkiMediaManager] Circuit breaker open, skipping sync')
        return
      } else {
        // Reset circuit breaker
        console.log('[AnkiMediaManager] Circuit breaker reset')
        this.circuitBreakerFailures = 0
        this.circuitBreakerResetTime = 0
      }
    }

    this.isProcessing = true

    try {
      // Get pending jobs that are ready (scheduledFor <= now)
      const jobs = await this.getPendingJobs()

      if (jobs.length === 0) {
        console.log('[AnkiMediaManager] Sync queue is empty, nothing to sync')
        this.syncStatus.syncState = 'synced'
        this.syncStatus.pendingCount = 0
        this.syncStatus.lastSyncTime = new Date()
        this.isProcessing = false
        return
      }

      console.log(`[AnkiMediaManager] Processing ${jobs.length} pending jobs`)

      // Update sync status
      this.syncStatus.syncState = 'syncing'
      this.syncStatus.pendingCount = jobs.length

      // Process with concurrency limit (max 3 at once)
      const chunks = this.chunkArray(jobs, this.MAX_CONCURRENT_UPLOADS)

      let successCount = 0
      let failureCount = 0

      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map(job => this.processJob(job))
        )

        // Count successes and failures
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            successCount++
          } else {
            failureCount++
          }
        })
      }

      console.log(`[AnkiMediaManager] Batch complete: ${successCount} succeeded, ${failureCount} failed`)

      // Reset circuit breaker on successful round
      if (successCount > 0 && this.circuitBreakerFailures > 0) {
        this.circuitBreakerFailures = 0
        console.log('[AnkiMediaManager] Circuit breaker reset due to successful operations')
      }

      // Update circuit breaker reset time if failures occurred
      if (failureCount > 0 && this.circuitBreakerFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
        this.circuitBreakerResetTime = now + this.CIRCUIT_BREAKER_RESET_MS
        console.warn('[AnkiMediaManager] Circuit breaker opened, will reset in 30s')
      }

      // Update final sync status
      const remainingJobs = await this.getPendingJobs()
      this.syncStatus.pendingCount = remainingJobs.length
      this.syncStatus.lastSyncTime = new Date()

      if (remainingJobs.length === 0) {
        this.syncStatus.syncState = 'synced'
      } else {
        this.syncStatus.syncState = 'error'
        this.syncStatus.lastError = `${failureCount} items failed to sync`
      }

    } catch (error) {
      console.error('[AnkiMediaManager] Queue processing error:', error)
      this.circuitBreakerFailures++

      if (this.circuitBreakerFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
        this.circuitBreakerResetTime = now + this.CIRCUIT_BREAKER_RESET_MS
        console.error('[AnkiMediaManager] Circuit breaker triggered')
      }

      this.syncStatus.syncState = 'error'
      this.syncStatus.lastError = error instanceof Error ? error.message : 'Unknown error'
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Process individual sync job
   * Implements exponential backoff on failure
   */
  private async processJob(job: MediaSyncJob): Promise<void> {
    console.log(`[AnkiMediaManager] Processing job ${job.id}`, {
      action: job.action,
      filename: job.filename,
      retryCount: job.retryCount
    })

    // Skip if already processing
    if (this.pendingSyncLock.has(job.id)) {
      console.log(`[AnkiMediaManager] Job ${job.id} already being processed, skipping`)
      return
    }

    this.pendingSyncLock.add(job.id)

    try {
      // Update status to processing
      await this.updateJobStatus(job.id, 'processing')

      if (job.action === 'upload') {
        await this.handleUploadJob(job)
      } else if (job.action === 'delete') {
        await this.handleDeleteJob(job)
      }

      // Success - remove from queue
      await this.removeJob(job.id)
      this.pendingSyncLock.delete(job.id)
      console.log(`[AnkiMediaManager] ✓ Job ${job.id} completed successfully`)

    } catch (error) {
      this.pendingSyncLock.delete(job.id)
      console.error(`[AnkiMediaManager] ✗ Job ${job.id} failed:`, error)

      // Increment retry count
      const newRetryCount = job.retryCount + 1

      if (newRetryCount >= job.maxRetries) {
        // Max retries exceeded - mark as failed permanently
        await this.markJobAsFailed(
          job.id,
          error instanceof Error ? error.message : 'Unknown error'
        )

        // Also mark media as failed in mediaStore
        await this.mediaStore.markAsFailed(
          job.filename,
          error instanceof Error ? error.message : 'Upload failed'
        )

        // Notify about failure
        this.notifyJobFailed(job)

        console.error(`[AnkiMediaManager] Job ${job.id} exceeded max retries, marked as failed`)
      } else {
        // Schedule retry with exponential backoff
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 30s)
        const backoffMs = Math.min(30000, Math.pow(2, newRetryCount - 1) * 1000)
        const scheduledFor = new Date(Date.now() + backoffMs)

        await this.rescheduleJob(
          job.id,
          newRetryCount,
          scheduledFor,
          error instanceof Error ? error.message : ''
        )

        console.log(
          `[AnkiMediaManager] Job ${job.id} rescheduled for ${scheduledFor.toISOString()} ` +
          `(retry ${newRetryCount}/${job.maxRetries}, backoff: ${backoffMs}ms)`
        )
      }
    }
  }

  /**
   * Handle upload job - uploads blob to Firebase Storage
   */
  private async handleUploadJob(job: MediaSyncJob): Promise<void> {
    // Get blob URL from mediaStore
    const blobUrl = await this.mediaStore.getMediaUrl(job.filename)
    if (!blobUrl) {
      throw new Error(`Media not found: ${job.filename}`)
    }

    // Fetch the actual blob from the blob URL
    const response = await fetch(blobUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch blob: ${response.statusText}`)
    }
    const blob = await response.blob()

    // Upload to Firebase Storage (REAL IMPLEMENTATION)
    const firebaseUrl = await this.uploader.uploadMedia(
      job.userId,
      job.deckId,
      job.filename,
      blob
    )

    // Mark as synced in mediaStore
    await this.mediaStore.markAsSynced(job.filename, firebaseUrl)

    // Update server metadata
    try {
      await fetch('/api/anki/media/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          deckId: job.deckId,
          files: [{
            filename: job.filename,
            firebaseUrl,
            size: blob.size,
            contentType: blob.type,
            uploadedAt: new Date().toISOString()
          }]
        })
      })
    } catch (error) {
      console.warn('[AnkiMediaManager] Failed to update server metadata:', error)
      // Don't fail the upload if metadata update fails
    }

    console.log(`[AnkiMediaManager] ✓ Uploaded: ${job.filename} → ${firebaseUrl}`)
  }

  /**
   * Handle delete job - removes blob from Firebase Storage
   */
  private async handleDeleteJob(job: MediaSyncJob): Promise<void> {
    // Delete from Firebase Storage (REAL IMPLEMENTATION)
    await this.uploader.deleteMedia(
      job.userId,
      job.deckId,
      job.filename
    )

    console.log(`[AnkiMediaManager] ✓ Deleted: ${job.filename}`)
  }

  /**
   * Open IndexedDB (reuse pattern from mediaStore)
   */
  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ankiMediaDB', 2)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /**
   * Get pending jobs that are ready to process
   * Only returns jobs where scheduledFor <= now
   */
  private async getPendingJobs(deckId?: string): Promise<MediaSyncJob[]> {
    try {
      const db = await this.openDB()
      const transaction = db.transaction(['syncQueue'], 'readonly')
      const store = transaction.objectStore('syncQueue')
      const index = store.index('status')

      const pending = await new Promise<MediaSyncJob[]>((resolve, reject) => {
        const request = index.getAll('pending')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      db.close()

      // Filter by scheduledFor (only jobs ready to run)
      const now = Date.now()
      const ready = pending.filter(job => {
        const scheduledTime = job.scheduledFor instanceof Date
          ? job.scheduledFor.getTime()
          : new Date(job.scheduledFor).getTime()
        return scheduledTime <= now
      })

      // Filter by deckId if provided
      if (deckId) {
        return ready.filter(job => job.deckId === deckId)
      }

      return ready
    } catch (error) {
      console.error('[AnkiMediaManager] Failed to get pending jobs:', error)
      return []
    }
  }

  /**
   * Get failed jobs for UI
   */
  private async getFailedJobs(deckId?: string): Promise<MediaSyncJob[]> {
    try {
      const db = await this.openDB()
      const transaction = db.transaction(['syncQueue'], 'readonly')
      const store = transaction.objectStore('syncQueue')
      const index = store.index('status')

      const failed = await new Promise<MediaSyncJob[]>((resolve, reject) => {
        const request = index.getAll('failed')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      db.close()

      if (deckId) {
        return failed.filter(job => job.deckId === deckId)
      }

      return failed
    } catch (error) {
      console.error('[AnkiMediaManager] Failed to get failed jobs:', error)
      return []
    }
  }

  /**
   * Add job to sync queue
   */
  private async addJobToQueue(job: MediaSyncJob): Promise<void> {
    try {
      const db = await this.openDB()
      const transaction = db.transaction(['syncQueue'], 'readwrite')
      const store = transaction.objectStore('syncQueue')

      await new Promise<void>((resolve, reject) => {
        const request = store.add(job)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      db.close()
      console.log(`[AnkiMediaManager] Added job to queue: ${job.id}`)
    } catch (error) {
      console.error('[AnkiMediaManager] Failed to add job to queue:', error)
      throw error
    }
  }

  /**
   * Update job status
   */
  private async updateJobStatus(
    jobId: string,
    status: 'pending' | 'processing' | 'failed'
  ): Promise<void> {
    try {
      const db = await this.openDB()
      const transaction = db.transaction(['syncQueue'], 'readwrite')
      const store = transaction.objectStore('syncQueue')

      const job = await new Promise<MediaSyncJob | null>((resolve, reject) => {
        const request = store.get(jobId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      if (job) {
        job.status = status
        await new Promise<void>((resolve, reject) => {
          const request = store.put(job)
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      }

      db.close()
    } catch (error) {
      console.error('[AnkiMediaManager] Failed to update job status:', error)
      throw error
    }
  }

  /**
   * Remove job from queue (after success)
   */
  private async removeJob(jobId: string): Promise<void> {
    try {
      const db = await this.openDB()
      const transaction = db.transaction(['syncQueue'], 'readwrite')
      const store = transaction.objectStore('syncQueue')

      await new Promise<void>((resolve, reject) => {
        const request = store.delete(jobId)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })

      db.close()
    } catch (error) {
      console.error('[AnkiMediaManager] Failed to remove job:', error)
      throw error
    }
  }

  /**
   * Reschedule job with new retry count and backoff time
   */
  private async rescheduleJob(
    jobId: string,
    retryCount: number,
    scheduledFor: Date,
    error: string
  ): Promise<void> {
    try {
      const db = await this.openDB()
      const transaction = db.transaction(['syncQueue'], 'readwrite')
      const store = transaction.objectStore('syncQueue')

      const job = await new Promise<MediaSyncJob | null>((resolve, reject) => {
        const request = store.get(jobId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      if (job) {
        job.status = 'pending'
        job.retryCount = retryCount
        job.scheduledFor = scheduledFor
        job.lastAttempt = new Date()
        job.error = error

        await new Promise<void>((resolve, reject) => {
          const request = store.put(job)
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      }

      db.close()
    } catch (error) {
      console.error('[AnkiMediaManager] Failed to reschedule job:', error)
      throw error
    }
  }

  /**
   * Mark job as permanently failed
   */
  private async markJobAsFailed(jobId: string, error: string): Promise<void> {
    try {
      const db = await this.openDB()
      const transaction = db.transaction(['syncQueue'], 'readwrite')
      const store = transaction.objectStore('syncQueue')

      const job = await new Promise<MediaSyncJob | null>((resolve, reject) => {
        const request = store.get(jobId)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      if (job) {
        job.status = 'failed'
        job.error = error
        job.lastAttempt = new Date()

        await new Promise<void>((resolve, reject) => {
          const request = store.put(job)
          request.onsuccess = () => resolve()
          request.onerror = () => reject(request.error)
        })
      }

      db.close()
    } catch (error) {
      console.error('[AnkiMediaManager] Failed to mark job as failed:', error)
      throw error
    }
  }

  /**
   * Notify user of sync failure (called after max retries)
   */
  private notifyJobFailed(job: MediaSyncJob): void {
    console.error(
      `[AnkiMediaManager] 🚨 Job permanently failed after ${job.maxRetries} retries:`,
      {
        filename: job.filename,
        deckId: job.deckId,
        error: job.error
      }
    )

    // TODO Task 6: Show toast notification
    // showToast(`Failed to sync ${job.filename}: ${job.error}`, 'error')
  }

  /**
   * Chunk array for concurrent processing
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size))
    }
    return chunks
  }

  // ============================================================================
  // PUBLIC API METHODS
  // ============================================================================

  /**
   * Enqueue media upload (called from import flow)
   *
   * CRITICAL: Must check premium status before enqueueing
   */
  async enqueueUpload(
    userId: string,
    deckId: string,
    filename: string,
    blob: Blob
  ): Promise<void> {
    console.log(`[AnkiMediaManager] Enqueuing upload: ${filename}`)

    // Store in IndexedDB with pending status
    await this.mediaStore.storeMedia(filename, blob, {
      userId,
      deckId,
      syncStatus: 'pending'
    })

    // Create sync job
    const job: MediaSyncJob = {
      id: crypto.randomUUID(),
      action: 'upload',
      userId,
      deckId,
      filename,
      status: 'pending',
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      scheduledFor: new Date(),  // Run immediately
      createdAt: new Date()
    }

    await this.addJobToQueue(job)

    // Trigger immediate sync
    this.scheduleImmediateSync()
  }

  /**
   * Enqueue media deletion
   */
  async enqueueDelete(
    userId: string,
    deckId: string,
    filename: string
  ): Promise<void> {
    console.log(`[AnkiMediaManager] Enqueuing delete: ${filename}`)

    const job: MediaSyncJob = {
      id: crypto.randomUUID(),
      action: 'delete',
      userId,
      deckId,
      filename,
      status: 'pending',
      retryCount: 0,
      maxRetries: this.MAX_RETRIES,
      scheduledFor: new Date(),
      createdAt: new Date()
    }

    await this.addJobToQueue(job)

    // Trigger immediate sync
    this.scheduleImmediateSync()
  }

  /**
   * Get sync status for UI display
   */
  async getSyncStatus(deckId?: string): Promise<MediaSyncStatus> {
    const jobs = await this.getPendingJobs(deckId)
    const failedJobs = await this.getFailedJobs(deckId)
    const pendingJobs = jobs.filter(j => j.status === 'pending')

    // Get total media count and synced count
    const allMedia = await this.mediaStore.getAllMedia()
    const totalCount = allMedia.length
    const syncedCount = allMedia.filter(m => m.syncStatus === 'synced').length

    return {
      isOnline: navigator.onLine,
      syncState: this.isProcessing
        ? 'syncing'
        : (failedJobs.length > 0
            ? 'error'
            : (pendingJobs.length > 0
                ? 'idle'
                : 'synced')),
      pendingCount: pendingJobs.length,
      failedCount: failedJobs.length,
      syncedCount,
      totalCount,
      lastSyncTime: this.syncStatus.lastSyncTime,
      lastError: failedJobs[0]?.error || null
    }
  }

  /**
   * Force sync all (for manual retry button)
   * Direct user action to process the queue immediately
   */
  async forceSyncAll(): Promise<void> {
    console.log('[AnkiMediaManager] Force sync all requested (manual trigger)')

    // Reset circuit breaker
    this.circuitBreakerFailures = 0
    this.circuitBreakerResetTime = 0

    // Process queue immediately
    await this.processQueue(true)
  }

  /**
   * Get current sync status (without querying DB)
   */
  getCurrentSyncStatus(): MediaSyncStatus {
    return { ...this.syncStatus }
  }

  /**
   * Clean up resources and gracefully shut down
   */
  destroy(): void {
    console.log('[AnkiMediaManager] Shutting down')

    // Stop sync timer
    this.stopSyncTimer()
  }
}
