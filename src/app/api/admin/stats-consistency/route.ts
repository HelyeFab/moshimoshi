/**
 * Stats Consistency Checker API
 * Analyzes user statistics to detect outliers and inconsistencies
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'

interface UserStatsSummary {
  userId: string
  email?: string
  xpTotal: number
  level: number
  currentStreak: number
  bestStreak: number
  achievementsCount: number
  totalSessions: number
  lastActivityDate: string | null
  dataHealth: string
}

interface StatisticalAnalysis {
  mean: number
  median: number
  stdDev: number
  min: number
  max: number
  q1: number
  q3: number
  iqr: number
  outlierThreshold: {
    lower: number
    upper: number
  }
}

/**
 * Calculate statistical measures for a dataset
 */
function calculateStats(values: number[]): StatisticalAnalysis {
  if (values.length === 0) {
    return {
      mean: 0,
      median: 0,
      stdDev: 0,
      min: 0,
      max: 0,
      q1: 0,
      q3: 0,
      iqr: 0,
      outlierThreshold: { lower: 0, upper: 0 }
    }
  }

  const sorted = [...values].sort((a, b) => a - b)
  const n = sorted.length

  // Mean
  const mean = values.reduce((sum, val) => sum + val, 0) / n

  // Median
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)]

  // Standard Deviation
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n
  const stdDev = Math.sqrt(variance)

  // Quartiles
  const q1Index = Math.floor(n * 0.25)
  const q3Index = Math.floor(n * 0.75)
  const q1 = sorted[q1Index]
  const q3 = sorted[q3Index]
  const iqr = q3 - q1

  // Outlier thresholds (using IQR method)
  const outlierThreshold = {
    lower: q1 - 1.5 * iqr,
    upper: q3 + 1.5 * iqr
  }

  return {
    mean,
    median,
    stdDev,
    min: sorted[0],
    max: sorted[n - 1],
    q1,
    q3,
    iqr,
    outlierThreshold
  }
}

/**
 * Identify outliers in a dataset
 */
function findOutliers(users: UserStatsSummary[], field: keyof Pick<UserStatsSummary, 'xpTotal' | 'currentStreak' | 'bestStreak' | 'achievementsCount' | 'totalSessions'>): { userId: string; value: number; email?: string }[] {
  const values = users.map(u => u[field] as number)
  const stats = calculateStats(values)

  return users
    .filter(u => {
      const value = u[field] as number
      return value < stats.outlierThreshold.lower || value > stats.outlierThreshold.upper
    })
    .map(u => ({
      userId: u.userId,
      email: u.email,
      value: u[field] as number
    }))
    .sort((a, b) => b.value - a.value) // Sort by value descending
}

/**
 * GET /api/admin/stats-consistency
 * Analyze user statistics for outliers and inconsistencies
 */
export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate and check admin
    const session = await requireAuth()

    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const isAdmin = userData?.role === 'admin' || userData?.isAdmin === true

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // 2. Fetch all user stats
    const userStatsSnapshot = await adminDb.collection('user_stats').get()

    if (userStatsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No user stats found',
        totalUsers: 0,
        statistics: null,
        outliers: null
      })
    }

    // 3. Build user stats summary
    const usersSummary: UserStatsSummary[] = []

    for (const doc of userStatsSnapshot.docs) {
      const data = doc.data()

      // Get user email (optional, for easier identification)
      let email: string | undefined
      try {
        const userDoc = await adminDb.collection('users').doc(doc.id).get()
        email = userDoc.data()?.email
      } catch {
        // Email lookup failed, continue without it
      }

      usersSummary.push({
        userId: doc.id,
        email,
        xpTotal: data.xp?.total || 0,
        level: data.xp?.level || 1,
        currentStreak: data.streak?.current || 0,
        bestStreak: data.streak?.best || 0,
        achievementsCount: data.achievements?.unlockedCount || 0,
        totalSessions: data.sessions?.totalSessions || 0,
        lastActivityDate: data.dates?.lastActivityDate || null,
        dataHealth: data.metadata?.dataHealth || 'unknown'
      })
    }

    // 4. Calculate statistics for each metric
    const statistics = {
      xpTotal: calculateStats(usersSummary.map(u => u.xpTotal)),
      currentStreak: calculateStats(usersSummary.map(u => u.currentStreak)),
      bestStreak: calculateStats(usersSummary.map(u => u.bestStreak)),
      achievementsCount: calculateStats(usersSummary.map(u => u.achievementsCount)),
      totalSessions: calculateStats(usersSummary.map(u => u.totalSessions))
    }

    // 5. Find outliers for each metric
    const outliers = {
      xpTotal: findOutliers(usersSummary, 'xpTotal'),
      currentStreak: findOutliers(usersSummary, 'currentStreak'),
      bestStreak: findOutliers(usersSummary, 'bestStreak'),
      achievementsCount: findOutliers(usersSummary, 'achievementsCount'),
      totalSessions: findOutliers(usersSummary, 'totalSessions')
    }

    // 6. Find users with unhealthy data
    const unhealthyUsers = usersSummary
      .filter(u => u.dataHealth !== 'healthy' && u.dataHealth !== 'synced')
      .map(u => ({
        userId: u.userId,
        email: u.email,
        dataHealth: u.dataHealth
      }))

    // 7. Find users with suspicious patterns
    const suspiciousPatterns = usersSummary
      .filter(u => {
        // Very high XP but no sessions
        const hasHighXPNoSessions = u.xpTotal > 10000 && u.totalSessions === 0

        // High achievements but low XP
        const hasHighAchievementsLowXP = u.achievementsCount > 10 && u.xpTotal < 1000

        // Very high level but low sessions
        const hasHighLevelLowSessions = u.level > 20 && u.totalSessions < 10

        return hasHighXPNoSessions || hasHighAchievementsLowXP || hasHighLevelLowSessions
      })
      .map(u => ({
        userId: u.userId,
        email: u.email,
        xpTotal: u.xpTotal,
        level: u.level,
        achievementsCount: u.achievementsCount,
        totalSessions: u.totalSessions,
        reason:
          u.xpTotal > 10000 && u.totalSessions === 0 ? 'High XP, no sessions' :
          u.achievementsCount > 10 && u.xpTotal < 1000 ? 'High achievements, low XP' :
          'High level, low sessions'
      }))

    // 8. Summary metrics
    const summary = {
      totalUsers: usersSummary.length,
      healthyUsers: usersSummary.filter(u => u.dataHealth === 'healthy' || u.dataHealth === 'synced').length,
      unhealthyUsers: unhealthyUsers.length,
      suspiciousPatterns: suspiciousPatterns.length,
      totalOutliers: Object.values(outliers).reduce((sum, arr) => sum + arr.length, 0)
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      statistics,
      outliers,
      unhealthyUsers,
      suspiciousPatterns
    })

  } catch (error: any) {
    console.error('[Stats Consistency] Error:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: false,
      error: 'Failed to analyze stats consistency',
      details: error.message,
    }, { status: 500 })
  }
}
