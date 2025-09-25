/**
 * Local media storage for Anki cards using IndexedDB
 */

interface StoredMedia {
  id: string;          // filename
  blob: Blob;          // actual media data
  type: string;        // MIME type
  size: number;        // file size
  createdAt: Date;
}

export class AnkiMediaStore {
  private static instance: AnkiMediaStore;
  private dbName = 'ankiMediaDB';
  private storeName = 'media';
  private blobUrlCache: Map<string, string> = new Map();

  private constructor() {}

  static getInstance(): AnkiMediaStore {
    if (!this.instance) {
      this.instance = new AnkiMediaStore();
    }
    return this.instance;
  }

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Store media blob in IndexedDB
   */
  async storeMedia(filename: string, blob: Blob): Promise<string> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const media: StoredMedia = {
        id: filename,
        blob,
        type: blob.type,
        size: blob.size,
        createdAt: new Date()
      };

      await new Promise((resolve, reject) => {
        const request = store.put(media);
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });

      db.close();

      // Create and cache blob URL
      const blobUrl = URL.createObjectURL(blob);
      this.blobUrlCache.set(filename, blobUrl);

      return blobUrl;
    } catch (error) {
      console.error('Failed to store media:', error);
      // Fallback to just creating a blob URL without persistence
      const blobUrl = URL.createObjectURL(blob);
      this.blobUrlCache.set(filename, blobUrl);
      return blobUrl;
    }
  }

  /**
   * Retrieve media blob URL
   */
  async getMediaUrl(filename: string): Promise<string | null> {
    // Check cache first
    if (this.blobUrlCache.has(filename)) {
      return this.blobUrlCache.get(filename)!;
    }

    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      const media = await new Promise<StoredMedia | null>((resolve, reject) => {
        const request = store.get(filename);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      db.close();

      if (media) {
        const blobUrl = URL.createObjectURL(media.blob);
        this.blobUrlCache.set(filename, blobUrl);
        return blobUrl;
      }
    } catch (error) {
      console.error('Failed to retrieve media:', error);
    }

    return null;
  }

  /**
   * Store multiple media files
   */
  async storeMediaBatch(mediaMap: Map<string, Blob>): Promise<Map<string, string>> {
    const urls = new Map<string, string>();

    for (const [filename, blob] of mediaMap) {
      const url = await this.storeMedia(filename, blob);
      urls.set(filename, url);
    }

    return urls;
  }

  /**
   * Clean up blob URLs when no longer needed
   */
  cleanup() {
    for (const url of this.blobUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.blobUrlCache.clear();
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalSize: number;
  }> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      const allMedia = await new Promise<StoredMedia[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      db.close();

      const totalSize = allMedia.reduce((sum, media) => sum + media.size, 0);

      return {
        totalFiles: allMedia.length,
        totalSize
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return { totalFiles: 0, totalSize: 0 };
    }
  }

  /**
   * Delete media files by filename
   */
  async deleteMedia(filenames: string[]): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      for (const filename of filenames) {
        // Remove from cache
        const cachedUrl = this.blobUrlCache.get(filename);
        if (cachedUrl) {
          URL.revokeObjectURL(cachedUrl);
          this.blobUrlCache.delete(filename);
        }

        // Remove from IndexedDB
        await new Promise((resolve, reject) => {
          const request = store.delete(filename);
          request.onsuccess = resolve;
          request.onerror = () => reject(request.error);
        });
      }

      db.close();
    } catch (error) {
      console.error('Failed to delete media:', error);
    }
  }

  /**
   * Delete all media files
   */
  async deleteAllMedia(): Promise<void> {
    try {
      // Revoke all cached URLs
      this.cleanup();

      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = resolve;
        request.onerror = () => reject(request.error);
      });

      db.close();
    } catch (error) {
      console.error('Failed to delete all media:', error);
    }
  }
}