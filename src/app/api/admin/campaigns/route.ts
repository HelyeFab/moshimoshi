/**
 * Admin Campaigns API
 *
 * POST - Create new campaign draft
 * GET - List all campaigns
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { Timestamp } from 'firebase-admin/firestore'
import { z } from 'zod'
import type { SendCampaignRequest } from '@/lib/email/campaigns/types'

// Validation schema
const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100),
  template: z.enum(['waitlist', 'welcome', 'password_reset', 'custom']),
  subject: z.string().min(1, 'Subject is required').max(200),
  segment: z.object({
    type: z.enum(['all', 'free', 'premium_monthly', 'premium_yearly']),
    respectMarketingPrefs: z.boolean(),
    emailVerifiedOnly: z.boolean(),
  }),
})

/**
 * POST - Create new campaign draft
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
      let validatedData: SendCampaignRequest
      try {
        validatedData = campaignSchema.parse(body)
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

      // Create campaign document
      const campaignRef = await adminFirestore.collection('email_campaigns').add({
        name: validatedData.name,
        template: validatedData.template,
        subject: validatedData.subject,
        segment: validatedData.segment,
        status: 'draft',
        stats: {
          totalRecipients: 0,
          sentCount: 0,
          failedCount: 0,
          skippedCount: 0,
        },
        createdBy: context.user.uid,
        createdAt: Timestamp.now(),
        errors: [],
      })

      console.log(
        `[API /admin/campaigns] Campaign created: ${campaignRef.id} by ${context.user.email}`
      )

      return NextResponse.json({
        success: true,
        campaignId: campaignRef.id,
        message: 'Campaign draft created successfully',
      })
    } catch (error: any) {
      console.error('[API /admin/campaigns] POST Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error.message || 'Failed to create campaign',
          },
        },
        { status: 500 }
      )
    }
  }
)

/**
 * GET - List all campaigns
 */
export const GET = withAdminAuth(async (request: NextRequest, context: AdminContext) => {
  try {
    ensureAdminInitialized()

    if (!adminFirestore) {
      throw new Error('Firebase Admin not initialized')
    }

    // Fetch all campaigns ordered by creation date (newest first)
    const snapshot = await adminFirestore
      .collection('email_campaigns')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()

    const campaigns = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      // Convert Timestamps to ISO strings for JSON serialization
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      sentAt: doc.data().sentAt?.toDate?.()?.toISOString() || null,
    }))

    return NextResponse.json({
      success: true,
      campaigns,
      count: campaigns.length,
    })
  } catch (error: any) {
    console.error('[API /admin/campaigns] GET Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error.message || 'Failed to fetch campaigns',
        },
      },
      { status: 500 }
    )
  }
})
