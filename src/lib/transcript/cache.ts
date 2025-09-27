import { db } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

interface TranscriptLine {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  words?: string[];
}

interface TranscriptCacheEntry {
  id: string;
  contentId: string;
  contentType: 'youtube' | 'audio' | 'video';
  videoUrl?: string;
  videoTitle?: string;
  transcript: TranscriptLine[];
  formattedTranscript?: TranscriptLine[];
  language: string;
  duration?: number;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  createdBy?: string;
  metadata?: {
    youtubeVideoId?: string;
    channelName?: string;
    uploadDate?: string;
    thumbnailUrl?: string;
    formattedAt?: Date;
    formattingModel?: string;
    wasFormatted?: boolean;
  };
}

class TranscriptCacheService {
  private readonly collection = 'transcriptCache';

  /**
   * Get cached transcript
   */
  async get(contentId: string): Promise<TranscriptCacheEntry | null> {
    try {
      if (!db) {
        return null;
      }

      const doc = await db.collection(this.collection).doc(contentId).get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data() as TranscriptCacheEntry;

      // Update access stats automatically
      await this.updateAccessStats(contentId);

      return data;
    } catch (error) {
      console.error('Error getting cached transcript:', error);
      return null;
    }
  }

  /**
   * Save transcript to cache
   */
  async set(params: {
    contentId: string;
    contentType: 'youtube' | 'audio' | 'video';
    transcript: TranscriptLine[];
    formattedTranscript?: TranscriptLine[];
    language: string;
    videoUrl?: string;
    videoTitle?: string;
    duration?: number;
    createdBy?: string;
    metadata?: any;
  }): Promise<boolean> {
    try {
      if (!db) {
        console.warn('Firebase not initialized, skipping transcript cache');
        return false;
      }

      // Validate required fields
      if (!params.contentId || !params.transcript || params.transcript.length === 0) {
        console.warn('Invalid transcript data, skipping cache:', {
          hasContentId: !!params.contentId,
          transcriptLength: params.transcript?.length || 0
        });
        return false;
      }

      const entry: any = {
        id: params.contentId,
        contentId: params.contentId,
        contentType: params.contentType,
        transcript: params.transcript,
        language: params.language || 'ja',
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1
      };

      // Add optional fields only if they exist
      if (params.videoUrl) entry.videoUrl = params.videoUrl;
      if (params.videoTitle) entry.videoTitle = params.videoTitle;
      if (params.duration !== undefined) entry.duration = params.duration;
      if (params.createdBy) entry.createdBy = params.createdBy;
      if (params.formattedTranscript) entry.formattedTranscript = params.formattedTranscript;
      if (params.metadata) entry.metadata = params.metadata;

      await db.collection(this.collection).doc(params.contentId).set(entry);

      console.log('✅ Transcript cached successfully:', {
        contentId: params.contentId,
        transcriptLength: params.transcript.length,
        hasFormatted: !!params.formattedTranscript,
        language: params.language
      });

      return true;
    } catch (error) {
      console.error('❌ Error caching transcript:', error);
      return false;
    }
  }

  /**
   * Update formatted transcript in cache
   */
  async updateFormatted(
    contentId: string,
    formattedTranscript: TranscriptLine[],
    formattingModel?: string
  ): Promise<boolean> {
    try {
      if (!db) {
        return false;
      }

      await db.collection(this.collection).doc(contentId).update({
        formattedTranscript,
        'metadata.formattedAt': new Date(),
        'metadata.formattingModel': formattingModel || 'gpt-3.5-turbo',
        'metadata.wasFormatted': true,
        lastAccessed: new Date()
      });

      console.log('Formatted transcript updated in cache:', contentId);
      return true;
    } catch (error) {
      console.error('Error updating formatted transcript:', error);
      return false;
    }
  }

  /**
   * Check if transcript is cached
   */
  async has(contentId: string): Promise<boolean> {
    if (!db) {
      return false;
    }

    try {
      const doc = await db.collection(this.collection).doc(contentId).get();
      return doc.exists;
    } catch (error) {
      console.error('Error checking cache:', error);
      return false;
    }
  }

