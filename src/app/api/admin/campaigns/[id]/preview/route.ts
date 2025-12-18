/**
 * Admin Campaign Preview API
 *
 * GET - Preview campaign recipient count before sending
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { CampaignService } from '@/lib/email/campaigns/service'
import type { EmailCampaign } from '@/lib/email/campaigns/types'

/**
 * GET - Preview campaign recipients
 *
 * Returns the count of users who will receive the campaign
 * based on the segment criteria.
 */
export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
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

    // Fetch campaign
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

    const campaign = { id: campaignId, ...campaignSnap.data() } as EmailCampaign

    console.log(`[API /admin/campaigns/${campaignId}/preview] Previewing recipients`)

    // Get users for this segment (without sending emails)
    const campaignService = new CampaignService()
    const users = await campaignService.getUsersForSegment(campaign.segment)

    return NextResponse.json({
      success: true,
      totalRecipients: users.length,
      segment: campaign.segment,
      campaignName: campaign.name,
      template: campaign.template,
      subject: campaign.subject,
    })
  } catch (error: any) {
    console.error('[API /admin/campaigns/preview] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to preview campaign',
        },
      },
      { status: 500 }
    )
  }
})
