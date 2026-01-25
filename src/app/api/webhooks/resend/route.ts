/**
 * Resend Webhook Handler
 *
 * Handles email events from Resend:
 * - email.bounced: Hard bounces should be suppressed
 * - email.complained: Spam complaints should be suppressed
 * - email.delivered: Can be logged for analytics
 *
 * Setup in Resend Dashboard:
 * 1. Go to Webhooks
 * 2. Add endpoint: https://moshimoshi.app/api/webhooks/resend
 * 3. Select events: email.bounced, email.complained
 * 4. Copy signing secret to RESEND_WEBHOOK_SECRET env var
 *
 * @see https://resend.com/docs/dashboard/webhooks/introduction
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import * as crypto from 'crypto'
import { suppressionService } from '@/lib/email/suppression'
import type { ResendWebhookPayload } from '@/lib/email/suppression/types'

/**
 * Verify Resend webhook signature
 *
 * Resend signs webhooks using SVix.
 * Headers: svix-id, svix-timestamp, svix-signature
 */
async function verifyWebhookSignature(
  request: NextRequest,
  body: string
): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET

  // In development, allow skipping verification
  if (!secret) {
    console.warn('[ResendWebhook] No RESEND_WEBHOOK_SECRET - skipping signature verification')
    return process.env.NODE_ENV === 'development'
  }

  const headersList = await headers()
  const svixId = headersList.get('svix-id')
  const svixTimestamp = headersList.get('svix-timestamp')
  const svixSignature = headersList.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('[ResendWebhook] Missing svix headers')
    return false
  }

  // Check timestamp to prevent replay attacks (5 minute tolerance)
  const timestamp = parseInt(svixTimestamp, 10)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > 300) {
    console.error('[ResendWebhook] Timestamp too old or in future')
    return false
  }

  // Reconstruct the signed content
  const signedContent = `${svixId}.${svixTimestamp}.${body}`

  // The secret is base64-encoded, starting with "whsec_"
  const secretBytes = Buffer.from(secret.replace('whsec_', ''), 'base64')

  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', secretBytes)
    .update(signedContent)
    .digest('base64')

  // Svix sends multiple signatures separated by space
  // Format: v1,<signature> v1,<signature>
  const signatures = svixSignature.split(' ')

  for (const sig of signatures) {
    const [version, signature] = sig.split(',')
    if (version === 'v1' && signature === expectedSignature) {
      return true
    }
  }

  console.error('[ResendWebhook] Signature verification failed')
  return false
}

/**
 * POST /api/webhooks/resend
 *
 * Handle incoming webhook events from Resend
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text()

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(request, body)
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse the webhook payload
    const payload: ResendWebhookPayload = JSON.parse(body)

    console.log(`[ResendWebhook] Received event: ${payload.type}`)

    // Handle different event types
    switch (payload.type) {
      case 'email.bounced':
        await handleBounce(payload)
        break

      case 'email.complained':
        await handleComplaint(payload)
        break

      case 'email.delivered':
        // Optional: Log delivery for analytics
        console.log(
          `[ResendWebhook] Email delivered to: ${payload.data.to.join(', ')}`
        )
        break

      case 'email.opened':
      case 'email.clicked':
        // Optional: Track engagement
        // Could update campaign stats or user engagement metrics
        break

      default:
        console.log(`[ResendWebhook] Unhandled event type: ${payload.type}`)
    }

    // Always return 200 to acknowledge receipt
    // Resend will retry on non-2xx responses
    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[ResendWebhook] Error processing webhook:', error)

    // Return 200 anyway to prevent Resend from retrying
    // Log the error for debugging
    return NextResponse.json({ received: true, error: 'Processing failed' })
  }
}

/**
 * Handle email bounce event
 */
async function handleBounce(payload: ResendWebhookPayload): Promise<void> {
  const { to, bounce } = payload.data

  for (const email of to) {
    // Only suppress hard bounces
    // Soft bounces might be temporary (mailbox full, server down)
    if (bounce?.type === 'hard') {
      console.log(`[ResendWebhook] Hard bounce for: ${email}`)

      await suppressionService.addSuppression(email, 'bounce', 'webhook', {
        bounceType: 'hard',
        webhookPayload: payload as unknown as Record<string, unknown>,
      })
    } else {
      console.log(
        `[ResendWebhook] Soft bounce for: ${email} - not suppressing`
      )
      // Could track soft bounces separately for monitoring
    }
  }
}

/**
 * Handle spam complaint event
 */
async function handleComplaint(payload: ResendWebhookPayload): Promise<void> {
  const { to } = payload.data

  for (const email of to) {
    console.log(`[ResendWebhook] Spam complaint from: ${email}`)

    await suppressionService.addSuppression(email, 'complaint', 'webhook', {
      webhookPayload: payload as unknown as Record<string, unknown>,
    })
  }
}

/**
 * GET handler - for webhook verification
 * Some services send a GET request to verify the endpoint exists
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'resend-webhook',
    timestamp: new Date().toISOString(),
  })
}
