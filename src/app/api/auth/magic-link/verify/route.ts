// Magic link verification endpoint
// Verifies magic link tokens and signs users in

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminFirestore, ensureAdminInitialized, setAdminClaims } from '@/lib/firebase/admin'
import { createSession } from '@/lib/auth/session'
import { getSecurityHeaders } from '@/lib/auth/validation'
import { logAuditEvent, AuditEvent, logAuthAttempt } from '@/lib/auth/audit'
import { verifyEmailVerificationToken } from '@/lib/auth/jwt'
import { getUserTier } from '@/lib/auth/tier-utils'
import { redis, RedisKeys } from '@/lib/redis/client'

export async function GET(request: NextRequest) {
  try {
    // Ensure Firebase Admin is initialized
    ensureAdminInitialized()

    // Get token from query parameters
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      const errorUrl = new URL('/auth/error', request.url)
      errorUrl.searchParams.set('code', 'MISSING_TOKEN')
      return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
    }

    // Get client information for audit logging
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    try {
      // Verify the JWT token
      const tokenValidation = verifyEmailVerificationToken(token)
      
      if (!tokenValidation.valid || !tokenValidation.email || !tokenValidation.userId) {
        await logAuditEvent(
          AuditEvent.MAGIC_LINK_SIGNIN,
          {
            ipAddress,
            userAgent,
            endpoint: '/api/auth/magic-link/verify',
          },
          {
            token: token.slice(0, 10) + '...',
            reason: 'invalid_token',
          },
          'failure'
        )

        const errorUrl = new URL('/auth/error', request.url)
        errorUrl.searchParams.set('code', 'INVALID_LINK')
        return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
      }

      const { email, userId } = tokenValidation

      // Check if token exists in Redis and hasn't been used
      const magicLinkKey = RedisKeys.magicLink(token)
      const storedData = await redis.get(magicLinkKey)
      
      if (!storedData) {
        await logAuditEvent(
          AuditEvent.MAGIC_LINK_SIGNIN,
          {
            userId,
            ipAddress,
            userAgent,
            endpoint: '/api/auth/magic-link/verify',
          },
          {
            email,
            reason: 'token_not_found_or_expired',
          },
          'failure'
        )

        const errorUrl = new URL('/auth/error', request.url)
        errorUrl.searchParams.set('code', 'LINK_EXPIRED')
        return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
      }

      const magicLinkData = JSON.parse(storedData as string)

      // Verify that the token matches the expected user and email
      if (magicLinkData.userId !== userId || magicLinkData.email !== email) {
        await logAuditEvent(
          AuditEvent.MAGIC_LINK_SIGNIN,
          {
            userId,
            ipAddress,
            userAgent,
            endpoint: '/api/auth/magic-link/verify',
          },
          {
            email,
            reason: 'token_data_mismatch',
          },
          'failure'
        )

        const errorUrl = new URL('/auth/error', request.url)
        errorUrl.searchParams.set('code', 'INVALID_LINK')
        return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
      }

      // Get user information from Firebase
      let userRecord
      try {
        userRecord = await adminAuth!.getUser(userId)
      } catch (error) {
        if ((error as any)?.code === 'auth/user-not-found') {
          await logAuditEvent(
            AuditEvent.MAGIC_LINK_SIGNIN,
            {
              userId,
              ipAddress,
              userAgent,
              endpoint: '/api/auth/magic-link/verify',
            },
            {
              email,
              reason: 'user_not_found',
            },
            'failure'
          )

          const errorUrl = new URL('/auth/error', request.url)
          errorUrl.searchParams.set('code', 'USER_NOT_FOUND')
          return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
        }
        throw error
      }

      // Get user profile from Firestore
      const userDoc = await adminFirestore!.collection('users').doc(userId).get()
      const userData = userDoc.data()

      if (!userData) {
        await logAuditEvent(
          AuditEvent.MAGIC_LINK_SIGNIN,
          {
            userId,
            ipAddress,
            userAgent,
            endpoint: '/api/auth/magic-link/verify',
          },
          {
            email,
            reason: 'profile_not_found',
          },
          'failure'
        )

        const errorUrl = new URL('/auth/error', request.url)
        errorUrl.searchParams.set('code', 'PROFILE_NOT_FOUND')
        return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
      }

      // Check if user account is active
      if (userData.userState === 'suspended') {
        await logAuthAttempt(
          AuditEvent.FAILED_LOGIN,
          {
            userId,
            ipAddress,
            userAgent,
            endpoint: '/api/auth/magic-link/verify',
          },
          {
            email,
            method: 'magic_link',
            reason: 'account_suspended',
          },
          'failure'
        )

        const errorUrl = new URL('/auth/error', request.url)
        errorUrl.searchParams.set('code', 'ACCOUNT_SUSPENDED')
        return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
      }

      if (userData.userState === 'deleted') {
        await logAuthAttempt(
          AuditEvent.FAILED_LOGIN,
          {
            userId,
            ipAddress,
            userAgent,
            endpoint: '/api/auth/magic-link/verify',
          },
          {
            email,
            method: 'magic_link',
            reason: 'account_deleted',
          },
          'failure'
        )

        const errorUrl = new URL('/auth/error', request.url)
        errorUrl.searchParams.set('code', 'ACCOUNT_DELETED')
        return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
      }

      // Invalidate the magic link token (single use)
      await redis.del(magicLinkKey)

      // Determine if user is admin
      const configuredAdmins = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || []
      const isAdmin = configuredAdmins.includes(email)
      
      // Set Firebase custom claims for admin users
      if (isAdmin) {
        const claimsSet = await setAdminClaims(userId, true)
        console.log('[API /auth/magic-link] Admin claims set:', claimsSet)
      }

      // Determine user tier from subscription data
      const userTier = getUserTier(userData)

      // Create session
      const session = await createSession(
        {
          uid: userId,
          email: userRecord.email || email,
          tier: userTier,
          admin: isAdmin,
        },
        {
          userAgent,
          ipAddress,
          rememberMe: true, // Magic links usually mean "remember me"
        }
      )

      // Log successful magic link signin
      await logAuthAttempt(
        AuditEvent.MAGIC_LINK_SIGNIN,
        {
          userId,
          sessionId: session.sessionId,
          ipAddress,
          userAgent,
          endpoint: '/api/auth/magic-link/verify',
        },
        {
          email,
          method: 'magic_link',
        },
        'success'
      )

      // Update last login time and email verification status
      await adminFirestore!.collection('users').doc(userId).update({
        lastLoginAt: new Date(),
        emailVerified: true, // Magic link confirms email ownership
        updatedAt: new Date(),
      })

      // Also update Firebase Auth record if not already verified
      if (!userRecord.emailVerified) {
        try {
          await adminAuth!.updateUser(userId, { emailVerified: true })
        } catch (error) {
          console.error('Failed to update Firebase Auth email verification:', error)
          // Continue anyway, Firestore update is more important
        }
      }

      // Redirect to dashboard
      const dashboardUrl = new URL('/dashboard', request.url)
      dashboardUrl.searchParams.set('magiclink', 'success')
      
      return NextResponse.redirect(dashboardUrl, { 
        status: 302, 
        headers: getSecurityHeaders() 
      })

    } catch (verificationError) {
      console.error('Magic link verification error:', verificationError)

      await logAuditEvent(
        AuditEvent.MAGIC_LINK_SIGNIN,
        {
          ipAddress,
          userAgent,
          endpoint: '/api/auth/magic-link/verify',
        },
        {
          token: token.slice(0, 10) + '...',
          error: verificationError instanceof Error ? verificationError.message : 'Unknown error',
        },
        'failure'
      )

      const errorUrl = new URL('/auth/error', request.url)
      errorUrl.searchParams.set('code', 'VERIFICATION_FAILED')
      return NextResponse.redirect(errorUrl, { status: 302, headers: getSecurityHeaders() })
    }

  } catch (error) {
    console.error('Magic link verify endpoint error:', error)
    
    // Log system error
    await logAuditEvent(
      AuditEvent.SYSTEM_ERROR,
      {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/magic-link/verify',
      },
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      'failure'
    )

    const errorUrl = new URL('/auth/error', request.url)
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