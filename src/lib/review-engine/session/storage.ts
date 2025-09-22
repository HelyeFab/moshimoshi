/**
 * Storage implementations for review sessions
 * Provides persistence for sessions and statistics
 */

import { ReviewSession, SessionStatistics, SessionSummary } from '../core/session.types';
import { StorageError } from '../core/errors';
import { reviewLogger } from '@/lib/monitoring/logger';

/**
 * Interface for session storage implementations
 */
export interface ISessionStorage {
  saveSession(session: ReviewSession): Promise<void>;
  updateSession(session: ReviewSession): Promise<void>;
  loadSession(sessionId: string): Promise<ReviewSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  
  saveStatistics(stats: SessionStatistics): Promise<void>;
  loadStatistics(sessionId: string): Promise<SessionStatistics | null>;
  
  getUserSessions(userId: string, limit?: number): Promise<ReviewSession[]>;
  getActiveSession(userId: string): Promise<ReviewSession | null>;
  getSessionSummaries(userId: string, limit?: number): Promise<SessionSummary[]>;
  
  clearAllSessions(): Promise<void>;
  getStorageSize(): Promise<number>;
}

/**
 * LocalStorage implementation for session storage
 */
export class LocalSessionStorage implements ISessionStorage {
  private readonly SESSION_KEY = 'review_sessions';
  private readonly STATS_KEY = 'review_statistics';
  private readonly ACTIVE_KEY = 'active_sessions';
  
  async saveSession(session: ReviewSession): Promise<void> {
    try {
      const sessions = await this.getAllSessions();
      sessions[session.id] = this.serializeSession(session);
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessions));
      
