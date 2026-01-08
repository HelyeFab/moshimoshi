import PQueue from 'p-queue'
import { ClientEventEmitter } from '@/lib/review-engine/core/client-event-emitter'
import { ankiDeckManager } from '@/lib/anki/AnkiDeckManager'
import { buildDeckPrefix, isValidDeckKey } from '@/lib/r2/r2-keys'
import { generateManifest } from '@/lib/r2/manifestGenerator'
import type { R2QueueStatus, R2UploadJob } from '@/types/r2'
import { debugLogger } from '@/lib/debug-logger'

type R2UploadJobRecord = R2UploadJob & {
  contentType?: string
  size?: number
  blob?: Blob
}

type UploadEvent = {
  deckId: string
  jobId?: string
  status?: R2QueueStatus
  error?: string
}

type DeckMetadata = {
  name: string
  cardCount: number
  hasMedia: boolean
  totalBytes: number
  originalFilename?: string
  r2: {
    packageKey: string
    manifestKey: string
    mediaPrefix: string
  }
}

const DB_NAME = 'ankiMediaDB'
const DB_VERSION = 2
const STORE_NAME = 'syncQueue'
const MAX_CONCURRENCY = 5
const MAX_RETRIES = 5
const BACKOFF_SECONDS = [1, 2, 4, 8, 16, 30]
const STUCK_UPLOAD_MS = 5 * 60 * 1000

export class R2UploadQueue {
  readonly userId: string
  private queue: PQueue
  private emitter = new ClientEventEmitter()
  private isRunning = false
  private isOnline = true
  private pollTimer: number | null = null
  private deckMetadata = new Map<string, DeckMetadata>()
  private deletedDecks = new Set<string>()
  private inFlightControllers = new Map<string, { controller: AbortController; deckId: string }>()

