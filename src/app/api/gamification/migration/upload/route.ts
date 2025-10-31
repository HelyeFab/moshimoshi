/**
 * API Route: Upload Streak Data for Migration
 *
 * POST /api/gamification/migration/upload
 *
 * Handles migration of streak data from IndexedDB to Firebase.
 * Merges data by taking maximum values to prevent data loss.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStreakData } from '@/lib/gamification/services/streakService';

interface MigrationData {
  currentStreak: number;
  bestStreak: number;
  lastActivityDate: string | null;
  totalXP: number;
  unlockedAchievements: string[];
  achievementProgress: Record<string, number>;
  sessionCount: number;
}

/**
 * POST /api/gamification/migration/upload
 *
 * Upload and merge gamification data from IndexedDB
 *
 * Strategy:
 * - Take maximum values for numeric fields (currentStreak, bestStreak, totalXP, sessionCount)
 * - Merge arrays (unlockedAchievements)
 * - Take maximum for achievement progress
 * - Use most recent lastActivityDate
 */
export async function POST(req: NextRequest) {
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

    // Parse migration data from request body
    const migrationData: MigrationData = await req.json();

    console.log('[Migration API] Received data for user:', userId);
    console.log('[Migration API] IndexedDB data:', {
      currentStreak: migrationData.currentStreak,
      bestStreak: migrationData.bestStreak,
      totalXP: migrationData.totalXP
    });

    // Get existing Firebase data
    const existingData = await getStreakData(userId);

    console.log('[Migration API] Existing Firebase data:', existingData ? {
      currentStreak: existingData.currentStreak,
      bestStreak: existingData.bestStreak,
      totalXP: existingData.totalXP
    } : 'No existing data');

    // Merge data (take maximum values)
    const mergedData = {
      currentStreak: Math.max(
        migrationData.currentStreak || 0,
        existingData?.currentStreak || 0
      ),
      bestStreak: Math.max(
        migrationData.bestStreak || 0,
        existingData?.bestStreak || 0
      ),
      totalXP: Math.max(
        migrationData.totalXP || 0,
        existingData?.totalXP || 0
      ),
      sessionCount: Math.max(
        migrationData.sessionCount || 0,
        0 // Firebase doesn't have sessionCount yet in old schema
      ),
      lastActivityDate: getMostRecentDate(
        migrationData.lastActivityDate,
        existingData?.lastActivityDate
      ),
      unlockedAchievements: mergeArrays(
        migrationData.unlockedAchievements || [],
        [] // Firebase doesn't have achievements yet in old schema
      ),
      achievementProgress: mergeProgress(
        migrationData.achievementProgress || {},
        {}
      ),
      freezesRemaining: existingData?.freezesRemaining || 3,
      version: (existingData?.version || 0) + 1,
      updatedAt: Timestamp.now()
    };

    console.log('[Migration API] Merged data:', {
      currentStreak: mergedData.currentStreak,
      bestStreak: mergedData.bestStreak,
      totalXP: mergedData.totalXP
    });

    // Write to Firebase
    const db = getFirestore();
    const userStatsRef = db.collection('user_stats').doc(userId);

    await userStatsRef.set(mergedData, { merge: true });

    console.log('[Migration API] Successfully wrote to Firebase');

    return NextResponse.json({
      success: true,
      data: mergedData,
      message: 'Migration successful'
    });

  } catch (error: any) {
    console.error('[Migration API] Error:', error);

    // Handle specific Firebase errors
    if (error.code === 'auth/id-token-expired') {
      return NextResponse.json(
        {
          success: false,
          error: 'Token expired'
        },
        { status: 401 }
      );
    }

    if (error.code === 'auth/argument-error') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid token'
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

/**
 * Helper: Get the most recent date
 */
function getMostRecentDate(date1: string | null, date2: string | null): string {
  if (!date1 && !date2) {
    return new Date().toISOString();
  }
  if (!date1) return date2!;
  if (!date2) return date1;

  const d1 = new Date(date1);
  const d2 = new Date(date2);

  return d1 > d2 ? date1 : date2;
}

/**
 * Helper: Merge two arrays (unique values)
 */
function mergeArrays<T>(arr1: T[], arr2: T[]): T[] {
  return Array.from(new Set([...arr1, ...arr2]));
}

/**
 * Helper: Merge achievement progress (take maximum)
 */
function mergeProgress(
  progress1: Record<string, number>,
  progress2: Record<string, number>
): Record<string, number> {
  const merged: Record<string, number> = { ...progress1 };

  for (const [key, value] of Object.entries(progress2)) {
    merged[key] = Math.max(merged[key] || 0, value);
  }

  return merged;
}