      // Track active session
      if (session.status === 'active') {
        await this.setActiveSession(session.userId, session.id);
      }
    } catch (error) {
      throw new StorageError(`Failed to save session ${session.id}: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        storageType: 'memory',
        operation: 'save'
      });
    }
  }
  
  async updateSession(session: ReviewSession): Promise<void> {
    await this.saveSession(session);
  }
  
  async loadSession(sessionId: string): Promise<ReviewSession | null> {
    try {
      const sessions = await this.getAllSessions();
      const session = sessions[sessionId];
      
      if (session) {
        return this.deserializeSession(session);
      }
      
      return null;
    } catch (error) {
      reviewLogger.error('Failed to load session:', error);
      return null;
    }
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.getAllSessions();
      delete sessions[sessionId];
      localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessions));
      
      // Also delete statistics
      const stats = await this.getAllStatistics();
      delete stats[sessionId];
      localStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
    } catch (error) {
      throw new StorageError(`Failed to delete session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        storageType: 'memory',
        operation: 'delete'
      });
    }
  }
  
  async saveStatistics(stats: SessionStatistics): Promise<void> {
    try {
      const allStats = await this.getAllStatistics();
      allStats[stats.sessionId] = stats;
      localStorage.setItem(this.STATS_KEY, JSON.stringify(allStats));
    } catch (error) {
      throw new StorageError(`Failed to save statistics for session ${stats.sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        storageType: 'memory',
        operation: 'save'
      });
    }
  }
  
  async loadStatistics(sessionId: string): Promise<SessionStatistics | null> {
    try {
      const allStats = await this.getAllStatistics();
      return allStats[sessionId] || null;
    } catch (error) {
      reviewLogger.error('Failed to load statistics:', error);
      return null;
    }
  }
  
  async getUserSessions(userId: string, limit = 10): Promise<ReviewSession[]> {
    try {
      const sessions = await this.getAllSessions();
      
      return Object.values(sessions)
        .map(s => this.deserializeSession(s))
        .filter(s => s.userId === userId)
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, limit);
    } catch (error) {
      reviewLogger.error('Failed to get user sessions:', error);
      return [];
    }
  }
  
  async getActiveSession(userId: string): Promise<ReviewSession | null> {
    try {
      const activeSessions = this.getActiveSessions();
      const sessionId = activeSessions[userId];
      
      if (sessionId) {
        const session = await this.loadSession(sessionId);
        if (session && session.status === 'active') {
          return session;
        }
      }
      
      return null;
    } catch (error) {
      reviewLogger.error('Failed to get active session:', error);
      return null;
    }
  }
  
  async getSessionSummaries(userId: string, limit = 10): Promise<SessionSummary[]> {
    try {
      const sessions = await this.getUserSessions(userId, limit);
      const summaries: SessionSummary[] = [];
      
      for (const session of sessions) {
        const stats = await this.loadStatistics(session.id);
        
        summaries.push({
          id: session.id,
          date: session.startedAt,
          duration: session.endedAt 
            ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 60000)
            : 0,
          itemCount: session.items.length,
          accuracy: stats?.accuracy || 0,
          mode: session.mode,
          status: session.status,
          score: stats?.totalScore || 0,
          contentTypes: [...new Set(session.items.map(i => i.content.contentType))]
        });
      }
      
      return summaries;
    } catch (error) {
      reviewLogger.error('Failed to get session summaries:', error);
      return [];
    }
  }
  
  async clearAllSessions(): Promise<void> {
    try {
      localStorage.removeItem(this.SESSION_KEY);
      localStorage.removeItem(this.STATS_KEY);
      localStorage.removeItem(this.ACTIVE_KEY);
    } catch (error) {
      throw new StorageError(`Failed to clear sessions: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        storageType: 'memory',
        operation: 'clear'
      });
    }
  }
  
  async getStorageSize(): Promise<number> {
    try {
      const sessionsSize = new Blob([localStorage.getItem(this.SESSION_KEY) || '']).size;
      const statsSize = new Blob([localStorage.getItem(this.STATS_KEY) || '']).size;
      const activeSize = new Blob([localStorage.getItem(this.ACTIVE_KEY) || '']).size;
      
      return sessionsSize + statsSize + activeSize;
    } catch (error) {
      reviewLogger.error('Failed to get storage size:', error);
      return 0;
    }
  }
  
  private async getAllSessions(): Promise<Record<string, any>> {
    const data = localStorage.getItem(this.SESSION_KEY);
    return data ? JSON.parse(data) : {};
  }
  
  private async getAllStatistics(): Promise<Record<string, SessionStatistics>> {
    const data = localStorage.getItem(this.STATS_KEY);
    return data ? JSON.parse(data) : {};
  }
  
  private getActiveSessions(): Record<string, string> {
    const data = localStorage.getItem(this.ACTIVE_KEY);
    return data ? JSON.parse(data) : {};
  }
  
  private async setActiveSession(userId: string, sessionId: string): Promise<void> {
    const activeSessions = this.getActiveSessions();
    activeSessions[userId] = sessionId;
    localStorage.setItem(this.ACTIVE_KEY, JSON.stringify(activeSessions));
  }
  
  private serializeSession(session: ReviewSession): any {
    return {
      ...session,
      startedAt: session.startedAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      endedAt: session.endedAt?.toISOString(),
      items: session.items.map(item => ({
        ...item,
        presentedAt: item.presentedAt?.toISOString(),
        answeredAt: item.answeredAt?.toISOString()
      }))
    };
  }
  
  private deserializeSession(data: any): ReviewSession {
    return {
      ...data,
      startedAt: new Date(data.startedAt),
      lastActivityAt: new Date(data.lastActivityAt),
      endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
      items: data.items.map((item: any) => ({
        ...item,
        presentedAt: item.presentedAt ? new Date(item.presentedAt) : undefined,
        answeredAt: item.answeredAt ? new Date(item.answeredAt) : undefined
      }))
    };
  }
}

/**
 * IndexedDB implementation for better performance with large datasets
 */
export class IndexedDBSessionStorage implements ISessionStorage {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'ReviewEngineDB';
  private readonly DB_VERSION = 1;
  private readonly SESSIONS_STORE = 'sessions';
  private readonly STATS_STORE = 'statistics';
  
  constructor() {
    this.initDB();
  }
  
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create sessions store
        if (!db.objectStoreNames.contains(this.SESSIONS_STORE)) {
          const sessionsStore = db.createObjectStore(this.SESSIONS_STORE, { keyPath: 'id' });
          sessionsStore.createIndex('userId', 'userId', { unique: false });
          sessionsStore.createIndex('status', 'status', { unique: false });
          sessionsStore.createIndex('startedAt', 'startedAt', { unique: false });
        }
        
