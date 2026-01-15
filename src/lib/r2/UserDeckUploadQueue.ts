import PQueue from 'p-queue'
import { ClientEventEmitter } from '@/lib/review-engine/core/client-event-emitter'
import type { FlashcardDeck } from '@/types/flashcards'
import { debugLogger } from '@/lib/debug-logger'
import { createUuid } from '@/lib/utils/uuid'

type UserDeckUploadJob = {
  id: string
  deckId: string
  userId: string
  key: string
  type: 'cards' | 'media' | 'manifest'
  status: 'pending' | 'uploading' | 'completed' | 'failed'
  retryCount: number
  maxRetries: number
  scheduledFor: number
  createdAt: number
  contentType?: string
  size?: number
  blob?: Blob
  error?: string
  progress?: number
}

type UserDeckMetadata = {
  deckId: string
  userId: string
  name: string
  cardCount: number
  totalJobs: number
  completedJobs: number
  failedJobs: number
  totalBytes: number
  hasMedia: boolean
}

type UploadEvent = {
  deckId: string
  jobId?: string
  status?: {
    pending: number
    uploading: number
    completed: number
    failed: number
    totalBytes: number
    uploadedBytes: number
  }
  error?: string
}

const DB_NAME = 'userDeckUploadQueue'
const DB_VERSION = 1
const JOBS_STORE = 'jobs'
const METADATA_STORE = 'metadata'
const MAX_CONCURRENCY = 5
const MAX_RETRIES = 5
const BACKOFF_SECONDS = [1, 2, 4, 8, 16, 30]

export class UserDeckUploadQueue {
  readonly userId: string
  private queue: PQueue
  private emitter = new ClientEventEmitter()
  private isRunning = false
  private isOnline = true
  private deckMetadata = new Map<string, UserDeckMetadata>()
  private deletedDecks = new Set<string>()

