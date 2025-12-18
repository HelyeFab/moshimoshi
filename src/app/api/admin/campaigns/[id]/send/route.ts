/**
 * Admin Campaign Send API
 *
 * POST - Send campaign to all recipients
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { CampaignService } from '@/lib/email/campaigns/service'

/**
 * POST - Send campaign
 *
 * Initiates sending of a campaign. For campaigns with many recipients,
 * this returns immediately and the sending continues in the background.
 * The campaign status is updated in Firestore as progress is made.
 */
export const POST = withAdminAuth(
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

      // Verify campaign exists
      const campaignSnap = await adminFirestore
        .collection('email_campaigns')
        .doc(campaignId)
        .get()

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

      // Check if campaign is already sending or sent
      if (campaign?.status === 'sending') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ALREADY_SENDING',
              message: 'Campaign is already being sent',
            },
          },
          { status: 400 }
        )
      }

      if (campaign?.status === 'sent') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ALREADY_SENT',
              message: 'Campaign has already been sent',
            },
          },
          { status: 400 }
        )
      }

      console.log(
        `[API /admin/campaigns/${campaignId}/send] Initiating send by ${context.user.email}`
      )

      // Initiate campaign send
      // For campaigns with many recipients, this needs to handle serverless timeout
      const campaignService = new CampaignService()

      // Send in background - don't wait for completion
      // The service will update Firestore status as it progresses
      campaignService.sendCampaign(campaignId).catch((err) => {
        console.error(`[API /admin/campaigns/${campaignId}/send] Send failed:`, err)
        // Update campaign status to 'failed'
        adminFirestore?.collection('email_campaigns').doc(campaignId).update({
          status: 'failed',
        })
      })

      return NextResponse.json({
        success: true,
        message: 'Campaign sending started',
        campaignId,
      })
    } catch (error: any) {
      console.error('[API /admin/campaigns/send] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error.message || 'Failed to send campaign',
          },
        },
        { status: 500 }
      )
    }
  }
)
