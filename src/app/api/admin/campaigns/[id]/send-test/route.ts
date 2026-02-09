/**
 * Send Test Email API
 *
 * POST - Send a test email to the campaign's configured test email address
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'

/**
 * POST - Send a test email for a campaign
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

      // Fetch the campaign
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

      // Check if test email is configured
      if (!campaign?.testEmail) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'NO_TEST_EMAIL',
              message: 'No test email configured for this campaign. Edit the campaign to add a test email.',
            },
          },
          { status: 400 }
        )
      }

      // Get the template if using custom template
      let htmlContent = ''
      let textContent = ''
      let templateVars: Array<{ name: string; defaultValue?: string }> = []

      if (campaign.template === 'custom' && campaign.templateId) {
        const templateRef = adminFirestore.collection('email_templates').doc(campaign.templateId)
        const templateSnap = await templateRef.get()

        if (!templateSnap.exists) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'TEMPLATE_NOT_FOUND',
                message: 'Template not found',
              },
            },
            { status: 404 }
          )
        }

        const template = templateSnap.data()
        htmlContent = template?.htmlContent || ''
        textContent = template?.textContent || ''
        templateVars = template?.variables || []
      }

      // Prepare variables for the test email
      // Start with system variables
      const variables: Record<string, string> = {
        name: 'Test User',
        firstName: 'Test User',
        email: campaign.testEmail,
        unsubscribeUrl: `https://moshimoshi.app/unsubscribe?email=${encodeURIComponent(campaign.testEmail)}&token=test`,
        preferencesUrl: 'https://moshimoshi.app/settings/notifications',
        year: new Date().getFullYear().toString(),
        currentYear: new Date().getFullYear().toString(),
      }

      // Apply template variable defaults
      for (const v of templateVars) {
        if (v.defaultValue && !variables[v.name]) {
          variables[v.name] = v.defaultValue
        }
      }

      // Campaign-level overrides take precedence
      Object.assign(variables, campaign.templateVariables || {})

      // Replace variables in content
      let finalHtml = htmlContent
      let finalText = textContent
      let finalSubject = campaign.subject

      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g')
        finalHtml = finalHtml.replace(regex, value)
        finalText = finalText.replace(regex, value)
        finalSubject = finalSubject.replace(regex, value)
      }

      // Send the test email using Resend
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)

      const { error } = await resend.emails.send({
        from: 'Moshimoshi <hello@moshimoshi.app>',
        to: campaign.testEmail,
        subject: `[TEST] ${finalSubject}`,
        html: finalHtml,
        text: finalText,
      })

      if (error) {
        console.error('[API /admin/campaigns/send-test] Resend error:', error)
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'EMAIL_SEND_FAILED',
              message: error.message || 'Failed to send test email',
            },
          },
          { status: 500 }
        )
      }

      console.log(
        `[API /admin/campaigns/${campaignId}/send-test] Test email sent to ${campaign.testEmail} by ${context.user.email}`
      )

      return NextResponse.json({
        success: true,
        message: 'Test email sent successfully',
        email: campaign.testEmail,
      })
    } catch (error: any) {
      console.error('[API /admin/campaigns/send-test] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error.message || 'Failed to send test email',
          },
        },
        { status: 500 }
      )
    }
  }
)
