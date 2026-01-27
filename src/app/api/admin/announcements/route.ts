/**
 * Admin Announcements API
 *
 * POST - Create new announcement draft
 * GET - List all announcements
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'

// Validation schema
const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  content: z.string().min(1, 'Content is required'),
  imageUrl: z.string().url().optional().or(z.literal('')),
  featureId: z.string().min(1, 'Feature ID is required').max(100),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

/**
 * POST - Create new announcement draft
 */
export const POST = withAdminAuth(
  async (request: NextRequest, context: AdminContext) => {
    try {
      ensureAdminInitialized()

      if (!adminFirestore) {
        throw new Error('Firebase Admin not initialized')
      }

      const body = await request.json()

      // Validate input
      let validatedData
      try {
        validatedData = announcementSchema.parse(body)
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: error.issues[0]?.message || 'Invalid announcement data',
                issues: error.issues,
              },
            },
            { status: 400 }
          )
        }
        throw error
      }

      // Create announcement document
      const announcementDoc: Record<string, any> = {
        title: validatedData.title,
        content: validatedData.content,
        imageUrl: validatedData.imageUrl || '',
        featureId: validatedData.featureId,
        status: validatedData.status || 'draft',
        publishedAt: null,
        createdBy: context.user.uid,
        createdAt: Timestamp.now(),
      }

      // If creating as published, set publishedAt
      if (validatedData.status === 'published') {
        announcementDoc.publishedAt = Timestamp.now()
      }

      const announcementRef = await adminFirestore.collection('announcements').add(announcementDoc)

      console.log(
        `[API /admin/announcements] Announcement created: ${announcementRef.id} by ${context.user.email}`
      )

      return NextResponse.json({
        success: true,
        announcementId: announcementRef.id,
        message: 'Announcement created successfully',
      })
    } catch (error: any) {
      console.error('[API /admin/announcements] POST Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error.message || 'Failed to create announcement',
          },
        },
        { status: 500 }
      )
    }
  }
)

/**
 * GET - List all announcements
 */
export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    // Fetch all announcements ordered by creation date (newest first)
    const snapshot = await adminFirestore
      .collection('announcements')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()

    const announcements = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Timestamps to ISO strings for JSON serialization
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      publishedAt: doc.data().publishedAt?.toDate?.()?.toISOString() || null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
    }))

    return NextResponse.json({
      success: true,
      announcements,
      count: announcements.length,
    })
  } catch (error: any) {
    console.error('[API /admin/announcements] GET Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to fetch announcements',
        },
      },
      { status: 500 }
    )
  }
})
