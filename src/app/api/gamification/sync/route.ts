import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { applyMergedStatsTransaction } from '@/lib/gamification/services/streakService'

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
      lastActivityDate,
      unlockedAchievements,
      achievementProgress,
      sessionCount
    } = body

    // CRITICAL SAFETY CHECK: Prevent overwriting real data with zeros
    // This protects against race condition bugs where client syncs before loading data
    const incomingLooksEmpty =
      (totalXP || 0) === 0 &&
      (sessionCount || 0) === 0

    if (incomingLooksEmpty) {
      console.error('[Gamification Sync] BLOCKED: Attempted to sync with empty data!', {
        userId,
        incoming: { xp: totalXP, sessions: sessionCount }
      })
      return NextResponse.json({
        error: 'Cannot sync empty data. This likely indicates a race condition bug.',
        details: 'Client attempted to sync before loading data from Firebase'
      }, { status: 400 })
    }

    // Delegate to streak service (single writer pattern)
    const result = await applyMergedStatsTransaction(userId, {
      xp: {
        total: totalXP || 0,
        level: Math.max(1, Math.floor((totalXP || 0) / 1000)),
        levelTitle: getLevelTitle(Math.max(1, Math.floor((totalXP || 0) / 1000))),
        xpToNextLevel: 1000 - ((totalXP || 0) % 1000)
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
        totalSessions: sessionCount || 0
      }
    })

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to sync gamification data', details: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      syncedAt: new Date().toISOString(),
      streak: result.streakData,
      xp: result.xpData
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