        // Create statistics store
        if (!db.objectStoreNames.contains(this.STATS_STORE)) {
          const statsStore = db.createObjectStore(this.STATS_STORE, { keyPath: 'sessionId' });
          statsStore.createIndex('userId', 'userId', { unique: false });
        }
      };
    });
  }
  
  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.initDB();
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    return this.db;
  }
  
  async saveSession(session: ReviewSession): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.SESSIONS_STORE], 'readwrite');
    const store = transaction.objectStore(this.SESSIONS_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.put(this.serializeForIndexedDB(session));
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save session'));
    });
  }
  
  async updateSession(session: ReviewSession): Promise<void> {
    return this.saveSession(session);
  }
  
  async loadSession(sessionId: string): Promise<ReviewSession | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.SESSIONS_STORE], 'readonly');
    const store = transaction.objectStore(this.SESSIONS_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(sessionId);
      request.onsuccess = () => {
        const data = request.result;
        resolve(data ? this.deserializeFromIndexedDB(data) : null);
      };
      request.onerror = () => reject(new Error('Failed to load session'));
    });
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.SESSIONS_STORE, this.STATS_STORE], 'readwrite');
    
    return new Promise((resolve, reject) => {
      const sessionsRequest = transaction.objectStore(this.SESSIONS_STORE).delete(sessionId);
      const statsRequest = transaction.objectStore(this.STATS_STORE).delete(sessionId);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to delete session'));
    });
  }
  
  async saveStatistics(stats: SessionStatistics): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.STATS_STORE], 'readwrite');
    const store = transaction.objectStore(this.STATS_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.put(stats);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error('Failed to save statistics'));
    });
  }
  
  async loadStatistics(sessionId: string): Promise<SessionStatistics | null> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.STATS_STORE], 'readonly');
    const store = transaction.objectStore(this.STATS_STORE);
    
    return new Promise((resolve, reject) => {
      const request = store.get(sessionId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(new Error('Failed to load statistics'));
    });
  }
  
  async getUserSessions(userId: string, limit = 10): Promise<ReviewSession[]> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.SESSIONS_STORE], 'readonly');
    const store = transaction.objectStore(this.SESSIONS_STORE);
    const index = store.index('userId');
    
    return new Promise((resolve, reject) => {
      const sessions: ReviewSession[] = [];
      const request = index.openCursor(IDBKeyRange.only(userId));
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor && sessions.length < limit) {
          sessions.push(this.deserializeFromIndexedDB(cursor.value));
          cursor.continue();
        } else {
          resolve(sessions.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()));
        }
      };
      
      request.onerror = () => reject(new Error('Failed to get user sessions'));
    });
  }
  
  async getActiveSession(userId: string): Promise<ReviewSession | null> {
    const sessions = await this.getUserSessions(userId, 100);
    return sessions.find(s => s.status === 'active') || null;
  }
  
  async getSessionSummaries(userId: string, limit = 10): Promise<SessionSummary[]> {
    const sessions = await this.getUserSessions(userId, limit);
    const summaries: SessionSummary[] = [];
    
    for (const session of sessions) {
      const stats = await this.loadStatistics(session.id);
      
      summaries.push({
        id: session.id,
        date: session.startedAt,
        duration: session.endedAt 
          ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 60000)
          : 0,
        itemCount: session.items.length,
        accuracy: stats?.accuracy || 0,
        mode: session.mode,
        status: session.status,
        score: stats?.totalScore || 0,
        contentTypes: [...new Set(session.items.map(i => i.content.contentType))]
      });
    }
    
    return summaries;
  }
  
  async clearAllSessions(): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([this.SESSIONS_STORE, this.STATS_STORE], 'readwrite');
    
    return new Promise((resolve, reject) => {
      const sessionsRequest = transaction.objectStore(this.SESSIONS_STORE).clear();
      const statsRequest = transaction.objectStore(this.STATS_STORE).clear();
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(new Error('Failed to clear sessions'));
    });
  }
  
  async getStorageSize(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }
    return 0;
  }
  
  private serializeForIndexedDB(session: ReviewSession): any {
    return {
      ...session,
      startedAt: session.startedAt.toISOString(),
      lastActivityAt: session.lastActivityAt.toISOString(),
      endedAt: session.endedAt?.toISOString()
    };
  }
  
  private deserializeFromIndexedDB(data: any): ReviewSession {
    return {
      ...data,
      startedAt: new Date(data.startedAt),
      lastActivityAt: new Date(data.lastActivityAt),
      endedAt: data.endedAt ? new Date(data.endedAt) : undefined
    };
  }
}

/**
 * Factory function to create storage instance
 */
export function createSessionStorage(type: 'local' | 'indexeddb' = 'local'): ISessionStorage {
  switch (type) {
    case 'indexeddb':
      return new IndexedDBSessionStorage();
    case 'local':
    default:
      return new LocalSessionStorage();
  }
}