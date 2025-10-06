import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'

/**
 * Helper function to check if user has premium access
 * Follows the same pattern as /src/app/api/review/_middleware/auth.ts
 */
function isPremiumUser(tier?: string): boolean {
  return tier === 'premium_monthly' || tier === 'premium_yearly'
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const userId = session?.uid

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // CRITICAL: Only premium users can sync gamification data to Firebase
    // Free users use IndexedDB only (offline-first)
    if (!isPremiumUser(session?.tier)) {
      return NextResponse.json(
        {
          error: 'Premium subscription required',
          message: 'Firebase sync is only available for premium users. Free users use local storage only.'
        },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      totalXP,
      currentStreak,
      bestStreak,
      lastActivityDate,
      unlockedAchievements,
      achievementProgress,
      sessionCount
    } = body

    // CRITICAL SAFETY CHECK: Prevent overwriting real data with zeros
    // This protects against race condition bugs where client syncs before loading data
    const userStatsRef = adminDb.collection('user_stats').doc(userId)
    const existingDoc = await userStatsRef.get()

    let existingData: any = {}
    if (existingDoc.exists) {
      existingData = existingDoc.data() || {}
      const existingXP = existingData?.xp?.total || 0
      const existingStreak = existingData?.streak?.current || 0
      const existingBestStreak = existingData?.streak?.best || 0
      const existingSessions = existingData?.sessions?.totalSessions || 0

      // Check if we're about to overwrite real data with zeros
      const incomingLooksEmpty =
        (totalXP || 0) === 0 &&
        (currentStreak || 0) === 0 &&
        (sessionCount || 0) === 0

      const existingHasData =
        existingXP > 0 ||
        existingStreak > 0 ||
        existingBestStreak > 0 ||
        existingSessions > 0

      if (incomingLooksEmpty && existingHasData) {
        console.error('[Gamification Sync] BLOCKED: Attempted to overwrite real data with zeros!', {
          userId,
          existing: { xp: existingXP, streak: existingStreak, sessions: existingSessions },
          incoming: { xp: totalXP, streak: currentStreak, sessions: sessionCount }
        })
        return NextResponse.json({
          error: 'Cannot overwrite existing stats with zero values. This likely indicates a race condition bug.',
          details: 'Client attempted to sync before loading data from Firebase'
        }, { status: 400 })
      }
    }

    // Calculate time-based metrics
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const weekStart = new Date(todayStart)
    weekStart.setDate(weekStart.getDate() - 7)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Get existing time-based data or initialize
    const existingXPData = existingData?.xp || {}
    const existingSessionData = existingData?.sessions || {}

    // Detect if this is a new session (totalSessions increased)
    const oldSessionCount = existingSessionData?.totalSessions || 0
    const newSessionDetected = (sessionCount || 0) > oldSessionCount

    // Calculate XP gained since last sync
    const oldTotalXP = existingXPData?.total || 0
    const newTotalXP = totalXP || 0
    const xpGainedThisSync = Math.max(0, newTotalXP - oldTotalXP)

    // Reset daily/weekly/monthly counters if time period changed
    const lastUpdated = existingData?.metadata?.lastUpdated
      ? new Date(existingData.metadata.lastUpdated)
      : new Date(0)

    const isSameDay = isToday(lastUpdated)
    const isSameWeek = lastUpdated >= weekStart
    const isSameMonth = lastUpdated.getMonth() === now.getMonth() && lastUpdated.getFullYear() === now.getFullYear()

    // Update time-based XP counters
    const xpGainedToday = isSameDay ? (existingXPData.xpGainedToday || 0) + xpGainedThisSync : xpGainedThisSync
    const weeklyXP = isSameWeek ? (existingXPData.weeklyXP || 0) + xpGainedThisSync : xpGainedThisSync
    const monthlyXP = isSameMonth ? (existingXPData.monthlyXP || 0) + xpGainedThisSync : xpGainedThisSync

    // Update time-based session counters
    const sessionIncrement = newSessionDetected ? 1 : 0
    const todaySessions = isSameDay ? (existingSessionData.todaySessions || 0) + sessionIncrement : sessionIncrement
    const weekSessions = isSameWeek ? (existingSessionData.weekSessions || 0) + sessionIncrement : sessionIncrement
    const monthSessions = isSameMonth ? (existingSessionData.monthSessions || 0) + sessionIncrement : sessionIncrement

    // Update user's gamification data in user_stats collection
    await userStatsRef.set({
      xp: {
        total: newTotalXP,
        level: Math.max(1, Math.floor(newTotalXP / 1000)),
        levelTitle: getLevelTitle(Math.max(1, Math.floor(newTotalXP / 1000))),
        xpToNextLevel: 1000 - (newTotalXP % 1000),
        xpGainedToday,
        weeklyXP,
        monthlyXP
      },
      streak: {
        current: currentStreak || 0,
        best: bestStreak || 0
        // REMOVED: nested dates object (legacy schema cleanup)
      },
      dates: {
        lastActivityDate: lastActivityDate || null,
        isActiveToday: !!lastActivityDate && isToday(new Date(lastActivityDate))
      },
      achievements: {
        unlockedIds: unlockedAchievements || [],
        unlockedCount: (unlockedAchievements || []).length,
        completionPercentage: Math.round(((unlockedAchievements || []).length / 10) * 100)
      },
      sessions: {
        totalSessions: sessionCount || 0,
        todaySessions,
        weekSessions,
        monthSessions,
        // Preserve other session fields or set defaults
        averageAccuracy: existingSessionData.averageAccuracy || 0,
        totalStudyTimeMinutes: existingSessionData.totalStudyTimeMinutes || 0,
        totalItemsReviewed: existingSessionData.totalItemsReviewed || 0
      },
      metadata: {
        lastUpdated: new Date().toISOString(),
        syncStatus: 'synced',
        dataHealth: 'healthy',
        schemaVersion: 2
      }
    }, { merge: true })

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('[Gamification Sync] Error:', error)
    return NextResponse.json(
      { error: 'Failed to sync gamification data', details: error.message },
      { status: 500 }
    )
  }
}

function getLevelTitle(level: number): string {
  if (level < 5) return 'Beginner'
  if (level < 10) return 'Novice'
  if (level < 25) return 'Intermediate'
  if (level < 50) return 'Advanced'
  if (level < 75) return 'Expert'
  return 'Master'
}

function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}
