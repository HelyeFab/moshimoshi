import { openDB, DBSchema, IDBPDatabase } from 'idb';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { firestore as db } from '@/lib/firebase/client';
import { User } from 'firebase/auth';
import logger from '@/lib/logger';

// Progress status for characters
export type ProgressStatus = 'not-started' | 'learning' | 'learned';

// Character progress interface
export interface CharacterProgress {
  status: ProgressStatus;
  reviewCount: number;
  correctCount: number;
  lastReviewed?: Date;
  pinned: boolean;
  updatedAt: Date;
}

// Extended progress with metadata
interface StoredProgress extends CharacterProgress {
  characterId: string;
  userId: string;
  script: 'hiragana' | 'katakana';
}

// IndexedDB Schema
interface ProgressDBSchema extends DBSchema {
  hiraganaProgress: {
    key: number;
    value: StoredProgress & { id?: number; compositeKey?: string };
    indexes: {
      'by-user': string;
      'by-updated': number;
      'by-composite': string;
    };
  };
  katakanaProgress: {
    key: number;
    value: StoredProgress & { id?: number; compositeKey?: string };
    indexes: {
      'by-user': string;
      'by-updated': number;
      'by-composite': string;
    };
  };
  kanjiProgress: {
    key: number;
    value: StoredProgress & {
      id?: number;
      jlptLevel?: number;
      strokeCount?: number;
      compositeKey?: string;
    };
    indexes: {
      'by-user': string;
      'by-updated': number;
      'by-jlpt': number;
      'by-composite': string;
    };
  };
  syncQueue: {
    key: number;
    value: {
      id?: number;
      type: 'progress-update';
      script: string;
      userId: string;
      data: any;
      timestamp: number;
      retryCount: number;
      status: 'pending' | 'syncing' | 'completed' | 'failed';
    };
  };
}

// Firebase document structure
interface FirebaseProgressDoc {
  userId: string;
  script: 'hiragana' | 'katakana' | 'kanji';
  characters: Record<string, CharacterProgress>;
  totalLearned: number;
  totalCharacters: number;
  lastSync: Timestamp;
  updatedAt: Timestamp;
}

