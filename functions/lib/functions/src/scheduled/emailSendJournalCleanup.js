"use strict";
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
exports.cleanupEmailSendJournal = void 0;
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const scheduler_1 = require("firebase-functions/v2/scheduler");
const COLLECTION = 'email_send_journal';
const RETENTION_DAYS = 180;
const DELETE_BATCH_SIZE = 400;
/**
 * Deletes old email send journal entries to enforce data minimization retention.
 */
exports.cleanupEmailSendJournal = (0, scheduler_1.onSchedule)({
    schedule: '15 2 * * *',
    timeZone: 'UTC',
    region: 'europe-west1',
    memory: '256MiB',
    timeoutSeconds: 540,
    retryCount: 1,
}, async () => {
    const db = admin.firestore();
    const cutoffDate = new Date();
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - RETENTION_DAYS);
    const cutoff = admin.firestore.Timestamp.fromDate(cutoffDate);
    let deleted = 0;
    while (true) {
        const snapshot = await db
            .collection(COLLECTION)
            .where('sentAt', '<', cutoff)
            .orderBy('sentAt', 'asc')
            .limit(DELETE_BATCH_SIZE)
            .get();
        if (snapshot.empty) {
            break;
        }
        const batch = db.batch();
        for (const doc of snapshot.docs) {
            batch.delete(doc.ref);
        }
        await batch.commit();
        deleted += snapshot.size;
        if (snapshot.size < DELETE_BATCH_SIZE) {
            break;
        }
    }
    logger.info('[EmailSendJournalCleanup] Completed', {
        collection: COLLECTION,
        retentionDays: RETENTION_DAYS,
        deleted,
    });
});
//# sourceMappingURL=emailSendJournalCleanup.js.map