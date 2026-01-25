/**
 * Campaign Email Sender (Server-Only)
 *
 * This module handles sending campaign emails with proper unsubscribe headers.
 * It must only be imported in server-side code (API routes, server components).
 *
 * DO NOT import this module in client components or pages with 'use client'.
 */

import { Resend } from 'resend'
import { generateOneClickUnsubscribeUrl } from '@/lib/email/suppression'

// Lazy initialize Resend
let resendClient: Resend | null = null

function getResendClient(): Resend {
  if (!resendClient && process.env.RESEND_API_KEY) {
    resendClient = new Resend(process.env.RESEND_API_KEY)
  }
  if (!resendClient) {
    throw new Error('Resend API key not configured')
  }
  return resendClient
}

export interface CampaignEmailOptions {
  to: string
  subject: string
  text?: string
  html?: string
  from?: string
  campaignId?: string
}

/**
 * Send campaign email with List-Unsubscribe headers
 *
 * Gmail and Yahoo require List-Unsubscribe headers for bulk senders
 * as of February 2024. This function adds the required headers.
 *
 * @see https://support.google.com/a/answer/81126
 */
export async function sendCampaignEmail(options: CampaignEmailOptions): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.error('[Resend] API key not configured')
    throw new Error('Email service not configured')
  }

  // Generate one-click unsubscribe URL for the List-Unsubscribe header
  // Note: The visible footer link is added by CampaignService, not here
  const oneClickUrl = generateOneClickUnsubscribeUrl(options.to)

  try {
    // Build email payload with List-Unsubscribe headers
    const emailPayload: Record<string, unknown> = {
      from: options.from || 'Moshimoshi <noreply@moshimoshi.app>',
      to: options.to,
      subject: options.subject,
      headers: {
        // RFC 2369 - List-Unsubscribe header
        // Provides both mailto and HTTPS options
        // The HTTPS URL must support POST for RFC 8058 one-click unsubscribe
        'List-Unsubscribe': `<mailto:unsubscribe@moshimoshi.app?subject=unsubscribe>, <${oneClickUrl}>`,
        // RFC 8058 - One-Click Unsubscribe
        // Required for Gmail/Yahoo compliance since February 2024
        // Email clients will POST to the HTTPS URL with body "List-Unsubscribe=One-Click"
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      // Add tags for tracking
      tags: [
        { name: 'type', value: 'campaign' },
        ...(options.campaignId
          ? [{ name: 'campaign_id', value: options.campaignId }]
          : []),
      ],
    }

    if (options.text) emailPayload.text = options.text
    if (options.html) emailPayload.html = options.html

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await getResendClient().emails.send(emailPayload as any)

    if (error) {
      console.error('[Resend] Error sending campaign email:', error)
      throw error
    }

    console.log('[Resend] Campaign email sent successfully:', data?.id)
  } catch (error: unknown) {
    console.error('[Resend] Error sending campaign email:', error)
    throw error
  }
}
