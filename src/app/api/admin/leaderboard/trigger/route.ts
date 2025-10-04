/**
 * Admin API: Trigger Leaderboard Update
 * Directly generates leaderboard snapshot (same logic as Firebase function)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

async function generateLeaderboardSnapshot() {
  console.log('[Leaderboard] Starting snapshot generation...');

  // 1. Fetch all user_stats ordered by XP (fetch extra to account for opt-outs)
  const statsSnapshot = await adminDb.collection('user_stats')
    .orderBy('xp.total', 'desc')
    .limit(150)
    .get();

  console.log(`[Leaderboard] Fetched ${statsSnapshot.size} user stats`);

  // 2. Get opt-outs
  const optOutsSnapshot = await adminDb.collection('leaderboard_optouts').get();
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
        ...(data.photoURL && { photoURL: data.photoURL }),
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

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const session = await getSession();

    if (!session || !session.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify admin status
    const userRecord = await adminAuth.getUser(session.uid);
    const isAdmin = userRecord.customClaims?.admin === true;

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    console.log(`[Admin Leaderboard Trigger] Triggered by admin: ${session.uid}`);

    // Generate snapshot directly (same logic as Cloud Function)
    const snapshot = await generateLeaderboardSnapshot();

    // Save to Firestore
    await adminDb.collection('leaderboard_snapshots')
      .doc('allTime-latest')
      .set(snapshot);

    console.log('[Admin Leaderboard Trigger] ✅ Success');

    return NextResponse.json({
      success: true,
      result: {
        entriesCount: snapshot.entries.length,
        totalPlayers: snapshot.totalPlayers,
        topPlayer: snapshot.entries[0]?.displayName || 'N/A',
        timestamp: snapshot.lastUpdated
      }
    });
  } catch (error) {
    console.error('[Admin Leaderboard Trigger] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
