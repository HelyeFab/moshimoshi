"use strict";
/**
 * Scheduled Cloud Function for Leaderboard Updates
 * Runs hourly to pre-compute leaderboard snapshots for better performance
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
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
// Initialize admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * Build leaderboard for a specific timeframe
 */
async function buildLeaderboard(timeframe, limit = 100) {
    console.log(`[Leaderboard] Building ${timeframe} snapshot`);
    try {
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        const aggregatedData = [];
        // Process users in batches
        const batchSize = 10;
        const userDocs = usersSnapshot.docs;
        for (let i = 0; i < userDocs.length; i += batchSize) {
            const batch = userDocs.slice(i, i + batchSize);
            const batchPromises = batch.map(async (userDoc) => {
                var _a;
                const userId = userDoc.id;
                const userData = userDoc.data();
                // Check if user has opted out
                const preferencesDoc = await db
                    .collection('users')
                    .doc(userId)
                    .collection('preferences')
                    .doc('settings')
                    .get();
                const preferences = preferencesDoc.data() || {};
                // Skip if user has opted out
                if (preferences.hideFromLeaderboard === true) {
                    return null;
                }
                // Fetch user's stats in parallel
                const [activitiesDoc, xpDoc, achievementsDoc] = await Promise.all([
                    db.collection('users').doc(userId).collection('achievements').doc('activities').get(),
                    db.collection('users').doc(userId).collection('stats').doc('xp').get(),
                    db.collection('users').doc(userId).collection('achievements').doc('data').get()
                ]);
                const activitiesData = activitiesDoc.data() || {};
                const xpData = xpDoc.data() || {};
                const achievementsData = achievementsDoc.data() || {};
                // Count achievements by rarity (simplified)
                const achievementCount = Object.keys(achievementsData.unlocked || {}).length;
                const rarityCount = {
                    legendary: Math.floor(achievementCount * 0.02),
                    epic: Math.floor(achievementCount * 0.08),
                    rare: Math.floor(achievementCount * 0.2),
                    uncommon: Math.floor(achievementCount * 0.3),
                    common: Math.floor(achievementCount * 0.4)
                };
                return {
                    userId,
                    displayName: preferences.useAnonymousName
                        ? `Anonymous Learner ${userId.slice(-4)}`
                        : userData.displayName || 'Anonymous',
                    photoURL: preferences.useAnonymousName ? undefined : userData.photoURL,
                    currentStreak: activitiesData.currentStreak || 0,
                    bestStreak: activitiesData.bestStreak || activitiesData.longestStreak || 0,
                    lastActivity: activitiesData.lastActivity || Date.now(),
                    totalXP: xpData.totalXP || 0,
                    currentLevel: xpData.currentLevel || 1,
                    weeklyXP: xpData.weeklyXP || 0,
                    monthlyXP: xpData.monthlyXP || 0,
                    achievementsUnlocked: achievementsData.unlocked || {},
                    totalPoints: achievementsData.totalPoints || 0,
                    achievementCount,
                    achievementRarity: rarityCount,
                    subscription: ((_a = userData.subscription) === null || _a === void 0 ? void 0 : _a.plan) || 'free',
                    isPublic: true
                };
            });
            const batchData = await Promise.all(batchPromises);
            aggregatedData.push(...batchData.filter(data => data !== null));
        }
        // Calculate scores based on timeframe
        const scoredEntries = aggregatedData.map(data => {
            let score = 0;
            let xpForTimeframe = data.totalXP;
            switch (timeframe) {
                case 'daily':
                    // For daily, use recent activity
                    const daysSinceActive = Math.floor((Date.now() - data.lastActivity) / (1000 * 60 * 60 * 24));
                    if (daysSinceActive > 1) {
                        xpForTimeframe = 0; // Not active today
                    }
                    else {
                        xpForTimeframe = Math.floor(data.totalXP / 30); // Daily average
                    }
                    score = data.totalPoints + xpForTimeframe + (data.currentStreak * 10);
                    break;
                case 'weekly':
                    xpForTimeframe = data.weeklyXP || Math.floor(data.totalXP / 4);
                    score = data.totalPoints + xpForTimeframe + (data.currentStreak * 5);
                    break;
                case 'monthly':
                    xpForTimeframe = data.monthlyXP || data.totalXP;
                    score = data.totalPoints + xpForTimeframe + (data.currentStreak * 2);
                    break;
                case 'allTime':
                default:
                    score = data.totalPoints + data.totalXP + (data.bestStreak * 3);
                    break;
            }
            const entry = {
                rank: 0, // Will be set after sorting
                userId: data.userId,
                displayName: data.displayName,
                photoURL: data.photoURL,
                totalPoints: data.totalPoints,
                totalXP: xpForTimeframe,
                currentLevel: data.currentLevel,
                currentStreak: data.currentStreak,
                bestStreak: data.bestStreak,
                achievementCount: data.achievementCount,
                achievementRarity: data.achievementRarity,
                lastActive: data.lastActivity,
                subscription: data.subscription,
                isPublic: true
            };
            return { entry, score };
        });
        // Sort by score (descending)
        scoredEntries.sort((a, b) => b.score - a.score);
        // Assign ranks and extract entries
        const entries = scoredEntries.slice(0, limit).map((item, index) => {
            item.entry.rank = index + 1;
            return item.entry;
        });
        const snapshot = {
            id: `${timeframe}-${Date.now()}`,
            timeframe,
            timestamp: Date.now(),
            entries,
            totalPlayers: aggregatedData.length,
            lastUpdated: Date.now()
        };
        return snapshot;
    }
    catch (error) {
        console.error(`[Leaderboard] Error building ${timeframe} snapshot:`, error);
        throw error;
    }
}
/**
 * Scheduled function to update leaderboard snapshots
 * Runs every hour
 */
