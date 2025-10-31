import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { getStreakData } from '@/lib/gamification/services/streakService'

/**
 * GET /api/gamification/load
 *
 * Loads gamification data from Firebase Firestore (premium users only)
 * Returns user_stats document data in normalized format
 *
 * Used for cross-device sync: Downloads Firebase data to IndexedDB cache
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const userId = session?.uid

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[Gamification Load] Fetching data for user:', userId)

    // Fetch user's gamification data from user_stats collection
    const userStatsRef = adminDb.collection('user_stats').doc(userId)
    const userStatsDoc = await userStatsRef.get()

    if (!userStatsDoc.exists) {
      console.log('[Gamification Load] No user_stats document found for:', userId)
      return NextResponse.json({
        success: false,
        data: null,
        message: 'No gamification data found in Firebase'
      })
    }

    const data = userStatsDoc.data()
    const streak = await getStreakData(userId, adminDb)

    const normalizedData = {
      totalXP: data?.xp?.total ?? 0,
      streak,
      unlockedAchievements: data?.achievements?.unlockedIds ?? [],
      achievementProgress: data?.achievements?.progress ?? {},
      sessionCount: data?.sessions?.totalSessions ?? 0,
      metadata: {
        lastUpdated: data?.metadata?.lastUpdated ?? null,
        syncStatus: data?.metadata?.syncStatus ?? 'unknown',
        schemaVersion: data?.metadata?.schemaVersion ?? 1
      }
    }

    console.log('[Gamification Load] Successfully loaded data:', {
      userId,
      totalXP: normalizedData.totalXP,
      current: normalizedData.streak?.current ?? 0,
      sessionCount: normalizedData.sessionCount
    })

    return NextResponse.json({
      success: true,
      data: normalizedData
    })
  } catch (error: any) {
    console.error('[Gamification Load] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to load gamification data',
        details: error.message,
        success: false
      },
      { status: 500 }
    )
  }
}
