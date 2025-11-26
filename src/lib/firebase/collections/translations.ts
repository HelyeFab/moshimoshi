/**
 * Firebase Collections - Translations
 * Efficient caching system for AI translations to reduce API costs
 */

import { db, Timestamp, FieldValue } from '@/lib/firebase/admin';
import { TranslationResult, TranslationMode } from '@/lib/ai/processors/TranslationProcessor';
import crypto from 'crypto';

// ============================================
// Translation Document Types
// ============================================

export interface TranslationDocument {
  // Identification
  id: string;
  textHash: string;
  originalText: string;

  // Translation settings
  mode: TranslationMode;
  sourceLang: 'ja' | 'en';
  targetLang: 'en' | 'ja';
  userLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

  // Translation result
  result: TranslationResult;

  // Quality metrics
  aiModel: string;
  confidence: number;
  version: string; // For tracking AI improvements

  // Usage tracking
  usageCount: number;
  lastUsed: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Context (optional)
  context?: {
    articleId?: string;
    articleTitle?: string;
    source?: 'article' | 'story' | 'manual';
  };

  // Cost tracking
  costInfo: {
    promptTokens: number;
    completionTokens: number;
    estimatedCost: number;
  };
}

export interface TranslationCacheDocument {
  // Quick lookup cache
  textHash: string;
  translationId: string;

  // Cache metadata
  mode: TranslationMode;
  userLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  confidence: number;
  usageCount: number;
  lastUsed: Timestamp;

  // Quick preview (for fast loading)
  preview: {
    translatedText: string;
    keyVocabularyCount: number;
    grammarNotesCount: number;
  };
}

export interface TranslationAnalytics {
  date: string; // YYYY-MM-DD
  translationId: string;

  // Usage metrics
  views: number;
  uniqueUsers: number;
  avgConfidence: number;

  // User breakdown
  userLevels: {
    N5: number;
    N4: number;
    N3: number;
    N2: number;
    N1: number;
  };

  // Mode breakdown
  modes: {
    hints: number;
    partial: number;
    full: number;
    learning: number;
  };

  // Performance
  avgResponseTime: number;
  errorRate: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Collection References
// ============================================

export const translationsCollection = db!.collection('translations');
export const translationCacheCollection = db!.collection('translation_cache');

// Helper to get analytics subcollection
export const getTranslationAnalyticsCollection = (translationId: string) =>
  db!.collection('translations').doc(translationId).collection('analytics');

// ============================================
// Utility Functions
// ============================================

/**
 * Generate a consistent hash for translation text and parameters
 */
export function generateTranslationHash(
  text: string,
  mode: TranslationMode,
  userLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1',
  options?: {
    includeGrammarNotes?: boolean;
    preserveGrammarStructure?: boolean;
  }
): string {
  const normalizedText = text.trim().toLowerCase();
  const optionsString = options ? JSON.stringify(options) : '';
  const combined = `${normalizedText}|${mode}|${userLevel}|${optionsString}`;

  return crypto.createHash('md5').update(combined).digest('hex');
}

/**
 * Generate a unique translation ID
 */
export function generateTranslationId(): string {
  return translationsCollection.doc().id;
}

// ============================================
// Translation Cache Service
// ============================================

export class TranslationCacheService {
  private static instance: TranslationCacheService;
  private memoryCache = new Map<string, { data: TranslationResult; timestamp: number }>();
  private readonly MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  static getInstance(): TranslationCacheService {
    if (!TranslationCacheService.instance) {
      TranslationCacheService.instance = new TranslationCacheService();
    }
    return TranslationCacheService.instance;
  }

  /**
   * Get translation from cache (memory -> Firebase)
   */
  async getCachedTranslation(
    text: string,
    mode: TranslationMode,
    userLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1',
    options?: {
      includeGrammarNotes?: boolean;
      preserveGrammarStructure?: boolean;
    }
  ): Promise<TranslationResult | null> {
    const hash = generateTranslationHash(text, mode, userLevel, options);

    // Check memory cache first
    const memCached = this.memoryCache.get(hash);
    if (memCached && Date.now() - memCached.timestamp < this.MEMORY_CACHE_TTL) {
      return memCached.data;
    }

    try {
      // Check Firebase cache
      const cacheDoc = await translationCacheCollection.doc(hash).get();
      if (cacheDoc.exists) {
        const cacheData = cacheDoc.data() as TranslationCacheDocument;

        // Get full translation document
        const translationDoc = await translationsCollection.doc(cacheData.translationId).get();
        if (translationDoc.exists) {
          const translationData = translationDoc.data() as TranslationDocument;

          // Update memory cache
          this.memoryCache.set(hash, {
            data: translationData.result,
            timestamp: Date.now()
          });

          // Update usage tracking
          this.updateUsageTracking(cacheData.translationId, hash);

          return translationData.result;
        }
      }
    } catch (error) {
      console.error('Error getting cached translation:', error);
    }

    return null;
  }

