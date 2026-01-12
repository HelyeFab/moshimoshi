"use strict";
/**
 * Firestore Trigger: Async Word Explanation Generation for Books
 * Triggers when a book is published to the 'books' collection
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onBookPublished = void 0;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const firestore_1 = require("firebase-functions/v2/firestore");
const params_1 = require("firebase-functions/params");
const wordExtractor_1 = require("../utils/wordExtractor");
const bookWordBatchManager_1 = require("../utils/bookWordBatchManager");
const bookWordBatchProcessor_1 = require("./bookWordBatchProcessor");
const db = admin.firestore();
const MODAL_API_KEY = (0, params_1.defineSecret)('MODAL_API_KEY');
const BOOK_WORD_LIMIT = 1000;
exports.onBookPublished = (0, firestore_1.onDocumentCreated)({
    document: 'books/{bookId}',
    secrets: [MODAL_API_KEY],
    memory: '512MiB',
    timeoutSeconds: 120,
}, async (event) => {
    var _a;
    const bookId = event.params.bookId;
    const book = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!book) {
        logger.error('[BookWordGen] No book data in trigger', { bookId });
        return;
    }
    if (book.status !== 'published') {
        logger.info('[BookWordGen] Skipping non-published book', { bookId });
        return;
    }
    try {
        const existing = await db.collection('book_word_explanations').doc(bookId).get();
        if (existing.exists) {
            logger.info('[BookWordGen] Word explanations already exist, skipping', { bookId });
            return;
        }
        const content = book.content || '';
        if (!content || content.trim().length === 0) {
            throw new Error('No content found in book');
        }
        await db.collection('books').doc(bookId).update({
            'metadata.wordExplanationsStatus': 'generating',
            'metadata.wordExplanationsStartedAt': admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info('[BookWordGen] Extracting words for batch processing', {
            bookId,
            textLength: content.length,
        });
        const { words } = await (0, wordExtractor_1.extractTopWords)(content, BOOK_WORD_LIMIT);
        logger.info('[BookWordGen] Words extracted, creating batch queue', {
            bookId,
            wordCount: words.length,
        });
        const queue = await (0, bookWordBatchManager_1.createBatchQueue)(bookId, words);
        await db.collection('books').doc(bookId).update({
            'metadata.wordProgress': {
                totalBatches: queue.totalBatches,
                completedBatches: 0,
                totalWords: queue.totalWords,
                completedWords: 0,
                currentBatch: 1,
                percentComplete: 0,
            },
        });
        await (0, bookWordBatchProcessor_1.publishFirstBookBatch)(bookId);
        logger.info('[BookWordGen] First batch published', {
            bookId,
            totalBatches: queue.totalBatches,
            totalWords: queue.totalWords,
        });
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('[BookWordGen] Failed to start batch processing', {
            bookId,
            error: errorMessage,
        });
        await db.collection('books').doc(bookId).update({
            'metadata.wordExplanationsStatus': 'failed',
            'metadata.wordExplanationsError': errorMessage,
            'metadata.wordExplanationsFailedAt': admin.firestore.FieldValue.serverTimestamp(),
        });
    }
});
//# sourceMappingURL=bookWordScheduler.js.map