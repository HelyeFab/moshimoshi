/**
 * Admin Campaign Management API
 *
 * GET - Get a single campaign
 * PUT - Update a campaign (draft only)
 * DELETE - Delete a campaign (draft only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'

// Validation schema for campaign updates
const updateCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100).optional(),
  template: z.enum(['waitlist', 'welcome', 'password_reset', 'custom']).optional(),
  subject: z.string().min(1, 'Subject is required').max(200).optional(),
  templateId: z.string().optional(),
  templateVariables: z.record(z.string(), z.string()).optional(),
  testEmail: z.string().email().optional().or(z.literal('')),
  segment: z.object({
    type: z.enum(['all', 'free', 'premium_monthly', 'premium_yearly', 'custom_emails']),
    respectMarketingPrefs: z.boolean(),
    emailVerifiedOnly: z.boolean(),
    customEmails: z.array(z.string().email()).optional(),
  }).optional(),
})

/**
 * GET - Get a single campaign
 */
export const GET = withAdminAuth(
  async (request: NextRequest, context: AdminContext) => {
    try {
      ensureAdminInitialized()

      if (!adminFirestore) {
        throw new Error('Firebase Admin not initialized')
      }

      const campaignId = context.params?.id

      if (!campaignId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'Campaign ID is required',
            },
          },
          { status: 400 }
        )
      }

      const campaignRef = adminFirestore.collection('email_campaigns').doc(campaignId)
      const campaignSnap = await campaignRef.get()

      if (!campaignSnap.exists) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Campaign not found',
            },
          },
          { status: 404 }
        )
      }

      const data = campaignSnap.data()

      return NextResponse.json({
        success: true,
        campaign: {
          id: campaignSnap.id,
          ...data,
          createdAt: data?.createdAt?.toDate?.()?.toISOString() || null,
          sentAt: data?.sentAt?.toDate?.()?.toISOString() || null,
        },
      })
    } catch (error: any) {
      console.error('[API /admin/campaigns/get] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error.message || 'Failed to fetch campaign',
          },
        },
        { status: 500 }
      )
    }
  }
)

/**
 * PUT - Update a campaign (draft only)
 */
export const PUT = withAdminAuth(
  async (request: NextRequest, context: AdminContext) => {
    try {
      ensureAdminInitialized()

      if (!adminFirestore) {
        throw new Error('Firebase Admin not initialized')
      }

      const campaignId = context.params?.id

      if (!campaignId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'Campaign ID is required',
            },
          },
          { status: 400 }
        )
      }

      // Fetch campaign to verify it exists and check status
      const campaignRef = adminFirestore.collection('email_campaigns').doc(campaignId)
      const campaignSnap = await campaignRef.get()

      if (!campaignSnap.exists) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Campaign not found',
            },
          },
          { status: 404 }
        )
      }

      const campaign = campaignSnap.data()

      // Only allow editing draft campaigns
      if (campaign?.status !== 'draft') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: `Cannot edit campaign with status '${campaign?.status}'. Only draft campaigns can be edited.`,
            },
          },
          { status: 400 }
        )
      }

      // Parse and validate request body
      const body = await request.json()
      let validatedData
      try {
        validatedData = updateCampaignSchema.parse(body)
      } catch (error) {
        if (error instanceof z.ZodError) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: error.issues[0]?.message || 'Invalid campaign data',
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

      if (validatedData.name !== undefined) updateData.name = validatedData.name
      if (validatedData.template !== undefined) updateData.template = validatedData.template
      if (validatedData.subject !== undefined) updateData.subject = validatedData.subject
      if (validatedData.segment !== undefined) updateData.segment = validatedData.segment
      if (validatedData.templateId !== undefined) updateData.templateId = validatedData.templateId
      if (validatedData.templateVariables !== undefined) updateData.templateVariables = validatedData.templateVariables
      if (validatedData.testEmail !== undefined) updateData.testEmail = validatedData.testEmail

      // Update the campaign
      await campaignRef.update(updateData)

      console.log(
        `[API /admin/campaigns/${campaignId}] Campaign updated by ${context.user.email}`
      )

      return NextResponse.json({
        success: true,
        message: 'Campaign updated successfully',
      })
    } catch (error: any) {
      console.error('[API /admin/campaigns/update] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error.message || 'Failed to update campaign',
          },
        },
        { status: 500 }
      )
    }
  }
)

/**
 * DELETE - Delete a campaign
 *
 * Only draft campaigns can be deleted. Attempting to delete a sent/sending campaign
 * will result in an error.
 */
export const DELETE = withAdminAuth(
  async (request: NextRequest, context: AdminContext) => {
    try {
      ensureAdminInitialized()

      if (!adminFirestore) {
        throw new Error('Firebase Admin not initialized')
      }

      const campaignId = context.params?.id

      if (!campaignId) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_REQUEST',
              message: 'Campaign ID is required',
            },
          },
          { status: 400 }
        )
      }

      // Fetch campaign to verify it exists and check status
      const campaignRef = adminFirestore.collection('email_campaigns').doc(campaignId)
      const campaignSnap = await campaignRef.get()

      if (!campaignSnap.exists) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Campaign not found',
            },
          },
          { status: 404 }
        )
      }

      const campaign = campaignSnap.data()

      // Only allow deleting draft campaigns
      if (campaign?.status !== 'draft') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: `Cannot delete campaign with status '${campaign?.status}'. Only draft campaigns can be deleted.`,
            },
          },
          { status: 400 }
        )
      }

      // Delete the campaign
      await campaignRef.delete()

      console.log(
        `[API /admin/campaigns/${campaignId}] Campaign deleted by ${context.user.email}`
      )

      return NextResponse.json({
        success: true,
        message: 'Campaign deleted successfully',
      })
    } catch (error: any) {
      console.error('[API /admin/campaigns/delete] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error.message || 'Failed to delete campaign',
          },
        },
        { status: 500 }
      )
    }
  }
)
