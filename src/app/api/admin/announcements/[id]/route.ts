/**
 * Admin Announcement Management API
 *
 * GET - Get a single announcement
 * PUT - Update an announcement
 * DELETE - Delete an announcement (draft only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'

// Validation schema for announcement updates
const updateAnnouncementSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200).optional(),
  content: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal('')),
  featureId: z.string().min(1, 'Feature ID is required').max(100).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
})

/**
 * GET - Get a single announcement
 */
export const GET = withAdminAuth(
  async (request: NextRequest, context: AdminContext) => {
    try {
      ensureAdminInitialized()

      if (!adminFirestore) {
        throw new Error('Firebase Admin not initialized')
      }

      const announcementId = context.params?.id

      if (!announcementId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'Announcement ID is required',
            },
          },
          { status: 400 }
        )
      }

      const announcementRef = adminFirestore.collection('announcements').doc(announcementId)
      const announcementSnap = await announcementRef.get()

      if (!announcementSnap.exists) {
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

      const data = announcementSnap.data()

      return NextResponse.json({
        success: true,
        announcement: {
          id: announcementSnap.id,
          ...data,
          createdAt: data?.createdAt?.toDate?.()?.toISOString() || null,
          publishedAt: data?.publishedAt?.toDate?.()?.toISOString() || null,
          updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || null,
        },
      })
    } catch (error: any) {
      console.error('[API /admin/announcements/get] Error:', error)
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
)

/**
 * PUT - Update an announcement
 *
 * Handles status transitions:
 * - draft -> published: Sets publishedAt timestamp
 * - published -> archived: Keeps publishedAt
 * - Any status can be edited (unlike campaigns)
 */
export const PUT = withAdminAuth(
  async (request: NextRequest, context: AdminContext) => {
    try {
      ensureAdminInitialized()

      if (!adminFirestore) {
        throw new Error('Firebase Admin not initialized')
      }

      const announcementId = context.params?.id

      if (!announcementId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'Announcement ID is required',
            },
          },
          { status: 400 }
        )
      }

      // Fetch announcement to verify it exists
      const announcementRef = adminFirestore.collection('announcements').doc(announcementId)
      const announcementSnap = await announcementRef.get()

      if (!announcementSnap.exists) {
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

      const currentData = announcementSnap.data()

      // Parse and validate request body
      const body = await request.json()
      let validatedData
      try {
        validatedData = updateAnnouncementSchema.parse(body)
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

      // Build update object
      const updateData: Record<string, any> = {
        updatedAt: Timestamp.now(),
        updatedBy: context.user.uid,
      }

      if (validatedData.title !== undefined) updateData.title = validatedData.title
      if (validatedData.content !== undefined) updateData.content = validatedData.content
      if (validatedData.imageUrl !== undefined) updateData.imageUrl = validatedData.imageUrl
      if (validatedData.featureId !== undefined) updateData.featureId = validatedData.featureId

      // Handle status transitions
      if (validatedData.status !== undefined) {
        updateData.status = validatedData.status

        // If transitioning to published and not already published, set publishedAt
        if (validatedData.status === 'published' && currentData?.status !== 'published') {
          updateData.publishedAt = Timestamp.now()
        }
      }

      // Update the announcement
      await announcementRef.update(updateData)

      console.log(
        `[API /admin/announcements/${announcementId}] Announcement updated by ${context.user.email}`
      )

      return NextResponse.json({
        success: true,
        message: 'Announcement updated successfully',
      })
    } catch (error: any) {
      console.error('[API /admin/announcements/update] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error.message || 'Failed to update announcement',
          },
        },
        { status: 500 }
      )
    }
  }
)

/**
 * DELETE - Delete an announcement
 *
 * Only draft announcements can be deleted. Published/archived announcements
 * should be archived instead.
 */
export const DELETE = withAdminAuth(
  async (request: NextRequest, context: AdminContext) => {
    try {
      ensureAdminInitialized()

      if (!adminFirestore) {
        throw new Error('Firebase Admin not initialized')
      }

      const announcementId = context.params?.id

      if (!announcementId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'Announcement ID is required',
            },
          },
          { status: 400 }
        )
      }

      // Fetch announcement to verify it exists and check status
      const announcementRef = adminFirestore.collection('announcements').doc(announcementId)
      const announcementSnap = await announcementRef.get()

      if (!announcementSnap.exists) {
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

      const announcement = announcementSnap.data()

      // Only allow deleting draft announcements
      if (announcement?.status !== 'draft') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: `Cannot delete announcement with status '${announcement?.status}'. Only draft announcements can be deleted. Archive published announcements instead.`,
            },
          },
          { status: 400 }
        )
      }

      // Delete the announcement
      await announcementRef.delete()

      console.log(
        `[API /admin/announcements/${announcementId}] Announcement deleted by ${context.user.email}`
      )

      return NextResponse.json({
        success: true,
        message: 'Announcement deleted successfully',
      })
    } catch (error: any) {
      console.error('[API /admin/announcements/delete] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error.message || 'Failed to delete announcement',
          },
        },
        { status: 500 }
      )
    }
  }
)
