/**
 * Background Sync Worker Module
 * Agent 3 - Data & Sync
 *
 * Service Worker module for handling background sync operations
 * To be integrated with the main service worker
 */

// Import types (these would be shared in production)
interface SyncOutboxItem {
  id: string;
  type: string;
  payload: any;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
  error?: string;
}

/**
 * Handle sync-outbox event
 * Called when background sync is triggered
 */
export async function handleSyncOutbox(): Promise<void> {
  console.log('[SW-Sync] Background sync triggered');

  try {
    // Open IndexedDB directly (can't import modules in SW)
    const db = await openDB();
    const items = await getPendingSyncItems(db);

    if (items.length === 0) {
      console.log('[SW-Sync] No items to sync');
      return;
    }

    console.log(`[SW-Sync] Syncing ${items.length} items`);

    // Process items sequentially
    for (const item of items) {
      const success = await syncItem(db, item);
      if (!success) {
        // Stop on first failure (will retry later)
        break;
      }
    }

    console.log('[SW-Sync] Sync completed');

  } catch (error) {
    console.error('[SW-Sync] Sync failed:', error);
    // Will retry automatically
    throw error;
  }
}

/**
 * Handle periodic sync for premium users
 * Check for due reviews daily
 */
export async function handlePeriodicSync(tag: string): Promise<void> {
  if (tag !== 'daily-review-check') {
    return;
  }

  console.log('[SW-Sync] Periodic sync: checking for due reviews');

  try {
    // Check if user is premium (via settings)
    const db = await openDB();
    const settings = await getSettings(db, 'sync');

    if (!settings?.periodicSyncEnabled) {
      console.log('[SW-Sync] Periodic sync not enabled');
      return;
    }

    // Check quiet hours
    if (isInQuietHours(settings)) {
      console.log('[SW-Sync] In quiet hours, skipping notification');
      return;
    }

    // Check for due reviews
    const dueCount = await getDueCount(db);

    if (dueCount > 0) {
      // Show notification (this would be handled by Agent 2)
      await self.registration.showNotification(
        'Reviews Due!',
        {
          body: `You have ${dueCount} reviews waiting`,
          icon: '/favicon-192x192.png',
          badge: '/favicon-192x192.png',
          tag: 'due-reviews',
          data: {
            actionUrl: '/review',
            count: dueCount
          }
        }
      );
    }

  } catch (error) {
    console.error('[SW-Sync] Periodic sync failed:', error);
  }
}

/**
 * Open IndexedDB connection
 */
async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('moshimoshi', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get pending sync items from IndexedDB
 */
async function getPendingSyncItems(db: IDBDatabase): Promise<SyncOutboxItem[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sync_outbox'], 'readonly');
    const store = tx.objectStore('sync_outbox');
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Sync a single item
 */
async function syncItem(db: IDBDatabase, item: SyncOutboxItem): Promise<boolean> {
  try {
    const response = await fetch('/api/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        opId: item.id,
        type: item.type,
        payload: item.payload,
        createdAt: item.createdAt
      })
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        // Auth error - stop syncing
        console.error('[SW-Sync] Authentication error');
        return false;
      }

      if (response.status === 409) {
        // Conflict - remove from queue (handled elsewhere)
        await removeFromQueue(db, item.id);
        return true;
      }

      if (response.status >= 500) {
        // Server error - retry later
        throw new Error(`Server error: ${response.status}`);
      }

      // Client error - don't retry, remove from queue
      console.error(`[SW-Sync] Client error for ${item.id}: ${response.status}`);
      await removeFromQueue(db, item.id);
      return true;
    }

    // Success - remove from queue
    await removeFromQueue(db, item.id);
    console.log(`[SW-Sync] Successfully synced ${item.id}`);
    return true;

  } catch (error) {
    // Network error - update attempt count
    console.error(`[SW-Sync] Failed to sync ${item.id}:`, error);

    await updateSyncItem(db, item.id, {
      attempts: item.attempts + 1,
      lastAttemptAt: Date.now(),
      error: String(error)
    });

    return false;
  }
}

/**
 * Remove item from sync queue
 */
async function removeFromQueue(db: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sync_outbox'], 'readwrite');
    const store = tx.objectStore('sync_outbox');
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update sync item
 */
async function updateSyncItem(
  db: IDBDatabase,
  id: string,
  update: Partial<SyncOutboxItem>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['sync_outbox'], 'readwrite');
    const store = tx.objectStore('sync_outbox');

    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result;
      if (item) {
        const updated = { ...item, ...update };
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        resolve();
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Get settings from IndexedDB
 */
async function getSettings(db: IDBDatabase, id: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['settings'], 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get count of due reviews
 */
async function getDueCount(db: IDBDatabase): Promise<number> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['reviewQueue'], 'readonly');
    const store = tx.objectStore('reviewQueue');
    const index = store.index('dueAt');
    const range = IDBKeyRange.upperBound(Date.now());
    const request = index.count(range);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Check if current time is in quiet hours
 */
function isInQuietHours(settings: any): boolean {
  if (!settings?.quietHours?.enabled) {
    return false;
  }

  const now = new Date();
  const currentTime = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = settings.quietHours.start.split(':').map(Number);
  const [endHour, endMin] = settings.quietHours.end.split(':').map(Number);

  const startTime = startHour * 60 + startMin;
  const endTime = endHour * 60 + endMin;

  if (startTime <= endTime) {
    // Quiet hours don't cross midnight
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // Quiet hours cross midnight
    return currentTime >= startTime || currentTime <= endTime;
  }
}