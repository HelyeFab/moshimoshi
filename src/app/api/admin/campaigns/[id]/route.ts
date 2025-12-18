/**
 * Admin Campaign Management API
 *
 * DELETE - Delete a campaign (draft only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'

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
