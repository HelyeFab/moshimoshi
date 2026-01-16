// Apple OAuth authentication endpoint
// Verifies Apple ID tokens and creates sessions

import { NextRequest, NextResponse } from 'next/server'
import {
  adminAuth,
  adminFirestore,
  ensureAdminInitialized,
  ensureUserProfile,
  setAdminClaims,
  isAdminUser,
  FieldValue,
} from '@/lib/firebase/admin'
import { getSecurityHeaders } from '@/lib/auth/validation'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'
import { getUserTier } from '@/lib/auth/tier-utils'
import { linkWaitlistToUser } from '@/lib/waitlist/linkWaitlist'

export async function POST(request: NextRequest) {
  console.log('[API /auth/apple] Request received')

  try {
    // Ensure Firebase Admin is initialized
    console.log('[API /auth/apple] Initializing Firebase Admin')
    try {
      ensureAdminInitialized()
    } catch (initError: any) {
      console.error('[API /auth/apple] Firebase Admin initialization failed:', initError)
      return NextResponse.json(
        {
          error: {
            code: 'FIREBASE_INIT_FAILED',
            message: 'Firebase Admin initialization failed: ' + initError.message,
          },
        },
        {
          status: 500,
          headers: getSecurityHeaders(),
        }
      )
    }

    // Parse request body
    const body = await request.json()
    const { idToken } = body

    if (!idToken) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_TOKEN',
            message: 'ID token is required',
          },
        },
        {
          status: 400,
          headers: getSecurityHeaders(),
        }
      )
    }

    console.log('[API /auth/apple] Verifying ID token')

    // Verify the ID token
    let decodedToken
    try {
      if (!adminAuth) {
        throw new Error('Firebase Admin Auth is not initialized')
      }
      decodedToken = await adminAuth.verifyIdToken(idToken)
    } catch (verifyError: any) {
      console.error('[API /auth/apple] Token verification failed:', verifyError)
      return NextResponse.json(
        {
          error: {
            code: 'TOKEN_VERIFICATION_FAILED',
            message: 'Failed to verify ID token: ' + verifyError.message,
          },
        },
        {
          status: 401,
          headers: getSecurityHeaders(),
        }
      )
    }
    const uid = decodedToken.uid
    const email = decodedToken.email
    const displayName = decodedToken.name || email?.split('@')[0]

    console.log('[API /auth/apple] Token verified for:', email)

    // Check if user exists in Firestore
    const userDoc = await adminFirestore!.collection('users').doc(uid).get()

    let isNewUser = false

    if (!userDoc.exists) {
      // Create new user profile
      console.log('[API /auth/apple] Creating new user profile')
      isNewUser = true

      // Use ensureUserProfile for complete default schema
      await ensureUserProfile(uid, email)

      // Add authentication-specific fields using merge
      await adminFirestore!
        .collection('users')
        .doc(uid)
        .set(
          {
            displayName,
            photoURL: null,
            emailVerified: true,
            authProvider: 'apple',
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        )

      // Check if user is on waitlist and grant discount eligibility
      // This is non-blocking - if it fails, signup continues
      if (email) {
        try {
          const wasOnWaitlist = await linkWaitlistToUser(email, uid)
          if (wasOnWaitlist) {
            console.log('[API /auth/apple] User was on waitlist, discount eligibility granted')
          }
        } catch (waitlistError) {
          console.error('[API /auth/apple] Waitlist linking failed (non-critical):', waitlistError)
        }
      }
    } else {
      // Update last login
      console.log('[API /auth/apple] Updating existing user')
      const updateData: any = {
        lastLoginAt: new Date(),
        updatedAt: new Date(),
        emailVerified: true,
      }

      await adminFirestore!.collection('users').doc(uid).update(updateData)
    }

    // Get user data for session
    const userData = isNewUser
      ? { uid, email, displayName, emailVerified: true }
      : userDoc.data() || { uid, email, displayName, emailVerified: true }

    // Determine user tier from subscription data
    const userTier = getUserTier(userData)

    // Check if user is admin using Firebase isAdmin field
    const isAdmin = await isAdminUser(uid)
    console.log(
      '[API /auth/apple] Admin check for user:',
      isAdmin ? 'Admin verified' : 'Regular user'
    )

    // Set Firebase custom claims for admin users
    if (isAdmin) {
      const claimsSet = await setAdminClaims(uid, true)
      console.log('[API /auth/apple] Admin claims set:', claimsSet)
    }

    // Create session token
    let sessionToken
    try {
      const { createSessionToken, decodeSessionToken, generateFingerprint } =
        await import('@/lib/auth/jwt')

      // Generate fingerprint from request headers
      const userAgent = request.headers.get('user-agent') || 'unknown'
      const ipAddress =
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        'unknown'
      const fingerprint = generateFingerprint(userAgent, ipAddress)

      sessionToken = await createSessionToken(
        {
          uid,
          email: userData.email || email,
          tier: userTier,
          fingerprint,
          admin: isAdmin,
        },
        7 * 24 * 60 * 60 * 1000
      ) // 7 days for Apple auth

      // Store session in Redis cache for validation
      const decoded = decodeSessionToken(sessionToken)
      if (decoded) {
        try {
          const { redis } = await import('@/lib/redis/client')
          const sessionCacheKey = `session:${decoded.sid}`
          await redis.setex(
            sessionCacheKey,
            60 * 60 * 24 * 7,
            JSON.stringify({
              uid,
              tier: userTier,
              valid: true,
              fingerprint: decoded.fingerprint,
            })
          )
          console.log(`[API /auth/apple] Session cached in Redis with tier: ${userTier}`)
        } catch (redisError) {
          console.error('[API /auth/apple] Redis error (continuing anyway):', redisError)
          // Continue even if Redis fails - the JWT is still valid
        }
      }
    } catch (sessionError) {
      console.error('[API /auth/apple] Session creation error:', sessionError)
      throw sessionError
    }

    // Set session cookie
    const { serialize } = await import('cookie')
    serialize('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days for Apple auth
    })

    // Log successful authentication
    await logAuditEvent(
      isNewUser ? AuditEvent.SIGN_UP : AuditEvent.SIGN_IN,
      {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/apple',
      },
      {
        userId: uid,
        email,
        authProvider: 'apple',
        isNewUser,
      },
      'success'
    )

    console.log('[API /auth/apple] Session created successfully')

    const response = NextResponse.json(
      {
        success: true,
        user: {
          uid,
          email,
          displayName,
          photoURL: null,
          tier: userTier,
          emailVerified: true,
        },
        isNewUser,
      },
      {
        status: 200,
        headers: getSecurityHeaders(),
      }
    )

    // Set the session cookie using NextResponse cookie method
    if (sessionToken) {
      response.cookies.set('session', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days for Apple auth
      })
    } else {
      console.error('[API /auth/apple] No session token to set in cookie')
    }

    return response
  } catch (error: any) {
    console.error('[API /auth/apple] Error:', error?.message || error)

    // Log error
    await logAuditEvent(
      AuditEvent.SYSTEM_ERROR,
      {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/apple',
      },
      {
        error: error.message,
        code: error.code,
      },
      'failure'
    )

    return NextResponse.json(
      {
        error: {
          code: 'APPLE_AUTH_FAILED',
          message: error.message || 'Apple authentication failed',
        },
      },
      {
        status: 500,
        headers: getSecurityHeaders(),
      }
    )
  }
}
