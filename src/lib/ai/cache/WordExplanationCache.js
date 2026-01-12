"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCachedWordExplanation = getCachedWordExplanation;
exports.setCachedWordExplanation = setCachedWordExplanation;
const crypto_1 = __importDefault(require("crypto"));
const admin_1 = require("@/lib/firebase/admin");
const COLLECTION = 'wordExplanationCache';
function hashText(text) {
    return crypto_1.default.createHash('sha256').update(text).digest('hex');
}
async function getCachedWordExplanation(word) {
    if (!admin_1.adminFirestore) {
        console.warn('[WordCache] Firebase Admin not initialized - cache disabled');
        return null;
    }
    try {
        const wordHash = hashText(word.trim().toLowerCase());
        const docId = wordHash;
        const doc = await admin_1.adminFirestore.collection(COLLECTION).doc(docId).get();
        if (!doc.exists) {
            return null;
        }
        const data = doc.data();
        // Update access metrics
        await doc.ref.update({
            lastAccessedAt: admin_1.Timestamp.now(),
            accessCount: data.accessCount + 1
        });
        return data.explanation;
    }
    catch (error) {
        console.error('[WordCache] ❌ Failed to read cache:', error);
        console.error('[WordCache] Word:', word);
        console.error('[WordCache] Error details:', error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
}
async function setCachedWordExplanation(word, explanation) {
    if (!admin_1.adminFirestore) {
        console.warn('[WordCache] Firebase Admin not initialized - cannot cache explanation');
        return;
    }
    try {
        // Remove undefined fields to satisfy Firestore
        const sanitizedExplanation = Object.assign({}, explanation);
        Object.keys(sanitizedExplanation).forEach(key => {
            if (sanitizedExplanation[key] === undefined) {
                delete sanitizedExplanation[key];
            }
        });
        const wordHash = hashText(word.trim().toLowerCase());
        const docId = wordHash;
        const entry = {
            id: docId,
            wordHash,
            word,
            explanation: sanitizedExplanation,
            createdAt: admin_1.Timestamp.now(),
            lastAccessedAt: admin_1.Timestamp.now(),
            accessCount: 1
        };
        await admin_1.adminFirestore.collection(COLLECTION).doc(docId).set(entry, { merge: true });
    }
    catch (error) {
        console.error('[WordCache] ❌ Failed to write cache:', error);
        console.error('[WordCache] Word:', word);
        console.error('[WordCache] Error details:', error instanceof Error ? error.message : 'Unknown error');
        // Log full error for debugging
        if (error instanceof Error && error.stack) {
            console.error('[WordCache] Stack trace:', error.stack);
        }
    }
}
//# sourceMappingURL=WordExplanationCache.js.map