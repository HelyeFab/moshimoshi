import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = params
    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get('timeframe') || 'allTime'

    // Mock user data - in production this would fetch from database
    const mockUserEntry = {
      rank: Math.floor(Math.random() * 100) + 50, // Random rank between 50-150
      userId,
      displayName: 'Current User',
      totalPoints: Math.floor(Math.random() * 5000) + 1000,
      achievementCount: Math.floor(Math.random() * 20) + 5,
      level: Math.floor(Math.random() * 10) + 5,
      xp: Math.floor(Math.random() * 3000) + 500,
      streak: Math.floor(Math.random() * 30),
      rarityBreakdown: {
        legendary: 0,
        epic: Math.floor(Math.random() * 3),
        rare: Math.floor(Math.random() * 5),
        uncommon: Math.floor(Math.random() * 8),
        common: Math.floor(Math.random() * 10),
      }
    }

    return NextResponse.json(
      {
        success: true,
        entry: mockUserEntry,
        timeframe,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('User leaderboard error:', error)
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