/**
 * Dismiss Announcement API
 *
 * POST - Marks an announcement as dismissed for the user
 *
 * Supports both authenticated users (via session) and guests (via visitorId in body)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'

const dismissSchema = z.object({
  announcementId: z.string().min(1, 'Announcement ID is required'),
  visitorId: z.string().optional(),
})

/**
 * POST - Mark an announcement as dismissed
 *
 * Body:
 * - announcementId: The announcement to dismiss (required)
 * - visitorId: For guest users (optional if authenticated)
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    // Parse and validate request body
    const body = await request.json()
    let validatedData
    try {
      validatedData = dismissSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: error.issues[0]?.message || 'Invalid request data',
            },
          },
          { status: 400 }
        )
      }
      throw error
    }

    // Try to get authenticated user session
    const session = await getSession()

    // Determine visitor identity
    let visitorType: 'user' | 'guest'
    let visitorValue: string

    if (session?.uid) {
      visitorType = 'user'
      visitorValue = session.uid
    } else if (validatedData.visitorId) {
      visitorType = 'guest'
      visitorValue = validatedData.visitorId
    } else {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Either authentication or visitorId is required',
          },
        },
        { status: 400 }
      )
    }

    // Verify the announcement exists
    const announcementDoc = await adminFirestore
      .collection('announcements')
      .doc(validatedData.announcementId)
      .get()

    if (!announcementDoc.exists) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'Announcement not found',
          },
        },
        { status: 404 }
      )
    }

    // Create dismissal record
    const dismissalId = `${visitorValue}_${validatedData.announcementId}`
    await adminFirestore.collection('announcement_dismissals').doc(dismissalId).set({
      visitorId: dismissalId,
      visitorType,
      visitorValue,
      announcementId: validatedData.announcementId,
      dismissedAt: Timestamp.now(),
    })

    console.log(
      `[API /announcements/dismiss] Announcement ${validatedData.announcementId} dismissed by ${visitorType}:${visitorValue}`
    )

    return NextResponse.json({
      success: true,
      message: 'Announcement dismissed',
    })
  } catch (error: any) {
    console.error('[API /announcements/dismiss] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to dismiss announcement',
        },
      },
      { status: 500 }
    )
  }
}
