/**
 * TEST ONLY - Unsubscribe Token Test Endpoint
 *
 * This endpoint generates a valid unsubscribe token for testing purposes.
 * It should be removed or protected in production.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  generateUnsubscribeUrl,
  suppressionService,
} from '@/lib/email/suppression'

/**
 * GET /api/email/test-unsubscribe?email=xxx
 *
 * Generates a valid unsubscribe token for testing
 */
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    )
  }

  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email') || 'test@example.com'

  try {
    // Generate token
    const token = createUnsubscribeToken(email)

    // Verify it works
    const verification = verifyUnsubscribeToken(token)

    // Generate URLs
    const unsubscribeUrl = generateUnsubscribeUrl(email)

    // Check current suppression status
    const suppressionStatus = await suppressionService.isEmailSuppressed(email)

    return NextResponse.json({
      success: true,
      email,
      token,
      tokenValid: verification.valid,
      unsubscribeUrl,
      currentStatus: {
        suppressed: suppressionStatus.suppressed,
        reason: suppressionStatus.reason,
      },
      instructions: {
        step1: 'Copy the unsubscribeUrl',
        step2: 'Open it in a browser',
        step3: 'You should see a success page',
        step4: 'The email should now be in the suppression list',
      },
    })
  } catch (error) {
    console.error('[TestUnsubscribe] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/email/test-unsubscribe
 *
 * Removes suppression for testing (re-subscribe)
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    )
  }

  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Remove suppression
    const removed = await suppressionService.removeSuppression(email)

    return NextResponse.json({
      success: true,
      email,
      wasRemoved: removed,
      message: removed
        ? 'Suppression removed - email can receive campaigns again'
        : 'Email was not in suppression list',
    })
  } catch (error) {
    console.error('[TestUnsubscribe] POST Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/email/test-unsubscribe?email=xxx
 *
 * Check suppression stats (admin info)
 */
export async function DELETE(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 403 }
    )
  }

  try {
    const stats = await suppressionService.getStats()

    return NextResponse.json({
      success: true,
      stats,
    })
  } catch (error) {
    console.error('[TestUnsubscribe] Stats Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
