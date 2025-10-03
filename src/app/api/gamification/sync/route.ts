import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    const userId = session?.uid

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Update user's gamification data in user_stats collection
    const userStatsRef = adminDb.collection('user_stats').doc(userId)

    await userStatsRef.set({
      xp: {
        total: totalXP || 0,
        level: Math.max(1, Math.floor((totalXP || 0) / 1000)),
        levelTitle: getLevelTitle(Math.max(1, Math.floor((totalXP || 0) / 1000))),
        xpToNextLevel: 1000 - ((totalXP || 0) % 1000)
      },
      streak: {
        current: currentStreak || 0,
        best: bestStreak || 0
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
