import { adminDb } from '@/lib/firebase/admin';
import { PracticeHistoryItem, PracticeHistoryStorage } from './types';
import { Timestamp } from 'firebase-admin/firestore';

const COLLECTION_NAME = 'userPracticeHistory';

export class FirebasePracticeHistoryStorage implements PracticeHistoryStorage {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  private getDocId(videoId: string): string {
    return `${this.userId}_${videoId}`;
  }

  async init(): Promise<void> {
    // Firebase doesn't require initialization
    return Promise.resolve();
  }

  async addOrUpdateItem(item: PracticeHistoryItem): Promise<void> {
    const docId = this.getDocId(item.videoId);
    const docRef = adminDb.collection(COLLECTION_NAME).doc(docId);

    try {
      // Check if document exists
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        // Update existing item
        const existingData = docSnap.data();

        const updateData = {
          userId: this.userId,
          videoId: item.videoId,
          videoUrl: item.videoUrl,
          videoTitle: item.videoTitle,
          lastPracticed: Timestamp.fromDate(new Date(item.lastPracticed)),
          firstPracticed: existingData?.firstPracticed || Timestamp.fromDate(new Date(item.firstPracticed)),
          practiceCount: (existingData?.practiceCount || 0) + 1,
          totalPracticeTime: (existingData?.totalPracticeTime || 0) + (item.totalPracticeTime || 0),
          contentType: item.contentType,
          ...(item.thumbnailUrl && { thumbnailUrl: item.thumbnailUrl }),
          ...(item.channelName && { channelName: item.channelName }),
          ...(item.duration && { duration: item.duration }),
          ...(item.metadata && { metadata: item.metadata }),
          updatedAt: Timestamp.now()
        };

        await docRef.set(updateData);
      } else {
        // Create new item
        const dataToSave = {
          userId: this.userId,
          videoId: item.videoId,
          videoUrl: item.videoUrl,
          videoTitle: item.videoTitle,
          lastPracticed: Timestamp.fromDate(new Date(item.lastPracticed)),
          firstPracticed: Timestamp.fromDate(new Date(item.firstPracticed)),
          practiceCount: 1,
          totalPracticeTime: item.totalPracticeTime || 0,
          contentType: item.contentType,
          ...(item.thumbnailUrl && { thumbnailUrl: item.thumbnailUrl }),
          ...(item.channelName && { channelName: item.channelName }),
          ...(item.duration && { duration: item.duration }),
          ...(item.metadata && { metadata: item.metadata }),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        // Validate contentType
        if (!['youtube', 'audio', 'video'].includes(dataToSave.contentType)) {
          throw new Error(`Invalid contentType: ${dataToSave.contentType}. Must be one of: youtube, audio, video`);
        }

        await docRef.set(dataToSave);
      }
    } catch (error: any) {
      console.error('Error saving practice history to Firebase:', error);
      throw error;
    }
  }

