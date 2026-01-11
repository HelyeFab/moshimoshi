"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ttsCache = void 0;
const admin_1 = require("@/lib/firebase/admin");
const firestore_1 = require("firebase-admin/firestore");
const utils_1 = require("./utils");
class TTSCacheService {
    constructor() {
        this.collection = 'tts_cache';
    }
    /**
     * Get cache entry by text
     */
    async get(text, provider, voice, options) {
        try {
            if (!admin_1.db) {
                return null;
            }
            const cacheKey = (0, utils_1.generateCacheKey)(text, provider, voice, options);
            const doc = await admin_1.db.collection(this.collection).doc(cacheKey).get();
            if (!doc.exists) {
                return null;
            }
            const data = doc.data();
            // Update access stats
            await this.updateAccessStats(cacheKey);
            return data;
        }
        catch (error) {
            console.error('Error getting cache entry:', error);
            return null;
        }
    }
    /**
     * Check if entry exists in cache
     */
    async has(text, provider, voice, options) {
        if (!admin_1.db) {
            return false;
        }
        const cacheKey = (0, utils_1.generateCacheKey)(text, provider, voice, options);
        const doc = await admin_1.db.collection(this.collection).doc(cacheKey).get();
        return doc.exists;
    }
    /**
     * Save entry to cache
     */
    async set(text, provider, voice, audioUrl, storagePath, metadata) {
        if (!admin_1.db) {
            throw new Error('Firebase is not initialized');
        }
        const cacheKey = (0, utils_1.generateCacheKey)(text, provider, voice, {
            speed: metadata === null || metadata === void 0 ? void 0 : metadata.speed,
            pitch: metadata === null || metadata === void 0 ? void 0 : metadata.pitch,
            volume: metadata === null || metadata === void 0 ? void 0 : metadata.volume,
        });
        const normalizedText = (0, utils_1.normalizeText)(text);
        const entry = {
            id: cacheKey,
            text,
            normalizedText,
            provider,
            voice,
            audioUrl,
            storagePath,
            createdAt: new Date(),
            lastAccessedAt: new Date(),
            accessCount: 1,
            metadata: {
                type: (metadata === null || metadata === void 0 ? void 0 : metadata.type) ||
                    ((0, utils_1.getTextType)(text) === 'article' ? 'paragraph' : (0, utils_1.getTextType)(text)),
                language: 'ja',
            },
        };
        // Add optional numeric fields only when defined to avoid Firestore undefined errors
        if ((metadata === null || metadata === void 0 ? void 0 : metadata.speed) !== undefined)
            entry.speed = metadata.speed;
        if ((metadata === null || metadata === void 0 ? void 0 : metadata.pitch) !== undefined)
            entry.pitch = metadata.pitch;
        if ((metadata === null || metadata === void 0 ? void 0 : metadata.volume) !== undefined)
            entry.volume = metadata.volume;
        if ((metadata === null || metadata === void 0 ? void 0 : metadata.duration) !== undefined)
            entry.duration = metadata.duration;
        if ((metadata === null || metadata === void 0 ? void 0 : metadata.size) !== undefined)
            entry.size = metadata.size;
        await admin_1.db.collection(this.collection).doc(cacheKey).set(entry);
        return entry;
    }
    /**
     * Delete cache entry
     */
    async delete(text, provider, voice, options) {
        try {
            if (!admin_1.db) {
                return false;
            }
            const cacheKey = (0, utils_1.generateCacheKey)(text, provider, voice, options);
            await admin_1.db.collection(this.collection).doc(cacheKey).delete();
            return true;
        }
        catch (error) {
            console.error('Error deleting cache entry:', error);
            return false;
        }
    }
    /**
     * Update access statistics
     */
    async updateAccessStats(cacheKey) {
        try {
            if (!admin_1.db) {
                return;
            }
            await admin_1.db
                .collection(this.collection)
                .doc(cacheKey)
                .update({
                lastAccessedAt: new Date(),
                accessCount: firestore_1.FieldValue.increment(1),
            });
        }
        catch (error) {
            console.error('Error updating access stats:', error);
        }
    }
    /**
     * Get cache statistics
     */
    async getStats() {
        try {
            if (!admin_1.db) {
                return {
                    totalEntries: 0,
                    totalSize: 0,
                    providers: {
                        voicevox: { count: 0, size: 0 },
                        elevenlabs: { count: 0, size: 0 },
                    },
                    recent: [],
                    popular: [],
                };
            }
            const snapshot = await admin_1.db.collection(this.collection).get();
            let totalSize = 0;
            const providers = {
                voicevox: { count: 0, size: 0 },
                elevenlabs: { count: 0, size: 0 },
            };
            const entries = [];
            snapshot.forEach(doc => {
                const data = doc.data();
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
            const popular = entries.sort((a, b) => b.accessCount - a.accessCount).slice(0, 10);
            return {
                totalEntries: entries.length,
                totalSize,
                providers,
                recent,
                popular,
            };
        }
        catch (error) {
            console.error('Error getting cache stats:', error);
            return {
                totalEntries: 0,
                totalSize: 0,
                providers: {
                    voicevox: { count: 0, size: 0 },
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
    async clear(filter) {
        try {
            if (!admin_1.db) {
                return { deleted: 0, freedSpace: 0 };
            }
            let query = admin_1.db.collection(this.collection);
            if (filter === null || filter === void 0 ? void 0 : filter.provider) {
                query = query.where('provider', '==', filter.provider);
            }
            if (filter === null || filter === void 0 ? void 0 : filter.olderThan) {
                query = query.where('createdAt', '<', filter.olderThan);
            }
            const snapshot = await query.get();
            let deleted = 0;
            let freedSpace = 0;
            const batch = admin_1.db.batch();
            snapshot.forEach((doc) => {
                const data = doc.data();
                if (filter === null || filter === void 0 ? void 0 : filter.pattern) {
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
        }
        catch (error) {
            console.error('Error clearing cache:', error);
            return { deleted: 0, freedSpace: 0 };
        }
    }
    /**
     * Get entries by text pattern
     */
    async search(pattern, limit = 10) {
        try {
            if (!admin_1.db) {
                return [];
            }
            // Note: This is a simple implementation. For production,
            // consider using Algolia or ElasticSearch for text search
            const snapshot = await admin_1.db
                .collection(this.collection)
                .orderBy('accessCount', 'desc')
                .limit(100)
                .get();
            const results = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.text.includes(pattern) || data.normalizedText.includes(pattern)) {
                    results.push(data);
                }
            });
            return results.slice(0, limit);
        }
        catch (error) {
            console.error('Error searching cache:', error);
            return [];
        }
    }
    /**
     * Batch check for multiple texts
     */
    async batchCheck(items) {
        const results = new Map();
        const promises = items.map(async (item) => {
            const exists = await this.has(item.text, item.provider, item.voice);
            const key = `${item.text}:${item.provider}:${item.voice}`;
            results.set(key, exists);
        });
        await Promise.all(promises);
        return results;
    }
}
// Export singleton instance
exports.ttsCache = new TTSCacheService();
//# sourceMappingURL=cache.js.map