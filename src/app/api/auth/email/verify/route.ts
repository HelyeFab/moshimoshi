// Email verification endpoint
// Verifies email address using JWT token

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { verifyEmailVerificationToken } from '@/lib/auth/jwt'
import { getSecurityHeaders } from '@/lib/auth/validation'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'
import { redis, RedisKeys, CacheTTL } from '@/lib/redis/client'

export async function GET(request: NextRequest) {
  console.log('[API /auth/email/verify] Request received')

  try {
    ensureAdminInitialized()

    // Get token from query parameters
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      const errorUrl = new URL('/auth/verify-email-error', request.url)
      errorUrl.searchParams.set('code', 'MISSING_TOKEN')
      return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
    }

    // Get client info for audit logging
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    try {
      // Verify JWT token
      const tokenValidation = verifyEmailVerificationToken(token)

      if (!tokenValidation.valid || !tokenValidation.email || !tokenValidation.userId) {
        await logAuditEvent(
          AuditEvent.EMAIL_VERIFY,
          {
            ipAddress,
            userAgent,
            endpoint: '/api/auth/email/verify',
          },
          {
            token: token.slice(0, 10) + '...',
            reason: 'invalid_token',
          },
          'failure'
        )

        const errorUrl = new URL('/auth/verify-email-error', request.url)
        errorUrl.searchParams.set('code', 'INVALID_TOKEN')
        return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
      }

      const { email, userId } = tokenValidation

      // Check if token exists in Redis and hasn't been used
      const verificationKey = RedisKeys.emailVerification(token)
      const storedData = await redis.get(verificationKey)

      if (!storedData) {
        await logAuditEvent(
          AuditEvent.EMAIL_VERIFY,
          {
            userId,
            ipAddress,
            userAgent,
            endpoint: '/api/auth/email/verify',
          },
          {
            email,
            reason: 'token_not_found_or_expired',
          },
          'failure'
        )

        const errorUrl = new URL('/auth/verify-email-error', request.url)
        errorUrl.searchParams.set('code', 'TOKEN_EXPIRED')
        return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
      }

      const verificationData = JSON.parse(storedData as string)

      // Verify token matches expected data
      if (verificationData.userId !== userId || verificationData.email !== email) {
        await logAuditEvent(
          AuditEvent.EMAIL_VERIFY,
          {
            userId,
            ipAddress,
            userAgent,
            endpoint: '/api/auth/email/verify',
          },
          {
            email,
            reason: 'token_data_mismatch',
          },
          'failure'
        )

        const errorUrl = new URL('/auth/verify-email-error', request.url)
        errorUrl.searchParams.set('code', 'INVALID_TOKEN')
        return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
      }

      // Get user from Firebase Auth
      let userRecord
      try {
        userRecord = await adminAuth!.getUser(userId)
      } catch (error) {
        if ((error as any)?.code === 'auth/user-not-found') {
          await logAuditEvent(
            AuditEvent.EMAIL_VERIFY,
            {
              userId,
              ipAddress,
              userAgent,
              endpoint: '/api/auth/email/verify',
            },
            {
              email,
              reason: 'user_not_found',
            },
            'failure'
          )

          const errorUrl = new URL('/auth/verify-email-error', request.url)
          errorUrl.searchParams.set('code', 'USER_NOT_FOUND')
          return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
        }
        throw error
      }

      // Check if already verified
      if (userRecord.emailVerified) {
        console.log('[API /auth/email/verify] Email already verified for:', email)
        // Still count as success, just redirect to success page
        const successUrl = new URL('/auth/verify-email-success', request.url)
        return NextResponse.redirect(successUrl, { status: 302, headers: getSecurityHeaders() })
      }

      // Delete token from Redis (single-use enforcement)
      await redis.del(verificationKey)

      // Update Firebase Auth to mark email as verified
      try {
        await adminAuth!.updateUser(userId, { emailVerified: true })
      } catch (error) {
        console.error('[API /auth/email/verify] Failed to update Firebase Auth:', error)
        throw error
      }

      // Update Firestore user document
      try {
        await adminFirestore!.collection('users').doc(userId).update({
          emailVerified: true,
          emailVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
      } catch (error) {
        console.error('[API /auth/email/verify] Failed to update Firestore:', error)
        // Continue anyway - Firebase Auth is the source of truth
      }

      // Log successful verification
      await logAuditEvent(
        AuditEvent.EMAIL_VERIFY,
        {
          userId,
          ipAddress,
          userAgent,
          endpoint: '/api/auth/email/verify',
        },
        {
          email,
          verifiedAt: new Date().toISOString(),
        },
        'success'
      )

      console.log('[API /auth/email/verify] Email verified successfully for:', email)

      // Redirect to success page
      const successUrl = new URL('/auth/verify-email-success', request.url)
      return NextResponse.redirect(successUrl, {
        status: 302,
        headers: getSecurityHeaders()
      })

    } catch (verificationError) {
      console.error('[API /auth/email/verify] Verification error:', verificationError)

      await logAuditEvent(
        AuditEvent.EMAIL_VERIFY,
        {
          ipAddress,
          userAgent,
          endpoint: '/api/auth/email/verify',
        },
        {
          token: token.slice(0, 10) + '...',
          error: verificationError instanceof Error ? verificationError.message : 'Unknown error',
        },
        'failure'
      )

      const errorUrl = new URL('/auth/verify-email-error', request.url)
      errorUrl.searchParams.set('code', 'VERIFICATION_FAILED')
      return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
    }

  } catch (error) {
    console.error('[API /auth/email/verify] Unexpected error:', error)

    await logAuditEvent(
      AuditEvent.SYSTEM_ERROR,
      {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/email/verify',
      },
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'failure'
    )

    const errorUrl = new URL('/auth/verify-email-error', request.url)
    errorUrl.searchParams.set('code', 'INTERNAL_ERROR')
    return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
  }
}

// All other methods not allowed
export async function POST() {
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
