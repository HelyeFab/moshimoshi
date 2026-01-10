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
import { getSession } from '@/lib/auth/session';
import { applyMergedStatsTransaction } from '@/lib/gamification/services/streakService';

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
    let userId: string | null = null;
    const authHeader = req.headers.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decodedToken = await getAuth().verifyIdToken(token);
        userId = decodedToken.uid;
      } catch (error: any) {
        if (error.code === 'auth/id-token-expired') {
          return NextResponse.json(
            { success: false, error: 'Token expired' },
            { status: 401 }
          );
        }
        if (error.code === 'auth/argument-error') {
          return NextResponse.json(
            { success: false, error: 'Invalid token' },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { success: false, error: 'Invalid token' },
          { status: 401 }
        );
      }
    } else {
      const session = await getSession();
      if (!session) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
      }
      userId = session.uid;
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID' },
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

    // DELEGATE TO STREAK SERVICE (single writer pattern)
    // All streak writes MUST go through transactional service
    // The service handles merging with existing data using max strategy
    const result = await applyMergedStatsTransaction(userId, {
      xp: {
        total: migrationData.totalXP || 0,
        level: Math.max(1, Math.floor((migrationData.totalXP || 0) / 1000)),
        levelTitle: getLevelTitle(Math.max(1, Math.floor((migrationData.totalXP || 0) / 1000))),
        xpToNextLevel: 1000 - ((migrationData.totalXP || 0) % 1000)
      },
      streak: {
        current: migrationData.currentStreak || 0,
        best: migrationData.bestStreak || 0
      },
      dates: {
        lastActivityDate: migrationData.lastActivityDate || null,
        isActiveToday: false
      },
      achievements: {
        unlockedIds: migrationData.unlockedAchievements || [],
        unlockedCount: (migrationData.unlockedAchievements || []).length,
        completionPercentage: 0
      },
      sessions: {
        totalSessions: migrationData.sessionCount || 0
      }
    });

    if (!result.success) {
      console.error('[Migration API] Failed:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Migration failed'
        },
        { status: 500 }
      );
    }

    console.log('[Migration API] Successfully migrated via transaction');
    console.log('[Migration API] Final streak data:', result.streakData);

    return NextResponse.json({
      success: true,
      streak: result.streakData,
      xp: result.xpData,
      message: 'Migration successful'
    });

  } catch (error: any) {
    console.error('[Migration API] Error:', error);

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
 * Helper: Get level title based on level number
 */
function getLevelTitle(level: number): string {
  if (level < 5) return 'Beginner';
  if (level < 10) return 'Novice';
  if (level < 25) return 'Intermediate';
  if (level < 50) return 'Advanced';
  if (level < 75) return 'Expert';
  return 'Master';
}
