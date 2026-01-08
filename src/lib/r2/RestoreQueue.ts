import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { BackupInfo } from '@/types/r2'

export type RestoreJobStatus = 'pending' | 'in_progress' | 'paused' | 'error' | 'completed'

export interface RestoreJob {
  id: string
  userId: string
  deckName: string
  cardCount: number
  hasMedia: boolean
  lastBackup: number
  manifestKey: string
  packageKey?: string
  status: RestoreJobStatus
  totalFiles: number
  downloadedFiles: string[]
  createdAt: number
  updatedAt: number
  lastError?: string
}

interface RestoreQueueDB extends DBSchema {
  restoreJobs: {
    key: string
    value: RestoreJob
    indexes: { 'userId': string; 'status': RestoreJobStatus }
  }
}

export class RestoreQueue {
  private static instance: RestoreQueue | null = null
  private db?: IDBPDatabase<RestoreQueueDB>
  private dbName = 'FlashcardRestoreDB'
  private dbVersion = 1

  static getInstance(): RestoreQueue {
    if (!this.instance) {
      this.instance = new RestoreQueue()
    }
    return this.instance
  }

  private async getDB(): Promise<IDBPDatabase<RestoreQueueDB>> {
    if (this.db) return this.db
    this.db = await openDB<RestoreQueueDB>(this.dbName, this.dbVersion, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('restoreJobs')) {
          const store = db.createObjectStore('restoreJobs', { keyPath: 'id' })
          store.createIndex('userId', 'userId')
          store.createIndex('status', 'status')
        }
      },
    })
    return this.db
  }

  async upsertJob(job: RestoreJob): Promise<void> {
    const db = await this.getDB()
    await db.put('restoreJobs', job)
  }

  async upsertJobFromBackup(backup: BackupInfo, userId: string): Promise<RestoreJob> {
    const existing = await this.getJob(backup.deckId)
    const now = Date.now()
    const job: RestoreJob = {
      id: backup.deckId,
      userId,
      deckName: backup.name,
      cardCount: backup.cardCount,
      hasMedia: backup.hasMedia,
      lastBackup: backup.lastBackup instanceof Date ? backup.lastBackup.getTime() : Date.now(),
      manifestKey: backup.r2Keys.manifestKey,
      packageKey: backup.r2Keys.packageKey,
      status: existing?.status ?? 'pending',
      totalFiles: existing?.totalFiles ?? 0,
      downloadedFiles: existing?.downloadedFiles ?? [],
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      lastError: existing?.lastError,
    }
    await this.upsertJob(job)
    return job
  }

  async getJob(deckId: string): Promise<RestoreJob | undefined> {
    const db = await this.getDB()
    return db.get('restoreJobs', deckId)
  }

  async getActiveJobs(userId: string): Promise<RestoreJob[]> {
    const db = await this.getDB()
    const jobs = await db.getAllFromIndex('restoreJobs', 'userId', userId)
    return jobs.filter(job =>
      job.status === 'pending' || job.status === 'in_progress' || job.status === 'paused'
    )
  }

  async setTotalFiles(deckId: string, totalFiles: number): Promise<void> {
    const job = await this.getJob(deckId)
    if (!job) return
    job.totalFiles = totalFiles
    job.updatedAt = Date.now()
    await this.upsertJob(job)
  }

  async addDownloadedFile(deckId: string, filename: string): Promise<void> {
    const job = await this.getJob(deckId)
    if (!job) return
    if (!job.downloadedFiles.includes(filename)) {
      job.downloadedFiles.push(filename)
      job.updatedAt = Date.now()
      await this.upsertJob(job)
    }
  }

  async markStatus(deckId: string, status: RestoreJobStatus, error?: string): Promise<void> {
    const job = await this.getJob(deckId)
    if (!job) return
    job.status = status
    job.updatedAt = Date.now()
    job.lastError = error
    await this.upsertJob(job)
  }

  async clearJob(deckId: string): Promise<void> {
    const db = await this.getDB()
    await db.delete('restoreJobs', deckId)
  }
}
