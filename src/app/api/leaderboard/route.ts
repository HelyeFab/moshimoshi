/**
 * Leaderboard API Route
 * GET /api/leaderboard - Returns paginated leaderboard data
 *
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 *
 * Response includes real-time leaderboard rankings with pagination metadata
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getCachedLeaderboard } from '@/lib/redis/caches/leaderboard-cache';
import type { LeaderboardResponse, LeaderboardSnapshot } from '@/lib/leaderboard/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    // Parse pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    // Validate pagination params
    if (isNaN(page) || isNaN(limit)) {
      return NextResponse.json(
        { error: 'Invalid pagination parameters' },
        { status: 400 }
      );
    }

    console.log(`[Leaderboard API] Fetching page ${page} with limit ${limit}`);

    // Try Redis cache first
    let snapshot = await getCachedLeaderboard('allTime');

    // Fallback to Firestore if cache miss
    if (!snapshot) {
      console.log('[Leaderboard API] Cache miss, fetching from Firestore');

      const doc = await adminDb
        .collection('leaderboard_snapshots')
        .doc('allTime-latest')
        .get();

      if (!doc.exists) {
        console.log('[Leaderboard API] No leaderboard snapshot found');
        return NextResponse.json(
          { error: 'Leaderboard not yet generated. Please try again later.' },
          { status: 404 }
        );
      }

      snapshot = doc.data() as LeaderboardSnapshot;
    } else {
      console.log('[Leaderboard API] Cache hit');
    }

    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEntries = snapshot.entries.slice(startIndex, endIndex);

    // Build response
    const response: LeaderboardResponse = {
      entries: paginatedEntries,
      pagination: {
        page,
        limit,
        total: snapshot.entries.length,
        totalPages: Math.ceil(snapshot.entries.length / limit),
        hasMore: endIndex < snapshot.entries.length
      },
      metadata: {
        totalPlayers: snapshot.totalPlayers,
        lastUpdated: snapshot.lastUpdated
      }
    };

    console.log(`[Leaderboard API] Returning ${paginatedEntries.length} entries (page ${page}/${response.pagination.totalPages})`);

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('[Leaderboard API] Error fetching leaderboard:', error);

    return NextResponse.json(
      {
        error: 'Failed to fetch leaderboard',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
