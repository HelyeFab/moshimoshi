/**
 * Local media storage for Anki cards using IndexedDB
 */

import type { StoredMedia, MediaStorageStats } from '@/types/ankiMedia'

const ANKI_MEDIA_KEY_SEPARATOR = '::'

export function buildAnkiMediaKey(deckId: string, filename: string): string {
  return `${deckId}${ANKI_MEDIA_KEY_SEPARATOR}${filename}`
}

function stripAnkiMediaKey(key: string): string {
  const separatorIndex = key.indexOf(ANKI_MEDIA_KEY_SEPARATOR)
  return separatorIndex >= 0 ? key.slice(separatorIndex + ANKI_MEDIA_KEY_SEPARATOR.length) : key
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

  private async openDB(retries = 1): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 2)  // Version 2!

      request.onerror = () => reject(request.error)
      request.onsuccess = async () => {
        const db = request.result
        if (!db.objectStoreNames.contains(this.storeName) && retries > 0) {
          console.warn('[AnkiMediaStore] Missing media store, recreating database...')
          db.close()
          const deleteRequest = indexedDB.deleteDatabase(this.dbName)
          deleteRequest.onerror = () => reject(deleteRequest.error)
          deleteRequest.onsuccess = () => {
            this.openDB(retries - 1).then(resolve).catch(reject)
          }
          return
        }
        resolve(db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        const oldVersion = event.oldVersion
        const transaction = (event.target as IDBOpenDBRequest).transaction!

        console.log(`[AnkiMediaStore] Upgrading database from v${oldVersion} to v2`)

        // Create or upgrade 'media' store
        let mediaStore: IDBObjectStore
        if (!db.objectStoreNames.contains('media')) {
          // New installation
          mediaStore = db.createObjectStore('media', { keyPath: 'id' })
          console.log('[AnkiMediaStore] Created media store')
        } else {
          // Existing installation - get store for adding indexes
          mediaStore = transaction.objectStore('media')
          console.log('[AnkiMediaStore] Upgrading existing media store')
        }

        // Add indexes if they don't exist
        if (!mediaStore.indexNames.contains('userId')) {
          mediaStore.createIndex('userId', 'userId', { unique: false })
          console.log('[AnkiMediaStore] Added userId index')
        }
        if (!mediaStore.indexNames.contains('deckId')) {
          mediaStore.createIndex('deckId', 'deckId', { unique: false })
          console.log('[AnkiMediaStore] Added deckId index')
        }
        if (!mediaStore.indexNames.contains('syncStatus')) {
          mediaStore.createIndex('syncStatus', 'syncStatus', { unique: false })
          console.log('[AnkiMediaStore] Added syncStatus index')
        }
        if (!mediaStore.indexNames.contains('updatedAt')) {
          mediaStore.createIndex('updatedAt', 'updatedAt', { unique: false })
          console.log('[AnkiMediaStore] Added updatedAt index')
        }

        // Create syncQueue store (new)
        if (!db.objectStoreNames.contains('syncQueue')) {
          const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id' })
          queueStore.createIndex('deckId', 'deckId', { unique: false })
          queueStore.createIndex('status', 'status', { unique: false })
          queueStore.createIndex('scheduledFor', 'scheduledFor', { unique: false })
          queueStore.createIndex('userId', 'userId', { unique: false })
          console.log('[AnkiMediaStore] Created syncQueue store with indexes')
        }

        // Migration: Add default values to existing records
        if (oldVersion === 1) {
          console.log('[AnkiMediaStore] Migrating v1 records to v2 schema')

          const mediaStore = transaction.objectStore('media')
          const getAllRequest = mediaStore.getAll()

          getAllRequest.onsuccess = () => {
            const records = getAllRequest.result as any[]
            console.log(`[AnkiMediaStore] Migrating ${records.length} existing records`)

            records.forEach((record) => {
              // Add missing fields with defaults
              if (!record.userId) record.userId = 'unknown'
              if (!record.deckId) record.deckId = 'unknown'
              if (!record.syncStatus) record.syncStatus = 'pending'
              if (!record.retryCount) record.retryCount = 0
              if (!record.updatedAt) record.updatedAt = record.createdAt || new Date()

              // Update record
              mediaStore.put(record)
            })

            console.log('[AnkiMediaStore] Migration complete')
          }

          getAllRequest.onerror = () => {
            console.error('[AnkiMediaStore] Migration failed:', getAllRequest.error)
          }
        }
      }
    })
  }

  /**
   * Store media blob in IndexedDB with sync tracking
   */
  async storeMedia(
    filename: string,
    blob: Blob,
    options?: {
      userId?: string
      deckId?: string
      syncStatus?: 'pending' | 'syncing' | 'synced' | 'failed'
      firebaseUrl?: string
    }
  ): Promise<string> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const media: StoredMedia = {
        id: filename,
        blob,
        type: blob.type,
        size: blob.size,
        userId: options?.userId || 'unknown',
        deckId: options?.deckId || 'unknown',
        syncStatus: options?.syncStatus || 'pending',
        firebaseUrl: options?.firebaseUrl,
        retryCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
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

      console.log(`[AnkiMediaStore] Stored media: ${filename} (${blob.size} bytes, deck: ${media.deckId})`);

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

      let media = await new Promise<StoredMedia | null>((resolve, reject) => {
        const request = store.get(filename);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (!media) {
        const fallbackKey = stripAnkiMediaKey(filename)
        if (fallbackKey !== filename) {
          media = await new Promise<StoredMedia | null>((resolve, reject) => {
            const request = store.get(fallbackKey);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
        }
      }

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
   * Batch retrieve media blob URLs (performance optimized)
   * Opens DB once and fetches all media in a single transaction
   * @param filenames - Array of filenames to retrieve
   * @returns Map of filename to blob URL
   */
  async getMediaUrls(filenames: string[]): Promise<Map<string, string>> {
    const results = new Map<string, string>();

    // Separate cached from uncached filenames
    const uncached: string[] = [];
    for (const filename of filenames) {
      if (this.blobUrlCache.has(filename)) {
        results.set(filename, this.blobUrlCache.get(filename)!);
      } else {
        uncached.push(filename);
      }
    }

    // If everything was cached, return immediately
    if (uncached.length === 0) {
      return results;
    }

    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      // Batch fetch all uncached media in a single transaction
      const mediaFiles = await Promise.all(
        uncached.map(filename =>
          new Promise<{ filename: string; media: StoredMedia | null }>((resolve, reject) => {
            const request = store.get(filename);
            request.onsuccess = () => resolve({ filename, media: request.result });
            request.onerror = () => reject(request.error);
          })
        )
      );

      db.close();

      // Create blob URLs and cache them
      for (const { filename, media } of mediaFiles) {
        let resolvedMedia = media
        if (!resolvedMedia) {
          const fallbackKey = stripAnkiMediaKey(filename)
          if (fallbackKey !== filename) {
            try {
              const fallbackDb = await this.openDB();
              const fallbackTx = fallbackDb.transaction([this.storeName], 'readonly');
              const fallbackStore = fallbackTx.objectStore(this.storeName);
              resolvedMedia = await new Promise<StoredMedia | null>((resolve, reject) => {
                const request = fallbackStore.get(fallbackKey);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
              });
              fallbackDb.close();
            } catch (fallbackError) {
              console.error('[AnkiMediaStore] Failed to retrieve fallback media:', fallbackError);
            }
          }
        }

        if (resolvedMedia) {
          const blobUrl = URL.createObjectURL(resolvedMedia.blob);
          this.blobUrlCache.set(filename, blobUrl);
          results.set(filename, blobUrl);
        }
      }
    } catch (error) {
      console.error('[AnkiMediaStore] Failed to batch retrieve media:', error);
    }

    return results;
  }

  /**
   * Retrieve media blob (for R2 upload)
   * @param filename - Filename to retrieve
   * @returns Blob or null if not found
   */
  async getMediaBlob(filename: string): Promise<Blob | null> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);

      let media = await new Promise<StoredMedia | null>((resolve, reject) => {
        const request = store.get(filename);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Fallback to stripped key if not found
      if (!media) {
        const fallbackKey = stripAnkiMediaKey(filename);
        if (fallbackKey !== filename) {
          media = await new Promise<StoredMedia | null>((resolve, reject) => {
            const request = store.get(fallbackKey);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          });
        }
      }

      db.close();
      return media?.blob || null;
    } catch (error) {
      console.error('[AnkiMediaStore] Failed to retrieve media blob:', error);
      return null;
    }
  }

  /**
   * Store multiple media files
   */
  async storeMediaBatch(
    mediaMap: Map<string, Blob>,
    options?: {
      userId?: string
      deckId?: string
      syncStatus?: 'pending' | 'syncing' | 'synced' | 'failed'
    }
  ): Promise<Map<string, string>> {
    const urls = new Map<string, string>();

    for (const [filename, blob] of mediaMap) {
      const url = await this.storeMedia(filename, blob, options);
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
  async getStats(): Promise<MediaStorageStats> {
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

      const stats: MediaStorageStats = {
        totalFiles: allMedia.length,
        totalSize: allMedia.reduce((sum, m) => sum + m.size, 0),
        syncedFiles: allMedia.filter(m => m.syncStatus === 'synced').length,
        pendingFiles: allMedia.filter(m => m.syncStatus === 'pending').length,
        failedFiles: allMedia.filter(m => m.syncStatus === 'failed').length,
      };

      const pendingMedia = allMedia.filter(m => m.syncStatus === 'pending');
      if (pendingMedia.length > 0) {
        stats.oldestPendingDate = new Date(Math.min(...pendingMedia.map(m => m.createdAt.getTime())));
      }

      return stats;
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        syncedFiles: 0,
        pendingFiles: 0,
        failedFiles: 0
      };
    }
  }

  /**
   * Get all media for a specific deck
   */
  async getMediaByDeck(deckId: string): Promise<StoredMedia[]> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('deckId');

      const media = await new Promise<StoredMedia[]>((resolve, reject) => {
        const request = index.getAll(deckId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      db.close();
      return media;
    } catch (error) {
      console.error(`Failed to get media for deck ${deckId}:`, error);
      return [];
    }
  }

  /**
   * Get all media files (for sync status calculation)
   */
  async getAllMedia(): Promise<StoredMedia[]> {
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
      return allMedia;
    } catch (error) {
      console.error('Failed to get all media:', error);
      return [];
    }
  }

  /**
   * Get all unsynced media (pending or failed)
   */
  async getUnsyncedMedia(deckId?: string): Promise<StoredMedia[]> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('syncStatus');

      // Get both pending and failed
      const pending = await new Promise<StoredMedia[]>((resolve, reject) => {
        const request = index.getAll('pending');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const failed = await new Promise<StoredMedia[]>((resolve, reject) => {
        const request = index.getAll('failed');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      db.close();

      const allUnsynced = [...pending, ...failed];

      // Filter by deckId if provided
      if (deckId) {
        return allUnsynced.filter(m => m.deckId === deckId);
      }

      return allUnsynced;
    } catch (error) {
      console.error('Failed to get unsynced media:', error);
      return [];
    }
  }

  /**
   * Mark media as successfully synced
   */
  async markAsSynced(filename: string, firebaseUrl: string): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const media = await new Promise<StoredMedia | null>((resolve, reject) => {
        const request = store.get(filename);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (media) {
        media.syncStatus = 'synced';
        media.firebaseUrl = firebaseUrl;
        media.updatedAt = new Date();
        media.lastSyncAttempt = new Date();
        media.retryCount = 0;
        media.syncError = undefined;

        await new Promise<void>((resolve, reject) => {
          const request = store.put(media);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        console.log(`[AnkiMediaStore] Marked as synced: ${filename}`);
      }

      db.close();
    } catch (error) {
      console.error(`Failed to mark ${filename} as synced:`, error);
      throw error;
    }
  }

  /**
   * Mark media as failed with error
   */
  async markAsFailed(filename: string, error: string): Promise<void> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const media = await new Promise<StoredMedia | null>((resolve, reject) => {
        const request = store.get(filename);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (media) {
        media.syncStatus = 'failed';
        media.syncError = error;
        media.updatedAt = new Date();
        media.lastSyncAttempt = new Date();
        media.retryCount++;

        await new Promise<void>((resolve, reject) => {
          const request = store.put(media);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        console.error(`[AnkiMediaStore] Marked as failed: ${filename} - ${error}`);
      }

      db.close();
    } catch (error) {
      console.error(`Failed to mark ${filename} as failed:`, error);
      throw error;
    }
  }

  /**
   * Delete all media for a specific deck
   * Also cleans up any pending sync jobs in syncQueue store
   */
  async deleteMediaByDeck(deckId: string): Promise<number> {
    try {
      const db = await this.openDB();
      const storeNames = Array.from(db.objectStoreNames);
      const hasSyncQueue = storeNames.includes('syncQueue');
      const transaction = db.transaction(
        hasSyncQueue ? [this.storeName, 'syncQueue'] : [this.storeName],
        'readwrite'
      );
      const store = transaction.objectStore(this.storeName);
      const syncQueueStore = hasSyncQueue ? transaction.objectStore('syncQueue') : null;
      const index = store.index('deckId');
      const queueIndex = syncQueueStore ? syncQueueStore.index('deckId') : null;

      // Get all media files for this deck
      const media = await new Promise<StoredMedia[]>((resolve, reject) => {
        const request = index.getAll(deckId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      let deletedCount = 0;

      if (media.length > 0) {
        // Batch delete all media files in parallel (much faster)
        const deletePromises = media.map(m => {
          // Revoke blob URL if cached
          if (this.blobUrlCache.has(m.id)) {
            URL.revokeObjectURL(this.blobUrlCache.get(m.id)!);
            this.blobUrlCache.delete(m.id);
          }

          // Delete from store
          return new Promise<void>((resolve, reject) => {
            const request = store.delete(m.id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        });

        await Promise.all(deletePromises);
        deletedCount = media.length;
      } else {
        // Fallback for legacy records with missing deckId: delete by key prefix
        const prefix = `${deckId}${ANKI_MEDIA_KEY_SEPARATOR}`;
        const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
          const request = store.getAllKeys();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const matchingKeys = keys.filter(
          (key): key is string => typeof key === 'string' && key.startsWith(prefix)
        );

        const deletePromises = matchingKeys.map(key => {
          if (this.blobUrlCache.has(key)) {
            URL.revokeObjectURL(this.blobUrlCache.get(key)!);
            this.blobUrlCache.delete(key);
          }

          return new Promise<void>((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        });

        await Promise.all(deletePromises);
        deletedCount = matchingKeys.length;
      }

      // Clean up sync queue entries for this deck
      const queueEntries = queueIndex ? await new Promise<any[]>((resolve, reject) => {
        const request = queueIndex.getAll(deckId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }) : [];

      // Batch delete queue entries in parallel
      const queueDeletePromises = syncQueueStore ? queueEntries.map(entry => {
        return new Promise<void>((resolve, reject) => {
          const request = syncQueueStore.delete(entry.id);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }) : [];

      await Promise.all(queueDeletePromises);

      db.close();

      console.log(`[AnkiMediaStore] Deleted ${deletedCount} media files and ${queueEntries.length} sync queue entries for deck ${deckId}`);
      return deletedCount;
    } catch (error) {
      console.error(`Failed to delete media for deck ${deckId}:`, error);
      return 0;
    }
  }

  /**
   * Delete media by explicit ids (keys).
   */
  async deleteMediaByIds(ids: Set<string>): Promise<number> {
    if (ids.size === 0) return 0;

    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const deletePromises: Promise<void>[] = [];
      for (const id of ids) {
        if (this.blobUrlCache.has(id)) {
          URL.revokeObjectURL(this.blobUrlCache.get(id)!);
          this.blobUrlCache.delete(id);
        }

        deletePromises.push(new Promise<void>((resolve, reject) => {
          const request = store.delete(id);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        }));
      }

      await Promise.all(deletePromises);
      db.close();
      return ids.size;
    } catch (error) {
      console.error('[AnkiMediaStore] Failed to delete media by ids:', error);
      return 0;
    }
  }

  /**
   * One-time cleanup for legacy media stored without deckId.
   * Repairs records when possible, deletes orphaned media otherwise.
   */
  async cleanupUnknownMedia(
    validDeckIds: Set<string>,
    referencedRawFilenames: Set<string>
  ): Promise<{ deleted: number; repaired: number }> {
    try {
      const db = await this.openDB();
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      const allMedia = await new Promise<StoredMedia[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      let deleted = 0;
      let repaired = 0;

      const updatePromises: Promise<void>[] = [];
      const deletePromises: Promise<void>[] = [];

      for (const media of allMedia) {
        if (media.deckId !== 'unknown') continue;
        if (typeof media.id !== 'string') continue;

        const separatorIndex = media.id.indexOf(ANKI_MEDIA_KEY_SEPARATOR);
        if (separatorIndex <= 0) {
          if (!referencedRawFilenames.has(media.id)) {
            if (this.blobUrlCache.has(media.id)) {
              URL.revokeObjectURL(this.blobUrlCache.get(media.id)!);
              this.blobUrlCache.delete(media.id);
            }
            deleted++;
            deletePromises.push(new Promise<void>((resolve, reject) => {
              const request = store.delete(media.id);
              request.onsuccess = () => resolve();
              request.onerror = () => reject(request.error);
            }));
          }
          continue;
        }

        const deckId = media.id.slice(0, separatorIndex);
        if (validDeckIds.has(deckId)) {
          media.deckId = deckId;
          media.updatedAt = new Date();
          repaired++;
          updatePromises.push(new Promise<void>((resolve, reject) => {
            const request = store.put(media);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          }));
        } else {
          if (this.blobUrlCache.has(media.id)) {
            URL.revokeObjectURL(this.blobUrlCache.get(media.id)!);
            this.blobUrlCache.delete(media.id);
          }
          deleted++;
          deletePromises.push(new Promise<void>((resolve, reject) => {
            const request = store.delete(media.id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          }));
        }
      }

      await Promise.all([...updatePromises, ...deletePromises]);
      db.close();

      return { deleted, repaired };
    } catch (error) {
      console.error('[AnkiMediaStore] Cleanup unknown media failed:', error);
      return { deleted: 0, repaired: 0 };
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
