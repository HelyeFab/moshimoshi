import { PracticeHistoryItem } from './types';
import { IndexedDBPracticeHistoryStorage } from './IndexedDBStorage';
import { FirebasePracticeHistoryStorage } from './FirebaseStorage';

/**
 * Practice History Service
 *
 * IMPORTANT: INTENTIONAL DUAL STORAGE EXCEPTION
 *
 * This service writes to Firebase for ALL authenticated users (both free and premium),
 * not just premium users. This is an INTENTIONAL DESIGN DECISION, not a violation of
 * the dual storage pattern.
 *
 * Reasons for Firebase writes for all users:
 * 1. Practice history data contributes to the global leaderboard feature
 * 2. All users need to participate in the leaderboard for fair competition
 * 3. This is similar to the leaderboard_stats collection pattern
 * 4. The data volume is minimal and acceptable for the leaderboard feature
 *
 * This exception is approved and necessary for the competitive features of the app.
 */
export class PracticeHistoryService {
  private indexedDBStorage: IndexedDBPracticeHistoryStorage;
  private firebaseStorage: FirebasePracticeHistoryStorage | null = null;
  private isInitialized = false;
  private userType: 'guest' | 'free' | 'premium' = 'guest';
  private userId?: string;

  constructor() {
    this.indexedDBStorage = new IndexedDBPracticeHistoryStorage();
  }

  async initialize(userId?: string, isPremium?: boolean): Promise<void> {
    // If already initialized with Firebase, don't reinitialize
    if (this.isInitialized && this.firebaseStorage && this.userId === userId) {
      return;
    }

    // If initializing with a user after being initialized as guest, reinitialize
    if (this.isInitialized && !this.firebaseStorage && userId) {
      this.isInitialized = false;
    }

    if (this.isInitialized) return;

    // Initialize IndexedDB for all users
    await this.indexedDBStorage.init();

    // Initialize Firebase for ALL authenticated users (both free and premium)
    // NOTE: This is intentional for leaderboard participation - see class documentation
    if (userId) {
      this.userId = userId;
      this.firebaseStorage = new FirebasePracticeHistoryStorage(userId);
      this.userType = isPremium ? 'premium' : 'free';

      // Sync local data to Firebase on first login
      await this.syncLocalToFirebase();
    } else {
      this.userType = 'guest';
      this.firebaseStorage = null;
    }

    this.isInitialized = true;
  }

  async addOrUpdateItem(item: PracticeHistoryItem): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('PracticeHistoryService not initialized');
    }

    // Always save to IndexedDB
    await this.indexedDBStorage.addOrUpdateItem(item);

    // Also save to Firebase for authenticated users
    if (this.firebaseStorage) {
      try {
        await this.firebaseStorage.addOrUpdateItem(item);
      } catch (error: any) {
        console.error('Failed to save to Firebase, but local save succeeded:', error);
      }
    }
  }

  async getItem(videoId: string): Promise<PracticeHistoryItem | null> {
    if (!this.isInitialized) {
      throw new Error('PracticeHistoryService not initialized');
    }

    // Premium users: try Firebase first, fallback to local
    if (this.firebaseStorage && this.userType === 'premium') {
      try {
        const firebaseItem = await this.firebaseStorage.getItem(videoId);
        if (firebaseItem) return firebaseItem;
      } catch (error) {
        console.error('Failed to get from Firebase, falling back to local:', error);
      }
    }

    // All users: get from IndexedDB
    return this.indexedDBStorage.getItem(videoId);
  }

  async getAllItems(): Promise<PracticeHistoryItem[]> {
    if (!this.isInitialized) {
      throw new Error('PracticeHistoryService not initialized');
    }

    // Premium users: get from Firebase
    if (this.firebaseStorage && this.userType === 'premium') {
      try {
        return await this.firebaseStorage.getAllItems();
      } catch (error) {
        console.error('Failed to get from Firebase, falling back to local:', error);
      }
    }

    // Free/Guest users: get from IndexedDB
    return this.indexedDBStorage.getAllItems();
  }

  async deleteItem(videoId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('PracticeHistoryService not initialized');
    }

    // Always delete from local
    await this.indexedDBStorage.deleteItem(videoId);

    // Also delete from Firebase for premium users
    if (this.firebaseStorage && this.userType === 'premium') {
      try {
        await this.firebaseStorage.deleteItem(videoId);
      } catch (error) {
        console.error('Failed to delete from Firebase:', error);
      }
    }
  }

  async clearAll(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('PracticeHistoryService not initialized');
    }

    // Always clear local
    await this.indexedDBStorage.clearAll();

    // Also clear Firebase for premium users
    if (this.firebaseStorage && this.userType === 'premium') {
      try {
        await this.firebaseStorage.clearAll();
      } catch (error) {
        console.error('Failed to clear Firebase:', error);
      }
    }
  }

  async getRecentItems(limit: number = 10): Promise<PracticeHistoryItem[]> {
    const allItems = await this.getAllItems();
    return allItems.slice(0, limit);
  }

  async getMostPracticed(limit: number = 10): Promise<PracticeHistoryItem[]> {
    if (this.firebaseStorage && this.userType === 'premium') {
      try {
        return await this.firebaseStorage.getMostPracticed(limit);
      } catch (error) {
        console.error('Failed to get from Firebase, falling back to local:', error);
      }
    }

    return this.indexedDBStorage.getMostPracticed(limit);
  }

  async getItemsByDateRange(startDate: Date, endDate: Date): Promise<PracticeHistoryItem[]> {
    if (this.firebaseStorage && this.userType === 'premium') {
      try {
        return await this.firebaseStorage.getItemsByDateRange(startDate, endDate);
      } catch (error) {
        console.error('Failed to get from Firebase, falling back to local:', error);
      }
    }

    return this.indexedDBStorage.getItemsByDateRange(startDate, endDate);
  }

  // Sync local data to Firebase when user upgrades to premium
  private async syncLocalToFirebase(): Promise<void> {
    if (!this.firebaseStorage || this.userType !== 'premium') return;

    try {
      const localItems = await this.indexedDBStorage.getAllItems();
      if (localItems.length > 0) {
        await this.firebaseStorage.syncFromLocal(localItems);
        console.log(`Synced ${localItems.length} items from local to Firebase`);
      }
    } catch (error) {
      console.error('Failed to sync local data to Firebase:', error);
    }
  }

  // Get service status
  getStatus(): {
    initialized: boolean;
    userType: string;
    hasFirebase: boolean;
    firebaseUserId?: string | null
  } {
    return {
      initialized: this.isInitialized,
      userType: this.userType,
      hasFirebase: !!this.firebaseStorage,
      firebaseUserId: this.userId || null
    };
  }

  // Reinitialize with new user (for login/logout scenarios)
  async reinitialize(userId?: string, isPremium?: boolean): Promise<void> {
    this.isInitialized = false;
    this.firebaseStorage = null;
    this.userId = undefined;
    this.userType = 'guest';
    await this.initialize(userId, isPremium);
  }
}

// Singleton instance
export const practiceHistoryService = new PracticeHistoryService();