exports.updateLeaderboardSnapshots = functions
    .runWith({
    timeoutSeconds: 300, // 5 minutes timeout
    memory: '512MB'
})
    .pubsub
    .schedule('every 1 hours')
    .timeZone('UTC')
    .onRun(async (context) => {
    console.log('[Leaderboard] Starting scheduled update');
    try {
        // Build snapshots for all timeframes in parallel
        const [dailySnapshot, weeklySnapshot, monthlySnapshot, allTimeSnapshot] = await Promise.all([
            buildLeaderboard('daily', 100),
            buildLeaderboard('weekly', 100),
            buildLeaderboard('monthly', 100),
            buildLeaderboard('allTime', 100)
        ]);
        // Save snapshots to Firestore
        const batch = db.batch();
        // Save each snapshot
        batch.set(db.collection('leaderboard_snapshots').doc('daily-latest'), dailySnapshot);
        batch.set(db.collection('leaderboard_snapshots').doc('weekly-latest'), weeklySnapshot);
        batch.set(db.collection('leaderboard_snapshots').doc('monthly-latest'), monthlySnapshot);
        batch.set(db.collection('leaderboard_snapshots').doc('allTime-latest'), allTimeSnapshot);
        // Also save historical snapshots for tracking trends
        batch.set(db.collection('leaderboard_history').doc(`daily-${Date.now()}`), Object.assign(Object.assign({}, dailySnapshot), { expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000) }));
        batch.set(db.collection('leaderboard_history').doc(`weekly-${Date.now()}`), Object.assign(Object.assign({}, weeklySnapshot), { expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000) }));
        await batch.commit();
        console.log('[Leaderboard] Successfully updated all snapshots');
        console.log(`[Leaderboard] Stats: ${allTimeSnapshot.totalPlayers} total players`);
        return null;
    }
    catch (error) {
        console.error('[Leaderboard] Failed to update snapshots:', error);
        throw error;
    }
});
/**
 * HTTP trigger to manually update leaderboard (for testing)
 */
exports.updateLeaderboardManually = functions
    .runWith({
    timeoutSeconds: 300,
    memory: '512MB'
})
    .https
    .onRequest(async (req, res) => {
    var _a, _b, _c;
    // Simple authentication check
    const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.replace('Bearer ', '');
    if (token !== ((_b = functions.config().admin) === null || _b === void 0 ? void 0 : _b.token)) {
        res.status(403).json({ error: 'Unauthorized' });
        return;
    }
    try {
        console.log('[Leaderboard] Manual update triggered');
        // Build and save snapshots
        const [dailySnapshot, weeklySnapshot, monthlySnapshot, allTimeSnapshot] = await Promise.all([
            buildLeaderboard('daily', 100),
            buildLeaderboard('weekly', 100),
            buildLeaderboard('monthly', 100),
            buildLeaderboard('allTime', 100)
        ]);
        const batch = db.batch();
        batch.set(db.collection('leaderboard_snapshots').doc('daily-latest'), dailySnapshot);
        batch.set(db.collection('leaderboard_snapshots').doc('weekly-latest'), weeklySnapshot);
        batch.set(db.collection('leaderboard_snapshots').doc('monthly-latest'), monthlySnapshot);
        batch.set(db.collection('leaderboard_snapshots').doc('allTime-latest'), allTimeSnapshot);
        await batch.commit();
        res.json({
            success: true,
            message: 'Leaderboard updated successfully',
            stats: {
                totalPlayers: allTimeSnapshot.totalPlayers,
                topPlayer: ((_c = allTimeSnapshot.entries[0]) === null || _c === void 0 ? void 0 : _c.displayName) || 'N/A'
            }
        });
    }
    catch (error) {
        console.error('[Leaderboard] Manual update failed:', error);
        res.status(500).json({ error: error.message });
    }
});
//# sourceMappingURL=leaderboard.js.map