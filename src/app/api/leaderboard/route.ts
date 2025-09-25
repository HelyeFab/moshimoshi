import { NextRequest, NextResponse } from 'next/server'
import { LeaderboardService } from '@/lib/leaderboard/LeaderboardService'
import { TimeFrame } from '@/lib/leaderboard/types'
import { getSession } from '@/lib/auth/session'
import logger from '@/lib/logger'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeframe = (searchParams.get('timeframe') || 'allTime') as TimeFrame
    const limit = parseInt(searchParams.get('limit') || '50', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)
    const useMockData = searchParams.get('mock') === 'true' // Allow fallback to mock data for testing

    logger.info('[API /leaderboard] Fetching leaderboard', { timeframe, limit, offset })

    // Get current user session to mark their entry
    const session = await getSession()
    const currentUserId = session?.uid

    // Initialize leaderboard service
    const leaderboardService = LeaderboardService.getInstance()

    try {
      // Get leaderboard from service
      const snapshot = await leaderboardService.getLeaderboard({
        timeframe,
        limit,
        offset
      })

      // Mark current user entry if they're in the list
      if (currentUserId) {
        snapshot.entries = snapshot.entries.map(entry => ({
          ...entry,
          isCurrentUser: entry.userId === currentUserId
        }))
      }

      // If no entries, always return mock data for better UX
      if (snapshot.entries.length === 0) {
        logger.info('[API /leaderboard] No real entries found, using mock data as fallback')
        const mockEntries = generateMockLeaderboard(timeframe, limit)
        return NextResponse.json(
          {
            success: true,
            entries: mockEntries,
            timeframe,
            totalPlayers: mockEntries.length,
            lastUpdated: new Date().toISOString(),
            isMockData: true,
            message: 'Using sample data - real rankings will appear when users start participating'
          },
          { status: 200 }
        )
      }

      return NextResponse.json(
        {
          success: true,
          entries: snapshot.entries,
          timeframe: snapshot.timeframe,
          totalPlayers: snapshot.totalPlayers,
          lastUpdated: new Date(snapshot.lastUpdated).toISOString(),
        },
        { status: 200 }
      )
    } catch (serviceError) {
      logger.error('[API /leaderboard] Service error, falling back to mock data', serviceError)

      // Always return mock data on error for better UX
      const mockEntries = generateMockLeaderboard(timeframe, limit)
      return NextResponse.json(
        {
          success: true,
          entries: mockEntries,
          timeframe,
          totalPlayers: 100,
          lastUpdated: new Date().toISOString(),
          isMockData: true,
          message: 'Using sample data while we fetch real rankings'
        },
        { status: 200 }
      )
    }
  } catch (error) {
    logger.error('[API /leaderboard] Outer error, returning mock data:', error)

    // Even on complete failure, return mock data for UX
    const mockEntries = generateMockLeaderboard('allTime', 50)
    return NextResponse.json(
      {
        success: true,
        entries: mockEntries,
        timeframe: 'allTime',
        totalPlayers: 100,
        lastUpdated: new Date().toISOString(),
        isMockData: true,
        message: 'Using sample data'
      },
      { status: 200 }
    )
  }
}

// Simple mock data generator as fallback
function generateMockLeaderboard(timeframe: string, limit: number) {
  const names = [
    'Sakura Master', 'Kanji Warrior', 'Hiragana Hero', 'JLPT Champion',
    'Study Samurai', 'Learning Ninja', 'Grammar Guru', 'Vocabulary Victor'
  ]

  const entries = []
  const basePoints = timeframe === 'daily' ? 500 : timeframe === 'weekly' ? 2000 : timeframe === 'monthly' ? 8000 : 15000

  for (let i = 0; i < Math.min(limit, names.length); i++) {
    entries.push({
      rank: i + 1,
      userId: `mock-user-${i + 1}`,
      displayName: names[i],
      totalPoints: Math.floor(basePoints * Math.pow(0.85, i) + Math.random() * 500),
      totalXP: Math.floor(1000 + Math.random() * 5000),
      currentLevel: Math.floor(10 + Math.random() * 15),
      achievementCount: Math.floor(20 + Math.random() * 30),
      currentStreak: Math.floor(Math.random() * 100),
      bestStreak: Math.floor(Math.random() * 150),
      achievementRarity: {
        legendary: Math.floor(Math.random() * 2),
        epic: Math.floor(Math.random() * 5),
        rare: Math.floor(Math.random() * 10),
        uncommon: Math.floor(Math.random() * 15),
        common: Math.floor(Math.random() * 20),
      },
      lastActive: Date.now() - Math.floor(Math.random() * 86400000),
      isPublic: true
    })
  }

  return entries
}