  /**
   * Delete cache entry
   */
  async delete(contentId: string): Promise<boolean> {
    try {
      if (!db) {
        return false;
      }

      await db.collection(this.collection).doc(contentId).delete();
      return true;
    } catch (error) {
      console.error('Error deleting cache entry:', error);
      return false;
    }
  }

  /**
   * Update access statistics
   */
  private async updateAccessStats(contentId: string): Promise<void> {
    try {
      if (!db) {
        return;
      }

      await db.collection(this.collection).doc(contentId).update({
        lastAccessed: new Date(),
        accessCount: FieldValue.increment(1)
      });
    } catch (error) {
      console.error('Error updating access stats:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalEntries: number;
    totalTranscriptLines: number;
    byContentType: Record<string, number>;
    recent: TranscriptCacheEntry[];
    popular: TranscriptCacheEntry[];
  }> {
    try {
      if (!db) {
        return {
          totalEntries: 0,
          totalTranscriptLines: 0,
          byContentType: {},
          recent: [],
          popular: []
        };
      }

      const snapshot = await db.collection(this.collection).get();

      let totalTranscriptLines = 0;
      const byContentType: Record<string, number> = {};
      const entries: TranscriptCacheEntry[] = [];

      snapshot.forEach(doc => {
        const data = doc.data() as TranscriptCacheEntry;
        entries.push(data);

        totalTranscriptLines += data.transcript?.length || 0;
        byContentType[data.contentType] = (byContentType[data.contentType] || 0) + 1;
      });

      // Get recent entries
      const recent = entries
        .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
        .slice(0, 10);

      // Get popular entries
      const popular = entries
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, 10);

      return {
        totalEntries: entries.length,
        totalTranscriptLines,
        byContentType,
        recent,
        popular
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalEntries: 0,
        totalTranscriptLines: 0,
        byContentType: {},
        recent: [],
        popular: []
      };
    }
  }

  /**
   * Clear cache with optional filters
   */
  async clear(filter?: {
    contentType?: 'youtube' | 'audio' | 'video';
    olderThan?: Date;
    pattern?: string;
  }): Promise<{ deleted: number }> {
    try {
      if (!db) {
        return { deleted: 0 };
      }

      let query = db.collection(this.collection) as any;

      if (filter?.contentType) {
        query = query.where('contentType', '==', filter.contentType);
      }

      if (filter?.olderThan) {
        query = query.where('createdAt', '<', filter.olderThan);
      }

      const snapshot = await query.get();

      let deleted = 0;
      const batch = db!.batch();

      snapshot.forEach((doc: any) => {
        const data = doc.data() as TranscriptCacheEntry;

        if (filter?.pattern) {
          if (!data.videoTitle?.includes(filter.pattern) && !data.videoUrl?.includes(filter.pattern)) {
            return;
          }
        }

        batch.delete(doc.ref);
        deleted++;
      });

      await batch.commit();

      return { deleted };
    } catch (error) {
      console.error('Error clearing cache:', error);
      return { deleted: 0 };
    }
  }

  /**
   * Search transcripts by pattern
   */
  async search(pattern: string, limit: number = 10): Promise<TranscriptCacheEntry[]> {
    try {
      if (!db) {
        return [];
      }

      const snapshot = await db
        .collection(this.collection)
        .orderBy('accessCount', 'desc')
        .limit(100)
        .get();

      const results: TranscriptCacheEntry[] = [];

      snapshot.forEach(doc => {
        const data = doc.data() as TranscriptCacheEntry;
        if (
          data.videoTitle?.includes(pattern) ||
          data.videoUrl?.includes(pattern) ||
          data.transcript?.some(line => line.text.includes(pattern))
        ) {
          results.push(data);
        }
      });

      return results.slice(0, limit);
    } catch (error) {
      console.error('Error searching cache:', error);
      return [];
    }
  }

  /**
   * Batch check for multiple content IDs
   */
  async batchCheck(contentIds: string[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    const promises = contentIds.map(async id => {
      const exists = await this.has(id);
      results.set(id, exists);
    });

    await Promise.all(promises);

    return results;
  }
}

// Export singleton instance
export const transcriptCache = new TranscriptCacheService();