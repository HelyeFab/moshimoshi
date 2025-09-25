import { NextRequest, NextResponse } from 'next/server'
import { LeaderboardService } from '@/lib/leaderboard/LeaderboardService'
import { TimeFrame } from '@/lib/leaderboard/types'
import { getSession } from '@/lib/auth/session'
import logger from '@/lib/logger'

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

    // Initialize leaderboard service
    const leaderboardService = LeaderboardService.getInstance()

    try {
      // Get user's leaderboard stats
      const userStats = await leaderboardService.getUserStats(userId, timeframe)

      if (!userStats) {
        // User not found or hasn't opted into leaderboard
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'USER_NOT_FOUND',
              message: 'User not found in leaderboard',
            },
          },
          { status: 404 }
        )
      }

      // Also get the user's actual entry data if they're in top entries
      const snapshot = await leaderboardService.getLeaderboard({ timeframe })
      const userEntry = snapshot.entries.find(e => e.userId === userId)

      return NextResponse.json(
        {
          success: true,
          entry: userEntry || {
            rank: userStats.globalRank,
            userId,
            displayName: 'You',
            totalPoints: 0, // Would need to fetch from user data
            achievementCount: 0,
            currentLevel: 1,
            totalXP: 0,
            currentStreak: 0,
            bestStreak: 0,
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
          stats: userStats,
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