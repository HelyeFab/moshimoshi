/**
 * Email Preview API - Waitlist Thank You
 * Returns HTML and text content without sending
 */

import { NextRequest, NextResponse } from 'next/server'
import { buildWaitlistThankYouContent } from '@/lib/email/waitlistThankYou'
import { z } from 'zod'

const previewSchema = z.object({
  email: z.string().email().default('preview@example.com'),
  locale: z.enum(['en', 'ja', 'it', 'de', 'fr', 'es']).optional().default('en'),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, locale } = previewSchema.parse(body)

    const { html, text } = buildWaitlistThankYouContent(email, locale)

    return NextResponse.json({
      success: true,
      html,
      text,
      email,
      locale,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to generate preview',
      },
      { status: 400 }
    )
  }
}
