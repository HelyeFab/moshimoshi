/**
 * API Route: Check Migration Status
 *
 * GET /api/gamification/migration/status
 *
 * Checks if user has data in Firebase (migrated) and/or IndexedDB (not migrated)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getStreakData } from '@/lib/gamification/services/streakService';

/**
 * GET /api/gamification/migration/status
 *
 * Returns migration status for current user
 */
export async function GET(req: NextRequest) {
  try {
    // Get auth token from request
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing or invalid authorization header'
        },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Verify token with Firebase Admin
    const decodedToken = await getAuth().verifyIdToken(token);
    const userId = decodedToken.uid;

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid user ID'
        },
        { status: 401 }
      );
    }

    // Check if user has data in Firebase
    const firebaseData = await getStreakData(userId);

    const hasMigrated = !!firebaseData;
    const hasVersion = firebaseData?.version !== undefined;

    return NextResponse.json({
      success: true,
      hasMigrated,
      hasVersion,
      streak: firebaseData ?? null
    });

  } catch (error: any) {
    console.error('[Migration Status API] Error:', error);

    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json(
        {
          success: false,
          error: 'Token expired'
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}
