/**
 * Email Preview API
 *
 * Renders the email template for preview before sending.
 * Shows exactly what recipients will see.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAdminAuth, AdminContext } from '@/lib/admin/adminAuth'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { buildWaitlistThankYouContent } from '@/lib/email/waitlistThankYou'
import { generateUnsubscribeUrl } from '@/lib/email/suppression'
import { substituteVariables, buildPreviewContext } from '@/lib/email/templates/variables'
import type { EmailCampaign } from '@/lib/email/campaigns/types'
import type { EmailTemplate } from '@/lib/email/templates/types'

/**
 * GET /api/admin/campaigns/[id]/email-preview
 *
 * Returns the rendered HTML and text content for the campaign template
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
            error: { code: 'INVALID_REQUEST', message: 'Campaign ID is required' },
          },
          { status: 400 }
        )
      }

      // Fetch campaign
      const campaignRef = adminFirestore.collection('email_campaigns').doc(campaignId)
      const campaignSnap = await campaignRef.get()

      if (!campaignSnap.exists) {
        return NextResponse.json(
          {
            success: false,
            error: { code: 'NOT_FOUND', message: 'Campaign not found' },
          },
          { status: 404 }
        )
      }

      const campaign = { id: campaignId, ...campaignSnap.data() } as EmailCampaign

      // Generate preview email content
      const previewEmail = 'preview@example.com'
      const emailContent = await buildEmailFromTemplate(campaign.template, previewEmail, campaign)

      // Add unsubscribe footer for preview
      const unsubscribeUrl = generateUnsubscribeUrl(previewEmail)
      const htmlWithFooter = appendUnsubscribeFooter(emailContent.html, unsubscribeUrl)
      const textWithFooter = appendUnsubscribeFooterText(emailContent.text, unsubscribeUrl)

      return NextResponse.json({
        success: true,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject,
          template: campaign.template,
        },
        preview: {
          html: htmlWithFooter,
          text: textWithFooter,
          previewEmail,
        },
      })
    } catch (error: any) {
      console.error('[API /admin/campaigns/email-preview] Error:', error)
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: error.message || 'Failed to generate email preview',
          },
        },
        { status: 500 }
      )
    }
  }
)

/**
 * Build email content from template
 */
async function buildEmailFromTemplate(
  template: EmailCampaign['template'],
  email: string,
  campaign: EmailCampaign
): Promise<{ html: string; text: string }> {
  switch (template) {
    case 'waitlist':
      return buildWaitlistThankYouContent(email, 'en')

    case 'welcome':
      return buildWelcomeEmailContent(email)

    case 'custom':
      // Use custom template from email_templates collection if templateId is present
      if (campaign.templateId) {
        return buildFromCustomTemplate(
          campaign.templateId,
          email,
          campaign.templateVariables || {}
        )
      }
      return buildCustomEmailContent(campaign.subject)

    default:
      return {
        html: `<h1>${campaign.subject}</h1><p>Template: ${template}</p>`,
        text: `${campaign.subject}\n\nTemplate: ${template}`,
      }
  }
}

/**
 * Build email content from a custom template
 */
async function buildFromCustomTemplate(
  templateId: string,
  email: string,
  overrides: Record<string, string>
): Promise<{ html: string; text: string }> {
  if (!adminFirestore) {
    throw new Error('Firestore not initialized')
  }

  const templateDoc = await adminFirestore
    .collection('email_templates')
    .doc(templateId)
    .get()

  if (!templateDoc.exists) {
    throw new Error(`Template not found: ${templateId}`)
  }

  const template = templateDoc.data() as EmailTemplate

  // Build preview context with sample data
  const unsubscribeUrl = generateUnsubscribeUrl(email)
  const variableContext = buildPreviewContext(template.variables || [], {
    email,
    name: email.split('@')[0],
    unsubscribeUrl,
    ...overrides,
  })

  // Substitute variables
  const html = substituteVariables(template.htmlContent, variableContext)
  const text = substituteVariables(template.textContent, variableContext)

  return { html, text }
}

