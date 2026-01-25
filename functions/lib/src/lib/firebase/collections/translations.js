"use strict";
/**
 * Firebase Collections - Translations
 * Efficient caching system for AI translations to reduce API costs
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.translationCache = exports.TranslationCacheService = exports.getTranslationAnalyticsCollection = void 0;
exports.generateTranslationHash = generateTranslationHash;
exports.generateTranslationId = generateTranslationId;
const admin_1 = require("@/lib/firebase/admin");
const crypto_1 = __importDefault(require("crypto"));
// ============================================
// Collection References (lazy - avoid init at module load)
// ============================================
function getCollectionsSafely() {
    try {
        const db = (0, admin_1.getAdminDb)();
        return {
            translationsCollection: db.collection('translations'),
            translationCacheCollection: db.collection('translation_cache'),
            getTranslationAnalyticsCollection: (translationId) => db.collection('translations').doc(translationId).collection('analytics'),
        };
    }
    catch (error) {
        console.warn('[TranslationCache] Firebase Admin not initialized - cache disabled', error);
        return null;
    }
}
// Helper to get analytics subcollection (safe)
const getTranslationAnalyticsCollection = (translationId) => {
    var _a;
    const collections = getCollectionsSafely();
    return (_a = collections === null || collections === void 0 ? void 0 : collections.getTranslationAnalyticsCollection(translationId)) !== null && _a !== void 0 ? _a : null;
};
exports.getTranslationAnalyticsCollection = getTranslationAnalyticsCollection;
// ============================================
// Utility Functions
// ============================================
/**
 * Generate a consistent hash for translation text and parameters
 */
function generateTranslationHash(text, mode, userLevel, options) {
    const normalizedText = text.trim().toLowerCase();
    const optionsString = options ? JSON.stringify(options) : '';
    const combined = `${normalizedText}|${mode}|${userLevel}|${optionsString}`;
    return crypto_1.default.createHash('md5').update(combined).digest('hex');
}
/**
 * Generate a unique translation ID
 */
