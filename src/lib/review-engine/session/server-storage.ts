/**
 * Server-side storage implementation for review sessions
 * Uses Firebase Firestore for persistence and Redis for caching
 */

import { ReviewSession, SessionStatistics, SessionSummary } from '../core/session.types';
import { ISessionStorage } from './storage';
import { StorageError } from '../core/errors';
import { adminFirestore as db } from '@/lib/firebase/admin';
import { redis } from '@/lib/redis/client';
import { reviewLogger } from '@/lib/monitoring/logger';

/**
 * Server-side storage implementation using Firebase and Redis
 */
export class ServerSessionStorage implements ISessionStorage {
  private readonly CACHE_TTL = 3600; // 1 hour in seconds
  
  async saveSession(session: ReviewSession): Promise<void> {
    try {
      // Save to Firebase
      if (!db) {
        throw new StorageError('Firestore admin not initialized');
      }
      await db.collection('reviewSessions').doc(session.id).set(this.serializeSession(session));
      
      // Cache in Redis
      await this.cacheSession(session.id, session);
      
      // Track active session
      if (session.status === 'active') {
        await redis.setex(
          `review:session:active:${session.userId}`,
          this.CACHE_TTL,
          JSON.stringify({
            sessionId: session.id,
            startedAt: session.startedAt,
            itemCount: session.items.length,
          })
        );
      }
    } catch (error) {
      throw new StorageError(`Failed to save session ${session.id}: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        storageType: 'firestore',
        operation: 'save'
      });
    }
  }
  
  async updateSession(session: ReviewSession): Promise<void> {
    try {
      // Update in Firebase
      if (!db) {
        throw new StorageError('Firestore admin not initialized');
      }
      await db.collection('reviewSessions').doc(session.id).update(this.serializeSession(session));
      
      // Update cache
      await this.cacheSession(session.id, session);
    } catch (error) {
      throw new StorageError(`Failed to update session ${session.id}: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        storageType: 'firestore',
        operation: 'update'
      });
    }
  }
  
  async loadSession(sessionId: string): Promise<ReviewSession | null> {
    try {
      // Try cache first
      const cached = await redis.get(`session:${sessionId}`);
      if (cached) {
        return this.deserializeSession(JSON.parse(cached));
      }
      
      // Fallback to database
      if (!db) {
        throw new StorageError('Firestore admin not initialized');
      }
      const doc = await db.collection('reviewSessions').doc(sessionId).get();
      if (!doc.exists) {
        return null;
      }
      
      const session = this.deserializeSession({ id: doc.id, ...doc.data() });
      
      // Re-cache for future requests
      await this.cacheSession(sessionId, session);
      
      return session;
    } catch (error) {
      reviewLogger.error('Failed to load session:', error);
      return null;
    }
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    try {
      // Delete from Firebase
      if (!db) {
        throw new StorageError('Firestore admin not initialized');
      }
      await db.collection('reviewSessions').doc(sessionId).delete();
      
      // Delete from cache
      await redis.del(`session:${sessionId}`);
      
      // Delete statistics
      await db.collection('sessionStatistics').doc(sessionId).delete();
    } catch (error) {
      throw new StorageError(`Failed to delete session ${sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        storageType: 'firestore',
        operation: 'delete'
      });
    }
  }
  
  async saveStatistics(stats: SessionStatistics): Promise<void> {
    try {
      if (!db) {
        throw new StorageError('Firestore admin not initialized');
      }
      await db.collection('sessionStatistics').doc(stats.sessionId).set(stats);
    } catch (error) {
      throw new StorageError(`Failed to save statistics for session ${stats.sessionId}: ${error instanceof Error ? error.message : 'Unknown error'}`, {
        storageType: 'firestore',
        operation: 'save'
      });
    }
  }
  
  async loadStatistics(sessionId: string): Promise<SessionStatistics | null> {
    try {
      if (!db) {
        throw new StorageError('Firestore admin not initialized');
      }
      const doc = await db.collection('sessionStatistics').doc(sessionId).get();
      return doc.exists ? doc.data() as SessionStatistics : null;
    } catch (error) {
      reviewLogger.error('Failed to load statistics:', error);
      return null;
    }
  }
  
  async getUserSessions(userId: string, limit = 10): Promise<ReviewSession[]> {
    try {
      if (!db) {
        throw new StorageError('Firestore admin not initialized');
      }
      const snapshot = await db.collection('reviewSessions')
        .where('userId', '==', userId)
        .orderBy('startedAt', 'desc')
        .limit(limit)
        .get();
      
      return snapshot.docs.map(doc => 
        this.deserializeSession({ id: doc.id, ...doc.data() })
      );
    } catch (error) {
      reviewLogger.error('Failed to get user sessions:', error);
      return [];
    }
  }
  
  async getActiveSession(userId: string): Promise<ReviewSession | null> {
    try {
      // Check Redis for active session
      const activeKey = `review:session:active:${userId}`;
      const activeData = await redis.get(activeKey);
      
      if (activeData) {
        const { sessionId } = JSON.parse(activeData);
        return await this.loadSession(sessionId);
      }
      
      // Fallback to database query
      if (!db) {
        throw new StorageError('Firestore admin not initialized');
      }
      const snapshot = await db.collection('reviewSessions')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return null;
      }
      
      const doc = snapshot.docs[0];
      return this.deserializeSession({ id: doc.id, ...doc.data() });
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
    // This is intentionally not implemented for server-side storage
    // to prevent accidental data loss
    throw new Error('clearAllSessions is not supported in server storage');
  }
  
  async getStorageSize(): Promise<number> {
    // Return 0 as storage size is not relevant for server-side storage
    return 0;
  }
  
  private async cacheSession(sessionId: string, session: ReviewSession): Promise<void> {
    try {
      await redis.setex(
        `session:${sessionId}`,
        this.CACHE_TTL,
        JSON.stringify(this.serializeSession(session))
      );
    } catch (error) {
      reviewLogger.error('Failed to cache session:', error);
      // Don't throw - caching is not critical
    }
  }
  
  private serializeSession(session: ReviewSession): any {
    return {
      ...session,
      startedAt: session.startedAt instanceof Date ? session.startedAt.toISOString() : session.startedAt,
      lastActivityAt: session.lastActivityAt instanceof Date ? session.lastActivityAt.toISOString() : session.lastActivityAt,
      endedAt: session.endedAt instanceof Date ? session.endedAt.toISOString() : session.endedAt,
      items: session.items.map(item => ({
        ...item,
        presentedAt: item.presentedAt instanceof Date ? item.presentedAt.toISOString() : item.presentedAt,
        answeredAt: item.answeredAt instanceof Date ? item.answeredAt.toISOString() : item.answeredAt
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