/**
 * Welcome email template
 */
function buildWelcomeEmailContent(email: string): { html: string; text: string } {
  const name = email.split('@')[0]

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Moshimoshi</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #111827;
          max-width: 640px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        }
        .logo {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .logo-mark {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #ec4899, #8b5cf6);
          color: white;
          border-radius: 12px;
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 20px;
        }
        .button {
          display: inline-block;
          padding: 14px 26px;
          background: linear-gradient(135deg, #ec4899, #8b5cf6);
          color: white;
          text-decoration: none;
          border-radius: 10px;
          font-weight: 700;
          margin-top: 18px;
        }
        .footer {
          margin-top: 28px;
          border-top: 1px solid #e5e7eb;
          padding-top: 16px;
          color: #6b7280;
          font-size: 13px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div class="logo-mark">も</div>
          <div style="font-size: 22px; font-weight: 800; color: #111;">Moshimoshi</div>
        </div>

        <h2 style="margin: 0 0 10px 0;">Welcome to Moshimoshi, ${name}!</h2>

        <p>Thanks for joining us on your Japanese learning journey. We're excited to help you master Japanese.</p>

        <p><strong>Here's what you can do:</strong></p>
        <ul>
          <li>Practice with YouTube shadowing</li>
          <li>Learn kanji with our connection system</li>
          <li>Import your Anki decks</li>
          <li>Track your progress</li>
        </ul>

        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'}" class="button">
          Start Learning
        </a>

        <div class="footer">
          <p>Need help? Reply to this email or contact support@moshimoshi.app</p>
        </div>
      </div>
    </body>
    </html>
  `

  const text = `
Welcome to Moshimoshi, ${name}!

Thanks for joining us on your Japanese learning journey. We're excited to help you master Japanese.

Here's what you can do:
- Practice with YouTube shadowing
- Learn kanji with our connection system
- Import your Anki decks
- Track your progress

Start learning: ${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'}

Need help? Reply to this email or contact support@moshimoshi.app
  `

  return { html, text }
}

/**
 * Custom email template (basic)
 */
function buildCustomEmailContent(subject: string): { html: string; text: string } {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #111827;
          max-width: 640px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .container {
          background: white;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.08);
        }
        .logo {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }
        .logo-mark {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #ec4899, #8b5cf6);
          color: white;
          border-radius: 12px;
          display: grid;
          place-items: center;
          font-weight: 700;
          font-size: 20px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <div class="logo-mark">も</div>
          <div style="font-size: 22px; font-weight: 800; color: #111;">Moshimoshi</div>
        </div>

        <h2 style="margin: 0 0 20px 0;">${subject}</h2>

        <p style="color: #6b7280; font-style: italic;">
          [Custom email content goes here]
        </p>
        <p style="color: #6b7280; font-style: italic;">
          Note: Custom template support with editable content is coming soon.
        </p>
      </div>
    </body>
    </html>
  `

  const text = `${subject}\n\n[Custom email content goes here]\n\nNote: Custom template support with editable content is coming soon.`

  return { html, text }
}

/**
 * Append unsubscribe footer to HTML email
 */
function appendUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  const footer = `
    <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
      <p>
        You're receiving this email because you signed up for Moshimoshi.
      </p>
      <p>
        <a href="${unsubscribeUrl}" style="color: #6b7280; text-decoration: underline;">Unsubscribe</a>
        from marketing emails
      </p>
    </div>
  `

  if (html.includes('</body>')) {
    return html.replace('</body>', `${footer}</body>`)
  }
  return html + footer
}

/**
 * Append unsubscribe footer to plain text email
 */
function appendUnsubscribeFooterText(text: string, unsubscribeUrl: string): string {
  const footer = `

---
You're receiving this email because you signed up for Moshimoshi.
Unsubscribe: ${unsubscribeUrl}
`
  return text + footer
}
