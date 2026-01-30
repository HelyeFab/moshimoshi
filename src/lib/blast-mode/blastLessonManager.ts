/**
 * Blast Lesson Manager
 * Saves lesson progress to IndexedDB (all users) and Firebase (premium users).
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { BlastLessonProgressRecord } from './types'

interface ProgressDBSchema extends DBSchema {
  progress: {
    key: number
    value: {
      id?: number
      userId: string
      contentType: string
      contentId: string
      compositeKey: string
      data: any
      updatedAt: Date
      syncedAt?: Date
    }
    indexes: {
      'by-user': string
      'by-content-type': string
      'by-composite-key': string
      'by-sync': Date
    }
  }
  sessions: {
    key: number
    value: {
      id?: number
      sessionId: string
      userId: string
      data: any
      syncedAt?: Date
    }
    indexes: {
      'by-session': string
      'by-user': string
    }
  }
  lessonProgress: {
    key: number
    value: {
      id?: number
      lessonId: string
      userId: string
      level: string
      data: BlastLessonProgressRecord
      syncedAt?: Date
    }
    indexes: {
      'by-lesson': string
      'by-user': string
      'by-level': string
    }
  }
  syncQueue: {
    key: number
    value: {
      id?: number
      type: 'progress' | 'session' | 'lesson'
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

class BlastLessonManager {
  private db: IDBPDatabase<ProgressDBSchema> | null = null
  private readonly dbName = 'moshimoshi-universal-progress'
  private readonly dbVersion = 3

  private async initDB(): Promise<void> {
    if (this.db) return
    if (typeof window === 'undefined') return

    this.db = await openDB<ProgressDBSchema>(this.dbName, this.dbVersion, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (oldVersion < 2) {
          if (db.objectStoreNames.contains('progress')) {
            const progressStore = transaction.objectStore('progress')
            if (progressStore.indexNames.contains('by-composite' as any)) {
              progressStore.deleteIndex('by-composite' as any)
            }
            if (!progressStore.indexNames.contains('by-composite-key')) {
              progressStore.createIndex('by-composite-key', 'compositeKey', {
                unique: true
              })
            }
          }
        }

        if (!db.objectStoreNames.contains('progress')) {
          const progressStore = db.createObjectStore('progress', {
            keyPath: 'id',
            autoIncrement: true
          })
          progressStore.createIndex('by-user', 'userId')
          progressStore.createIndex('by-content-type', 'contentType')
          progressStore.createIndex('by-composite-key', 'compositeKey', { unique: true })
          progressStore.createIndex('by-sync', 'syncedAt')
        }

        if (!db.objectStoreNames.contains('sessions')) {
          const sessionsStore = db.createObjectStore('sessions', {
            keyPath: 'id',
            autoIncrement: true
          })
          sessionsStore.createIndex('by-session', 'sessionId', { unique: true })
          sessionsStore.createIndex('by-user', 'userId')
        }

        if (!db.objectStoreNames.contains('lessonProgress')) {
          const lessonStore = db.createObjectStore('lessonProgress', {
            keyPath: 'id',
            autoIncrement: true
          })
          lessonStore.createIndex('by-lesson', 'lessonId', { unique: true })
          lessonStore.createIndex('by-user', 'userId')
          lessonStore.createIndex('by-level', 'level')
        }

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
  }

  private async saveToIndexedDB(record: BlastLessonProgressRecord): Promise<void> {
    await this.initDB()
    if (!this.db) return

    const existing = await this.db.getFromIndex('lessonProgress', 'by-lesson', record.lessonId)
    if (existing) {
      await this.db.put('lessonProgress', { ...existing, data: record, level: record.level })
      return
    }

    try {
      await this.db.add('lessonProgress', {
        lessonId: record.lessonId,
        userId: record.userId,
        level: record.level,
        data: record
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'ConstraintError') {
        const nowExisting = await this.db.getFromIndex('lessonProgress', 'by-lesson', record.lessonId)
        if (nowExisting) {
          await this.db.put('lessonProgress', { ...nowExisting, data: record, level: record.level })
        }
      } else {
        console.error('[BlastLessonManager] Failed to save lesson to IndexedDB:', error)
      }
    }
  }

  private async queueSync(record: BlastLessonProgressRecord): Promise<void> {
    await this.initDB()
    if (!this.db) return

    try {
      await this.db.add('syncQueue', {
        type: 'lesson',
        userId: record.userId,
        contentType: 'blast-lesson',
        data: record,
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending'
      })
    } catch (error) {
      console.error('[BlastLessonManager] Failed to queue lesson sync:', error)
    }
  }

  private async syncToFirebase(record: BlastLessonProgressRecord): Promise<boolean> {
    try {
      const response = await fetch('/api/blast/lesson/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(record)
      })
      return response.ok
    } catch (error) {
      console.error('[BlastLessonManager] Firebase sync failed:', error)
      return false
    }
  }

  private getTimeValue(record: BlastLessonProgressRecord): number {
    const candidate = record.updatedAt || record.completedAt || record.lastAttemptAt
    if (!candidate) return 0
    const parsed = Date.parse(candidate)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  private async fetchRemoteLessons(level?: string, limit: number = 50): Promise<BlastLessonProgressRecord[]> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (level) params.set('level', level)
    const response = await fetch(`/api/blast/lesson/progress?${params.toString()}`, {
      credentials: 'include'
    })
    if (!response.ok) return []
    const data = await response.json()
    return (data.lessons || []).map((item: any) => ({
      lessonId: item.lessonId,
      userId: item.userId,
      level: item.level,
      lessonIndex: item.lessonIndex,
      lessonSize: item.lessonSize,
      totalLessons: item.totalLessons,
      kanjiIds: item.kanjiIds || [],
      accuracy: item.accuracy,
      completed: Boolean(item.completed),
      attempts: item.attempts || 0,
      lastAttemptAt: item.lastAttemptAt,
      completedAt: item.completedAt || undefined,
      updatedAt: item.updatedAt || item.lastAttemptAt,
      source: item.source || 'blast-lesson'
    })) as BlastLessonProgressRecord[]
  }

  async saveLessonProgress(record: BlastLessonProgressRecord, isPremium: boolean): Promise<void> {
    await this.saveToIndexedDB(record)

    if (!isPremium || !record.userId || record.userId === 'guest') {
      return
    }

    const ok = await this.syncToFirebase(record)
    if (!ok) {
      await this.queueSync(record)
    }
  }

  async syncOnEntry(
    userId: string,
    isPremium: boolean,
    level?: string,
    limit: number = 50
  ): Promise<void> {
    if (!isPremium || !userId || userId === 'guest') return

    const localAll = await this.getLocalLessons(userId, level)
    const localSorted = [...localAll].sort((a, b) => this.getTimeValue(b) - this.getTimeValue(a))
    const localRecent = localSorted.slice(0, limit)
    const remote = await this.fetchRemoteLessons(level, limit)

    const remoteMap = new Map(remote.map(item => [item.lessonId, item]))
    const localMap = new Map(localAll.map(item => [item.lessonId, item]))

    for (const remoteItem of remote) {
      const localItem = localMap.get(remoteItem.lessonId)
      if (!localItem) {
        await this.saveToIndexedDB(remoteItem)
        continue
      }
      const remoteTime = this.getTimeValue(remoteItem)
      const localTime = this.getTimeValue(localItem)
      if (remoteTime > localTime) {
        await this.saveToIndexedDB(remoteItem)
      }
    }

    for (const localItem of localRecent) {
      const remoteItem = remoteMap.get(localItem.lessonId)
      if (!remoteItem) {
        const ok = await this.syncToFirebase(localItem)
        if (!ok) await this.queueSync(localItem)
        continue
      }
      const remoteTime = this.getTimeValue(remoteItem)
      const localTime = this.getTimeValue(localItem)
      if (localTime > remoteTime) {
        const ok = await this.syncToFirebase(localItem)
        if (!ok) await this.queueSync(localItem)
      }
    }
  }

  async processSyncQueue(): Promise<void> {
    await this.initDB()
    if (!this.db) return

    const tx = this.db.transaction('syncQueue', 'readwrite')
    const pending = await tx.store.index('by-status').getAll('pending')

    for (const item of pending) {
      if (item.type !== 'lesson' || item.contentType !== 'blast-lesson') continue
      const ok = await this.syncToFirebase(item.data as BlastLessonProgressRecord)
      if (ok && item.id) {
        await this.db.delete('syncQueue', item.id)
      }
    }
  }

  async getLocalLessons(userId: string, level?: string): Promise<BlastLessonProgressRecord[]> {
    await this.initDB()
    if (!this.db) return []

    const tx = this.db.transaction('lessonProgress', 'readonly')
    const store = tx.objectStore('lessonProgress')
    const records = await store.index('by-user').getAll(userId)
    const filtered = level ? records.filter(entry => entry.level === level) : records
    return filtered.map(entry => entry.data)
  }
}

export const blastLessonManager = new BlastLessonManager()