  constructor(userId: string) {
    this.userId = userId
    this.queue = new PQueue({ concurrency: MAX_CONCURRENCY })

    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
    }
  }

  /**
   * Queue a user deck for upload to R2
   */
  async queueDeckUpload(
    deck: FlashcardDeck,
    mediaFiles: Map<string, Blob>
  ): Promise<void> {
    debugLogger.r2Upload('Starting user deck R2 upload', {
      deckId: deck.id,
      deckName: deck.name,
      cardCount: deck.cards.length,
      mediaFiles: mediaFiles.size,
    })

    // Clear any existing jobs for this deck to prevent duplicates
    await this.clearDeck(deck.id, { markDeleted: false })

    if (this.deletedDecks.has(deck.id)) {
      debugLogger.queueStatus('Deck deleted during queue prep - aborting', { deckId: deck.id })
      return
    }

    // Generate cards.json
    const cardsJson = JSON.stringify(deck)
    const cardsBlob = new Blob([cardsJson], { type: 'application/json' })

    const totalBytes =
      cardsBlob.size + Array.from(mediaFiles.values()).reduce((sum, blob) => sum + blob.size, 0)

    // Store deck metadata
    const metadata: UserDeckMetadata = {
      deckId: deck.id,
      userId: this.userId,
      name: deck.name,
      cardCount: deck.cards.length,
      totalJobs: 2 + mediaFiles.size, // cards.json + manifest.json + media files
      completedJobs: 0,
      failedJobs: 0,
      totalBytes,
      hasMedia: mediaFiles.size > 0,
    }

    this.deckMetadata.set(deck.id, metadata)
    await this.putMetadata(metadata)

    const now = Date.now()

    // Queue cards.json upload
    debugLogger.step(1, 'Queueing cards.json...', {
      deckId: deck.id,
      size: Math.round(cardsBlob.size / 1024) + ' KB',
    })

    await this.putJob({
      id: createUuid(),
      deckId: deck.id,
      userId: this.userId,
      key: 'cards.json',
      type: 'cards',
      status: 'pending',
      retryCount: 0,
      maxRetries: MAX_RETRIES,
      scheduledFor: now,
      createdAt: now,
      contentType: 'application/json',
      size: cardsBlob.size,
      blob: cardsBlob,
    })

    // Queue media files
    if (mediaFiles.size > 0) {
      debugLogger.step(2, 'Queueing media files...', {
        count: mediaFiles.size,
      })

      for (const [filename, blob] of mediaFiles.entries()) {
        if (this.deletedDecks.has(deck.id)) {
          debugLogger.queueStatus('Deck deleted during media queue - aborting', { deckId: deck.id })
          return
        }

        await this.putJob({
          id: createUuid(),
          deckId: deck.id,
          userId: this.userId,
          key: `media/${filename}`,
          type: 'media',
          status: 'pending',
          retryCount: 0,
          maxRetries: MAX_RETRIES,
          scheduledFor: now,
          createdAt: now,
          contentType: blob.type || 'application/octet-stream',
          size: blob.size,
          blob,
        })
      }
    }

    // Queue manifest (will be generated after cards + media complete)
    debugLogger.step(3, 'Queueing manifest...', { deckId: deck.id })

    await this.putJob({
      id: createUuid(),
      deckId: deck.id,
      userId: this.userId,
      key: 'manifest.json',
      type: 'manifest',
      status: 'pending',
      retryCount: 0,
      maxRetries: MAX_RETRIES,
      scheduledFor: now + 1000, // Delay slightly so cards/media upload first
      createdAt: now,
      contentType: 'application/json',
      size: 0, // Will be set when manifest is generated
      blob: undefined, // Will be generated later
    })

    debugLogger.success('All files queued for upload!', {
      deckId: deck.id,
      totalJobs: metadata.totalJobs,
    })

    await this.processPending()
    await this.emitStatus(deck.id)
  }

  async start(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true
    await this.processPending()
  }

  stop(): void {
    this.isRunning = false
    this.queue.pause()
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
    }
  }

  async clearDeck(deckId: string, options: { markDeleted?: boolean } = {}): Promise<void> {
    if (options.markDeleted) {
      this.deletedDecks.add(deckId)
    }

    const jobs = await this.getJobsByDeck(deckId)
    if (jobs.length === 0) return

    debugLogger.queueStatus(`Clearing ${jobs.length} jobs for deck...`, { deckId })

    const db = await this.openDb()
    const tx = db.transaction(JOBS_STORE, 'readwrite')
    const store = tx.objectStore(JOBS_STORE)

    await Promise.all(
      jobs.map(
        job =>
          new Promise<void>((resolve, reject) => {
            const req = store.delete(job.id)
            req.onsuccess = () => resolve()
            req.onerror = () => reject(req.error)
          })
      )
    )

    db.close()
    this.deckMetadata.delete(deckId)

    debugLogger.success(`Cleared ${jobs.length} jobs!`, { deckId })
  }

  on(event: 'progress' | 'complete' | 'error', handler: (data: UploadEvent) => void): void {
    this.emitter.on(event, handler)
  }

  off(event: 'progress' | 'complete' | 'error', handler: (data: UploadEvent) => void): void {
    this.emitter.off(event, handler)
  }

  private handleOnline = () => {
    this.isOnline = true
    this.queue.start()
    this.processPending().catch(() => {})
  }

  private handleOffline = () => {
    this.isOnline = false
    this.queue.pause()
  }

  private async processPending(): Promise<void> {
    if (!this.isRunning || !this.isOnline) return

    const readyJobs = (await this.getReadyJobs()).filter(job => !this.deletedDecks.has(job.deckId))

    if (readyJobs.length === 0) return

    for (const job of readyJobs) {
      await this.updateJob(job.id, { status: 'uploading', progress: 0 })
      this.queue.add(() => this.uploadJob(job.id))
    }
  }

  private async uploadJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId)
    if (!job) return
    if (!this.isOnline) return
    if (this.deletedDecks.has(job.deckId)) return

    // Generate manifest blob if this is a manifest job
    if (job.type === 'manifest' && !job.blob) {
      const manifestBlob = await this.generateManifest(job.deckId)
      if (!manifestBlob) {
        debugLogger.error('Failed to generate manifest', { deckId: job.deckId })
        return
      }
      await this.updateJob(job.id, { blob: manifestBlob, size: manifestBlob.size })
      job.blob = manifestBlob
      job.size = manifestBlob.size
    }

    if (!job.blob) {
      debugLogger.error('Job has no blob', { jobId, deckId: job.deckId })
      return
    }

    const filename = job.key.split('/').pop() || job.key

    debugLogger.r2Upload(`Uploading ${job.type}...`, {
      filename,
      size: Math.round(job.size! / 1024) + ' KB',
    })

    try {
      const deckBytes = this.deckMetadata.get(job.deckId)?.totalBytes
      const signedUrl = await this.requestUploadUrl(job.deckId, job.key, job.contentType, deckBytes)

      const response = await fetch(signedUrl, {
        method: 'PUT',
        body: job.blob,
        headers: {
          'Content-Type': job.contentType || 'application/octet-stream',
        },
      })

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`)
      }

      debugLogger.success(`${job.type} uploaded!`, { filename })

      await this.updateJob(job.id, { status: 'completed', progress: 100, error: undefined })
      await this.emitStatus(job.deckId)
      await this.checkDeckCompletion(job.deckId)
    } catch (error: any) {
      debugLogger.error(`Upload error for ${filename}`, error?.message || 'Upload failed')
      await this.handleUploadError(job, error?.message || 'Upload failed')
    }
  }

  private async handleUploadError(job: UserDeckUploadJob, message: string): Promise<void> {
    const retryCount = job.retryCount + 1
    const shouldFail = retryCount > job.maxRetries
    const backoffMs = this.getBackoffMs(retryCount)
    const nextAttempt = Date.now() + backoffMs

    await this.updateJob(job.id, {
      retryCount,
      status: shouldFail ? 'failed' : 'pending',
      scheduledFor: shouldFail ? job.scheduledFor : nextAttempt,
      error: message,
    })

    if (shouldFail) {
      debugLogger.error(`Upload FAILED after ${retryCount} attempts!`, {
        deckId: job.deckId,
        error: message,
      })
      this.emitter.emit('error', { deckId: job.deckId, jobId: job.id, error: message })
    } else {
      debugLogger.queueStatus(`Upload will retry (attempt ${retryCount}/${job.maxRetries})`, {
        retryIn: Math.round(backoffMs / 1000) + 's',
      })
    }

    await this.emitStatus(job.deckId)
  }

  private getBackoffMs(retryCount: number): number {
    const index = Math.min(retryCount - 1, BACKOFF_SECONDS.length - 1)
    return BACKOFF_SECONDS[index] * 1000
  }

  private async checkDeckCompletion(deckId: string): Promise<void> {
    const jobs = await this.getJobsByDeck(deckId)
    const allCompleted = jobs.every(job => job.status === 'completed')

    if (!allCompleted) return

    debugLogger.success('ALL UPLOADS COMPLETE!', { deckId })

    const metadata = this.deckMetadata.get(deckId)
    if (!metadata) {
      debugLogger.error('Metadata missing for completed deck', { deckId })
      return
    }

    debugLogger.step(4, 'Writing deck metadata to Firestore...', { deckId })

    const wroteMetadata = await this.writeMetadata(deckId, metadata)
    if (wroteMetadata) {
      const status = await this.getStatus(deckId)
      this.emitter.emit('complete', { deckId, status })
    } else {
      this.emitter.emit('error', {
        deckId,
        error: 'Failed to write deck metadata',
      })
    }
  }

  private async writeMetadata(
    deckId: string,
    metadata: UserDeckMetadata
  ): Promise<boolean> {
    try {
      const r2Keys = {
        cardsKey: `users/${this.userId}/flashcards/${deckId}/cards.json`,
        manifestKey: `users/${this.userId}/flashcards/${deckId}/manifest.json`,
        mediaPrefix: `users/${this.userId}/flashcards/${deckId}/media/`,
      }

      const response = await fetch('/api/flashcards/r2/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          deckId,
          name: metadata.name,
          cardCount: metadata.cardCount,
          hasMedia: metadata.hasMedia,
          totalBytes: metadata.totalBytes,
          r2Keys,
        }),
      })

      if (!response.ok) {
        throw new Error(`Metadata write failed with status ${response.status}`)
      }

      debugLogger.success('Deck metadata written to Firestore!', {
        deckId,
        deckName: metadata.name,
      })
      return true
    } catch (error: any) {
      debugLogger.error('Metadata write failed!', {
        deckId,
        error: error?.message || 'Failed to write metadata',
      })
      return false
    }
  }

  private async requestUploadUrl(
    deckId: string,
    key: string,
    contentType?: string,
    deckTotalBytes?: number
  ): Promise<string> {
    const response = await fetch('/api/flashcards/r2/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ deckId, key, contentType, deckTotalBytes }),
    })

    if (!response.ok) {
      throw new Error('Failed to request upload URL')
    }

    const data = (await response.json()) as { url?: string }
    if (!data.url) {
      throw new Error('Upload URL missing in response')
    }

    return data.url
  }

  private async generateManifest(deckId: string): Promise<Blob | null> {
    const jobs = await this.getJobsByDeck(deckId)
    const completedJobs = jobs.filter(job => job.status === 'completed' && job.type !== 'manifest')

    const manifest = {
      deckId,
      userId: this.userId,
      createdAt: new Date().toISOString(),
      files: completedJobs.map(job => ({
        type: job.type,
        filename: job.key.split('/').pop() || job.key,
        size: job.size || 0,
        hash: 'sha256-placeholder', // TODO: Implement actual hashing if needed
      })),
    }

    return new Blob([JSON.stringify(manifest)], { type: 'application/json' })
  }

  private async emitStatus(deckId: string): Promise<void> {
    const status = await this.getStatus(deckId)
    this.emitter.emit('progress', { deckId, status })
  }

  private async getStatus(deckId: string): Promise<{
    pending: number
    uploading: number
    completed: number
    failed: number
    totalBytes: number
    uploadedBytes: number
  }> {
    const jobs = await this.getJobsByDeck(deckId)
    const summary = {
      pending: 0,
      uploading: 0,
      completed: 0,
      failed: 0,
      totalBytes: 0,
      uploadedBytes: 0,
    }

    jobs.forEach(job => {
      summary.totalBytes += job.size || 0
      if (job.status === 'pending') summary.pending += 1
      if (job.status === 'uploading') summary.uploading += 1
      if (job.status === 'completed') {
        summary.completed += 1
        summary.uploadedBytes += job.size || 0
      }
      if (job.status === 'failed') summary.failed += 1
    })

    return summary
  }

  private async openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result

        // Jobs store
        if (!db.objectStoreNames.contains(JOBS_STORE)) {
          const jobsStore = db.createObjectStore(JOBS_STORE, { keyPath: 'id' })
          jobsStore.createIndex('deckId', 'deckId', { unique: false })
          jobsStore.createIndex('status', 'status', { unique: false })
          jobsStore.createIndex('scheduledFor', 'scheduledFor', { unique: false })
        }

        // Metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: 'deckId' })
        }
      }
    })
  }

  private async putJob(job: UserDeckUploadJob): Promise<void> {
    const db = await this.openDb()
    const tx = db.transaction(JOBS_STORE, 'readwrite')
    const store = tx.objectStore(JOBS_STORE)

    await new Promise<void>((resolve, reject) => {
      const req = store.put(job)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })

    db.close()
  }

  private async updateJob(jobId: string, updates: Partial<UserDeckUploadJob>): Promise<void> {
    const db = await this.openDb()
    const tx = db.transaction(JOBS_STORE, 'readwrite')
    const store = tx.objectStore(JOBS_STORE)

    const job = await new Promise<UserDeckUploadJob | undefined>((resolve, reject) => {
      const req = store.get(jobId)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    if (job) {
      const updated = { ...job, ...updates }
      await new Promise<void>((resolve, reject) => {
        const req = store.put(updated)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    }

    db.close()
  }

  private async getJob(jobId: string): Promise<UserDeckUploadJob | null> {
    const db = await this.openDb()
    const tx = db.transaction(JOBS_STORE, 'readonly')
    const store = tx.objectStore(JOBS_STORE)

    const job = await new Promise<UserDeckUploadJob | undefined>((resolve, reject) => {
      const req = store.get(jobId)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    db.close()
    return job || null
  }

  private async getJobsByDeck(deckId: string): Promise<UserDeckUploadJob[]> {
    const db = await this.openDb()
    const tx = db.transaction(JOBS_STORE, 'readonly')
    const store = tx.objectStore(JOBS_STORE)
    const index = store.index('deckId')

    const jobs = await new Promise<UserDeckUploadJob[]>((resolve, reject) => {
      const req = index.getAll(deckId)
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    db.close()
    return jobs
  }

  private async getReadyJobs(): Promise<UserDeckUploadJob[]> {
    const db = await this.openDb()
    const tx = db.transaction(JOBS_STORE, 'readonly')
    const store = tx.objectStore(JOBS_STORE)

    const allJobs = await new Promise<UserDeckUploadJob[]>((resolve, reject) => {
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })

    db.close()

    const now = Date.now()
    return allJobs.filter(
      job =>
        (job.status === 'pending' || job.status === 'failed') &&
        job.scheduledFor <= now &&
        job.retryCount < job.maxRetries
    )
  }

  private async putMetadata(metadata: UserDeckMetadata): Promise<void> {
    const db = await this.openDb()
    const tx = db.transaction(METADATA_STORE, 'readwrite')
    const store = tx.objectStore(METADATA_STORE)

    await new Promise<void>((resolve, reject) => {
      const req = store.put(metadata)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })

    db.close()
  }
}

// Singleton instance getter
let uploadQueueInstance: UserDeckUploadQueue | null = null

export function getUserDeckUploadQueue(userId: string): UserDeckUploadQueue {
  if (!uploadQueueInstance || uploadQueueInstance.userId !== userId) {
    uploadQueueInstance = new UserDeckUploadQueue(userId)
  }
  return uploadQueueInstance
}
