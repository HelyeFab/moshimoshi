import { db } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { TTSCacheEntry, TTSProvider } from './types';
import { generateCacheKey, normalizeText, getTextType } from './utils';

class TTSCacheService {
  private readonly collection = 'tts_cache';

  /**
   * Get cache entry by text
   */
  async get(
    text: string,
    provider: TTSProvider,
    voice: string
  ): Promise<TTSCacheEntry | null> {
    try {
      if (!db) {
        return null;
      }
      const cacheKey = generateCacheKey(text, provider, voice);
      const doc = await db.collection(this.collection).doc(cacheKey).get();
      
      if (!doc.exists) {
        return null;
      }
      
      const data = doc.data() as TTSCacheEntry;
      
      // Update access stats
      await this.updateAccessStats(cacheKey);
      
      return data;
    } catch (error) {
      console.error('Error getting cache entry:', error);
      return null;
    }
  }

  /**
   * Check if entry exists in cache
   */
  async has(
    text: string,
    provider: TTSProvider,
    voice: string
  ): Promise<boolean> {
    if (!db) {
      return false;
    }
    const cacheKey = generateCacheKey(text, provider, voice);
    const doc = await db.collection(this.collection).doc(cacheKey).get();
    return doc.exists;
  }

  /**
   * Save entry to cache
   */
  async set(
    text: string,
    provider: TTSProvider,
    voice: string,
    audioUrl: string,
    storagePath: string,
    metadata?: {
      duration?: number;
      size?: number;
      type?: 'character' | 'word' | 'sentence' | 'paragraph';
    }
  ): Promise<TTSCacheEntry> {
    if (!db) {
      throw new Error('Firebase is not initialized');
    }
    const cacheKey = generateCacheKey(text, provider, voice);
    const normalizedText = normalizeText(text);
    
    const entry: TTSCacheEntry = {
      id: cacheKey,
      text,
      normalizedText,
      provider,
      voice,
      audioUrl,
      storagePath,
      duration: metadata?.duration,
      size: metadata?.size,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
      accessCount: 1,
      metadata: {
        type: metadata?.type || (getTextType(text) === 'article' ? 'paragraph' : getTextType(text)) as 'character' | 'word' | 'sentence' | 'paragraph',
        language: 'ja',
      },
    };
    
    await db.collection(this.collection).doc(cacheKey).set(entry);
    
    return entry;
  }

  /**
   * Delete cache entry
   */
  async delete(
    text: string,
    provider: TTSProvider,
    voice: string
  ): Promise<boolean> {
    try {
      if (!db) {
        return false;
      }
      const cacheKey = generateCacheKey(text, provider, voice);
      await db.collection(this.collection).doc(cacheKey).delete();
      return true;
    } catch (error) {
      console.error('Error deleting cache entry:', error);
      return false;
    }
  }

  /**
   * Update access statistics
   */
  private async updateAccessStats(cacheKey: string): Promise<void> {
    try {
      if (!db) {
        return;
      }
      await db.collection(this.collection).doc(cacheKey).update({
        lastAccessedAt: new Date(),
        accessCount: FieldValue.increment(1),
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
    totalSize: number;
    providers: Record<TTSProvider, { count: number; size: number }>;
    recent: TTSCacheEntry[];
    popular: TTSCacheEntry[];
  }> {
    try {
      if (!db) {
        return {
          totalEntries: 0,
          totalSize: 0,
          providers: {
            google: { count: 0, size: 0 },
            elevenlabs: { count: 0, size: 0 }
          } as Record<TTSProvider, { count: number; size: number }>,
          recent: [],
          popular: []
        };
      }
      const snapshot = await db.collection(this.collection).get();
      
      let totalSize = 0;
      const providers: Record<TTSProvider, { count: number; size: number }> = {
        google: { count: 0, size: 0 },
        elevenlabs: { count: 0, size: 0 },
      };
      
      const entries: TTSCacheEntry[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data() as TTSCacheEntry;
        entries.push(data);
        
        const size = data.size || 0;
        totalSize += size;
        
        providers[data.provider].count++;
        providers[data.provider].size += size;
      });
      
      // Get recent entries
      const recent = entries
        .sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime())
        .slice(0, 10);
      
      // Get popular entries
      const popular = entries
        .sort((a, b) => b.accessCount - a.accessCount)
        .slice(0, 10);
      
      return {
        totalEntries: entries.length,
        totalSize,
        providers,
        recent,
        popular,
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        totalEntries: 0,
        totalSize: 0,
        providers: {
          google: { count: 0, size: 0 },
          elevenlabs: { count: 0, size: 0 },
        },
        recent: [],
        popular: [],
      };
    }
  }

  /**
   * Clear cache with optional filter
   */
  async clear(filter?: {
    provider?: TTSProvider;
    olderThan?: Date;
    pattern?: string;
  }): Promise<{ deleted: number; freedSpace: number }> {
    try {
      if (!db) {
        return { deleted: 0, freedSpace: 0 };
      }
      let query = db.collection(this.collection) as any;
      
      if (filter?.provider) {
        query = query.where('provider', '==', filter.provider);
      }
      
      if (filter?.olderThan) {
        query = query.where('createdAt', '<', filter.olderThan);
      }
      
      const snapshot = await query.get();
      
      let deleted = 0;
      let freedSpace = 0;
      
      const batch = db!.batch();
      
      snapshot.forEach((doc: any) => {
        const data = doc.data() as TTSCacheEntry;
        
        if (filter?.pattern) {
          if (!data.text.includes(filter.pattern)) {
            return;
          }
        }
        
        batch.delete(doc.ref);
        deleted++;
        freedSpace += data.size || 0;
      });
      
      await batch.commit();
      
      return { deleted, freedSpace };
    } catch (error) {
      console.error('Error clearing cache:', error);
      return { deleted: 0, freedSpace: 0 };
    }
  }

  /**
   * Get entries by text pattern
   */
  async search(pattern: string, limit: number = 10): Promise<TTSCacheEntry[]> {
    try {
      if (!db) {
        return [];
      }
      // Note: This is a simple implementation. For production,
      // consider using Algolia or ElasticSearch for text search
      const snapshot = await db
        .collection(this.collection)
        .orderBy('accessCount', 'desc')
        .limit(100)
        .get();
      
      const results: TTSCacheEntry[] = [];
      
      snapshot.forEach(doc => {
        const data = doc.data() as TTSCacheEntry;
        if (data.text.includes(pattern) || data.normalizedText.includes(pattern)) {
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
   * Batch check for multiple texts
   */
  async batchCheck(
    items: Array<{ text: string; provider: TTSProvider; voice: string }>
  ): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    const promises = items.map(async item => {
      const exists = await this.has(item.text, item.provider, item.voice);
      const key = `${item.text}:${item.provider}:${item.voice}`;
      results.set(key, exists);
    });
    
    await Promise.all(promises);
    
    return results;
  }
}

// Export singleton instance
export const ttsCache = new TTSCacheService();