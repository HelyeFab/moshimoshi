import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { doc, getDoc, setDoc, serverTimestamp, Timestamp, getFirestore } from 'firebase/firestore';
import { app } from '@/lib/firebase/config';
import { User } from 'firebase/auth';

// Define comprehensive preferences interface
export interface UserPreferences {
  // Appearance
  theme: 'light' | 'dark' | 'system';
  language: 'en' | 'ja' | 'fr' | 'it' | 'de' | 'es';
  palette: string;

  // Notifications
  notifications: {
    dailyReminder: boolean;
    achievementAlerts: boolean;
    weeklyProgress: boolean;
    marketingEmails: boolean;
  };

  // Learning
  learning: {
    autoplay: boolean;
    furigana: boolean;
    romaji: boolean;
    soundEffects: boolean;
    hapticFeedback: boolean;
  };

  // Privacy
  privacy: {
    publicProfile: boolean;
    showProgress: boolean;
    shareAchievements: boolean;
    hideFromLeaderboard: boolean;
  };

  // Accessibility
  accessibility: {
    largeText: boolean;
    highContrast: boolean;
    reduceMotion: boolean;
    screenReader: boolean;
  };

  // Metadata
  updatedAt: Date;
  syncedAt?: Date;
}

// IndexedDB schema for preferences
interface PreferencesDBSchema extends DBSchema {
  preferences: {
    key: string; // userId
    value: {
      userId: string;
      preferences: UserPreferences;
      updatedAt: Date;
      syncedAt?: Date;
    };
    indexes: {
      'by-updated': Date;
    };
  };

  syncQueue: {
    key: number;
    value: {
      id?: number;
      userId: string;
      preferences: UserPreferences;
      timestamp: number;
      retryCount: number;
      status: 'pending' | 'syncing' | 'completed' | 'failed';
    };
    indexes: {
      'by-status': string;
      'by-user': string;
    };
  };
}

export class PreferencesManager {
  private static instance: PreferencesManager;
  private db: IDBPDatabase<PreferencesDBSchema> | null = null;
  private syncTimeout: NodeJS.Timeout | null = null;
  private readonly SYNC_DELAY = 500; // ms - debounce delay
  private readonly DB_NAME = 'moshimoshi-preferences';
  private readonly DB_VERSION = 1;

  // Default preferences
  private readonly DEFAULT_PREFERENCES: Omit<UserPreferences, 'updatedAt'> = {
    theme: 'dark', // Default to dark as per your request
    language: 'en',
    palette: 'sakura',
    notifications: {
      dailyReminder: true,
      achievementAlerts: true,
      weeklyProgress: false,
      marketingEmails: false,
    },
    learning: {
      autoplay: true,
      furigana: true,
      romaji: false,
      soundEffects: true,
      hapticFeedback: true,
    },
    privacy: {
      publicProfile: false,
      showProgress: true,
      shareAchievements: false,
      hideFromLeaderboard: false,
    },
    accessibility: {
      largeText: false,
      highContrast: false,
      reduceMotion: false,
      screenReader: false,
    },
  };

  private constructor() {}

  static getInstance(): PreferencesManager {
    if (!this.instance) {
      this.instance = new PreferencesManager();
    }
    return this.instance;
  }

