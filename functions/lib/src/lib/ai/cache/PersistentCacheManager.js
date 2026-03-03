"use strict";
/**
 * Persistent Cache Manager for AI Service
 * Handles both in-memory and Firestore persistence for AI responses
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistentCacheManager = void 0;
const admin_1 = require("@/lib/firebase/admin");
const CacheManager_1 = require("./CacheManager");
const crypto_1 = __importDefault(require("crypto"));
class PersistentCacheManager extends CacheManager_1.CacheManager {
    constructor() {
        super();
        this.COLLECTION_NAME = 'aiResponseCache';
        this.MAX_FIRESTORE_SIZE = 1000000; // 1MB max per document
        this.persistenceEnabled = true;
        this.initializePersistence();
    }
    /**
     * Initialize persistence layer
     */
    async initializePersistence() {
        try {
            // Check if Firestore is available
            if (!admin_1.adminFirestore) {
                console.warn('⚠️ Firestore not available, using in-memory cache only');
                this.persistenceEnabled = false;
                return;
            }
            // Load frequently accessed entries from Firestore
            await this.warmupCache();
        }
        catch (error) {
            console.error('Failed to initialize cache persistence:', error);
            this.persistenceEnabled = false;
        }
    }
    /**
     * Get cached value - check memory first, then Firestore
     */
    async get(key) {
        // Try in-memory cache first
        const memoryResult = await super.get(key);
        if (memoryResult !== null) {
            return memoryResult;
        }
        // If not in memory and persistence enabled, check Firestore
        if (this.persistenceEnabled && admin_1.adminFirestore) {
            try {
                const docId = this.generateDocId(key);
                const doc = await admin_1.adminFirestore.collection(this.COLLECTION_NAME).doc(docId).get();
                if (doc.exists) {
                    const data = doc.data();
                    if (data && new Date() < data.expiresAt.toDate()) {
                        // Restore to memory cache
                        await super.set(key, data.data, Math.floor((data.expiresAt.toDate().getTime() - Date.now()) / 1000), data.metadata);
                        console.log(`💾 Cache hit from Firestore: ${key}`);
                        return data.data;
                    }
                    else if (data) {
                        // Expired, delete from Firestore
                        await doc.ref.delete();
                    }
                }
            }
            catch (error) {
                console.error('Failed to get from Firestore cache:', error);
            }
        }
        return null;
    }
    /**
     * Set cache value - save to both memory and Firestore
     */
    async set(key, data, durationSeconds, metadata) {
        // Always save to memory
        await super.set(key, data, durationSeconds, metadata);
        // Persist to Firestore if enabled
        if (this.persistenceEnabled && admin_1.adminFirestore) {
            try {
                const cleanData = this.sanitizeForFirestore(data);
                const cleanMetadata = this.sanitizeForFirestore(metadata !== null && metadata !== void 0 ? metadata : {});
                // Check data size (Firestore has 1MB limit per document)
                const dataSize = JSON.stringify(cleanData).length;
                if (dataSize > this.MAX_FIRESTORE_SIZE) {
                    console.warn(`⚠️ Data too large for Firestore (${dataSize} bytes), skipping persistence`);
                    return;
                }
                const docId = this.generateDocId(key);
                const expiresAt = new Date(Date.now() + durationSeconds * 1000);
                await admin_1.adminFirestore.collection(this.COLLECTION_NAME).doc(docId).set({
                    key,
                    data: cleanData,
                    metadata: cleanMetadata,
                    timestamp: admin_1.Timestamp.now(),
                    expiresAt: admin_1.Timestamp.fromDate(expiresAt),
                    hits: 0,
                    size: dataSize
                });
                console.log(`💾 Persisted to Firestore: ${key}`);
            }
            catch (error) {
                console.error('Failed to persist to Firestore:', error);
                // Don't throw - memory cache is still valid
            }
        }
    }
    /**
     * Recursively sanitize payloads for Firestore:
     * - Remove undefined object properties
     * - Replace undefined array items with null
     */
    sanitizeForFirestore(value) {
        if (value === undefined)
            return null;
        if (value === null)
            return value;
        if (Array.isArray(value)) {
            return value.map((item) => item === undefined ? null : this.sanitizeForFirestore(item));
        }
        if (typeof value === 'object') {
            const entries = Object.entries(value)
                .filter(([, v]) => v !== undefined)
                .map(([k, v]) => [k, this.sanitizeForFirestore(v)]);
            return Object.fromEntries(entries);
        }
        return value;
    }
    /**
     * Delete cache entry from both memory and Firestore
     */
    async delete(key) {
        const memoryDeleted = await super.delete(key);
        if (this.persistenceEnabled && admin_1.adminFirestore) {
            try {
                const docId = this.generateDocId(key);
                await admin_1.adminFirestore.collection(this.COLLECTION_NAME).doc(docId).delete();
                return true;
            }
            catch (error) {
                console.error('Failed to delete from Firestore:', error);
            }
        }
        return memoryDeleted;
    }
    /**
     * Clear cache with pattern matching
     */
    async clear(pattern) {
        // Clear memory cache
        await super.clear(pattern);
        // Clear Firestore if pattern provided
        if (this.persistenceEnabled && pattern && admin_1.adminFirestore) {
            try {
                const snapshot = await admin_1.adminFirestore.collection(this.COLLECTION_NAME)
                    .where('key', '>=', pattern)
                    .where('key', '<=', pattern + '\uf8ff')
                    .get();
                const batch = admin_1.adminFirestore.batch();
                snapshot.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                console.log(`🗑️ Cleared ${snapshot.size} Firestore cache entries`);
            }
            catch (error) {
                console.error('Failed to clear Firestore cache:', error);
            }
        }
    }
    /**
     * Warmup cache with frequently accessed entries
     */
    async warmupCache() {
        if (!this.persistenceEnabled || !admin_1.adminFirestore)
            return;
        try {
            console.log('🔥 Warming up cache from Firestore...');
            // Get most frequently accessed, non-expired entries
            const snapshot = await admin_1.adminFirestore.collection(this.COLLECTION_NAME)
                .where('expiresAt', '>', admin_1.Timestamp.now())
                .orderBy('expiresAt', 'asc')
                .orderBy('hits', 'desc')
                .limit(50)
                .get();
            let loaded = 0;
            for (const doc of snapshot.docs) {
                const data = doc.data();
                if (data && data.key && data.data) {
                    const remainingTime = Math.floor((data.expiresAt.toDate().getTime() - Date.now()) / 1000);
                    if (remainingTime > 0) {
                        await super.set(data.key, data.data, remainingTime, data.metadata);
                        loaded++;
                    }
                }
            }
            console.log(`✅ Loaded ${loaded} cache entries from Firestore`);
        }
        catch (error) {
            console.error('Failed to warmup cache:', error);
        }
    }
    /**
     * Clean up expired Firestore entries
     */
    async cleanupExpiredFirestore() {
        if (!this.persistenceEnabled || !admin_1.adminFirestore)
            return;
        try {
            const snapshot = await admin_1.adminFirestore.collection(this.COLLECTION_NAME)
                .where('expiresAt', '<', admin_1.Timestamp.now())
                .limit(100)
                .get();
            if (snapshot.empty)
                return;
            const batch = admin_1.adminFirestore.batch();
            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            console.log(`🧹 Cleaned ${snapshot.size} expired Firestore cache entries`);
        }
        catch (error) {
            console.error('Failed to cleanup Firestore cache:', error);
        }
    }
    /**
     * Generate a Firestore-safe document ID from cache key
     */
    generateDocId(key) {
        // Firestore document IDs have restrictions, so we hash the key
        return crypto_1.default
            .createHash('sha256')
            .update(key)
            .digest('hex')
            .substring(0, 20);
    }
    /**
     * Get cache statistics including Firestore
     */
    async getStatsWithPersistence() {
        const memoryStats = this.getStats();
        const firestoreStats = {
            enabled: this.persistenceEnabled
        };
        if (this.persistenceEnabled && admin_1.adminFirestore) {
            try {
                const snapshot = await admin_1.adminFirestore.collection(this.COLLECTION_NAME).count().get();
                firestoreStats.documentCount = snapshot.data().count;
                // Get total size (sample)
                const sampleSnapshot = await admin_1.adminFirestore.collection(this.COLLECTION_NAME)
                    .limit(10)
                    .get();
                if (!sampleSnapshot.empty) {
                    const avgSize = sampleSnapshot.docs
                        .map(doc => doc.data().size || 0)
                        .reduce((a, b) => a + b, 0) / sampleSnapshot.size;
                    firestoreStats.estimatedTotalSize = avgSize * firestoreStats.documentCount;
                }
            }
            catch (error) {
                console.error('Failed to get Firestore stats:', error);
            }
        }
        return {
            memory: memoryStats,
            firestore: firestoreStats
        };
    }
    /**
     * Export cache for backup (memory + Firestore)
     */
    async exportAll() {
        const memoryEntries = super.export().map(entry => (Object.assign(Object.assign({}, entry), { persistent: false })));
        const firestoreEntries = [];
        if (this.persistenceEnabled && admin_1.adminFirestore) {
            try {
                const snapshot = await admin_1.adminFirestore.collection(this.COLLECTION_NAME)
                    .where('expiresAt', '>', admin_1.Timestamp.now())
                    .get();
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data) {
                        firestoreEntries.push({
                            key: data.key,
                            data: data.data,
                            timestamp: data.timestamp.toDate(),
                            expiresAt: data.expiresAt.toDate(),
                            hits: data.hits || 0,
                            metadata: data.metadata,
                            persistent: true
                        });
                    }
                });
            }
            catch (error) {
                console.error('Failed to export Firestore cache:', error);
            }
        }
        // Merge and dedupe
        const allKeys = new Set();
        const mergedEntries = [];
        // Memory entries first (more recent)
        memoryEntries.forEach(entry => {
            if (!allKeys.has(entry.key)) {
                allKeys.add(entry.key);
                mergedEntries.push(entry);
            }
        });
        // Then Firestore entries
        firestoreEntries.forEach(entry => {
            if (!allKeys.has(entry.key)) {
                allKeys.add(entry.key);
                mergedEntries.push(entry);
            }
        });
        return mergedEntries;
    }
}
exports.PersistentCacheManager = PersistentCacheManager;
//# sourceMappingURL=PersistentCacheManager.js.map