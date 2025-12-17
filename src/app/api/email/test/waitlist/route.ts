/**
 * Test Email API - Waitlist Thank You
 *
 * Sends a test waitlist thank-you email to a specified address.
 * Only works in development or with valid admin session.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { sendWaitlistThankYouEmail } from '@/lib/email/waitlistThankYou'
import { z } from 'zod'

const testEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
  locale: z.enum(['en', 'ja', 'it', 'de', 'fr', 'es']).optional().default('en'),
})

export async function POST(request: NextRequest) {
  try {
    // Security: Only allow in development OR for admin users
    const isDevelopment = process.env.NODE_ENV === 'development'

    if (!isDevelopment) {
      const session = await getSession()
      if (!session?.admin) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNAUTHORIZED',
              message: 'Test emails can only be sent in development or by admins'
            }
          },
          { status: 403 }
        )
      }
    }

    // Validate request body
    const body = await request.json()
    const validation = testEmailSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: validation.error.issues[0]?.message || 'Invalid input',
          },
        },
        { status: 400 }
      )
    }

    const { email, locale } = validation.data

    console.log(`[Test Email] Sending waitlist thank-you to ${email} (locale: ${locale})`)

    // Send the test email
    await sendWaitlistThankYouEmail(email, locale)

    console.log(`[Test Email] Successfully sent to ${email}`)

    return NextResponse.json({
      success: true,
      message: `Test email sent to ${email}`,
      data: {
        email,
        locale,
        timestamp: new Date().toISOString(),
      },
    })

  } catch (error: any) {
    console.error('[Test Email] Error:', error)

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
}
