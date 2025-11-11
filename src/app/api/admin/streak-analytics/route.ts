/**
 * Admin Streak Analytics API Endpoint
 * Phase 3.3: Analytics Dashboard
 *
 * Returns aggregated analytics from streak_save_logs collection
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession, authOptions } from '@/lib/auth'
import { adminFirestore as db } from '@/lib/firebase/admin'

interface RecentSave {
  userId: string
  streakSaved: number
  xpDeducted: number
  daysSinceActivity: number
  timestamp: string
}

interface StreakAnalytics {
  totalSaves: number
  totalXPSpent: number
  uniqueUsers: number
  averageCost: number
  savesLast7Days: number
  savesLast30Days: number
  mostCommonDaysSince: number | null
  conversionRate: number | null
  recentSaves: RecentSave[]
}

/**
 * Check if user is admin
 */
async function isAdmin(userId: string): Promise<boolean> {
  if (!db) return false

  const userDoc = await db.collection('users').doc(userId).get()
  if (!userDoc.exists) return false

  const userData = userDoc.data()
  // Check for admin role or specific email domain
  return userData?.role === 'admin' || userData?.isAdmin === true
}

/**
 * GET - Fetch streak save analytics
 */
export async function GET(req: NextRequest) {
  try {
    // 1. Auth check
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // 2. Admin check
    const adminStatus = await isAdmin(session.user.id)
    if (!adminStatus) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // 3. Check DB
    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    // 4. Query streak_save_logs
    const logsSnapshot = await db.collection('streak_save_logs')
      .orderBy('createdAt', 'desc')
      .limit(1000) // Get last 1000 saves for analysis
      .get()

    if (logsSnapshot.empty) {
      // No saves yet
      return NextResponse.json<StreakAnalytics>({
        totalSaves: 0,
        totalXPSpent: 0,
        uniqueUsers: 0,
        averageCost: 0,
        savesLast7Days: 0,
        savesLast30Days: 0,
        mostCommonDaysSince: null,
        conversionRate: null,
        recentSaves: []
      })
    }

    // 5. Calculate analytics
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    let totalXPSpent = 0
    let savesLast7Days = 0
    let savesLast30Days = 0
    const uniqueUsersSet = new Set<string>()
    const daysSinceCount: Record<number, number> = {}
    const recentSaves: RecentSave[] = []

    logsSnapshot.docs.forEach((doc, index) => {
      const data = doc.data()

      // Total XP
      totalXPSpent += data.xpDeducted || 0

      // Unique users
      uniqueUsersSet.add(data.userId)

      // Time-based counts
      const createdAt = data.createdAt ? new Date(data.createdAt) : null
      if (createdAt) {
        if (createdAt >= sevenDaysAgo) savesLast7Days++
        if (createdAt >= thirtyDaysAgo) savesLast30Days++
      }

      // Days since activity frequency
      const daysSince = data.daysSinceActivity ?? 0
      daysSinceCount[daysSince] = (daysSinceCount[daysSince] || 0) + 1

      // Recent saves (limit to 50)
      if (index < 50) {
        recentSaves.push({
          userId: data.userId || 'unknown',
          streakSaved: data.streakSaved || 0,
          xpDeducted: data.xpDeducted || 0,
          daysSinceActivity: data.daysSinceActivity || 0,
          timestamp: data.createdAt || data.timestamp?.toDate?.()?.toISOString() || new Date().toISOString()
        })
      }
    })

    // Calculate most common daysSince
    let mostCommonDaysSince: number | null = null
    let maxCount = 0
    Object.entries(daysSinceCount).forEach(([days, count]) => {
      if (count > maxCount) {
        maxCount = count
        mostCommonDaysSince = parseInt(days)
      }
    })

    // Calculate conversion rate (optional - would need break logs too)
    // For now, return null since we don't track breaks separately
    const conversionRate = null

    // 6. Return analytics
    return NextResponse.json<StreakAnalytics>({
      totalSaves: logsSnapshot.size,
      totalXPSpent,
      uniqueUsers: uniqueUsersSet.size,
      averageCost: logsSnapshot.size > 0 ? Math.round(totalXPSpent / logsSnapshot.size) : 0,
      savesLast7Days,
      savesLast30Days,
      mostCommonDaysSince,
      conversionRate,
      recentSaves
    })

  } catch (error) {
    console.error('[Streak Analytics] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
