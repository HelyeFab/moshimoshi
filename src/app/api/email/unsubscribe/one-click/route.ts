/**
 * One-Click Unsubscribe Endpoint (RFC 8058)
 *
 * Required by Gmail/Yahoo since February 2024 for bulk senders.
 * This endpoint is called by email clients when user clicks "Unsubscribe"
 * in their email interface.
 *
 * The List-Unsubscribe-Post header triggers a POST to this endpoint
 * with body: "List-Unsubscribe=One-Click"
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8058
 */

import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import {
  verifyUnsubscribeToken,
  suppressionService,
} from '@/lib/email/suppression'

/**
 * POST /api/email/unsubscribe/one-click?token=xxx
 *
 * RFC 8058 One-Click Unsubscribe
 * Body contains: List-Unsubscribe=One-Click
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json(
      { error: 'Missing token' },
      { status: 400 }
    )
  }

  // Verify the HMAC-signed token
  const verification = verifyUnsubscribeToken(token)

  if (!verification.valid || !verification.payload) {
    console.warn(
      '[OneClickUnsubscribe] Invalid token:',
      verification.error
    )
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 400 }
    )
  }

  const { email } = verification.payload

  try {
    // Get request metadata
    const headersList = await headers()
    const userAgent = headersList.get('user-agent') || undefined

    // Add to suppression list with 'one-click' source
    await suppressionService.addSuppression(
      email,
      'unsubscribe',
      'one-click',
      { userAgent }
    )

    console.log(`[OneClickUnsubscribe] Successfully unsubscribed: ${email}`)

    // RFC 8058 requires 200 OK response
    // No body is required, but we include one for debugging
    return NextResponse.json({
      success: true,
      message: 'Unsubscribed successfully',
    })
  } catch (error) {
    console.error('[OneClickUnsubscribe] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process unsubscribe' },
      { status: 500 }
    )
  }
}

/**
 * GET handler - for testing/verification
 * Some email clients may try GET first
 */
export async function GET(request: NextRequest) {
  // Redirect GET requests to the main unsubscribe page
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json(
      { error: 'Use POST for one-click unsubscribe' },
      { status: 405 }
    )
  }

  // Redirect to main unsubscribe page with token
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'
  return NextResponse.redirect(`${appUrl}/api/email/unsubscribe?token=${token}`)
}