function generateTranslationId() {
    const collections = getCollectionsSafely();
    if (collections) {
        return collections.translationsCollection.doc().id;
    }
    return crypto_1.default.randomUUID();
}
// ============================================
// Translation Cache Service
// ============================================
class TranslationCacheService {
    constructor() {
        this.memoryCache = new Map();
        this.MEMORY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    }
    static getInstance() {
        if (!TranslationCacheService.instance) {
            TranslationCacheService.instance = new TranslationCacheService();
        }
        return TranslationCacheService.instance;
    }
    /**
     * Get translation from cache (memory -> Firebase)
     */
    async getCachedTranslation(text, mode, userLevel, options) {
        const hash = generateTranslationHash(text, mode, userLevel, options);
        // Check memory cache first
        const memCached = this.memoryCache.get(hash);
        if (memCached && Date.now() - memCached.timestamp < this.MEMORY_CACHE_TTL) {
            return memCached.data;
        }
        try {
            const collections = getCollectionsSafely();
            if (!collections) {
                return null;
            }
            // Check Firebase cache
            const cacheDoc = await collections.translationCacheCollection.doc(hash).get();
            if (cacheDoc.exists) {
                const cacheData = cacheDoc.data();
                // Get full translation document
                const translationDoc = await collections.translationsCollection.doc(cacheData.translationId).get();
                if (translationDoc.exists) {
                    const translationData = translationDoc.data();
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
        }
        catch (error) {
            console.error('Error getting cached translation:', error);
        }
        return null;
    }
    /**
     * Store translation in cache
     */
    async storeTranslation(text, mode, userLevel, result, costInfo, context, options) {
        var _a, _b;
        const hash = generateTranslationHash(text, mode, userLevel, options);
        const translationId = generateTranslationId();
        try {
            // Store main translation document
            const collections = getCollectionsSafely();
            if (!collections) {
                // Skip Firebase cache if Admin isn't initialized
                return translationId;
            }
            const translationDoc = {
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
                lastUsed: admin_1.FieldValue.serverTimestamp(),
                createdAt: admin_1.FieldValue.serverTimestamp(),
                updatedAt: admin_1.FieldValue.serverTimestamp(),
                costInfo
            };
            // Only add context if it's defined and not empty
            if (context && Object.keys(context).length > 0) {
                translationDoc.context = context;
            }
            await collections.translationsCollection.doc(translationId).set(translationDoc);
            // Store cache document for quick lookups
            const cacheDoc = {
                textHash: hash,
                translationId,
                mode,
                userLevel,
                confidence: result.confidence,
                usageCount: 1,
                lastUsed: admin_1.FieldValue.serverTimestamp(),
                preview: {
                    translatedText: result.translatedText,
                    keyVocabularyCount: ((_a = result.keyVocabulary) === null || _a === void 0 ? void 0 : _a.length) || 0,
                    grammarNotesCount: ((_b = result.grammarNotes) === null || _b === void 0 ? void 0 : _b.length) || 0
                }
            };
            await collections.translationCacheCollection.doc(hash).set(cacheDoc);
            // Update memory cache
            this.memoryCache.set(hash, {
                data: result,
                timestamp: Date.now()
            });
            console.log(`📦 Cached translation: ${text.substring(0, 50)}... (${mode})`);
            return translationId;
        }
        catch (error) {
            console.error('Error storing translation cache:', error);
            throw error;
        }
    }
    /**
     * Update usage tracking for cached translation
     */
    async updateUsageTracking(translationId, hash) {
        try {
            const collections = getCollectionsSafely();
            if (!collections) {
                return;
            }
            // Update main translation document usage count
            await collections.translationsCollection.doc(translationId).set({
                usageCount: admin_1.FieldValue.increment(1),
                lastUsed: admin_1.FieldValue.serverTimestamp(),
                updatedAt: admin_1.FieldValue.serverTimestamp()
            }, { merge: true });
            // Update cache document usage count
            await collections.translationCacheCollection.doc(hash).set({
                usageCount: admin_1.FieldValue.increment(1),
                lastUsed: admin_1.FieldValue.serverTimestamp()
            }, { merge: true });
            console.log(`📈 Updated usage for translation: ${translationId}`);
        }
        catch (error) {
            console.error('Error updating usage tracking:', error);
            // Don't throw here - usage tracking failure shouldn't break translation
        }
    }
    /**
     * Get translation analytics
     */
    async getTranslationAnalytics(startDate, endDate, limit) {
        try {
            // This would aggregate data from the analytics subcollections
            // Implementation depends on your specific analytics needs
            return [];
        }
        catch (error) {
            console.error('Error getting translation analytics:', error);
            return [];
        }
    }
    /**
     * Get popular translations
     */
    async getPopularTranslations(limitCount = 10) {
        try {
            const collections = getCollectionsSafely();
            if (!collections) {
                return [];
            }
            const snapshot = await collections.translationCacheCollection
                .orderBy('usageCount', 'desc')
                .limit(limitCount)
                .get();
            return snapshot.docs.map(doc => doc.data());
        }
        catch (error) {
            console.error('Error getting popular translations:', error);
            return [];
        }
    }
    /**
     * Clean up old memory cache entries
     */
    cleanMemoryCache() {
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
    getCacheStats() {
        return {
            memoryCacheSize: this.memoryCache.size,
            memoryCacheHitRateEstimate: 0.85 // Placeholder - would need actual tracking
        };
    }
}
exports.TranslationCacheService = TranslationCacheService;
// ============================================
// Export singleton instance
// ============================================
exports.translationCache = TranslationCacheService.getInstance();
// ============================================
// Cleanup utility
// ============================================
// Clean up memory cache every 10 minutes
if (typeof window !== 'undefined') {
    setInterval(() => {
        exports.translationCache.cleanMemoryCache();
    }, 10 * 60 * 1000);
}
//# sourceMappingURL=translations.js.map