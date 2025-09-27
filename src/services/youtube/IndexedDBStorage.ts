/**
 * IndexedDB Storage for YouTube History
 * Used by all users for local storage
 */

import { YouTubeVideoItem, YouTubeHistoryStorage } from './types';

const DB_NAME = 'MoshimoshiYouTubeHistory';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

export class IndexedDBYouTubeStorage implements YouTubeHistoryStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'videoId' });
          store.createIndex('lastWatched', 'lastWatched', { unique: false });
          store.createIndex('videoTitle', 'videoTitle', { unique: false });
          store.createIndex('channelName', 'channelName', { unique: false });
        }
      };
    });
  }

  async addOrUpdateVideo(video: YouTubeVideoItem): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      // Check if video exists
      const getRequest = store.get(video.videoId);

      getRequest.onsuccess = () => {
        const existingVideo = getRequest.result;

        if (existingVideo) {
          // Update existing video
          const updatedVideo = {
            ...existingVideo,
            ...video,
            watchCount: (existingVideo.watchCount || 0) + 1,
            totalWatchTime: (existingVideo.totalWatchTime || 0) + (video.totalWatchTime || 0),
            lastWatched: new Date(),
          };
          store.put(updatedVideo);
        } else {
          // Add new video
          store.put({
            ...video,
            firstWatched: new Date(),
            lastWatched: new Date(),
            watchCount: 1,
          });
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getVideo(videoId: string): Promise<YouTubeVideoItem | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(videoId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllVideos(): Promise<YouTubeVideoItem[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('lastWatched');
      const request = index.openCursor(null, 'prev'); // Sort by lastWatched desc

      const videos: YouTubeVideoItem[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          videos.push(cursor.value);
          cursor.continue();
        } else {
          resolve(videos);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async deleteVideo(videoId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(videoId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getRecentVideos(limit: number): Promise<YouTubeVideoItem[]> {
    const allVideos = await this.getAllVideos();
    return allVideos.slice(0, limit);
  }

  async searchVideos(query: string): Promise<YouTubeVideoItem[]> {
    const allVideos = await this.getAllVideos();
    const lowercaseQuery = query.toLowerCase();

    return allVideos.filter(video =>
      video.videoTitle.toLowerCase().includes(lowercaseQuery) ||
      video.channelName?.toLowerCase().includes(lowercaseQuery) ||
      video.metadata?.description?.toLowerCase().includes(lowercaseQuery)
    );
  }
}