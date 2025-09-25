import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'

/**
 * GET /api/review/user-sessions
 * Fetch review sessions and history from Firebase for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)

    // Fetch sessions from user's sessions subcollection
    const sessionsSnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('sessions')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    // Fetch review history
    const reviewHistorySnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('review_history')
      .orderBy('reviewedAt', 'desc')
      .limit(limit * 5) // More review history items
      .get()

    // Transform sessions data
    const sessions = sessionsSnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        date: data.createdAt?.toDate?.() || new Date(data.createdAt),
        duration: data.duration || 0,
        itemsReviewed: data.itemsReviewed || data.totalItems || 0,
        accuracy: data.accuracy || 0,
        averageResponseTime: data.averageResponseTime || 0,
        mode: data.mode || 'recognition',
        status: data.status || 'completed',
        contentType: data.contentType,
        completedAt: data.completedAt?.toDate?.() || data.completedAt,
        score: data.score || 0
      }
    })

    // Transform review history into activity items
    const reviewHistory = reviewHistorySnapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        itemId: data.itemId,
        contentType: data.contentType,
        reviewedAt: data.reviewedAt?.toDate?.() || new Date(data.reviewedAt),
        correct: data.correct,
        responseTime: data.responseTime,
        difficulty: data.difficulty,
        sessionId: data.sessionId
      }
    })

    // Generate activity summary from review history (group by date)
    const activityByDate = new Map<string, number>()
    reviewHistory.forEach(item => {
      const dateStr = new Date(item.reviewedAt).toISOString().split('T')[0]
      activityByDate.set(dateStr, (activityByDate.get(dateStr) || 0) + 1)
    })

    // Convert to heatmap data format
    const heatmapData = Array.from(activityByDate.entries()).map(([date, count]) => ({
      date,
      count
    }))

    // Calculate stats
    const totalReviews = reviewHistory.length
    const correctReviews = reviewHistory.filter(r => r.correct).length
    const overallAccuracy = totalReviews > 0 ? (correctReviews / totalReviews) : 0

    return NextResponse.json({
      success: true,
      data: {
        sessions,
        reviewHistory,
        heatmapData,
        stats: {
          totalSessions: sessions.length,
          totalReviews,
          overallAccuracy,
          averageSessionDuration: sessions.reduce((acc, s) => acc + s.duration, 0) / Math.max(sessions.length, 1)
        }
      }
    })
  } catch (error: any) {
    console.error('Error fetching user sessions:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch sessions' } },
      { status: 500 }
    )
  }
}