/**
 * YouTube History Service
 *
 * PREMIUM-ONLY FIREBASE STORAGE
 * This service stores full YouTube video metadata including URLs, titles, thumbnails, etc.
 *
 * Storage Strategy:
 * - Free users: IndexedDB only (local storage)
 * - Premium users: IndexedDB + Firebase (cloud sync)
 *
 * This follows the standard dual-storage pattern where only premium users
 * get cloud sync benefits.
 */

import { YouTubeVideoItem, YouTubeHistoryStorage } from './types';
import { IndexedDBYouTubeStorage } from './IndexedDBStorage';
import { FirebaseYouTubeStorage } from './FirebaseStorage';
import { getStorageDecision, StorageDecision } from '@/lib/api/storage-helper';

export class YouTubeHistoryService {
  private indexedDBStorage: IndexedDBYouTubeStorage;
  private firebaseStorage: FirebaseYouTubeStorage | null = null;
  private isInitialized = false;
  private storageDecision: StorageDecision | null = null;
  private userId?: string;

  constructor() {
    this.indexedDBStorage = new IndexedDBYouTubeStorage();
  }

  async initialize(userId?: string): Promise<void> {
    // If already initialized with the same user, skip
    if (this.isInitialized && this.userId === userId) {
      return;
    }

    // Initialize IndexedDB for all users
    await this.indexedDBStorage.init();

    if (userId) {
      this.userId = userId;

      // Check if user is premium
      this.storageDecision = await getStorageDecision({ uid: userId });

      // Only initialize Firebase for premium users
      if (this.storageDecision.shouldWriteToFirebase) {
        this.firebaseStorage = new FirebaseYouTubeStorage(userId);
        await this.firebaseStorage.init();
        console.log(`[YouTubeHistory] Premium user ${userId} - Firebase storage enabled`);
      } else {
        this.firebaseStorage = null;
        console.log(`[YouTubeHistory] Free user ${userId} - Local storage only`);
      }
    } else {
      // Guest user
      this.userId = undefined;
      this.firebaseStorage = null;
      this.storageDecision = null;
      console.log('[YouTubeHistory] Guest user - Local storage only');
    }

    this.isInitialized = true;
  }

  async addOrUpdateVideo(video: YouTubeVideoItem): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('YouTubeHistoryService not initialized');
    }

    // Always save to IndexedDB
    await this.indexedDBStorage.addOrUpdateVideo(video);

    // Only save to Firebase for premium users
    if (this.firebaseStorage && this.storageDecision?.shouldWriteToFirebase) {
      try {
        await this.firebaseStorage.addOrUpdateVideo(video);
        console.log(`[YouTubeHistory] Saved to Firebase for premium user`);
      } catch (error: any) {
        console.error('[YouTubeHistory] Failed to save to Firebase, but local save succeeded:', error);
      }
    }
  }

  async getVideo(videoId: string): Promise<YouTubeVideoItem | null> {
    if (!this.isInitialized) {
      throw new Error('YouTubeHistoryService not initialized');
    }

    // Premium users: try Firebase first, fallback to local
    if (this.firebaseStorage && this.storageDecision?.shouldWriteToFirebase) {
      try {
        const firebaseVideo = await this.firebaseStorage.getVideo(videoId);
        if (firebaseVideo) return firebaseVideo;
      } catch (error) {
        console.error('[YouTubeHistory] Failed to get from Firebase, falling back to local:', error);
      }
    }

    // All users: get from IndexedDB
    return this.indexedDBStorage.getVideo(videoId);
  }

  async getAllVideos(): Promise<YouTubeVideoItem[]> {
    if (!this.isInitialized) {
      throw new Error('YouTubeHistoryService not initialized');
    }

    // Premium users: get from Firebase
    if (this.firebaseStorage && this.storageDecision?.shouldWriteToFirebase) {
      try {
        return await this.firebaseStorage.getAllVideos();
      } catch (error) {
        console.error('[YouTubeHistory] Failed to get from Firebase, falling back to local:', error);
      }
    }

    // Free/Guest users: get from IndexedDB
    return this.indexedDBStorage.getAllVideos();
  }

  async deleteVideo(videoId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('YouTubeHistoryService not initialized');
    }

    // Always delete from local
    await this.indexedDBStorage.deleteVideo(videoId);

    // Also delete from Firebase for premium users
    if (this.firebaseStorage && this.storageDecision?.shouldWriteToFirebase) {
      try {
        await this.firebaseStorage.deleteVideo(videoId);
      } catch (error) {
        console.error('[YouTubeHistory] Failed to delete from Firebase:', error);
      }
    }
  }

  async clearAll(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('YouTubeHistoryService not initialized');
    }

    // Always clear local
    await this.indexedDBStorage.clearAll();

    // Also clear Firebase for premium users
    if (this.firebaseStorage && this.storageDecision?.shouldWriteToFirebase) {
      try {
        await this.firebaseStorage.clearAll();
      } catch (error) {
        console.error('[YouTubeHistory] Failed to clear Firebase:', error);
      }
    }
  }

  async getRecentVideos(limit: number = 10): Promise<YouTubeVideoItem[]> {
    if (!this.isInitialized) {
      throw new Error('YouTubeHistoryService not initialized');
    }

    // Premium users: get from Firebase
    if (this.firebaseStorage && this.storageDecision?.shouldWriteToFirebase) {
      try {
        return await this.firebaseStorage.getRecentVideos(limit);
      } catch (error) {
        console.error('[YouTubeHistory] Failed to get recent from Firebase, falling back to local:', error);
      }
    }

    // Free/Guest users: get from IndexedDB
    return this.indexedDBStorage.getRecentVideos(limit);
  }

  async searchVideos(query: string): Promise<YouTubeVideoItem[]> {
    if (!this.isInitialized) {
      throw new Error('YouTubeHistoryService not initialized');
    }

    // Premium users: search in Firebase
    if (this.firebaseStorage && this.storageDecision?.shouldWriteToFirebase) {
      try {
        return await this.firebaseStorage.searchVideos(query);
      } catch (error) {
        console.error('[YouTubeHistory] Failed to search in Firebase, falling back to local:', error);
      }
    }

    // Free/Guest users: search in IndexedDB
    return this.indexedDBStorage.searchVideos(query);
  }

  /**
   * Get storage location info
   */
  getStorageInfo(): { location: 'local' | 'both' | 'none'; isPremium: boolean } {
    if (!this.isInitialized) {
      return { location: 'none', isPremium: false };
    }

    return {
      location: this.storageDecision?.storageLocation || 'local',
      isPremium: this.storageDecision?.isPremium || false
    };
  }

  /**
   * Sync local data to Firebase (for when users upgrade to premium)
   */
  async syncLocalToFirebase(): Promise<void> {
    if (!this.firebaseStorage || !this.storageDecision?.shouldWriteToFirebase) {
      console.log('[YouTubeHistory] Cannot sync - user is not premium');
      return;
    }

    try {
      const localVideos = await this.indexedDBStorage.getAllVideos();
      console.log(`[YouTubeHistory] Syncing ${localVideos.length} videos to Firebase`);

      for (const video of localVideos) {
        await this.firebaseStorage.addOrUpdateVideo(video);
      }

      console.log('[YouTubeHistory] Sync completed successfully');
    } catch (error) {
      console.error('[YouTubeHistory] Failed to sync to Firebase:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const youTubeHistoryService = new YouTubeHistoryService();