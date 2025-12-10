import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'

/**
 * GET /api/reading-stats
 *
 * Returns reading statistics for articles, stories, and books
 * Aggregates data from:
 * - user_stats.news (articles)
 * - storyProgress collection (stories)
 * - bookProgress collection (books)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    const userId = session?.uid

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 })
    }

    // Fetch all stats in parallel
    const [userStatsDoc, storyProgressSnapshot, bookProgressSnapshot] = await Promise.all([
      // Get user_stats for articles
      adminDb.collection('user_stats').doc(userId).get(),
      // Get completed stories
      adminDb
        .collection('storyProgress')
        .where('userId', '==', userId)
        .where('completed', '==', true)
        .get(),
      // Get completed books
      adminDb
        .collection('bookProgress')
        .where('userId', '==', userId)
        .where('completed', '==', true)
        .get()
    ])

    // Extract article stats from user_stats
    const userStats = userStatsDoc.data()
    const articlesRead = userStats?.news?.articlesRead ?? 0
    const articlesReadingTimeMs = userStats?.news?.totalReadingTimeMs ?? 0

    // Count completed stories and sum reading time
    let storiesCompleted = 0
    let storiesReadingTimeSec = 0
    storyProgressSnapshot.forEach((doc) => {
      storiesCompleted++
      const data = doc.data()
      storiesReadingTimeSec += data.timeSpent ?? 0
    })

    // Count completed books and sum reading time
    let booksCompleted = 0
    let booksReadingTimeSec = 0
    bookProgressSnapshot.forEach((doc) => {
      booksCompleted++
      const data = doc.data()
      booksReadingTimeSec += data.timeSpentSec ?? 0
    })

    return NextResponse.json({
      success: true,
      stats: {
        articles: {
          count: articlesRead,
          readingTimeMs: articlesReadingTimeMs
        },
        stories: {
          count: storiesCompleted,
          readingTimeSec: storiesReadingTimeSec
        },
        books: {
          count: booksCompleted,
          readingTimeSec: booksReadingTimeSec
        }
      }
    })
  } catch (error: any) {
    console.error('[Reading Stats] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to load reading stats',
        details: error.message,
        success: false
      },
      { status: 500 }
    )
  }
}
