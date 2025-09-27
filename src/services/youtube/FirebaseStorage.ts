/**
 * Firebase Storage for YouTube History
 * Used by premium users for cloud sync
 */

import { adminFirestore as adminDb } from '@/lib/firebase/admin';
import { YouTubeVideoItem, YouTubeHistoryStorage } from './types';
import { Timestamp } from 'firebase-admin/firestore';

const COLLECTION_NAME = 'userYouTubeHistory';

export class FirebaseYouTubeStorage implements YouTubeHistoryStorage {
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

  async addOrUpdateVideo(video: YouTubeVideoItem): Promise<void> {
    const docId = this.getDocId(video.videoId);
    const docRef = adminDb.collection(COLLECTION_NAME).doc(docId);

    try {
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        // Update existing video
        const existingData = docSnap.data();

        const updateData = {
          userId: this.userId,
          videoId: video.videoId,
          videoUrl: video.videoUrl,
          videoTitle: video.videoTitle,
          lastWatched: Timestamp.fromDate(new Date()),
          firstWatched: existingData?.firstWatched || Timestamp.fromDate(new Date()),
          watchCount: (existingData?.watchCount || 0) + 1,
          totalWatchTime: (existingData?.totalWatchTime || 0) + (video.totalWatchTime || 0),
          ...(video.thumbnailUrl && { thumbnailUrl: video.thumbnailUrl }),
          ...(video.channelName && { channelName: video.channelName }),
          ...(video.channelId && { channelId: video.channelId }),
          ...(video.duration && { duration: video.duration }),
          ...(video.metadata && { metadata: video.metadata }),
          ...(video.personalNotes && { personalNotes: video.personalNotes }),
          updatedAt: Timestamp.now()
        };

        await docRef.set(updateData);
      } else {
        // Create new video entry
        const dataToSave = {
          userId: this.userId,
          videoId: video.videoId,
          videoUrl: video.videoUrl,
          videoTitle: video.videoTitle,
          lastWatched: Timestamp.now(),
          firstWatched: Timestamp.now(),
          watchCount: 1,
          totalWatchTime: video.totalWatchTime || 0,
          ...(video.thumbnailUrl && { thumbnailUrl: video.thumbnailUrl }),
          ...(video.channelName && { channelName: video.channelName }),
          ...(video.channelId && { channelId: video.channelId }),
          ...(video.duration && { duration: video.duration }),
          ...(video.metadata && { metadata: video.metadata }),
          ...(video.personalNotes && { personalNotes: video.personalNotes }),
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        };

        await docRef.set(dataToSave);
      }
    } catch (error: any) {
      console.error('Error saving YouTube video to Firebase:', error);
      throw error;
    }
  }

  async getVideo(videoId: string): Promise<YouTubeVideoItem | null> {
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
          lastWatched: data.lastWatched?.toDate() || new Date(),
          firstWatched: data.firstWatched?.toDate() || new Date(),
          watchCount: data.watchCount || 1,
          totalWatchTime: data.totalWatchTime,
          duration: data.duration,
          thumbnailUrl: data.thumbnailUrl,
          channelName: data.channelName,
          channelId: data.channelId,
          metadata: data.metadata,
          personalNotes: data.personalNotes
        } as YouTubeVideoItem;
      }
      return null;
    } catch (error) {
      console.error('Error getting YouTube video from Firebase:', error);
      return null;
    }
  }

  async getAllVideos(): Promise<YouTubeVideoItem[]> {
    try {
      const querySnapshot = await adminDb
        .collection(COLLECTION_NAME)
        .where('userId', '==', this.userId)
        .orderBy('lastWatched', 'desc')
        .get();

      const videos: YouTubeVideoItem[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        videos.push({
          id: doc.id,
          videoId: data.videoId,
          videoUrl: data.videoUrl,
          videoTitle: data.videoTitle,
          lastWatched: data.lastWatched?.toDate() || new Date(),
          firstWatched: data.firstWatched?.toDate() || new Date(),
          watchCount: data.watchCount || 1,
          totalWatchTime: data.totalWatchTime,
          duration: data.duration,
          thumbnailUrl: data.thumbnailUrl,
          channelName: data.channelName,
          channelId: data.channelId,
          metadata: data.metadata,
          personalNotes: data.personalNotes
        } as YouTubeVideoItem);
      });

      return videos;
    } catch (error) {
      console.error('Error getting all YouTube videos from Firebase:', error);
      return [];
    }
  }

  async deleteVideo(videoId: string): Promise<void> {
    const docId = this.getDocId(videoId);
    const docRef = adminDb.collection(COLLECTION_NAME).doc(docId);

    try {
      // Verify ownership before deleting
      const docSnap = await docRef.get();

      if (docSnap.exists) {
        const data = docSnap.data();

        if (data?.userId !== this.userId) {
          throw new Error('Cannot delete video - ownership mismatch');
        }

        await docRef.delete();
        console.log(`Successfully deleted YouTube video: ${videoId}`);
      } else {
        console.log(`YouTube video not found: ${videoId}, nothing to delete`);
      }
    } catch (error: any) {
      console.error('Error deleting YouTube video from Firebase:', error);
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
      console.error('Error clearing YouTube history from Firebase:', error);
      throw error;
    }
  }

  async getRecentVideos(limit: number): Promise<YouTubeVideoItem[]> {
    try {
      const querySnapshot = await adminDb
        .collection(COLLECTION_NAME)
        .where('userId', '==', this.userId)
        .orderBy('lastWatched', 'desc')
        .limit(limit)
        .get();

      const videos: YouTubeVideoItem[] = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        videos.push({
          id: doc.id,
          videoId: data.videoId,
          videoUrl: data.videoUrl,
          videoTitle: data.videoTitle,
          lastWatched: data.lastWatched?.toDate() || new Date(),
          firstWatched: data.firstWatched?.toDate() || new Date(),
          watchCount: data.watchCount || 1,
          totalWatchTime: data.totalWatchTime,
          duration: data.duration,
          thumbnailUrl: data.thumbnailUrl,
          channelName: data.channelName,
          channelId: data.channelId,
          metadata: data.metadata,
          personalNotes: data.personalNotes
        } as YouTubeVideoItem);
      });

      return videos;
    } catch (error) {
      console.error('Error getting recent YouTube videos from Firebase:', error);
      return [];
    }
  }

  async searchVideos(query: string): Promise<YouTubeVideoItem[]> {
    // Firebase doesn't support full-text search easily,
    // so we'll get all videos and filter client-side
    const allVideos = await this.getAllVideos();
    const lowercaseQuery = query.toLowerCase();

    return allVideos.filter(video =>
      video.videoTitle.toLowerCase().includes(lowercaseQuery) ||
      video.channelName?.toLowerCase().includes(lowercaseQuery) ||
      video.metadata?.description?.toLowerCase().includes(lowercaseQuery)
    );
  }
}