  constructor(userId: string) {
    this.userId = userId
    this.queue = new PQueue({ concurrency: MAX_CONCURRENCY })

    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine
      window.addEventListener('online', this.handleOnline)
      window.addEventListener('offline', this.handleOffline)
    }
  }

  async queueDeckUpload(
    deckId: string,
    packageBlob: Blob,
    mediaFiles: Map<string, Blob>
  ): Promise<void> {
    if (this.deletedDecks.has(deckId)) {
      debugLogger.queueStatus('Deck was previously deleted; resetting state for new upload', { deckId })
      this.deletedDecks.delete(deckId)
    }
    debugLogger.r2Upload('Starting R2 backup upload', {
      deckId,
      packageSize: Math.round(packageBlob.size / 1024) + ' KB',
      mediaFiles: mediaFiles.size,
      totalSizeMB: Math.round((packageBlob.size + Array.from(mediaFiles.values()).reduce((sum, b) => sum + b.size, 0)) / 1024 / 1024) + ' MB'
    })

    const deck = await ankiDeckManager.getDeck(deckId, this.userId)
    if (!deck) {
      debugLogger.error('Deck not found for R2 upload!', { deckId })
      throw new Error('Deck not found for upload')
    }

    // CRITICAL: Clear any existing jobs for this deck to prevent duplicates
    debugLogger.step(1, 'Clearing old jobs for this deck...', { deckId, deckName: deck.name })
    await this.clearDeck(deckId, { markDeleted: false })
    debugLogger.success('Old jobs cleared!', { deckId })

    if (this.deletedDecks.has(deckId)) {
      debugLogger.queueStatus('Deck deleted during queue prep - aborting', { deckId })
      return
    }

    const prefix = buildDeckPrefix(this.userId, deckId)
    const packageKey = `${prefix}package.apkg`
    const manifestKey = `${prefix}manifest.json`
    const mediaPrefix = `${prefix}media/`

    const manifest = await generateManifest(deckId, this.userId, packageBlob, mediaFiles)
    const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' })
    const totalBytes =
      packageBlob.size +
      manifestBlob.size +
      Array.from(mediaFiles.values()).reduce((sum, blob) => sum + blob.size, 0)

    const usageResponse = await fetch('/api/anki/r2/usage-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ deckId, deckTotalBytes: totalBytes }),
    })

    if (!usageResponse.ok) {
      const data = await usageResponse.json().catch(() => ({}))
      if (usageResponse.status === 413) {
        const error = new Error('R2_STORAGE_LIMIT_EXCEEDED')
        ;(error as any).code = 'R2_STORAGE_LIMIT_EXCEEDED'
        ;(error as any).details = data?.error || {}
        throw error
      }
      throw new Error('Failed to check R2 usage')
    }

    this.deckMetadata.set(deckId, {
      name: deck.name,
      cardCount: deck.cardCount || deck.cards?.length || 0,
      hasMedia: mediaFiles.size > 0,
      totalBytes,
      originalFilename: deck.metadata?.originalFilename,
      r2: {
        packageKey,
        manifestKey,
        mediaPrefix,
      },
    })

    const now = Date.now()

    debugLogger.step(2, 'Queueing package file...', {
      key: packageKey,
      size: Math.round(packageBlob.size / 1024) + ' KB'
    })

    if (this.deletedDecks.has(deckId)) {
      debugLogger.queueStatus('Deck deleted before package queue - aborting', { deckId })
      return
    }

    await this.putJob({
      id: crypto.randomUUID(),
      deckId,
      userId: this.userId,
      key: packageKey,
      type: 'package',
      status: 'pending',
      retryCount: 0,
      maxRetries: MAX_RETRIES,
      scheduledFor: now,
      createdAt: now,
      contentType: 'application/octet-stream',
      size: packageBlob.size,
      blob: packageBlob,
    })

    debugLogger.success('Package file queued!', { packageKey })

    debugLogger.step(3, 'Queueing media files...', {
      count: mediaFiles.size,
      prefix: mediaPrefix
    })

    for (const [filename, blob] of mediaFiles.entries()) {
      if (this.deletedDecks.has(deckId)) {
        debugLogger.queueStatus('Deck deleted during media queue - aborting', { deckId })
        return
      }
      const key = `${mediaPrefix}${filename}`
      if (!isValidDeckKey(key, prefix)) {
        continue
      }
      await this.putJob({
        id: crypto.randomUUID(),
        deckId,
        userId: this.userId,
        key,
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

    debugLogger.success('Media files queued!', { count: mediaFiles.size })

    debugLogger.step(4, 'Queueing manifest file...', { key: manifestKey })

    if (this.deletedDecks.has(deckId)) {
      debugLogger.queueStatus('Deck deleted before manifest queue - aborting', { deckId })
      return
    }

    await this.putJob({
      id: crypto.randomUUID(),
      deckId,
      userId: this.userId,
      key: manifestKey,
      type: 'manifest',
      status: 'pending',
      retryCount: 0,
      maxRetries: MAX_RETRIES,
      scheduledFor: now,
      createdAt: now,
      contentType: 'application/json',
      size: manifestBlob.size,
      blob: manifestBlob,
    })

    debugLogger.success('All files queued successfully!', {
      deckId,
      deckName: deck.name,
      totalJobs: 2 + mediaFiles.size // package + manifest + media
    })

    if (this.deletedDecks.has(deckId)) {
      debugLogger.queueStatus('Deck deleted before processing - aborting', { deckId })
      return
    }

    debugLogger.queueStatus('Starting upload processing...', { deckId })

    await this.processPending()
    await this.emitStatus(deckId)
  }

  async start(): Promise<void> {
    if (this.isRunning) return
    this.isRunning = true
    await this.processPending()
    if (this.pollTimer === null && typeof window !== 'undefined') {
      this.pollTimer = window.setInterval(() => {
        this.processPending().catch(() => {})
      }, 5000)
    }
  }

  stop(): void {
    this.isRunning = false
    this.queue.pause()
    if (this.pollTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
    }
  }

  async getStatus(deckId: string): Promise<R2QueueStatus> {
    const jobs = await this.getJobsByDeck(deckId)
    const summary: R2QueueStatus = {
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

  async retryFailed(deckId: string): Promise<void> {
    const jobs = await this.getJobsByDeck(deckId)
    const now = Date.now()
    await Promise.all(
      jobs
        .filter(job => job.status === 'failed')
        .map(job =>
          this.updateJob(job.id, {
            status: 'pending',
            scheduledFor: now,
            error: undefined,
          })
        )
    )
    await this.processPending()
    await this.emitStatus(deckId)
  }

  async clearDeck(deckId: string, options: { markDeleted?: boolean } = {}): Promise<void> {
    if (options.markDeleted) {
      this.deletedDecks.add(deckId)
      for (const [jobId, entry] of this.inFlightControllers.entries()) {
        if (entry.deckId === deckId) {
          entry.controller.abort()
          this.inFlightControllers.delete(jobId)
        }
      }
    }
    const jobs = await this.getJobsByDeck(deckId)

    if (jobs.length > 0) {
      debugLogger.queueStatus(`Clearing ${jobs.length} old jobs for deck...`, { deckId })
    }

    const db = await this.openDb()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    await Promise.all(jobs.map(job => {
      return new Promise<void>((resolve, reject) => {
        const req = store.delete(job.id)
        req.onsuccess = () => resolve()
        req.onerror = () => reject(req.error)
      })
    }))

    db.close()
    this.deckMetadata.delete(deckId)

    if (jobs.length > 0) {
      debugLogger.success(`Cleared ${jobs.length} old jobs!`, { deckId })
    }
  }

  async clearAllJobs(): Promise<void> {
    debugLogger.queueStatus('Clearing ALL upload jobs...', {})

    const db = await this.openDb()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    await new Promise<void>((resolve, reject) => {
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })

    db.close()
    this.deckMetadata.clear()

    debugLogger.success('All upload jobs cleared!', {})
  }

  on(event: 'progress' | 'complete' | 'error', handler: (data: UploadEvent) => void): void {
    this.emitter.on(event, handler)
  }

  isDeckDeleted(deckId: string): boolean {
    return this.deletedDecks.has(deckId)
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

    await this.recoverStuckUploads()
    const readyJobs = (await this.getReadyJobs()).filter(job => !this.deletedDecks.has(job.deckId))

    if (readyJobs.length === 0) return

    // CRITICAL: Only queue jobs that aren't already in the queue
    // Check current queue size to avoid overwhelming it
    const currentQueueSize = this.queue.size + this.queue.pending
    const MAX_QUEUE_SIZE = 50
    const availableSlots = Math.max(0, MAX_QUEUE_SIZE - currentQueueSize)

    if (availableSlots === 0) {
      debugLogger.queueStatus('Queue full - waiting for slots...', {
        currentSize: currentQueueSize,
        maxSize: MAX_QUEUE_SIZE,
        readyJobs: readyJobs.length
      })
      return
    }

    // Only add as many jobs as we have slots for
    const jobsToQueue = readyJobs.slice(0, availableSlots)

    debugLogger.queueStatus('Processing batch of jobs...', {
      readyJobs: readyJobs.length,
      availableSlots,
      batchSize: jobsToQueue.length,
      currentQueueSize
    })

    for (const job of jobsToQueue) {
      await this.updateJob(job.id, { status: 'uploading', progress: 0 })
      this.queue.add(() => this.uploadJob(job.id))
    }
  }

  private async uploadJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId)
    if (!job || !job.blob) return
    if (!this.isOnline) return
    if (this.deletedDecks.has(job.deckId)) {
      debugLogger.queueStatus('Skipping upload for deleted deck', {
        deckId: job.deckId,
        jobId,
        key: job.key
      })
      return
    }

    if (job.status !== 'uploading') {
      await this.updateJob(job.id, { status: 'uploading', progress: 0 })
      await this.emitStatus(job.deckId)
    }

    // Extract filename from key for cleaner logging
    const filename = job.key.split('/').pop() || job.key

    debugLogger.r2Upload(`Uploading ${job.type} file...`, {
      filename,
      size: Math.round(job.size! / 1024) + ' KB',
      type: job.type
    })

    try {
      const deckBytes = this.deckMetadata.get(job.deckId)?.totalBytes
      const signedUrl = await this.requestUploadUrl(
        job.deckId,
        job.key,
        job.contentType,
        deckBytes
      )
      const controller = new AbortController()
      this.inFlightControllers.set(job.id, { controller, deckId: job.deckId })

      // Use PUT with presigned URL (checksum headers disabled on server)
      const response = await fetch(signedUrl, {
        method: 'PUT',
        body: job.blob,
        headers: {
          'Content-Type': job.contentType || 'application/octet-stream',
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'No error details')
        debugLogger.error(`Upload failed: ${response.status} ${response.statusText}`, {
          filename,
          status: response.status,
          error: errorText
        })
        throw new Error(`Upload failed with status ${response.status}: ${response.statusText}`)
      }

      debugLogger.success(`${job.type} file uploaded!`, {
        filename,
        size: Math.round(job.size! / 1024) + ' KB'
      })

      await this.updateJob(job.id, { status: 'completed', progress: 100, error: undefined })
      await this.emitStatus(job.deckId)
      await this.checkDeckCompletion(job.deckId)
    } catch (error: any) {
      if (this.deletedDecks.has(job.deckId)) {
        debugLogger.queueStatus('Upload aborted for deleted deck', {
          deckId: job.deckId,
          jobId: job.id
        })
        return
      }
      debugLogger.error(`Upload error for ${filename}`, error?.message || 'Upload failed')
      await this.handleUploadError(job, error?.message || 'Upload failed')
    } finally {
      this.inFlightControllers.delete(job.id)
    }
  }

  private async handleUploadError(job: R2UploadJobRecord, message: string): Promise<void> {
    const retryCount = job.retryCount + 1
    const shouldFail = retryCount > job.maxRetries
    const backoffMs = this.getBackoffMs(retryCount)
    const nextAttempt = Date.now() + backoffMs
    const filename = job.key.split('/').pop() || job.key

    await this.updateJob(job.id, {
      retryCount,
      status: shouldFail ? 'failed' : 'pending',
      scheduledFor: shouldFail ? job.scheduledFor : nextAttempt,
      error: message,
    })

    if (shouldFail) {
      debugLogger.error(`Upload PERMANENTLY FAILED after ${retryCount} attempts!`, {
        filename,
        attempts: retryCount,
        error: message
      })
      this.emitter.emit('error', { deckId: job.deckId, jobId: job.id, error: message })
    } else {
      debugLogger.queueStatus(`Upload will retry (attempt ${retryCount}/${job.maxRetries})`, {
        filename,
        retryIn: Math.round(backoffMs / 1000) + 's',
        error: message
      })
    }

    await this.emitStatus(job.deckId)
  }

  private getBackoffMs(retryCount: number): number {
    const index = Math.min(retryCount - 1, BACKOFF_SECONDS.length - 1)
    return BACKOFF_SECONDS[index] * 1000
  }

  private async checkDeckCompletion(deckId: string): Promise<void> {
    const status = await this.getStatus(deckId)
    if (status.pending === 0 && status.uploading === 0 && status.failed === 0 && status.completed > 0) {
      const metadata = this.deckMetadata.get(deckId)
      debugLogger.success('ALL UPLOADS COMPLETE!', {
        deckId,
        deckName: metadata?.name || 'Unknown',
        totalFiles: status.completed,
        totalSize: Math.round(status.totalBytes / 1024 / 1024) + ' MB'
      })

      debugLogger.step(5, 'Writing backup metadata to Firestore...', { deckId })

      await this.writeMetadata(deckId)
      this.emitter.emit('complete', { deckId, status })
    }
  }

  private async writeMetadata(deckId: string): Promise<void> {
    const metadata = this.deckMetadata.get(deckId)
    if (!metadata) return
    try {
      const response = await fetch('/api/anki/r2/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          deckId,
          name: metadata.name,
          cardCount: metadata.cardCount,
          hasMedia: metadata.hasMedia,
          totalBytes: metadata.totalBytes,
          r2: metadata.r2,
          originalFilename: metadata.originalFilename,
        }),
      })

      if (!response.ok) {
        throw new Error(`Metadata write failed with status ${response.status}`)
      }

      debugLogger.success('Backup metadata written to Firestore!', {
        deckId,
        deckName: metadata.name,
        cardCount: metadata.cardCount
      })
    } catch (error: any) {
      debugLogger.error('Metadata write failed!', {
        deckId,
        error: error?.message || 'Failed to write backup metadata'
      })
      this.emitter.emit('error', {
        deckId,
        error: error?.message || 'Failed to write backup metadata',
      })
    }
  }

  private async requestUploadUrl(
    deckId: string,
    key: string,
    contentType?: string,
    deckTotalBytes?: number
  ): Promise<string> {
    const response = await fetch('/api/anki/r2/upload-url', {
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

  private async emitStatus(deckId: string): Promise<void> {
    const status = await this.getStatus(deckId)
    this.emitter.emit('progress', { deckId, status })
  }

  private async openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
      request.onupgradeneeded = event => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('deckId', 'deckId', { unique: false })
          store.createIndex('status', 'status', { unique: false })
          store.createIndex('scheduledFor', 'scheduledFor', { unique: false })
          store.createIndex('userId', 'userId', { unique: false })
        }
      }
    })
  }

  private async putJob(job: R2UploadJobRecord): Promise<void> {
    const db = await this.openDb()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const now = Date.now()
    const jobWithTimestamps = {
      ...job,
      createdAt: job.createdAt || now,
      updatedAt: job.updatedAt || now,
    }
    await new Promise<void>((resolve, reject) => {
      const req = store.put(jobWithTimestamps)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
    db.close()
  }

  private async getJob(jobId: string): Promise<R2UploadJobRecord | null> {
    const db = await this.openDb()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const job = await new Promise<R2UploadJobRecord | null>((resolve, reject) => {
      const req = store.get(jobId)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
    db.close()
    return job
  }

  private async updateJob(jobId: string, updates: Partial<R2UploadJobRecord>): Promise<void> {
    const job = await this.getJob(jobId)
    if (!job) return
    const nextJob = { ...job, ...updates, updatedAt: Date.now() }
    await this.putJob(nextJob)
  }

  private async getJobsByDeck(deckId: string): Promise<R2UploadJobRecord[]> {
    const db = await this.openDb()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('deckId')
    const jobs = await new Promise<R2UploadJobRecord[]>((resolve, reject) => {
      const req = index.getAll(deckId)
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })
    db.close()
    return jobs.filter(job => job.userId === this.userId)
  }

  private async getReadyJobs(): Promise<R2UploadJobRecord[]> {
    const now = Date.now()
    const db = await this.openDb()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const statusIndex = store.index('status')

    const pending = await new Promise<R2UploadJobRecord[]>((resolve, reject) => {
      const req = statusIndex.getAll('pending')
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })

    const failed = await new Promise<R2UploadJobRecord[]>((resolve, reject) => {
      const req = statusIndex.getAll('failed')
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })

    db.close()

    return [...pending, ...failed].filter(job => {
      if (job.userId !== this.userId) return false
      if (job.status === 'failed' && job.retryCount >= job.maxRetries) return false
      return job.scheduledFor <= now
    })
  }

  private async recoverStuckUploads(): Promise<void> {
    const now = Date.now()
    const db = await this.openDb()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const statusIndex = store.index('status')

    const uploading = await new Promise<R2UploadJobRecord[]>((resolve, reject) => {
      const req = statusIndex.getAll('uploading')
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    })

    db.close()

    const staleJobs = uploading.filter(job => {
      if (job.userId !== this.userId) return false
      const updatedAt = job.updatedAt || job.createdAt || now
      return now - updatedAt > STUCK_UPLOAD_MS
    })

    if (staleJobs.length === 0) return

    debugLogger.queueStatus('Recovering stuck uploads...', { count: staleJobs.length })

    for (const job of staleJobs) {
      if (this.deletedDecks.has(job.deckId)) {
        continue
      }
      const inflight = this.inFlightControllers.get(job.id)
      if (inflight) {
        inflight.controller.abort()
        this.inFlightControllers.delete(job.id)
      }
      await this.updateJob(job.id, { status: 'pending', scheduledFor: now })
    }
  }
}

let queueInstance: R2UploadQueue | null = null

export function getR2UploadQueue(userId: string): R2UploadQueue {
  if (!queueInstance || queueInstance.userId !== userId) {
    queueInstance?.stop()
    queueInstance = new R2UploadQueue(userId)
  }
  return queueInstance
}