export class KanaProgressManager {
  private static instance: KanaProgressManager;
  private db: IDBPDatabase<ProgressDBSchema> | null = null;
  private readonly DB_NAME = 'moshimoshi-progress';
  private readonly DB_VERSION = 2;
  private syncTimeout: NodeJS.Timeout | null = null;
  private pendingUpdates: Map<string, any> = new Map();
  private readonly SYNC_DELAY = 500; // Debounce delay in ms
  private readonly BATCH_SYNC_INTERVAL = 30000; // 30 seconds
  private batchSyncInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Only initialize on client side
    if (typeof window !== 'undefined') {
      this.initDB();
      this.setupNetworkListeners();
    }
  }

  static getInstance(): KanaProgressManager {
    if (!KanaProgressManager.instance) {
      KanaProgressManager.instance = new KanaProgressManager();
    }
    return KanaProgressManager.instance;
  }

  private async initDB(): Promise<void> {
    if (this.db) return;

    try {
      this.db = await openDB<ProgressDBSchema>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
          // Delete old stores if they exist (handles both version 1 and fresh installs)
          if (db.objectStoreNames.contains('hiraganaProgress')) {
            db.deleteObjectStore('hiraganaProgress');
          }
          if (db.objectStoreNames.contains('katakanaProgress')) {
            db.deleteObjectStore('katakanaProgress');
          }
          if (db.objectStoreNames.contains('kanjiProgress')) {
            db.deleteObjectStore('kanjiProgress');
          }

          // Create hiragana progress store with string-based composite index
          if (!db.objectStoreNames.contains('hiraganaProgress')) {
            const hiraganaStore = db.createObjectStore('hiraganaProgress', {
              keyPath: 'id',
              autoIncrement: true
            });
            hiraganaStore.createIndex('by-user', 'userId');
            hiraganaStore.createIndex('by-updated', 'updatedAt');
            hiraganaStore.createIndex('by-composite', 'compositeKey', { unique: true });
          }

          // Create katakana progress store with string-based composite index
          if (!db.objectStoreNames.contains('katakanaProgress')) {
            const katakanaStore = db.createObjectStore('katakanaProgress', {
              keyPath: 'id',
              autoIncrement: true
            });
            katakanaStore.createIndex('by-user', 'userId');
            katakanaStore.createIndex('by-updated', 'updatedAt');
            katakanaStore.createIndex('by-composite', 'compositeKey', { unique: true });
          }

          // Create kanji progress store with string-based composite index
          if (!db.objectStoreNames.contains('kanjiProgress')) {
            const kanjiStore = db.createObjectStore('kanjiProgress', {
              keyPath: 'id',
              autoIncrement: true
            });
            kanjiStore.createIndex('by-user', 'userId');
            kanjiStore.createIndex('by-updated', 'updatedAt');
            kanjiStore.createIndex('by-jlpt', 'jlptLevel');
            kanjiStore.createIndex('by-composite', 'compositeKey', { unique: true });
          }

          // Create sync queue store
          if (!db.objectStoreNames.contains('syncQueue')) {
            const syncStore = db.createObjectStore('syncQueue', {
              keyPath: 'id',
              autoIncrement: true
            });
          }
        },
      });

      logger.kana('IndexedDB initialized successfully');
    } catch (error) {
      logger.error('[KanaProgressManager] Failed to initialize IndexedDB:', error);
      this.db = null;
    }
  }

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined' || !window.addEventListener) return;

    window.addEventListener('online', () => {
      logger.kana('Network restored, processing sync queue...');
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      logger.kana('Network lost, pausing sync...');
    });

    // Set up batch sync interval for premium users
    this.batchSyncInterval = setInterval(() => {
      if (navigator.onLine && this.pendingUpdates.size > 0) {
        this.processPendingUpdates();
      }
    }, this.BATCH_SYNC_INTERVAL);
  }

  /**
   * Save progress for a character
   * @param script - 'hiragana' or 'katakana'
   * @param characterId - The character ID (e.g., 'a', 'ka')
   * @param progress - The progress data
   * @param user - The authenticated user (null for guests)
   * @param isPremium - Whether the user has a premium subscription
   */
  async saveProgress(
    script: 'hiragana' | 'katakana',
    characterId: string,
    progress: CharacterProgress,
    user: User | null,
    isPremium: boolean
  ): Promise<void> {
    // Guest users: no storage at all
    if (!user) {
      logger.kana('Guest user - no storage');
      return;
    }

    const userId = user.uid;
    const storeName = script === 'hiragana' ? 'hiraganaProgress' : 'katakanaProgress';

    // Ensure updatedAt is set
    progress.updatedAt = new Date();

    // Save to IndexedDB for all logged-in users (free and premium)
    await this.saveToIndexedDB(storeName, userId, characterId, progress, script);

    // For premium users, also sync to Firebase
    if (isPremium) {
      // Debounce Firebase updates
      this.queueFirebaseUpdate(script, userId, characterId, progress);
    }
  }

  /**
   * Remove undefined values from an object (for storage compatibility)
   */
  private cleanForStorage(obj: any): any {
    if (obj === undefined || obj === null) return null;
    if (obj instanceof Date) return obj;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.cleanForStorage(item));

    const cleaned: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = this.cleanForStorage(value);
      }
    }
    return cleaned;
  }

  private async saveToIndexedDB(
    storeName: 'hiraganaProgress' | 'katakanaProgress',
    userId: string,
    characterId: string,
    progress: CharacterProgress,
    script: 'hiragana' | 'katakana'
  ): Promise<void> {
    await this.initDB();
    if (!this.db) {
      logger.error('[KanaProgressManager] Database not initialized');
      return;
    }

    try {
      // Create composite key string
      const compositeKey = `${userId}:${characterId}`;

      // Check if record already exists
      let existingRecord;
      try {
        existingRecord = await this.db.getFromIndex(storeName, 'by-composite', compositeKey);
      } catch (e) {
        // Index might not exist yet or record not found
        existingRecord = null;
      }

      // Clean the progress to remove undefined values
      const cleanedProgress = this.cleanForStorage(progress);

      const storedProgress: StoredProgress & { id?: number; compositeKey?: string } = {
        ...cleanedProgress,
        characterId,
        userId,
        script,
        compositeKey,
        updatedAt: new Date() // Ensure updatedAt is always set
      };

      // Only add id if it exists (for updates), omit for new records so autoIncrement works
      if (existingRecord?.id) {
        storedProgress.id = existingRecord.id;
      }

      await this.db.put(storeName, storedProgress);

      reviewLogger.debug(`[KanaProgressManager] Saved ${script} progress for ${characterId} to IndexedDB`);
    } catch (error) {
      logger.error('[KanaProgressManager] Failed to save to IndexedDB:', error);
    }
  }

  private queueFirebaseUpdate(
    script: string,
    userId: string,
    characterId: string,
    progress: CharacterProgress
  ): void {
    const updateKey = `${script}:${userId}`;

    if (!this.pendingUpdates.has(updateKey)) {
      this.pendingUpdates.set(updateKey, {});
    }

    // Clean the progress data before queueing
    this.pendingUpdates.get(updateKey)[characterId] = this.cleanForStorage(progress);

    // Clear existing timeout
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    // Set new timeout for debounced update
    this.syncTimeout = setTimeout(() => {
      this.processPendingUpdates();
    }, this.SYNC_DELAY);
  }

  private async processPendingUpdates(): Promise<void> {
    if (this.pendingUpdates.size === 0) return;

    const updates = new Map(this.pendingUpdates);
    this.pendingUpdates.clear();

    for (const [key, characters] of updates) {
      const [script, userId] = key.split(':');
      await this.syncToFirebase(userId, script as 'hiragana' | 'katakana', characters);
    }
  }

  /**
   * Get progress for a script (hiragana/katakana)
   * @param script - 'hiragana' or 'katakana'
   * @param user - The authenticated user (null for guests)
   * @param isPremium - Whether the user has a premium subscription
   * @returns Record of character IDs to progress
   */
  async getProgress(
    script: 'hiragana' | 'katakana',
    user: User | null,
    isPremium: boolean
  ): Promise<Record<string, CharacterProgress>> {
    // Guest users: return empty
    if (!user) {
      return {};
    }

    const userId = user.uid;
    const storeName = script === 'hiragana' ? 'hiraganaProgress' : 'katakanaProgress';

    // Load from IndexedDB first
    const localProgress = await this.loadFromIndexedDB(storeName, userId);

    // For premium users, also load from Firebase and merge
    if (isPremium && navigator.onLine) {
      try {
        const cloudProgress = await this.loadFromFirebase(userId, script);
        return this.mergeProgressData(localProgress, cloudProgress);
      } catch (error) {
        logger.error('[KanaProgressManager] Failed to load from Firebase, using local only:', error);
        return localProgress;
      }
    }

    return localProgress;
  }

  private async loadFromIndexedDB(
    storeName: 'hiraganaProgress' | 'katakanaProgress',
    userId: string
  ): Promise<Record<string, CharacterProgress>> {
    await this.initDB();
    if (!this.db) {
      return {};
    }

    try {
      const allProgress = await this.db.getAllFromIndex(storeName, 'by-user', userId);
      const progressMap: Record<string, CharacterProgress> = {};

      for (const item of allProgress) {
        progressMap[item.characterId] = {
          status: item.status,
          reviewCount: item.reviewCount,
          correctCount: item.correctCount,
          lastReviewed: item.lastReviewed,
          pinned: item.pinned,
          updatedAt: item.updatedAt
        };
      }

      return progressMap;
    } catch (error) {
      logger.error('[KanaProgressManager] Failed to load from IndexedDB:', error);
      return {};
    }
  }

  async syncToFirebase(
    userId: string,
    script: 'hiragana' | 'katakana',
    progressUpdates: Record<string, CharacterProgress>
  ): Promise<void> {
    if (!db) {
      logger.error('[KanaProgressManager] Firestore not initialized');
      return;
    }

    try {
      const docRef = doc(db, 'users', userId, 'progress', script);
      const docSnap = await getDoc(docRef);

      // Clean the progress updates to remove undefined values
      const cleanedProgressUpdates: Record<string, CharacterProgress> = {};
      for (const [charId, progress] of Object.entries(progressUpdates)) {
        cleanedProgressUpdates[charId] = this.cleanForStorage(progress);
      }

      let currentData: FirebaseProgressDoc;

      if (docSnap.exists()) {
        currentData = docSnap.data() as FirebaseProgressDoc;
        // Merge new updates with existing characters
        currentData.characters = {
          ...currentData.characters,
          ...cleanedProgressUpdates
        };
      } else {
        // Create new document
        currentData = {
          userId,
          script,
          characters: cleanedProgressUpdates,
          totalLearned: 0,
          totalCharacters: 0,
          lastSync: serverTimestamp() as Timestamp,
          updatedAt: serverTimestamp() as Timestamp
        };
      }

      // Calculate totals
      const characters = Object.values(currentData.characters);
      currentData.totalLearned = characters.filter(c => c.status === 'learned').length;
      currentData.totalCharacters = characters.length;
      currentData.updatedAt = serverTimestamp() as Timestamp;

      await setDoc(docRef, currentData);

      logger.kana(`Successfully synced ${script} progress to Firebase`);
    } catch (error) {
      logger.error('[KanaProgressManager] Failed to sync to Firebase:', error);
      // Queue for retry
      await this.addToSyncQueue(userId, script, progressUpdates);
    }
  }

  private async loadFromFirebase(
    userId: string,
    script: 'hiragana' | 'katakana'
  ): Promise<Record<string, CharacterProgress>> {
    if (!db) {
      return {};
    }

    try {
      const docRef = doc(db, 'users', userId, 'progress', script);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as FirebaseProgressDoc;

        // Convert Firestore timestamps to Dates
        const characters: Record<string, CharacterProgress> = {};
        for (const [charId, progress] of Object.entries(data.characters)) {
          characters[charId] = {
            ...progress,
            lastReviewed: progress.lastReviewed instanceof Timestamp
              ? progress.lastReviewed.toDate()
              : progress.lastReviewed,
            updatedAt: progress.updatedAt instanceof Timestamp
              ? progress.updatedAt.toDate()
              : progress.updatedAt
          };
        }

        return characters;
      }

      return {};
    } catch (error) {
      logger.error('[KanaProgressManager] Failed to load from Firebase:', error);
      return {};
    }
  }

  private mergeProgressData(
    local: Record<string, CharacterProgress>,
    cloud: Record<string, CharacterProgress>
  ): Record<string, CharacterProgress> {
    const merged: Record<string, CharacterProgress> = { ...local };

    for (const [charId, cloudProgress] of Object.entries(cloud)) {
      const localProgress = local[charId];

      if (!localProgress) {
        // Character only exists in cloud
        merged[charId] = cloudProgress;
      } else {
        // Compare timestamps and keep newer
        const localTime = localProgress.updatedAt?.getTime() || 0;
        const cloudTime = cloudProgress.updatedAt?.getTime() || 0;

        if (cloudTime > localTime) {
          merged[charId] = cloudProgress;
        }
        // Special case: if one is pinned and other isn't, keep pinned
        else if (cloudProgress.pinned && !localProgress.pinned) {
          merged[charId] = { ...localProgress, pinned: true };
        }
      }
    }

    return merged;
  }

  private async addToSyncQueue(
    userId: string,
    script: string,
    data: any
  ): Promise<void> {
    await this.initDB();
    if (!this.db) return;

    try {
      await this.db.add('syncQueue', {
        type: 'progress-update',
        script,
        userId,
        data,
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending'
      });
    } catch (error) {
      logger.error('[KanaProgressManager] Failed to add to sync queue:', error);
    }
  }

  async processSyncQueue(): Promise<void> {
    await this.initDB();
    if (!this.db) return;

    try {
      const queue = await this.db.getAll('syncQueue');
      const pendingItems = queue.filter(item => item.status === 'pending');

      for (const item of pendingItems) {
        if (item.type === 'progress-update') {
          await this.syncToFirebase(item.userId, item.script as any, item.data);

          // Mark as completed
          if (item.id) {
            await this.db.delete('syncQueue', item.id);
          }
        }
      }
    } catch (error) {
      logger.error('[KanaProgressManager] Failed to process sync queue:', error);
    }
  }

  /**
   * Migrate existing localStorage data to IndexedDB
   * @param script - 'hiragana' or 'katakana'
   * @param user - The authenticated user
   * @param isPremium - Whether the user has a premium subscription
   */
  async migrateFromLocalStorage(
    script: 'hiragana' | 'katakana',
    user: User,
    isPremium: boolean
  ): Promise<boolean> {
    const localStorageKey = `kana-progress-${script}-${user.uid}`;
    const existingData = localStorage.getItem(localStorageKey);

    if (!existingData) {
      return false;
    }

    try {
      const parsed = JSON.parse(existingData);

      // Save each character's progress
      for (const [characterId, progress] of Object.entries(parsed)) {
        await this.saveProgress(
          script,
          characterId,
          progress as CharacterProgress,
          user,
          isPremium
        );
      }

      // Mark as migrated (don't delete yet for safety)
      localStorage.setItem(`${localStorageKey}-migrated`, 'true');

      logger.kana(`Successfully migrated ${script} progress from localStorage`);
      return true;
    } catch (error) {
      logger.error('[KanaProgressManager] Failed to migrate from localStorage:', error);
      return false;
    }
  }

  /**
   * Clear all progress for a user (useful for testing or account cleanup)
   */
  async clearProgress(
    script: 'hiragana' | 'katakana',
    userId: string
  ): Promise<void> {
    await this.initDB();
    if (!this.db) return;

    const storeName = script === 'hiragana' ? 'hiraganaProgress' : 'katakanaProgress';

    try {
      const tx = this.db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const index = store.index('by-user');

      for await (const cursor of index.iterate(userId)) {
        await cursor.delete();
      }

      await tx.done;
      logger.kana(`Cleared ${script} progress for user ${userId}`);
    } catch (error) {
      logger.error('[KanaProgressManager] Failed to clear progress:', error);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }
    if (this.batchSyncInterval) {
      clearInterval(this.batchSyncInterval);
    }
    if (this.db) {
      this.db.close();
    }
  }
}

// Export singleton instance getter
export const kanaProgressManager = KanaProgressManager.getInstance();