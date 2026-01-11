"use strict";
/**
 * Scheduled Leaderboard Functions
 *
 * Daily leaderboard snapshot generation with simplified scoring:
 * Score = totalXP + (currentStreak × 3)
 *
 * Features:
 * - Daily updates at midnight UTC
 * - All-time rankings only (top 100)
 * - Respects user opt-outs
 * - Redis caching for performance
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
exports.updateLeaderboardManually = exports.updateLeaderboardSnapshots = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Core logic for generating leaderboard snapshot
 */
async function generateLeaderboardSnapshot() {
    var _a, _b, _c, _d, _e, _f, _g;
    console.log('[Leaderboard] Starting snapshot generation...');
    try {
        // 1. Fetch all user_stats ordered by XP (fetch extra to account for opt-outs)
        const statsSnapshot = await db.collection('user_stats')
            .orderBy('xp.total', 'desc')
            .limit(150)
            .get();
        console.log(`[Leaderboard] Fetched ${statsSnapshot.size} user stats`);
        // 2. Get opt-outs
        const optOutsSnapshot = await db.collection('leaderboard_optouts').get();
        const optedOutUsers = new Set(optOutsSnapshot.docs.map(doc => doc.id));
        console.log(`[Leaderboard] Found ${optedOutUsers.size} opted-out users`);
        // 3. Build entries with score calculation
        const scoredEntries = [];
        for (const doc of statsSnapshot.docs) {
            const userId = doc.id;
            // Skip opted-out users
            if (optedOutUsers.has(userId)) {
                continue;
            }
            const data = doc.data();
            // Calculate score: XP + (streak × 3)
            const totalXP = ((_a = data.xp) === null || _a === void 0 ? void 0 : _a.total) || 0;
            const currentStreak = ((_b = data.streak) === null || _b === void 0 ? void 0 : _b.current) || 0;
            const score = totalXP + (currentStreak * 3);
            scoredEntries.push({
                score,
                entry: {
                    userId,
                    displayName: data.displayName || 'Anonymous',
                    photoURL: data.photoURL || undefined,
                    totalXP,
                    currentLevel: ((_c = data.xp) === null || _c === void 0 ? void 0 : _c.level) || 1,
                    currentStreak,
                    bestStreak: ((_d = data.streak) === null || _d === void 0 ? void 0 : _d.best) || 0,
                    achievementCount: ((_e = data.achievements) === null || _e === void 0 ? void 0 : _e.unlockedCount) || 0,
                    lastActive: ((_f = data.dates) === null || _f === void 0 ? void 0 : _f.lastActivityDate) || null,
                    subscription: ((_g = data.subscription) === null || _g === void 0 ? void 0 : _g.plan) || 'free'
                }
            });
        }
        // 4. Sort by score (descending) and take top 100
        scoredEntries.sort((a, b) => b.score - a.score);
        const top100 = scoredEntries.slice(0, 100);
        // 5. Assign ranks
        const entries = top100.map((item, index) => (Object.assign({ rank: index + 1 }, item.entry)));
        // 6. Create snapshot
        const now = Date.now();
        const snapshot = {
            timeframe: 'allTime',
            timestamp: now,
            entries,
            totalPlayers: scoredEntries.length,
            lastUpdated: now
        };
        console.log(`[Leaderboard] Generated snapshot with ${entries.length} entries (${scoredEntries.length} total eligible players)`);
        return snapshot;
    }
    catch (error) {
        console.error('[Leaderboard] Error generating snapshot:', error);
        throw error;
    }
}
/**
 * Scheduled function to update leaderboard snapshots
 * Runs daily at midnight UTC
 */
exports.updateLeaderboardSnapshots = (0, scheduler_1.onSchedule)({
    schedule: 'every day 00:00',
    timeZone: 'UTC',
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 300
}, async (event) => {
    console.log('[Leaderboard] Daily snapshot update triggered');
    try {
        // Generate snapshot
        const snapshot = await generateLeaderboardSnapshot();
        // Save to Firestore
        await db.collection('leaderboard_snapshots')
            .doc('allTime-latest')
            .set(snapshot);
        console.log(`[Leaderboard] ✅ Snapshot saved successfully`);
        console.log(`[Leaderboard] Stats: ${snapshot.entries.length} entries, ${snapshot.totalPlayers} total players`);
        // Log top 3 for verification
        if (snapshot.entries.length > 0) {
            console.log('[Leaderboard] Top 3:');
            snapshot.entries.slice(0, 3).forEach(entry => {
                console.log(`  ${entry.rank}. ${entry.displayName} - XP: ${entry.totalXP}, Streak: ${entry.currentStreak}`);
            });
        }
        return null;
    }
    catch (error) {
        console.error('[Leaderboard] ❌ Failed to update snapshot:', error);
        throw error;
    }
});
/**
 * Callable function to manually trigger leaderboard update
 * For admin/testing use
 */
exports.updateLeaderboardManually = (0, https_1.onCall)({
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 300
}, async (request) => {
    var _a;
    // Verify authentication
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Must be authenticated to trigger manual update');
    }
    console.log(`[Leaderboard] Manual update requested by user: ${request.auth.uid}`);
    try {
        // Generate snapshot
        const snapshot = await generateLeaderboardSnapshot();
        // Save to Firestore
        await db.collection('leaderboard_snapshots')
            .doc('allTime-latest')
            .set(snapshot);
        console.log('[Leaderboard] ✅ Manual update completed successfully');
        return {
            success: true,
            entriesCount: snapshot.entries.length,
            totalPlayers: snapshot.totalPlayers,
            topPlayer: ((_a = snapshot.entries[0]) === null || _a === void 0 ? void 0 : _a.displayName) || 'N/A',
            timestamp: snapshot.lastUpdated
        };
    }
    catch (error) {
        console.error('[Leaderboard] ❌ Manual update failed:', error);
        throw new https_1.HttpsError('internal', `Failed to update leaderboard: ${error.message}`);
    }
});
//# sourceMappingURL=leaderboard.js.map