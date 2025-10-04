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

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  photoURL?: string;
  totalXP: number;
  currentLevel: number;
  currentStreak: number;
  bestStreak: number;
  achievementCount: number;
  lastActive: string | null;
  subscription: 'free' | 'premium_monthly' | 'premium_yearly';
}

interface LeaderboardSnapshot {
  timeframe: 'allTime';
  timestamp: number;
  entries: LeaderboardEntry[];
  totalPlayers: number;
  lastUpdated: number;
}

/**
 * Core logic for generating leaderboard snapshot
 */
async function generateLeaderboardSnapshot(): Promise<LeaderboardSnapshot> {
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
    const scoredEntries: Array<{ score: number; entry: Omit<LeaderboardEntry, 'rank'> }> = [];

    for (const doc of statsSnapshot.docs) {
      const userId = doc.id;

      // Skip opted-out users
      if (optedOutUsers.has(userId)) {
        continue;
      }

      const data = doc.data();

      // Calculate score: XP + (streak × 3)
      const totalXP = data.xp?.total || 0;
      const currentStreak = data.streak?.current || 0;
      const score = totalXP + (currentStreak * 3);

      scoredEntries.push({
        score,
        entry: {
          userId,
          displayName: data.displayName || 'Anonymous',
          photoURL: data.photoURL || undefined,
          totalXP,
          currentLevel: data.xp?.level || 1,
          currentStreak,
          bestStreak: data.streak?.best || 0,
          achievementCount: data.achievements?.unlockedCount || 0,
          lastActive: data.dates?.lastActivityDate || null,
          subscription: data.subscription?.plan || 'free'
        }
      });
    }

    // 4. Sort by score (descending) and take top 100
    scoredEntries.sort((a, b) => b.score - a.score);
    const top100 = scoredEntries.slice(0, 100);

    // 5. Assign ranks
    const entries: LeaderboardEntry[] = top100.map((item, index) => ({
      rank: index + 1,
      ...item.entry
    }));

    // 6. Create snapshot
    const now = Date.now();
    const snapshot: LeaderboardSnapshot = {
      timeframe: 'allTime',
      timestamp: now,
      entries,
      totalPlayers: scoredEntries.length,
      lastUpdated: now
    };

    console.log(`[Leaderboard] Generated snapshot with ${entries.length} entries (${scoredEntries.length} total eligible players)`);

    return snapshot;
  } catch (error) {
    console.error('[Leaderboard] Error generating snapshot:', error);
    throw error;
  }
}

/**
 * Scheduled function to update leaderboard snapshots
 * Runs daily at midnight UTC
 */
export const updateLeaderboardSnapshots = onSchedule({
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
  } catch (error) {
    console.error('[Leaderboard] ❌ Failed to update snapshot:', error);
    throw error;
  }
});

/**
 * Callable function to manually trigger leaderboard update
 * For admin/testing use
 */
export const updateLeaderboardManually = onCall({
  region: 'europe-west1',
  memory: '512MiB',
  timeoutSeconds: 300
}, async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated to trigger manual update');
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
      topPlayer: snapshot.entries[0]?.displayName || 'N/A',
      timestamp: snapshot.lastUpdated
    };
  } catch (error: any) {
    console.error('[Leaderboard] ❌ Manual update failed:', error);
    throw new HttpsError('internal', `Failed to update leaderboard: ${error.message}`);
  }
});
