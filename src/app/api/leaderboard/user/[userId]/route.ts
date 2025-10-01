import { NextRequest, NextResponse } from 'next/server'
import { LeaderboardService } from '@/lib/leaderboard/LeaderboardService'
import { TimeFrame } from '@/lib/leaderboard/types'
import { getSession } from '@/lib/auth/session'
import logger from '@/lib/logger'
import { userStatsService } from '@/lib/services/UserStatsService'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    const searchParams = request.nextUrl.searchParams
    const timeframe = (searchParams.get('timeframe') || 'allTime') as TimeFrame
    const useMockData = searchParams.get('mock') === 'true'

    logger.info('[API /leaderboard/user] Fetching user stats', { userId, timeframe })

    // Verify user has permission to view this data
    const session = await getSession()
    const currentUserId = session?.uid

    // Users can only view their own detailed stats
    // In the future, we might allow viewing friends or public profiles
    if (userId !== currentUserId && !searchParams.get('public')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Cannot view other users\' leaderboard data',
          },
        },
        { status: 403 }
      )
    }

    try {
      // CRITICAL: Get stats from user_stats (SINGLE SOURCE OF TRUTH)
      const userStats = await userStatsService.getUserStats(userId)

      if (!userStats) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found',
            },
          },
          { status: 404 }
        )
      }

      // Initialize leaderboard service to get rank
      const leaderboardService = LeaderboardService.getInstance()
      const snapshot = await leaderboardService.getLeaderboard({ timeframe })
      const userEntry = snapshot.entries.find(e => e.userId === userId)

      // Build response from user_stats (source of truth)
      return NextResponse.json(
        {
          success: true,
          entry: userEntry || {
            rank: 0, // Rank not yet calculated
            userId,
            displayName: userStats.displayName || 'You',
            totalPoints: userStats.achievements.totalPoints,
            achievementCount: userStats.achievements.unlockedCount,
            currentLevel: userStats.xp.level,
            totalXP: userStats.xp.total,
            currentStreak: userStats.streak.current, // FROM user_stats (SOURCE OF TRUTH)
            bestStreak: userStats.streak.best,       // FROM user_stats (SOURCE OF TRUTH)
            achievementRarity: {
              legendary: 0,
              epic: 0,
              rare: 0,
              uncommon: 0,
              common: 0,
            },
            isCurrentUser: true,
            lastActive: Date.now(),
            isPublic: false
          },
          stats: {
            globalRank: userEntry?.rank || 0,
            totalPoints: userStats.achievements.totalPoints,
            currentStreak: userStats.streak.current,
            bestStreak: userStats.streak.best
          },
          timeframe,
        },
        { status: 200 }
      )
    } catch (serviceError) {
      logger.error('[API /leaderboard/user] Service error', serviceError)

      // Fallback to mock data if requested
      if (useMockData) {
        const mockUserEntry = {
          rank: Math.floor(Math.random() * 100) + 50,
          userId,
          displayName: 'Current User',
          totalPoints: Math.floor(Math.random() * 5000) + 1000,
          achievementCount: Math.floor(Math.random() * 20) + 5,
          currentLevel: Math.floor(Math.random() * 10) + 5,
          totalXP: Math.floor(Math.random() * 3000) + 500,
          currentStreak: Math.floor(Math.random() * 30),
          bestStreak: Math.floor(Math.random() * 50),
          achievementRarity: {
            legendary: 0,
            epic: Math.floor(Math.random() * 3),
            rare: Math.floor(Math.random() * 5),
            uncommon: Math.floor(Math.random() * 8),
            common: Math.floor(Math.random() * 10),
          },
          isCurrentUser: true,
          lastActive: Date.now(),
          isPublic: false
        }

        return NextResponse.json(
          {
            success: true,
            entry: mockUserEntry,
            timeframe,
            isMockData: true
          },
          { status: 200 }
        )
      }

      throw serviceError
    }
  } catch (error) {
    logger.error('[API /leaderboard/user] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'USER_LEADERBOARD_ERROR',
          message: 'Failed to fetch user leaderboard data',
        },
      },
      { status: 500 }
    )
  }
}