/**
 * Scheduled Cloud Function for Leaderboard Updates
 * Runs hourly to pre-compute leaderboard snapshots for better performance
 *
 * UPDATED: Now reads from unified user_stats collection instead of scattered collections
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface LeaderboardEntry {
  rank: number
  userId: string
  displayName: string
  photoURL?: string
  totalPoints: number
  totalXP: number
  currentLevel: number
  currentStreak: number
  bestStreak: number
  achievementCount: number
  achievementRarity: {
    legendary: number
    epic: number
    rare: number
    uncommon: number
    common: number
  }
  lastActive: number
  subscription?: string
  isPublic: boolean
}

interface LeaderboardSnapshot {
  id: string
  timeframe: 'daily' | 'weekly' | 'monthly' | 'allTime'
  timestamp: number
  entries: LeaderboardEntry[]
  totalPlayers: number
  lastUpdated: number
}

/**
 * Build leaderboard for a specific timeframe
 */
async function buildLeaderboard(
  timeframe: 'daily' | 'weekly' | 'monthly' | 'allTime',
  limit: number = 100
): Promise<LeaderboardSnapshot> {
  console.log(`[Leaderboard] Building ${timeframe} snapshot`);

  try {
    // Get all users
    const usersSnapshot = await db.collection('users').get();
    const aggregatedData: any[] = [];

    // Process users in batches
    const batchSize = 10;
    const userDocs = usersSnapshot.docs;

    for (let i = 0; i < userDocs.length; i += batchSize) {
      const batch = userDocs.slice(i, i + batchSize);
      const batchPromises = batch.map(async (userDoc) => {
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

        // Fetch user's stats from unified collection
        const userStatsDoc = await db.collection('user_stats').doc(userId).get();

        if (!userStatsDoc.exists) {
          // User has no stats yet
          return null;
        }

        const statsData = userStatsDoc.data() || {};

        // Count achievements from unified stats
        const achievementCount = statsData.achievements?.unlockedCount || 0;
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
            : statsData.displayName || userData.displayName || 'Anonymous',
          photoURL: preferences.useAnonymousName ? undefined : statsData.photoURL || userData.photoURL,
          currentStreak: statsData.streak?.current || 0,
          bestStreak: statsData.streak?.best || 0,
          lastActivity: statsData.streak?.lastActivityTimestamp || Date.now(),
          totalXP: statsData.xp?.total || 0,
          currentLevel: statsData.xp?.level || 1,
          weeklyXP: statsData.xp?.weeklyXP || 0,
          monthlyXP: statsData.xp?.monthlyXP || 0,
          achievementsUnlocked: statsData.achievements?.unlockedIds || [],
          totalPoints: statsData.achievements?.totalPoints || 0,
          achievementCount,
          achievementRarity: rarityCount,
          subscription: statsData.tier || userData.subscription?.plan || 'free',
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
          } else {
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

      const entry: LeaderboardEntry = {
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

    const snapshot: LeaderboardSnapshot = {
      id: `${timeframe}-${Date.now()}`,
      timeframe,
      timestamp: Date.now(),
      entries,
      totalPlayers: aggregatedData.length,
      lastUpdated: Date.now()
    };

    return snapshot;
  } catch (error) {
    console.error(`[Leaderboard] Error building ${timeframe} snapshot:`, error);
    throw error;
  }
}

/**
 * Scheduled function to update leaderboard snapshots
 * Runs every hour
 */
export const updateLeaderboardSnapshots = functions
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
      batch.set(
        db.collection('leaderboard_snapshots').doc('daily-latest'),
        dailySnapshot
      );
      batch.set(
        db.collection('leaderboard_snapshots').doc('weekly-latest'),
        weeklySnapshot
      );
      batch.set(
        db.collection('leaderboard_snapshots').doc('monthly-latest'),
        monthlySnapshot
      );
      batch.set(
        db.collection('leaderboard_snapshots').doc('allTime-latest'),
        allTimeSnapshot
      );

      // Also save historical snapshots for tracking trends
      batch.set(
        db.collection('leaderboard_history').doc(`daily-${Date.now()}`),
        { ...dailySnapshot, expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000) }
      );
      batch.set(
        db.collection('leaderboard_history').doc(`weekly-${Date.now()}`),
        { ...weeklySnapshot, expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 30 * 24 * 60 * 60 * 1000) }
      );

      await batch.commit();

      console.log('[Leaderboard] Successfully updated all snapshots');
      console.log(`[Leaderboard] Stats: ${allTimeSnapshot.totalPlayers} total players`);

      return null;
    } catch (error) {
      console.error('[Leaderboard] Failed to update snapshots:', error);
      throw error;
    }
  });

/**
 * HTTP trigger to manually update leaderboard (for testing)
 */
export const updateLeaderboardManually = functions
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB'
  })
  .https
  .onRequest(async (req, res) => {
    // Simple authentication check
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token !== functions.config().admin?.token) {
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
          topPlayer: allTimeSnapshot.entries[0]?.displayName || 'N/A'
        }
      });
    } catch (error: any) {
      console.error('[Leaderboard] Manual update failed:', error);
      res.status(500).json({ error: error.message });
    }
  });