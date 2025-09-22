import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore';

// Import Firebase - it will be null on server side
import { firestore as db } from '@/lib/firebase/client';

interface TranscriptLine {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
}

interface CachedTranscript {
  id: string;
  contentId: string; // Hash of the content identifier
  contentType: 'youtube' | 'audio' | 'video';
  videoUrl?: string;
  videoTitle?: string;
  transcript: TranscriptLine[];
  formattedTranscript?: TranscriptLine[]; // AI-formatted version
  language: string;
  duration?: number;
  createdAt: Timestamp;
  lastAccessed: Timestamp;
  accessCount: number;
  createdBy?: string; // User ID who created it
  metadata?: {
    youtubeVideoId?: string;
    channelName?: string;
    uploadDate?: string;
    thumbnailUrl?: string;
    formattedAt?: Timestamp; // When AI formatting was done
    formattingModel?: string; // Which AI model was used
    wasFormatted?: boolean; // Whether formatting was applied
  };
}

export class TranscriptCacheManager {
  private static COLLECTION_NAME = 'transcriptCache';
  private static CACHE_DURATION_DAYS = 90; // Cache for 90 days

  /**
   * Normalize a YouTube URL to a standard format
   * This ensures consistent video IDs regardless of URL format
   */
  static normalizeYouTubeUrl(url: string): string {
    const videoId = this.extractYouTubeVideoId(url);
    if (videoId) {
      // Always return the standard watch URL format
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return url;
  }

  /**
   * Generate a unique content ID for caching
   * For YouTube: Use video ID
   * For uploaded files: Use hash of file name + size + duration
   */
  static generateContentId(params: {
    type: 'youtube' | 'audio' | 'video';
    videoUrl?: string;
    fileName?: string;
    fileSize?: number;
    duration?: number;
  }): string {
    if (params.type === 'youtube' && params.videoUrl) {
      // Normalize the URL first - decode any URI encoding
      const normalizedUrl = decodeURIComponent(params.videoUrl);

      // Extract YouTube video ID
      const videoId = this.extractYouTubeVideoId(normalizedUrl);

      if (videoId) {
        const contentId = `youtube_${videoId}`;
        return contentId;
      } else {
        // Fallback to a hash of the URL if we can't extract the ID
        let hash = 0;
        for (let i = 0; i < normalizedUrl.length; i++) {
          const char = normalizedUrl.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        const fallbackId = `youtube_fallback_${Math.abs(hash).toString(16)}`;
        return fallbackId;
      }
    }

    // For uploaded files, create a simple hash using browser-compatible method
    const contentString = `${params.type}_${params.fileName}_${params.fileSize}_${params.duration}`;

    // Simple hash function for browser
    let hash = 0;
    for (let i = 0; i < contentString.length; i++) {
      const char = contentString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return `${params.type}_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Extract YouTube video ID from various URL formats
   */
  static extractYouTubeVideoId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/,
      /youtube\.com\/v\/([^&\s]+)/,
      /youtube\.com\/shorts\/([^&\s]+)/,
      /music\.youtube\.com\/watch\?v=([^&\s]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Save transcript to cache
   */
  static async saveTranscriptToCache(params: {
    contentId: string;
    contentType: 'youtube' | 'audio' | 'video';
    videoUrl?: string;
    videoTitle?: string;
    transcript: TranscriptLine[];
    formattedTranscript?: TranscriptLine[];
    language: string;
    duration?: number;
    metadata?: any;
    userId?: string;
  }): Promise<void> {
    if (!db) {
      console.warn('Firebase not initialized, skipping cache save');
      return;
    }

    try {
      const docRef = doc(db, this.COLLECTION_NAME, params.contentId);

      const cacheData: Partial<CachedTranscript> = {
        contentId: params.contentId,
        contentType: params.contentType,
        videoUrl: params.videoUrl,
        videoTitle: params.videoTitle,
        transcript: params.transcript,
        formattedTranscript: params.formattedTranscript,
        language: params.language,
        duration: params.duration,
        createdAt: serverTimestamp() as Timestamp,
        lastAccessed: serverTimestamp() as Timestamp,
        accessCount: 1,
        createdBy: params.userId,
        metadata: {
          ...params.metadata,
          formattedAt: params.formattedTranscript ? serverTimestamp() as Timestamp : undefined,
          wasFormatted: !!params.formattedTranscript
        }
      };

      await setDoc(docRef, cacheData);
      console.log('Transcript saved to cache:', params.contentId);
    } catch (error) {
      console.error('Error saving transcript to cache:', error);
    }
  }

  /**
   * Get cached transcript
   */
  static async getCachedTranscript(contentId: string): Promise<CachedTranscript | null> {
    if (!db) {
      console.warn('Firebase not initialized, skipping cache lookup');
      return null;
    }

    try {
      const docRef = doc(db, this.COLLECTION_NAME, contentId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as CachedTranscript;

        // Update access count and timestamp
        await updateDoc(docRef, {
          lastAccessed: serverTimestamp(),
          accessCount: increment(1)
        }).catch(err => console.error('Failed to update access count:', err));

        return data;
      }

      return null;
    } catch (error) {
      console.error('Error getting cached transcript:', error);
      return null;
    }
  }

  /**
   * Update formatted transcript in cache
   */
  static async updateFormattedTranscript(
    contentId: string,
    formattedTranscript: TranscriptLine[],
    formattingModel?: string
  ): Promise<void> {
    if (!db) {
      console.warn('Firebase not initialized, skipping cache update');
      return;
    }

    try {
      const docRef = doc(db, this.COLLECTION_NAME, contentId);
      await updateDoc(docRef, {
        formattedTranscript,
        'metadata.formattedAt': serverTimestamp(),
        'metadata.formattingModel': formattingModel || 'gpt-3.5-turbo',
        'metadata.wasFormatted': true,
        lastAccessed: serverTimestamp()
      });
      console.log('Formatted transcript updated in cache:', contentId);
    } catch (error) {
      console.error('Error updating formatted transcript:', error);
    }
  }

  /**
   * Check if transcript is cached
   */
  static async isTranscriptCached(contentId: string): Promise<boolean> {
    if (!db) {
      return false;
    }

    try {
      const docRef = doc(db, this.COLLECTION_NAME, contentId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      console.error('Error checking cache:', error);
      return false;
    }
  }

  /**
   * Debug function to list all cached transcripts
   */
  static async debugListAllCachedTranscripts(): Promise<void> {
    if (!db) {
      console.warn('Firebase not initialized');
      return;
    }

    console.log('=== Cached Transcripts Debug ===');
    // Note: This would need additional Firestore query setup
    console.log('Check Firestore console for cached transcripts in collection:', this.COLLECTION_NAME);
  }
}