  // Initialize IndexedDB
  private async initDB(): Promise<void> {
    if (this.db) return;

    try {
      this.db = await openDB<PreferencesDBSchema>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db, oldVersion, newVersion) {
          // Create preferences store
          if (!db.objectStoreNames.contains('preferences')) {
            const prefsStore = db.createObjectStore('preferences', {
              keyPath: 'userId'
            });
            prefsStore.createIndex('by-updated', 'updatedAt');
          }

          // Create sync queue store
          if (!db.objectStoreNames.contains('syncQueue')) {
            const syncStore = db.createObjectStore('syncQueue', {
              keyPath: 'id',
              autoIncrement: true
            });
            syncStore.createIndex('by-status', 'status');
            syncStore.createIndex('by-user', 'userId');
          }
        }
      });

      console.log('[PreferencesManager] IndexedDB initialized');
    } catch (error) {
      console.error('[PreferencesManager] Failed to initialize IndexedDB:', error);
      // Fallback to memory storage if IndexedDB fails
      this.db = null;
    }
  }

  /**
   * Save preferences based on user tier
   * Guest: No storage (transient)
   * Free: IndexedDB only
   * Premium: IndexedDB + Firebase sync
   */
  async savePreferences(
    preferences: Partial<UserPreferences>,
    user: User | null,
    isPremium: boolean
  ): Promise<void> {
    console.log('[PreferencesManager] Saving preferences', {
      userId: user?.uid,
      isPremium,
      hasUser: !!user
    });

    // Guest users: no persistent storage
    if (!user) {
      console.log('[PreferencesManager] Guest user - no storage');
      // Could emit event for UI updates if needed
      return;
    }

    // Merge with existing preferences
    const existingPrefs = await this.getPreferencesFromIndexedDB(user.uid);
    const mergedPreferences: UserPreferences = {
      ...this.DEFAULT_PREFERENCES,
      ...existingPrefs,
      ...preferences,
      updatedAt: new Date()
    };

    // All logged-in users: Save to IndexedDB
    await this.saveToIndexedDB(user.uid, mergedPreferences);

    // Premium users: Also sync to Firebase (debounced)
    if (isPremium) {
      console.log('[PreferencesManager] Premium user - queuing Firebase sync');
      this.queueFirebaseSync(user.uid, mergedPreferences);
    }
  }

  /**
   * Get preferences based on user tier
   */
  async getPreferences(
    user: User | null,
    isPremium: boolean
  ): Promise<UserPreferences> {
    console.log('[PreferencesManager] Getting preferences', {
      userId: user?.uid,
      isPremium
    });

    // Guest users: return defaults
    if (!user) {
      console.log('[PreferencesManager] Guest user - returning defaults');
      return {
        ...this.DEFAULT_PREFERENCES,
        updatedAt: new Date()
      };
    }

    // Load from IndexedDB
    const localPrefs = await this.getPreferencesFromIndexedDB(user.uid);

    // Premium users: Try to merge with Firebase data
    if (isPremium && navigator.onLine) {
      try {
        const cloudPrefs = await this.getPreferencesFromFirebase(user.uid);
        if (cloudPrefs) {
          // Merge: use most recent data
          const merged = this.mergePreferences(localPrefs, cloudPrefs);

          // Update local if cloud is newer
          if (cloudPrefs.updatedAt > (localPrefs?.updatedAt || new Date(0))) {
            await this.saveToIndexedDB(user.uid, merged);
          }

          return merged;
        }
      } catch (error) {
        console.error('[PreferencesManager] Failed to fetch from Firebase:', error);
        // Fallback to local
      }
    }

    // Return local preferences or defaults
    return localPrefs || {
      ...this.DEFAULT_PREFERENCES,
      updatedAt: new Date()
    };
  }

  // Save to IndexedDB
  private async saveToIndexedDB(userId: string, preferences: UserPreferences): Promise<void> {
    await this.initDB();

    if (!this.db) {
      console.warn('[PreferencesManager] IndexedDB not available');
      return;
    }

    try {
      await this.db.put('preferences', {
        userId,
        preferences,
        updatedAt: preferences.updatedAt,
        syncedAt: preferences.syncedAt
      });

      console.log('[PreferencesManager] Saved to IndexedDB');
    } catch (error) {
      console.error('[PreferencesManager] Failed to save to IndexedDB:', error);
    }
  }

  // Get from IndexedDB
  private async getPreferencesFromIndexedDB(userId: string): Promise<UserPreferences | null> {
    await this.initDB();

    if (!this.db) {
      console.warn('[PreferencesManager] IndexedDB not available');
      return null;
    }

    try {
      const data = await this.db.get('preferences', userId);
      return data?.preferences || null;
    } catch (error) {
      console.error('[PreferencesManager] Failed to get from IndexedDB:', error);
      return null;
    }
  }

  // Queue Firebase sync with debouncing
  private queueFirebaseSync(userId: string, preferences: UserPreferences): void {
    // Clear existing timeout
    if (this.syncTimeout) {
      clearTimeout(this.syncTimeout);
    }

    // Set new timeout
    this.syncTimeout = setTimeout(() => {
      this.syncToFirebase(userId, preferences);
    }, this.SYNC_DELAY);
  }

  // Sync to Firebase
  private async syncToFirebase(userId: string, preferences: UserPreferences): Promise<void> {
    // Get Firestore instance when needed
    if (!app) {
      console.error('[PreferencesManager] Firebase app not initialized');
      await this.addToSyncQueue(userId, preferences);
      return;
    }

    const db = getFirestore(app);

    try {
      console.log('[PreferencesManager] Syncing to Firebase...');

      // Use the userPreferences collection for premium users
      // This matches the Firestore rules (lines 250-266)
      const prefsRef = doc(db, 'userPreferences', userId);

      await setDoc(prefsRef, {
        ...preferences,
        userId,
        syncedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Update local sync timestamp
      preferences.syncedAt = new Date();
      await this.saveToIndexedDB(userId, preferences);

      console.log('[PreferencesManager] Successfully synced to Firebase');

      // Process any pending items in sync queue
      await this.processSyncQueue(userId);
    } catch (error) {
      console.error('[PreferencesManager] Failed to sync to Firebase:', error);
      // Add to sync queue for retry
      await this.addToSyncQueue(userId, preferences);
    }
  }

  // Get from Firebase
  private async getPreferencesFromFirebase(userId: string): Promise<UserPreferences | null> {
    // Get Firestore instance when needed
    if (!app) {
      console.error('[PreferencesManager] Firebase app not initialized');
      return null;
    }

    const db = getFirestore(app);

    try {
      // Use the userPreferences collection for premium users
      // This matches the Firestore rules (lines 250-266)
      const prefsRef = doc(db, 'userPreferences', userId);
      const snapshot = await getDoc(prefsRef);

      if (snapshot.exists()) {
        const data = snapshot.data();

        // Convert Firestore timestamps
        return {
          ...data,
          updatedAt: data.updatedAt instanceof Timestamp
            ? data.updatedAt.toDate()
            : new Date(data.updatedAt),
          syncedAt: data.syncedAt instanceof Timestamp
            ? data.syncedAt.toDate()
            : data.syncedAt ? new Date(data.syncedAt) : undefined
        } as UserPreferences;
      }

      return null;
    } catch (error) {
      console.error('[PreferencesManager] Failed to get from Firebase:', error);
      return null;
    }
  }

  // Merge preferences (Last Write Wins with special cases)
  private mergePreferences(
    local: UserPreferences | null,
    cloud: UserPreferences | null
  ): UserPreferences {
    // If one is null, return the other or defaults
    if (!local && !cloud) {
      return {
        ...this.DEFAULT_PREFERENCES,
        updatedAt: new Date()
      };
    }

    if (!local) return cloud!;
    if (!cloud) return local;

    // Return the most recently updated
    return local.updatedAt > cloud.updatedAt ? local : cloud;
  }

  // Add to sync queue for offline resilience
  private async addToSyncQueue(userId: string, preferences: UserPreferences): Promise<void> {
    if (!this.db) return;

    try {
      await this.db.add('syncQueue', {
        userId,
        preferences,
        timestamp: Date.now(),
        retryCount: 0,
        status: 'pending'
      });

      console.log('[PreferencesManager] Added to sync queue');
    } catch (error) {
      console.error('[PreferencesManager] Failed to add to sync queue:', error);
    }
  }

  // Process sync queue
  private async processSyncQueue(userId: string): Promise<void> {
    if (!this.db) return;

    try {
      const tx = this.db.transaction('syncQueue', 'readwrite');
      const index = tx.store.index('by-user');
      const items = await index.getAll(userId);

      for (const item of items) {
        if (item.status === 'pending' && item.retryCount < 3) {
          // Try to sync
          item.status = 'syncing';
          await tx.store.put(item);

          try {
            await this.syncToFirebase(item.userId, item.preferences);
            // Success - remove from queue
            await tx.store.delete(item.id!);
          } catch (error) {
            // Failed - update retry count
            item.status = 'pending';
            item.retryCount++;
            await tx.store.put(item);
          }
        }
      }

      await tx.done;
    } catch (error) {
      console.error('[PreferencesManager] Failed to process sync queue:', error);
    }
  }

  /**
   * Migrate from localStorage to new storage system
   */
  async migrateFromLocalStorage(
    user: User,
    isPremium: boolean
  ): Promise<boolean> {
    const migrationKey = `preferences-migrated-${user.uid}`;

    // Check if already migrated
    if (localStorage.getItem(migrationKey)) {
      return false;
    }

    try {
      // Get old preferences from localStorage
      const oldPrefsJson = localStorage.getItem('user-preferences');
      if (!oldPrefsJson) return false;

      const oldPrefs = JSON.parse(oldPrefsJson);

      // Map old format to new format
      const newPrefs: Partial<UserPreferences> = {
        theme: oldPrefs.theme || this.DEFAULT_PREFERENCES.theme,
        language: oldPrefs.language || this.DEFAULT_PREFERENCES.language,
        palette: oldPrefs.palette || this.DEFAULT_PREFERENCES.palette,
        notifications: oldPrefs.notifications || this.DEFAULT_PREFERENCES.notifications,
        learning: oldPrefs.learning || this.DEFAULT_PREFERENCES.learning,
        privacy: oldPrefs.privacy || this.DEFAULT_PREFERENCES.privacy,
        accessibility: oldPrefs.accessibility || this.DEFAULT_PREFERENCES.accessibility,
      };

      // Save to new storage
      await this.savePreferences(newPrefs, user, isPremium);

      // Mark as migrated
      localStorage.setItem(migrationKey, 'true');

      console.log('[PreferencesManager] Successfully migrated from localStorage');
      return true;
    } catch (error) {
      console.error('[PreferencesManager] Migration failed:', error);
      return false;
    }
  }

  /**
   * Clear all preferences for a user (for testing/logout)
   */
  async clearPreferences(userId: string): Promise<void> {
    await this.initDB();

    if (!this.db) return;

    try {
      // Clear from IndexedDB
      await this.db.delete('preferences', userId);

      // Clear sync queue for this user
      const tx = this.db.transaction('syncQueue', 'readwrite');
      const index = tx.store.index('by-user');
      const items = await index.getAllKeys(userId);

      for (const key of items) {
        await tx.store.delete(key);
      }

      await tx.done;

      console.log('[PreferencesManager] Cleared preferences for user:', userId);
    } catch (error) {
      console.error('[PreferencesManager] Failed to clear preferences:', error);
    }
  }

  /**
   * Force sync all pending items (for manual sync button)
   */
  async forceSyncAll(userId: string): Promise<void> {
    await this.processSyncQueue(userId);
  }
}

// Export singleton instance
export const preferencesManager = PreferencesManager.getInstance();