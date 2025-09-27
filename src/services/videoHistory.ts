/**
 * Video History Service
 * Tracks which YouTube videos a user has already accessed
 * to allow unlimited repeat practice without counting against limits
 *
 * PREMIUM-ONLY FIREBASE STORAGE
 * Free users track video IDs locally only
 * Premium users get Firebase sync for cross-device access
 */

import { firestore as db } from '@/lib/firebase/client';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';

const LOCAL_STORAGE_KEY = 'moshimoshi_video_history';

interface VideoHistoryData {
  videoIds: string[];
  lastUpdated: string;
}

class VideoHistoryService {
  private memoryCache: Set<string> = new Set();
  private userId: string | null = null;
  private isPremium: boolean = false;

  /**
   * Initialize the service for a user
   * @param userId - User ID if authenticated
   * @param isPremium - Whether the user has premium subscription
   */
  async initialize(userId?: string, isPremium: boolean = false) {
    this.userId = userId || null;
    this.isPremium = isPremium;
    await this.loadHistory();
  }

  /**
   * Load video history from storage
   */
  private async loadHistory() {
    try {
      // Premium users: load from Firestore
      if (this.userId && this.isPremium && db) {
        const docRef = doc(db, 'userVideoHistory', this.userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data() as VideoHistoryData;
          this.memoryCache = new Set(data.videoIds || []);
        }
      }

      // All users (including premium): also load from localStorage
      // This ensures data is available even if Firebase is down
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const data: VideoHistoryData = JSON.parse(stored);
        // Merge with any Firebase data
        data.videoIds?.forEach(id => this.memoryCache.add(id));
      }
    } catch (error) {
      console.error('Error loading video history:', error);
      // Fall back to localStorage only
      try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (stored) {
          const data: VideoHistoryData = JSON.parse(stored);
          this.memoryCache = new Set(data.videoIds || []);
        }
      } catch (localError) {
        console.error('Error loading from localStorage:', localError);
      }
    }
  }

  /**
   * Check if a video has been used before
   */
  hasUsedVideo(videoId: string): boolean {
    return this.memoryCache.has(videoId);
  }

  /**
   * Add a video to the history
   */
  async addVideo(videoId: string) {
    if (this.memoryCache.has(videoId)) return;

    this.memoryCache.add(videoId);

    // Always save to localStorage for all users
    try {
      const data: VideoHistoryData = {
        videoIds: Array.from(this.memoryCache),
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }

    // Premium users: also save to Firestore for sync
    if (this.userId && this.isPremium && db) {
      try {
        const docRef = doc(db, 'userVideoHistory', this.userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          // Update existing document
          await updateDoc(docRef, {
            videoIds: arrayUnion(videoId),
            lastUpdated: new Date().toISOString()
          });
        } else {
          // Create new document
          await setDoc(docRef, {
            videoIds: Array.from(this.memoryCache),
            lastUpdated: new Date().toISOString()
          });
        }
        console.log(`[VideoHistory] Saved to Firebase for premium user`);
      } catch (error) {
        console.error('[VideoHistory] Failed to save to Firebase, but local save succeeded:', error);
      }
    }
  }

  /**
   * Get the total number of unique videos watched
   */
  getUniqueVideoCount(): number {
    return this.memoryCache.size;
  }

  /**
   * Get all video IDs in history
   */
  getAllVideoIds(): string[] {
    return Array.from(this.memoryCache);
  }

  /**
   * Migrate guest history to user account
   * Called when a guest user signs in
   */
  async migrateGuestHistory(userId: string) {
    try {
      // Load guest history from localStorage
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (!stored) return;

      const guestData: VideoHistoryData = JSON.parse(stored);
      const guestVideoIds = guestData.videoIds || [];

      if (guestVideoIds.length === 0) return;

      // Initialize for the new user
      this.userId = userId;

      if (db) {
        // Get existing user history
        const docRef = doc(db, 'userVideoHistory', userId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          // Merge with existing history
          const userData = docSnap.data() as VideoHistoryData;
          const existingIds = new Set(userData.videoIds || []);

          // Add guest IDs that aren't already in user history
          const newIds = guestVideoIds.filter(id => !existingIds.has(id));

          if (newIds.length > 0) {
            await updateDoc(docRef, {
              videoIds: arrayUnion(...newIds),
              lastUpdated: new Date().toISOString()
            });
          }
        } else {
          // Create new document with guest history
          await setDoc(docRef, {
            videoIds: guestVideoIds,
            lastUpdated: new Date().toISOString()
          });
        }
      }

      // Update memory cache with combined history
      guestVideoIds.forEach(id => this.memoryCache.add(id));

      // Clear guest history from localStorage
      localStorage.removeItem(LOCAL_STORAGE_KEY);

      console.log(`Migrated ${guestVideoIds.length} videos from guest to user account`);
    } catch (error) {
      console.error('Error migrating guest history:', error);
    }
  }

  /**
   * Clear all video history (for testing/debugging)
   */
  async clearHistory() {
    this.memoryCache.clear();

    // Always clear localStorage
    try {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }

    // Premium users: also clear Firebase
    if (this.userId && this.isPremium && db) {
      try {
        const docRef = doc(db, 'userVideoHistory', this.userId);
        await setDoc(docRef, {
          videoIds: [],
          lastUpdated: new Date().toISOString()
        });
      } catch (error) {
        console.error('Error clearing Firebase history:', error);
      }
    }
  }
}

// Export singleton instance
export const videoHistoryService = new VideoHistoryService();