  /**
   * Store translation in cache
   */
  async storeTranslation(
    text: string,
    mode: TranslationMode,
    userLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1',
    result: TranslationResult,
    costInfo: TranslationDocument['costInfo'],
    context?: TranslationDocument['context'],
    options?: {
      includeGrammarNotes?: boolean;
      preserveGrammarStructure?: boolean;
    }
  ): Promise<string> {
    const hash = generateTranslationHash(text, mode, userLevel, options);
    const translationId = generateTranslationId();

    try {
      // Store main translation document
      const translationDoc: any = {
        id: translationId,
        textHash: hash,
        originalText: text,
        mode,
        sourceLang: 'ja', // Assuming Japanese source for now
        targetLang: 'en',
        userLevel,
        result,
        aiModel: 'gpt-4o-mini', // From current AI service
        confidence: result.confidence,
        version: '1.0', // Current translation system version
        usageCount: 1,
        lastUsed: FieldValue.serverTimestamp() as Timestamp,
        createdAt: FieldValue.serverTimestamp() as Timestamp,
        updatedAt: FieldValue.serverTimestamp() as Timestamp,
        costInfo
      };

      // Only add context if it's defined and not empty
      if (context && Object.keys(context).length > 0) {
        translationDoc.context = context;
      }

      await translationsCollection.doc(translationId).set(translationDoc);

      // Store cache document for quick lookups
      const cacheDoc: TranslationCacheDocument = {
        textHash: hash,
        translationId,
        mode,
        userLevel,
        confidence: result.confidence,
        usageCount: 1,
        lastUsed: FieldValue.serverTimestamp() as Timestamp,
        preview: {
          translatedText: result.translatedText,
          keyVocabularyCount: result.keyVocabulary?.length || 0,
          grammarNotesCount: result.grammarNotes?.length || 0
        }
      };

      await translationCacheCollection.doc(hash).set(cacheDoc);

      // Update memory cache
      this.memoryCache.set(hash, {
        data: result,
        timestamp: Date.now()
      });

      console.log(`📦 Cached translation: ${text.substring(0, 50)}... (${mode})`);

      return translationId;
    } catch (error) {
      console.error('Error storing translation cache:', error);
      throw error;
    }
  }

  /**
   * Update usage tracking for cached translation
   */
  private async updateUsageTracking(translationId: string, hash: string): Promise<void> {
    try {
      // Update main translation document usage count
      await translationsCollection.doc(translationId).set(
        {
          usageCount: FieldValue.increment(1),
          lastUsed: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      // Update cache document usage count
      await translationCacheCollection.doc(hash).set(
        {
          usageCount: FieldValue.increment(1),
          lastUsed: FieldValue.serverTimestamp()
        },
        { merge: true }
      );

      console.log(`📈 Updated usage for translation: ${translationId}`);
    } catch (error) {
      console.error('Error updating usage tracking:', error);
      // Don't throw here - usage tracking failure shouldn't break translation
    }
  }

  /**
   * Get translation analytics
   */
  async getTranslationAnalytics(
    startDate?: Date,
    endDate?: Date,
    limit?: number
  ): Promise<TranslationAnalytics[]> {
    try {
      // This would aggregate data from the analytics subcollections
      // Implementation depends on your specific analytics needs
      return [];
    } catch (error) {
      console.error('Error getting translation analytics:', error);
      return [];
    }
  }

  /**
   * Get popular translations
   */
  async getPopularTranslations(limitCount: number = 10): Promise<TranslationCacheDocument[]> {
    try {
      const snapshot = await translationCacheCollection
        .orderBy('usageCount', 'desc')
        .limit(limitCount)
        .get();

      return snapshot.docs.map(doc => doc.data() as TranslationCacheDocument);
    } catch (error) {
      console.error('Error getting popular translations:', error);
      return [];
    }
  }

  /**
   * Clean up old memory cache entries
   */
  cleanMemoryCache(): void {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (now - value.timestamp > this.MEMORY_CACHE_TTL) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    memoryCacheSize: number;
    memoryCacheHitRateEstimate: number;
  } {
    return {
      memoryCacheSize: this.memoryCache.size,
      memoryCacheHitRateEstimate: 0.85 // Placeholder - would need actual tracking
    };
  }
}

// ============================================
// Export singleton instance
// ============================================

export const translationCache = TranslationCacheService.getInstance();

// ============================================
// Cleanup utility
// ============================================

// Clean up memory cache every 10 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    translationCache.cleanMemoryCache();
  }, 10 * 60 * 1000);
}