/**
 * User Rank API Route
 * GET /api/leaderboard/user-rank - Returns authenticated user's rank
 *
 * Requires authentication
 * Returns the user's current rank, total players, and their entry data
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getCachedLeaderboard } from '@/lib/redis/caches/leaderboard-cache';
import { adminDb } from '@/lib/firebase/admin';
import type { UserRankResponse, LeaderboardSnapshot } from '@/lib/leaderboard/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();

    if (!session || !session.uid) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to view your rank.' },
        { status: 401 }
      );
    }

    const userId = session.uid;
    console.log(`[User Rank API] Fetching rank for user: ${userId}`);

    // Try Redis cache first
    let snapshot = await getCachedLeaderboard('allTime');

    // Fallback to Firestore if cache miss
    if (!snapshot) {
      console.log('[User Rank API] Cache miss, fetching from Firestore');

      const doc = await adminDb
        .collection('leaderboard_snapshots')
        .doc('allTime-latest')
        .get();

      if (!doc.exists) {
        console.log('[User Rank API] No leaderboard snapshot found');
        return NextResponse.json(
          { error: 'Leaderboard not yet generated' },
          { status: 404 }
        );
      }

      snapshot = doc.data() as LeaderboardSnapshot;
    }

    // Find user's entry in the leaderboard
    const userEntry = snapshot.entries.find(entry => entry.userId === userId);

    if (userEntry) {
      // User is in top 100
      const response: UserRankResponse = {
        rank: userEntry.rank,
        totalPlayers: snapshot.totalPlayers,
        entry: userEntry
      };

      console.log(`[User Rank API] User found at rank ${userEntry.rank}/${snapshot.totalPlayers}`);

      return NextResponse.json(response, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });
    } else {
      // User not in top 100 - estimate rank
      // They are ranked somewhere after the last entry
      const estimatedRank = snapshot.entries.length + 1;

      const response: UserRankResponse = {
        rank: estimatedRank,
        totalPlayers: snapshot.totalPlayers,
        entry: undefined
      };

      console.log(`[User Rank API] User not in top 100, estimated rank: ${estimatedRank}+`);

      return NextResponse.json(response, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });
    }
  } catch (error) {
    console.error('[User Rank API] Error fetching user rank:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch user rank',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
