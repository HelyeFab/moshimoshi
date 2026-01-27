/**
 * Active Announcement API
 *
 * GET - Returns the most recent published announcement that the user hasn't dismissed
 *
 * Supports both authenticated users (via session) and guests (via visitorId query param)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'

/**
 * GET - Get the most recent published announcement for the user
 *
 * Query params:
 * - visitorId: Required for guests, optional for authenticated users
 */
export async function GET(request: NextRequest) {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    // Try to get authenticated user session
    const session = await getSession()
    const visitorId = request.nextUrl.searchParams.get('visitorId')

    // Determine visitor identity
    let visitorType: 'user' | 'guest'
    let visitorValue: string

    if (session?.uid) {
      visitorType = 'user'
      visitorValue = session.uid
    } else if (visitorId) {
      visitorType = 'guest'
      visitorValue = visitorId
    } else {
      // No session and no visitorId - cannot track dismissals
      // Still return the announcement, client will handle tracking
      visitorType = 'guest'
      visitorValue = ''
    }

    // Get the most recent published announcement
    const announcementsSnapshot = await adminFirestore
      .collection('announcements')
      .where('status', '==', 'published')
      .orderBy('publishedAt', 'desc')
      .limit(1)
      .get()

    if (announcementsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        announcement: null,
      })
    }

    const announcementDoc = announcementsSnapshot.docs[0]
    const announcementId = announcementDoc.id
    const announcementData = announcementDoc.data()

    // Check if user has already dismissed this announcement
    if (visitorValue) {
      const dismissalId = `${visitorValue}_${announcementId}`
      const dismissalDoc = await adminFirestore
        .collection('announcement_dismissals')
        .doc(dismissalId)
        .get()

      if (dismissalDoc.exists) {
        // User has dismissed this announcement
        return NextResponse.json({
          success: true,
          announcement: null,
        })
      }
    }

    // Return the announcement
    return NextResponse.json({
      success: true,
      announcement: {
        id: announcementId,
        title: announcementData.title,
        content: announcementData.content || '',
        description: announcementData.description || '', // backward compatibility
        imageUrl: announcementData.imageUrl || '',
        featureId: announcementData.featureId,
        publishedAt: announcementData.publishedAt?.toDate?.()?.toISOString() || null,
      },
    })
  } catch (error: any) {
    console.error('[API /announcements/active] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to fetch announcement',
        },
      },
      { status: 500 }
    )
  }
}
