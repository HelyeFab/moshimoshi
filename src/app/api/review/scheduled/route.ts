import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { IndexedDBStorage } from '@/lib/review-engine/offline/indexed-db'

export async function GET(request: NextRequest) {
  try {
    // Get the authenticated user from session
    const session = await getSession()

    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get fresh user data from Firestore
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()
    const plan = userData?.subscription?.plan || 'free'
    const isPremium = plan.startsWith('premium')

    const scheduledItems: any[] = []
    const now = new Date()
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(23, 59, 59, 999)
    const nextWeek = new Date()
    nextWeek.setDate(nextWeek.getDate() + 7)

    if (isPremium) {
      // Fetch from the dedicated srs_data collection
      const srsSnapshot = await adminDb
        .collection('users')
        .doc(session.uid)
        .collection('srs_data')
        .where('nextReviewAt', '!=', null)
        .get()

      srsSnapshot.forEach(doc => {
        const data = doc.data()

        // Handle both Firebase Timestamp and Date string formats
        let nextReviewAt: Date
        if (data.nextReviewAt?.toDate) {
          nextReviewAt = data.nextReviewAt.toDate()
        } else if (data.nextReviewAt) {
          nextReviewAt = new Date(data.nextReviewAt)
        } else {
          return // Skip if no nextReviewAt
        }

        const dueIn = Math.floor((nextReviewAt.getTime() - now.getTime()) / (1000 * 60 * 60)) // hours

        scheduledItems.push({
          id: doc.id,
          type: data.contentType || 'unknown',
          content: data.character || doc.id, // Use actual character if available, fallback to ID
          meaning: data.romaji || '', // Use romaji as meaning if available
          nextReviewAt: nextReviewAt.toISOString(),
          dueIn,
          interval: data.interval || 0,
          easeFactor: data.easeFactor || 2.5,
          status: data.status || 'learning',
          reviewCount: data.reviewCount || 0,
          correctCount: data.correctCount || 0,
          streak: data.streak || 0,
          difficulty: 0.3,
          // Categorize by due time
          category: dueIn <= 0 ? 'overdue' :
                   nextReviewAt <= endOfToday ? 'today' :
                   nextReviewAt <= tomorrow ? 'tomorrow' :
                   nextReviewAt <= nextWeek ? 'thisWeek' : 'later'
        })
      })
    } else {
      // For free users, we would need to fetch from IndexedDB on the client
      // This endpoint returns empty for free users, client should handle IndexedDB
      return NextResponse.json({
        success: true,
        items: [],
        stats: {
          overdue: 0,
          dueToday: 0,
          dueTomorrow: 0,
          dueThisWeek: 0,
          total: 0
        },
        message: 'Client-side storage for free users'
      })
    }

    // Sort by nextReviewAt
    scheduledItems.sort((a, b) =>
      new Date(a.nextReviewAt).getTime() - new Date(b.nextReviewAt).getTime()
    )

    // Calculate statistics
    const stats = {
      overdue: scheduledItems.filter(item => item.category === 'overdue').length,
      dueToday: scheduledItems.filter(item => item.category === 'today').length,
      dueTomorrow: scheduledItems.filter(item => item.category === 'tomorrow').length,
      dueThisWeek: scheduledItems.filter(item => item.category === 'thisWeek').length,
      total: scheduledItems.length
    }

    console.log(`[Scheduled Reviews API] Found ${scheduledItems.length} scheduled items for user ${session.uid}`)

    return NextResponse.json({
      success: true,
      items: scheduledItems,
      stats
    })

  } catch (error) {
    console.error('[Scheduled Reviews API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scheduled reviews' },
      { status: 500 }
    )
  }
}