  async getItem(videoId: string): Promise<PracticeHistoryItem | null> {
    const docId = this.getDocId(videoId);
    const docRef = adminDb.collection(COLLECTION_NAME).doc(docId);

    try {
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const data = docSnap.data();
        if (!data) return null;

        return {
          id: docId,
          videoId: data.videoId,
          videoUrl: data.videoUrl,
          videoTitle: data.videoTitle,
          lastPracticed: data.lastPracticed?.toDate() || new Date(),
          firstPracticed: data.firstPracticed?.toDate() || new Date(),
          practiceCount: data.practiceCount || 1,
          totalPracticeTime: data.totalPracticeTime,
          duration: data.duration,
          contentType: data.contentType,
          thumbnailUrl: data.thumbnailUrl,
          channelName: data.channelName,
          metadata: data.metadata
        } as PracticeHistoryItem;
      }
      return null;
    } catch (error) {
      console.error('Error getting practice history item:', error);
      return null;
    }
  }

  async getAllItems(): Promise<PracticeHistoryItem[]> {
    try {
      const querySnapshot = await adminDb
        .collection(COLLECTION_NAME)
        .where('userId', '==', this.userId)
        .orderBy('lastPracticed', 'desc')
        .get();

      const items: PracticeHistoryItem[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          videoId: data.videoId,
          videoUrl: data.videoUrl,
          videoTitle: data.videoTitle,
          lastPracticed: data.lastPracticed?.toDate() || new Date(),
          firstPracticed: data.firstPracticed?.toDate() || new Date(),
          practiceCount: data.practiceCount || 1,
          totalPracticeTime: data.totalPracticeTime,
          duration: data.duration,
          contentType: data.contentType,
          thumbnailUrl: data.thumbnailUrl,
          channelName: data.channelName,
          metadata: data.metadata
        } as PracticeHistoryItem);
      });

      return items;
    } catch (error) {
      console.error('Error getting all practice history items:', error);
      return [];
    }
  }

  async deleteItem(videoId: string): Promise<void> {
    const docId = this.getDocId(videoId);
    const docRef = adminDb.collection(COLLECTION_NAME).doc(docId);

    try {
      // First, verify the document exists and belongs to the user
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const data = docSnap.data();

        // Verify ownership before attempting delete
        if (data?.userId !== this.userId) {
          throw new Error('Cannot delete practice history item - ownership mismatch');
        }

        // Now safe to delete
        await docRef.delete();
        console.log(`Successfully deleted practice history for video: ${videoId}`);
      } else {
        console.log(`Practice history item not found for video: ${videoId}, nothing to delete`);
      }
    } catch (error: any) {
      console.error('Error deleting practice history item:', error);
      throw error;
    }
  }

  async clearAll(): Promise<void> {
    try {
      const querySnapshot = await adminDb
        .collection(COLLECTION_NAME)
        .where('userId', '==', this.userId)
        .get();

      const batch = adminDb.batch();

      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });

      await batch.commit();
    } catch (error) {
      console.error('Error clearing practice history:', error);
      throw error;
    }
  }

  async getItemsByDateRange(startDate: Date, endDate: Date): Promise<PracticeHistoryItem[]> {
    try {
      const querySnapshot = await adminDb
        .collection(COLLECTION_NAME)
        .where('userId', '==', this.userId)
        .where('lastPracticed', '>=', Timestamp.fromDate(startDate))
        .where('lastPracticed', '<=', Timestamp.fromDate(endDate))
        .orderBy('lastPracticed', 'desc')
        .get();

      const items: PracticeHistoryItem[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          videoId: data.videoId,
          videoUrl: data.videoUrl,
          videoTitle: data.videoTitle,
          lastPracticed: data.lastPracticed?.toDate() || new Date(),
          firstPracticed: data.firstPracticed?.toDate() || new Date(),
          practiceCount: data.practiceCount || 1,
          totalPracticeTime: data.totalPracticeTime,
          duration: data.duration,
          contentType: data.contentType,
          thumbnailUrl: data.thumbnailUrl,
          channelName: data.channelName,
          metadata: data.metadata
        } as PracticeHistoryItem);
      });

      return items;
    } catch (error) {
      console.error('Error getting practice history by date range:', error);
      return [];
    }
  }

  async getMostPracticed(limitCount: number = 10): Promise<PracticeHistoryItem[]> {
    try {
      const querySnapshot = await adminDb
        .collection(COLLECTION_NAME)
        .where('userId', '==', this.userId)
        .orderBy('practiceCount', 'desc')
        .limit(limitCount)
        .get();

      const items: PracticeHistoryItem[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          videoId: data.videoId,
          videoUrl: data.videoUrl,
          videoTitle: data.videoTitle,
          lastPracticed: data.lastPracticed?.toDate() || new Date(),
          firstPracticed: data.firstPracticed?.toDate() || new Date(),
          practiceCount: data.practiceCount || 1,
          totalPracticeTime: data.totalPracticeTime,
          duration: data.duration,
          contentType: data.contentType,
          thumbnailUrl: data.thumbnailUrl,
          channelName: data.channelName,
          metadata: data.metadata
        } as PracticeHistoryItem);
      });

      return items;
    } catch (error) {
      console.error('Error getting most practiced items:', error);
      return [];
    }
  }

  // Sync from IndexedDB to Firebase (for when users upgrade)
  async syncFromLocal(localItems: PracticeHistoryItem[]): Promise<void> {
    try {
      const batch = adminDb.batch();

      for (const item of localItems) {
        const docId = this.getDocId(item.videoId);
        const docRef = adminDb.collection(COLLECTION_NAME).doc(docId);

        const data = {
          userId: this.userId,
          videoId: item.videoId,
          videoUrl: item.videoUrl,
          videoTitle: item.videoTitle,
          lastPracticed: Timestamp.fromDate(new Date(item.lastPracticed)),
          firstPracticed: Timestamp.fromDate(new Date(item.firstPracticed)),
          practiceCount: item.practiceCount,
          totalPracticeTime: item.totalPracticeTime || 0,
          contentType: item.contentType,
          ...(item.thumbnailUrl && { thumbnailUrl: item.thumbnailUrl }),
          ...(item.channelName && { channelName: item.channelName }),
          ...(item.duration && { duration: item.duration }),
          ...(item.metadata && { metadata: item.metadata }),
          syncedAt: Timestamp.now()
        };

        batch.set(docRef, data, { merge: true });
      }

      await batch.commit();
      console.log(`Successfully synced ${localItems.length} items from local to Firebase`);
    } catch (error) {
      console.error('Error syncing from local to Firebase:', error);
      throw error;
    }
  }
}