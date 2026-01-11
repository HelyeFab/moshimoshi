"use strict";
/**
 * Q&A Voting Cloud Functions
 * Server-side vote counting for questions and answers
 *
 * This approach is more secure than client-side counting:
 * - Atomic operations guaranteed
 * - No race conditions
 * - Cannot be manipulated by client
 * - Consistent vote counts
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
exports.onAnswerVoteDeleted = exports.onAnswerVoteCreated = exports.onQuestionVoteDeleted = exports.onQuestionVoteCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = __importStar(require("firebase-admin"));
/**
 * When a question vote is created, increment the question's vote count
 *
 * Concurrency limits:
 * - maxInstances: 50 - Higher for voting (very frequent operation)
 * - minInstances: 2 - Keep 2 warm for better UX (handles 160 concurrent votes)
 * - concurrency: 80 - Max concurrency (voting is lightweight Firestore transaction)
 * - Max concurrent votes: 4,000/sec (50 instances × 80 requests)
 */
exports.onQuestionVoteCreated = (0, firestore_1.onDocumentCreated)({
    document: 'qa_question_votes/{voteId}',
    maxInstances: 50,
    minInstances: 2,
    concurrency: 80,
    timeoutSeconds: 10,
    memory: '256MiB',
}, async (event) => {
    var _a;
    const voteData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!voteData) {
        console.error('No vote data in event');
        return;
    }
    const { questionId, voteType } = voteData;
    try {
        const db = admin.firestore();
        const questionRef = db.collection('qa_questions').doc(questionId);
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(questionRef);
            if (!snap.exists)
                return;
            const data = snap.data() || {};
            const currentUp = data.upvotes || 0;
            const currentDown = data.downvotes || 0;
            const newUp = voteType === 'upvote' ? currentUp + 1 : currentUp;
            const newDown = voteType === 'downvote' ? currentDown + 1 : currentDown;
            tx.update(questionRef, { upvotes: newUp, downvotes: newDown });
        });
        console.log(`Question ${questionId} ${voteType} count incremented`);
    }
    catch (error) {
        console.error(`Failed to increment question vote count:`, error);
    }
});
/**
 * When a question vote is deleted, decrement the question's vote count
 *
 * Concurrency limits: Same as vote creation
 */
exports.onQuestionVoteDeleted = (0, firestore_1.onDocumentDeleted)({
    document: 'qa_question_votes/{voteId}',
    maxInstances: 50,
    minInstances: 2,
    concurrency: 80,
    timeoutSeconds: 10,
    memory: '256MiB',
}, async (event) => {
    var _a;
    const voteData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!voteData) {
        console.error('No vote data in event');
        return;
    }
    const { questionId, voteType } = voteData;
    try {
        const db = admin.firestore();
        const questionRef = db.collection('qa_questions').doc(questionId);
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(questionRef);
            if (!snap.exists)
                return;
            const data = snap.data() || {};
            const currentUp = data.upvotes || 0;
            const currentDown = data.downvotes || 0;
            // Prevent negative counts
            const newUp = voteType === 'upvote' ? Math.max(0, currentUp - 1) : currentUp;
            const newDown = voteType === 'downvote' ? Math.max(0, currentDown - 1) : currentDown;
            tx.update(questionRef, { upvotes: newUp, downvotes: newDown });
        });
        console.log(`Question ${questionId} ${voteType} count decremented`);
    }
    catch (error) {
        console.error(`Failed to decrement question vote count:`, error);
    }
});
/**
 * When an answer vote is created, increment the answer's vote count
 *
 * Concurrency limits: Same as question voting
 */
exports.onAnswerVoteCreated = (0, firestore_1.onDocumentCreated)({
    document: 'qa_answer_votes/{voteId}',
    maxInstances: 50,
    minInstances: 2,
    concurrency: 80,
    timeoutSeconds: 10,
    memory: '256MiB',
}, async (event) => {
    var _a;
    const voteData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!voteData) {
        console.error('No vote data in event');
        return;
    }
    const { answerId, voteType } = voteData;
    try {
        const db = admin.firestore();
        const answerRef = db.collection('qa_answers').doc(answerId);
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(answerRef);
            if (!snap.exists)
                return;
            const data = snap.data() || {};
            const currentUp = data.upvotes || 0;
            const currentDown = data.downvotes || 0;
            const newUp = voteType === 'upvote' ? currentUp + 1 : currentUp;
            const newDown = voteType === 'downvote' ? currentDown + 1 : currentDown;
            tx.update(answerRef, { upvotes: newUp, downvotes: newDown });
        });
        console.log(`Answer ${answerId} ${voteType} count incremented`);
    }
    catch (error) {
        console.error(`Failed to increment answer vote count:`, error);
    }
});
/**
 * When an answer vote is deleted, decrement the answer's vote count
 *
 * Concurrency limits: Same as question voting
 */
exports.onAnswerVoteDeleted = (0, firestore_1.onDocumentDeleted)({
    document: 'qa_answer_votes/{voteId}',
    maxInstances: 50,
    minInstances: 2,
    concurrency: 80,
    timeoutSeconds: 10,
    memory: '256MiB',
}, async (event) => {
    var _a;
    const voteData = (_a = event.data) === null || _a === void 0 ? void 0 : _a.data();
    if (!voteData) {
        console.error('No vote data in event');
        return;
    }
    const { answerId, voteType } = voteData;
    try {
        const db = admin.firestore();
        const answerRef = db.collection('qa_answers').doc(answerId);
        await db.runTransaction(async (tx) => {
            const snap = await tx.get(answerRef);
            if (!snap.exists)
                return;
            const data = snap.data() || {};
            const currentUp = data.upvotes || 0;
            const currentDown = data.downvotes || 0;
            // Prevent negative counts
            const newUp = voteType === 'upvote' ? Math.max(0, currentUp - 1) : currentUp;
            const newDown = voteType === 'downvote' ? Math.max(0, currentDown - 1) : currentDown;
            tx.update(answerRef, { upvotes: newUp, downvotes: newDown });
        });
        console.log(`Answer ${answerId} ${voteType} count decremented`);
    }
    catch (error) {
        console.error(`Failed to decrement answer vote count:`, error);
    }
});
//# sourceMappingURL=qa-voting.js.map