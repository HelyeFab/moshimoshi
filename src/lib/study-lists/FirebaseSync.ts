/**
 * Firebase Sync Service for Study Lists
 * Handles cloud synchronization for premium users only
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { StudyList, SavedStudyItem } from '@/types/studyList';
import type { User } from 'firebase/auth';

// Collection paths
const LISTS_COLLECTION = 'studyLists';
const ITEMS_COLLECTION = 'savedItems';

export class FirebaseSync {
  private userId: string | null = null;
  private isPremium: boolean = false;
  private unsubscribers: Array<() => void> = [];
  private syncQueue: Map<string, any> = new Map();
  private isSyncing: boolean = false;
  private retryCount: number = 0;
  private maxRetries: number = 3;

  /**
   * Initialize sync service for a user
   */
  public async initialize(user: User | null, isPremium: boolean) {
    // Clean up existing listeners
    this.cleanup();

    if (!user || !isPremium) {
      this.userId = null;
      this.isPremium = false;
      return;
    }

    this.userId = user.uid;
    this.isPremium = isPremium;

    // Start real-time listeners for premium users
    if (this.isPremium) {
      this.startRealtimeSync();
    }
  }

  /**
   * Clean up listeners and resources
   */
  public cleanup() {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.syncQueue.clear();
    this.isSyncing = false;
  }

  /**
   * Check if user can sync (premium only)
   */
  private canSync(): boolean {
    return this.userId !== null && this.isPremium;
  }

  /**
   * Start real-time synchronization
   */
  private startRealtimeSync() {
    if (!this.canSync()) return;

    // Listen to study lists changes
    const listsQuery = query(
      collection(db, 'users', this.userId!, LISTS_COLLECTION),
      orderBy('updatedAt', 'desc')
    );

    const listsUnsub = onSnapshot(listsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified' || change.type === 'added') {
          // Handle incoming changes from other devices
          this.handleIncomingListChange(change.doc.data() as StudyList);
        }
      });
    });

    this.unsubscribers.push(listsUnsub);

    // Listen to saved items changes
    const itemsQuery = query(
      collection(db, 'users', this.userId!, ITEMS_COLLECTION),
      orderBy('lastModified', 'desc')
    );

    const itemsUnsub = onSnapshot(itemsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified' || change.type === 'added') {
          // Handle incoming changes from other devices
          this.handleIncomingItemChange(change.doc.data() as SavedStudyItem);
        }
      });
    });

    this.unsubscribers.push(itemsUnsub);
  }

  /**
   * Sync a study list to Firebase
   */
  public async syncList(list: StudyList): Promise<void> {
    if (!this.canSync()) return;

    try {
      const listRef = doc(db, 'users', this.userId!, LISTS_COLLECTION, list.id);

      const listData = {
        ...list,
        createdAt: Timestamp.fromMillis(list.createdAt),
        updatedAt: Timestamp.fromMillis(list.updatedAt),
        lastReviewedAt: list.lastReviewedAt ? Timestamp.fromMillis(list.lastReviewedAt) : null,
        syncedAt: serverTimestamp(),
      };

      await setDoc(listRef, listData, { merge: true });
      this.retryCount = 0;
    } catch (error) {
      console.error('Failed to sync list:', error);
      this.handleSyncError(list, 'list');
    }
  }

  /**
   * Sync a saved item to Firebase
   */
  public async syncItem(item: SavedStudyItem): Promise<void> {
    if (!this.canSync()) return;

    try {
      const itemRef = doc(db, 'users', this.userId!, ITEMS_COLLECTION, item.id);

      const itemData = {
        ...item,
        savedAt: Timestamp.fromMillis(item.savedAt),
        lastModified: Timestamp.fromMillis(item.lastModified),
        reviewData: item.reviewData ? {
          ...item.reviewData,
          nextReviewDate: Timestamp.fromMillis(item.reviewData.nextReviewDate),
          lastReviewedAt: item.reviewData.lastReviewedAt
            ? Timestamp.fromMillis(item.reviewData.lastReviewedAt)
            : null,
        } : null,
        syncedAt: serverTimestamp(),
      };

      await setDoc(itemRef, itemData, { merge: true });
      this.retryCount = 0;
    } catch (error) {
      console.error('Failed to sync item:', error);
      this.handleSyncError(item, 'item');
    }
  }

  /**
   * Batch sync multiple lists
   */
  public async syncLists(lists: StudyList[]): Promise<void> {
    if (!this.canSync() || lists.length === 0) return;

    try {
      const batch = writeBatch(db);

      lists.forEach(list => {
        const listRef = doc(db, 'users', this.userId!, LISTS_COLLECTION, list.id);

        const listData = {
          ...list,
          createdAt: Timestamp.fromMillis(list.createdAt),
          updatedAt: Timestamp.fromMillis(list.updatedAt),
          lastReviewedAt: list.lastReviewedAt ? Timestamp.fromMillis(list.lastReviewedAt) : null,
          syncedAt: serverTimestamp(),
        };

        batch.set(listRef, listData, { merge: true });
      });

      await batch.commit();
      this.retryCount = 0;
    } catch (error) {
      console.error('Failed to batch sync lists:', error);
      lists.forEach(list => this.handleSyncError(list, 'list'));
    }
  }

  /**
   * Batch sync multiple items
   */
  public async syncItems(items: SavedStudyItem[]): Promise<void> {
    if (!this.canSync() || items.length === 0) return;

    try {
      const batch = writeBatch(db);

      items.forEach(item => {
        const itemRef = doc(db, 'users', this.userId!, ITEMS_COLLECTION, item.id);

        const itemData = {
          ...item,
          savedAt: Timestamp.fromMillis(item.savedAt),
          lastModified: Timestamp.fromMillis(item.lastModified),
          reviewData: item.reviewData ? {
            ...item.reviewData,
            nextReviewDate: Timestamp.fromMillis(item.reviewData.nextReviewDate),
            lastReviewedAt: item.reviewData.lastReviewedAt
              ? Timestamp.fromMillis(item.reviewData.lastReviewedAt)
              : null,
          } : null,
          syncedAt: serverTimestamp(),
        };

        batch.set(itemRef, itemData, { merge: true });
      });

      await batch.commit();
      this.retryCount = 0;
    } catch (error) {
      console.error('Failed to batch sync items:', error);
      items.forEach(item => this.handleSyncError(item, 'item'));
    }
  }

  /**
   * Delete a list from Firebase
   */
  public async deleteList(listId: string): Promise<void> {
    if (!this.canSync()) return;

    try {
      const listRef = doc(db, 'users', this.userId!, LISTS_COLLECTION, listId);
      await deleteDoc(listRef);
    } catch (error) {
      console.error('Failed to delete list from Firebase:', error);
    }
  }

  /**
   * Delete an item from Firebase
   */
  public async deleteItem(itemId: string): Promise<void> {
    if (!this.canSync()) return;

    try {
      const itemRef = doc(db, 'users', this.userId!, ITEMS_COLLECTION, itemId);
      await deleteDoc(itemRef);
    } catch (error) {
      console.error('Failed to delete item from Firebase:', error);
    }
  }

  /**
   * Fetch all lists from Firebase
   */
  public async fetchLists(): Promise<StudyList[]> {
    if (!this.canSync()) return [];

    try {
      const listsQuery = query(
        collection(db, 'users', this.userId!, LISTS_COLLECTION),
        where('deleted', '!=', true),
        orderBy('updatedAt', 'desc')
      );

      const snapshot = await getDocs(listsQuery);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toMillis() || Date.now(),
          updatedAt: data.updatedAt?.toMillis() || Date.now(),
          lastReviewedAt: data.lastReviewedAt?.toMillis(),
        } as StudyList;
      });
    } catch (error) {
      console.error('Failed to fetch lists from Firebase:', error);
      return [];
    }
  }

  /**
   * Fetch all items from Firebase
   */
  public async fetchItems(): Promise<SavedStudyItem[]> {
    if (!this.canSync()) return [];

    try {
      const itemsQuery = query(
        collection(db, 'users', this.userId!, ITEMS_COLLECTION),
        orderBy('lastModified', 'desc')
      );

      const snapshot = await getDocs(itemsQuery);

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          savedAt: data.savedAt?.toMillis() || Date.now(),
          lastModified: data.lastModified?.toMillis() || Date.now(),
          reviewData: data.reviewData ? {
            ...data.reviewData,
            nextReviewDate: data.reviewData.nextReviewDate?.toMillis() || Date.now(),
            lastReviewedAt: data.reviewData.lastReviewedAt?.toMillis(),
          } : undefined,
        } as SavedStudyItem;
      });
    } catch (error) {
      console.error('Failed to fetch items from Firebase:', error);
      return [];
    }
  }

  /**
   * Handle incoming list changes from other devices
   */
  private handleIncomingListChange(list: StudyList) {
    // Convert timestamps
    const processedList: StudyList = {
      ...list,
      createdAt: (list.createdAt as any)?.toMillis() || Date.now(),
      updatedAt: (list.updatedAt as any)?.toMillis() || Date.now(),
      lastReviewedAt: (list.lastReviewedAt as any)?.toMillis(),
    };

    // Emit event for StudyListManager to handle
    window.dispatchEvent(new CustomEvent('studylist:remote-change', {
      detail: { type: 'list', data: processedList }
    }));
  }

  /**
   * Handle incoming item changes from other devices
   */
  private handleIncomingItemChange(item: SavedStudyItem) {
    // Convert timestamps
    const processedItem: SavedStudyItem = {
      ...item,
      savedAt: (item.savedAt as any)?.toMillis() || Date.now(),
      lastModified: (item.lastModified as any)?.toMillis() || Date.now(),
      reviewData: item.reviewData ? {
        ...item.reviewData,
        nextReviewDate: (item.reviewData.nextReviewDate as any)?.toMillis() || Date.now(),
        lastReviewedAt: (item.reviewData.lastReviewedAt as any)?.toMillis(),
      } : undefined,
    };

    // Emit event for StudyListManager to handle
    window.dispatchEvent(new CustomEvent('studylist:remote-change', {
      detail: { type: 'item', data: processedItem }
    }));
  }

  /**
   * Handle sync errors with exponential backoff
   */
  private handleSyncError(data: any, type: 'list' | 'item') {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = Math.pow(2, this.retryCount) * 1000; // Exponential backoff

      setTimeout(() => {
        if (type === 'list') {
          this.syncList(data);
        } else {
          this.syncItem(data);
        }
      }, delay);
    } else {
      // Add to sync queue for later retry
      this.syncQueue.set(`${type}:${data.id}`, data);
    }
  }

  /**
   * Process sync queue
   */
  public async processSyncQueue(): Promise<void> {
    if (!this.canSync() || this.isSyncing) return;

    this.isSyncing = true;
    const lists: StudyList[] = [];
    const items: SavedStudyItem[] = [];

    this.syncQueue.forEach((data, key) => {
      if (key.startsWith('list:')) {
        lists.push(data);
      } else if (key.startsWith('item:')) {
        items.push(data);
      }
    });

    if (lists.length > 0) {
      await this.syncLists(lists);
    }

    if (items.length > 0) {
      await this.syncItems(items);
    }

    this.syncQueue.clear();
    this.isSyncing = false;
  }

  /**
   * Get sync status
   */
  public getSyncStatus() {
    return {
      isEnabled: this.canSync(),
      isPremium: this.isPremium,
      pendingItems: this.syncQueue.size,
      isSyncing: this.isSyncing,
    };
  }
}

// Export singleton instance
export const firebaseSync = new FirebaseSync();