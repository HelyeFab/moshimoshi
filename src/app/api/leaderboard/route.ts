import { NextRequest, NextResponse } from 'next/server'

// Mock leaderboard data generator
function generateMockLeaderboard(timeframe: string, limit: number) {
  const names = [
    'Sakura Master', 'Kanji Warrior', 'Hiragana Hero', 'JLPT Champion',
    'Study Samurai', 'Learning Ninja', 'Grammar Guru', 'Vocabulary Victor',
    'Reading Ronin', 'Writing Wizard', 'Speaking Sensei', 'Listening Legend'
  ]

  const entries = []
  const basePoints = timeframe === 'daily' ? 500 : timeframe === 'weekly' ? 2000 : timeframe === 'monthly' ? 8000 : 15000

  for (let i = 0; i < Math.min(limit, names.length); i++) {
    entries.push({
      rank: i + 1,
      userId: `user-${i + 1}`,
      displayName: names[i],
      totalPoints: Math.floor(basePoints * Math.pow(0.85, i) + Math.random() * 500),
      achievementCount: Math.floor(20 + Math.random() * 30),
      level: Math.floor(10 + Math.random() * 15),
      xp: Math.floor(1000 + Math.random() * 5000),
      streak: Math.floor(Math.random() * 100),
      rarityBreakdown: {
        legendary: Math.floor(Math.random() * 2),
        epic: Math.floor(Math.random() * 5),
        rare: Math.floor(Math.random() * 10),
        uncommon: Math.floor(Math.random() * 15),
        common: Math.floor(Math.random() * 20),
      }
    })
  }

  return entries
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const timeframe = searchParams.get('timeframe') || 'allTime'
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    // Generate mock leaderboard data
    const entries = generateMockLeaderboard(timeframe, limit)

    return NextResponse.json(
      {
        success: true,
        entries,
        timeframe,
        totalPlayers: 1234, // Mock total
        lastUpdated: new Date().toISOString(),
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Leaderboard error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'LEADERBOARD_ERROR',
          message: 'Failed to fetch leaderboard data',
        },
      },
      { status: 500 }
    )
  }
}