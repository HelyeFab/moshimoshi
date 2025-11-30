// Newsletter verification endpoint
// Verifies newsletter subscription using JWT token

import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { verifyNewsletterVerificationToken } from '@/lib/auth/jwt'
import { getSecurityHeaders } from '@/lib/auth/validation'
import { redis, RedisKeys } from '@/lib/redis/client'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  console.log('[API /newsletter/verify] Request received')

  try {
    // Get token from query parameters
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      const errorUrl = new URL('/newsletter/verify-error', request.url)
      errorUrl.searchParams.set('code', 'MISSING_TOKEN')
      return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
    }

    try {
      // Verify JWT token
      const tokenValidation = verifyNewsletterVerificationToken(token)

      if (!tokenValidation.valid || !tokenValidation.email) {
        const errorUrl = new URL('/newsletter/verify-error', request.url)
        errorUrl.searchParams.set('code', 'INVALID_TOKEN')
        return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
      }

      const { email } = tokenValidation
      const normalizedEmail = email.toLowerCase().trim()

      // Check if token exists in Redis and hasn't been used
      const verificationKey = RedisKeys.emailVerification(token)
      const storedData = await redis.get(verificationKey)

      if (!storedData) {
        const errorUrl = new URL('/newsletter/verify-error', request.url)
        errorUrl.searchParams.set('code', 'TOKEN_EXPIRED')
        return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
      }

      const verificationData = JSON.parse(storedData as string)

      // Verify token matches expected data
      if (verificationData.email !== normalizedEmail || verificationData.type !== 'newsletter') {
        const errorUrl = new URL('/newsletter/verify-error', request.url)
        errorUrl.searchParams.set('code', 'INVALID_TOKEN')
        return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
      }

      // Delete token from Redis (single-use enforcement)
      await redis.del(verificationKey)

      // Create email hash for document ID
      const emailHash = crypto
        .createHash('sha256')
        .update(normalizedEmail)
        .digest('hex')

      if (!adminDb) {
        const errorUrl = new URL('/newsletter/verify-error', request.url)
        errorUrl.searchParams.set('code', 'DATABASE_ERROR')
        return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
      }

      // Get subscriber document
      const subscriberRef = adminDb.collection('newsletterSubscribers').doc(emailHash)
      const subscriberDoc = await subscriberRef.get()

      if (!subscriberDoc.exists) {
        const errorUrl = new URL('/newsletter/verify-error', request.url)
        errorUrl.searchParams.set('code', 'SUBSCRIBER_NOT_FOUND')
        return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
      }

      const subscriberData = subscriberDoc.data()

      // Check if already verified
      if (subscriberData?.status === 'active') {
        console.log('[API /newsletter/verify] Already verified:', normalizedEmail)
        // Still count as success, redirect to success page
        const successUrl = new URL('/newsletter/verify-success', request.url)
        return NextResponse.redirect(successUrl, { status: 302, headers: getSecurityHeaders() })
      }

      // Update subscriber status to active
      await subscriberRef.update({
        status: 'active',
        verifiedAt: new Date(),
        updatedAt: new Date(),
      })

      console.log('[API /newsletter/verify] Newsletter subscription verified for:', normalizedEmail)

      // Redirect to success page
      const successUrl = new URL('/newsletter/verify-success', request.url)
      return NextResponse.redirect(successUrl, {
        status: 302,
        headers: getSecurityHeaders()
      })

    } catch (verificationError) {
      console.error('[API /newsletter/verify] Verification error:', verificationError)

      const errorUrl = new URL('/newsletter/verify-error', request.url)
      errorUrl.searchParams.set('code', 'VERIFICATION_FAILED')
      return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
    }

  } catch (error) {
    console.error('[API /newsletter/verify] Unexpected error:', error)

    const errorUrl = new URL('/newsletter/verify-error', request.url)
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
