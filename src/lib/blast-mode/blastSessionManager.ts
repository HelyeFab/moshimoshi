/**
 * Blast Session Manager
 * Saves completed sessions to IndexedDB (all users) and Firebase (premium users).
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'
import type { BlastLessonProgressRecord, BlastSessionRecord } from './types'

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
      data: BlastSessionRecord
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

class BlastSessionManager {
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

  private async saveToIndexedDB(session: BlastSessionRecord): Promise<void> {
    await this.initDB()
    if (!this.db) return

    const existing = await this.db.getFromIndex('sessions', 'by-session', session.sessionId)
    if (existing) {
      await this.db.put('sessions', { ...existing, data: session })
      return
    }

    try {
      await this.db.add('sessions', {
        sessionId: session.sessionId,
        userId: session.userId,
        data: session
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'ConstraintError') {
        const nowExisting = await this.db.getFromIndex('sessions', 'by-session', session.sessionId)
        if (nowExisting) {
          await this.db.put('sessions', { ...nowExisting, data: session })
        }
      } else {
        console.error('[BlastSessionManager] Failed to save session to IndexedDB:', error)
      }
    }
  }

  private async queueSync(session: BlastSessionRecord): Promise<void> {
    await this.initDB()
    if (!this.db) return

    try {
      await this.db.add('syncQueue', {
        type: 'session',
        userId: session.userId,
        contentType: 'blast',
        data: session,
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending'
      })
    } catch (error) {
      console.error('[BlastSessionManager] Failed to queue session sync:', error)
    }
  }

  private async syncToFirebase(session: BlastSessionRecord): Promise<boolean> {
    try {
      const response = await fetch('/api/blast/session/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(session)
      })
      return response.ok
    } catch (error) {
      console.error('[BlastSessionManager] Firebase sync failed:', error)
      return false
    }
  }

  private getTimeValue(value?: string): number {
    if (!value) return 0
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  private async fetchRemoteSessions(limit: number): Promise<BlastSessionRecord[]> {
    const response = await fetch(`/api/blast/sessions?limit=${limit}`, {
      credentials: 'include'
    })
    if (!response.ok) return []
    const data = await response.json()
    return (data.sessions || []).map((s: any) => ({
      sessionId: s.sessionId,
      userId: s.userId,
      contentType: s.contentType,
      level: s.level || undefined,
      listId: s.listId || undefined,
      selectedKanji: s.selectedKanji || undefined,
      studiedItems: s.studiedItems,
      accuracy: s.accuracy,
      completedAt: s.completedAt || new Date().toISOString(),
      source: s.source || 'blast-mode'
    })) as BlastSessionRecord[]
  }

  async saveCompletedSession(session: BlastSessionRecord, isPremium: boolean): Promise<void> {
    await this.saveToIndexedDB(session)

    if (!isPremium || !session.userId || session.userId === 'guest') {
      return
    }

    const ok = await this.syncToFirebase(session)
    if (!ok) {
      await this.queueSync(session)
    }
  }

  async syncOnEntry(userId: string, isPremium: boolean, limit: number = 50): Promise<void> {
    if (!isPremium || !userId || userId === 'guest') return

    const localAll = await this.getLocalSessions(userId)
    const localSorted = [...localAll].sort(
      (a, b) => this.getTimeValue(b.completedAt) - this.getTimeValue(a.completedAt)
    )
    const localRecent = localSorted.slice(0, limit)
    const remote = await this.fetchRemoteSessions(limit)

    const remoteMap = new Map(remote.map(item => [item.sessionId, item]))
    const localMap = new Map(localAll.map(item => [item.sessionId, item]))

    // Pull missing or newer remote sessions into local IndexedDB
    for (const remoteItem of remote) {
      const localItem = localMap.get(remoteItem.sessionId)
      if (!localItem) {
        await this.saveToIndexedDB(remoteItem)
        continue
      }
      const remoteTime = this.getTimeValue(remoteItem.completedAt)
      const localTime = this.getTimeValue(localItem.completedAt)
      if (remoteTime > localTime) {
        await this.saveToIndexedDB(remoteItem)
      }
    }

    // Push missing or newer local sessions to Firebase
    for (const localItem of localRecent) {
      const remoteItem = remoteMap.get(localItem.sessionId)
      if (!remoteItem) {
        const ok = await this.syncToFirebase(localItem)
        if (!ok) await this.queueSync(localItem)
        continue
      }
      const remoteTime = this.getTimeValue(remoteItem.completedAt)
      const localTime = this.getTimeValue(localItem.completedAt)
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
      if (item.type !== 'session' || item.contentType !== 'blast') continue
      const ok = await this.syncToFirebase(item.data as BlastSessionRecord)
      if (ok && item.id) {
        await this.db.delete('syncQueue', item.id)
      }
    }
  }

  async getLocalSessions(userId: string): Promise<BlastSessionRecord[]> {
    await this.initDB()
    if (!this.db) return []

    const tx = this.db.transaction('sessions', 'readonly')
    const store = tx.objectStore('sessions')
    const sessions = await store.index('by-user').getAll(userId)
    return sessions.map(entry => entry.data)
  }

  async getSessionHistory(userId: string, isPremium: boolean): Promise<BlastSessionRecord[]> {
    const local = await this.getLocalSessions(userId)
    if (!isPremium || !userId || userId === 'guest') {
      return local.sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    }

    try {
      const remote = await this.fetchRemoteSessions(50)

      const map = new Map<string, BlastSessionRecord>()
      for (const item of [...local, ...remote]) {
        map.set(item.sessionId, item)
      }
      return Array.from(map.values()).sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    } catch (error) {
      console.error('[BlastSessionManager] Failed to load session history:', error)
      return local.sort((a, b) => b.completedAt.localeCompare(a.completedAt))
    }
  }
}

export const blastSessionManager = new BlastSessionManager()
