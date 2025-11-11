// Send email verification endpoint
// Sends verification email to authenticated users

import { NextRequest, NextResponse } from 'next/server'
import { getSession, requireAuth } from '@/lib/auth/session'
import { adminAuth, adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { createEmailVerificationToken } from '@/lib/auth/jwt'
import { sendVerificationEmail } from '@/lib/email/resend'
import { getSecurityHeaders } from '@/lib/auth/validation'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'
import { redis, RedisKeys, CacheTTL } from '@/lib/redis/client'

export async function POST(request: NextRequest) {
  console.log('[API /auth/email/send-verification] Request received')

  try {
    ensureAdminInitialized()

    // Require authentication
    const session = await requireAuth()

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Check rate limiting - max 3 emails per hour per user
    const rateLimitKey = `email_verification_rate:${session.uid}`
    const attempts = await redis.get(rateLimitKey)
    const attemptCount = attempts ? parseInt(attempts as string, 10) : 0

    if (attemptCount >= 3) {
      await logAuditEvent(
        AuditEvent.EMAIL_VERIFY,
        {
          userId: session.uid,
          ipAddress,
          userAgent,
          endpoint: '/api/auth/email/send-verification',
        },
        {
          email: session.email,
          reason: 'rate_limited',
          attempts: attemptCount,
        },
        'failure'
      )

      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many verification emails sent. Please try again in 1 hour.',
          },
        },
        {
          status: 429,
          headers: getSecurityHeaders(),
        }
      )
    }

    // Get user from Firebase Auth
    const userRecord = await adminAuth!.getUser(session.uid)

    // Check if already verified
    if (userRecord.emailVerified) {
      return NextResponse.json(
        {
          success: true,
          message: 'Email already verified',
          alreadyVerified: true,
        },
        {
          status: 200,
          headers: getSecurityHeaders(),
        }
      )
    }

    // Get user display name from Firestore
    let displayName: string | undefined
    try {
      const userDoc = await adminFirestore!.collection('users').doc(session.uid).get()
      if (userDoc.exists) {
        displayName = userDoc.data()?.displayName
      }
    } catch (error) {
      console.warn('[API /auth/email/send-verification] Could not fetch display name:', error)
    }

    // Generate verification token (24 hour expiration)
    const verificationToken = createEmailVerificationToken(
      session.email,
      session.uid,
      CacheTTL.EMAIL_VERIFICATION * 1000 // Convert to ms
    )

    // Store token in Redis
    const verificationKey = RedisKeys.emailVerification(verificationToken)
    const verificationData = {
      userId: session.uid,
      email: session.email,
      createdAt: new Date().toISOString(),
      ipAddress,
      userAgent,
    }

    await redis.setex(
      verificationKey,
      CacheTTL.EMAIL_VERIFICATION,
      JSON.stringify(verificationData)
    )

    // Build verification link
    const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'}/api/auth/email/verify?token=${verificationToken}`

    // Send verification email
    try {
      await sendVerificationEmail(session.email, verificationUrl, displayName)
      console.log('[API /auth/email/send-verification] Verification email sent to:', session.email)
    } catch (emailError) {
      console.error('[API /auth/email/send-verification] Failed to send email:', emailError)

      // Clean up token since email failed
      await redis.del(verificationKey)

      return NextResponse.json(
        {
          error: {
            code: 'EMAIL_SEND_FAILED',
            message: 'Failed to send verification email. Please try again.',
          },
        },
        {
          status: 500,
          headers: getSecurityHeaders(),
        }
      )
    }

    // Increment rate limit counter
    await redis.setex(rateLimitKey, 3600, (attemptCount + 1).toString()) // 1 hour TTL

    // Log audit event
    await logAuditEvent(
      AuditEvent.EMAIL_VERIFY,
      {
        userId: session.uid,
        ipAddress,
        userAgent,
        endpoint: '/api/auth/email/send-verification',
      },
      {
        email: session.email,
        action: 'verification_email_sent',
        tokenExpiry: '24 hours',
      },
      'success'
    )

    return NextResponse.json(
      {
        success: true,
        message: 'Verification email sent successfully',
        data: {
          email: session.email,
          expiresIn: '24 hours',
        },
      },
      {
        status: 200,
        headers: getSecurityHeaders(),
      }
    )

  } catch (error) {
    console.error('[API /auth/email/send-verification] Error:', error)

    await logAuditEvent(
      AuditEvent.SYSTEM_ERROR,
      {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/email/send-verification',
      },
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'failure'
    )

    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to send verification email',
        },
      },
      {
        status: 500,
        headers: getSecurityHeaders(),
      }
    )
  }
}

// All other methods not allowed
export async function GET() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    { status: 405, headers: getSecurityHeaders() }
  )
}

export async function PUT() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    { status: 405, headers: getSecurityHeaders() }
  )
}

export async function DELETE() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    { status: 405, headers: getSecurityHeaders() }
  )
}

export async function PATCH() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    { status: 405, headers: getSecurityHeaders() }
  )
}
