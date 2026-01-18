// User login endpoint
// Authenticates users with email and password

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminFirestore, ensureAdminInitialized, ensureUserProfile, setAdminClaims, isAdminUserCached } from '@/lib/firebase/admin'
import { createSession } from '@/lib/auth/session'
import { signInSchema, getSecurityHeaders, formatZodErrors } from '@/lib/auth/validation'
import { checkSigninRateLimit, getRateLimitHeaders, trackAuthAttempt, isLockedOut } from '@/lib/auth/rateLimit'
import { logAuditEvent, AuditEvent, logAuthAttempt } from '@/lib/auth/audit'
import { verifyReCaptcha, isReCaptchaConfigured } from '@/lib/auth/recaptcha'
import { z } from 'zod'

type FirebaseRestSignInResult = {
  localId: string
  email: string
  idToken: string
  refreshToken: string
  expiresIn: string
  registered?: boolean
}

async function verifyPasswordWithFirebase(
  email: string,
  password: string,
  apiKey: string
): Promise<FirebaseRestSignInResult> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  )

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error?.message || 'AUTH_FAILED'
    const error: any = new Error(message)
    error.code = message
    throw error
  }

  return data as FirebaseRestSignInResult
}

export async function POST(request: NextRequest) {
  try {
    // Ensure Firebase Admin is initialized
    ensureAdminInitialized()

    // Parse and validate request body
    const body = await request.json()
    
    let validatedData
    try {
      validatedData = signInSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Invalid input data',
              details: formatZodErrors(error),
            },
          },
          { 
            status: 400,
            headers: getSecurityHeaders(),
          }
        )
      }
      throw error
    }

    const { email, rememberMe } = validatedData
    const recaptchaToken = body.recaptchaToken
    const firebaseApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    if (!firebaseApiKey) {
      console.error('[API /auth/signin] Missing Firebase API key for REST verification')
      return NextResponse.json(
        {
          error: {
            code: 'AUTH_CONFIG_ERROR',
            message: 'Authentication configuration error',
          },
        },
        {
          status: 500,
          headers: getSecurityHeaders(),
        }
      )
    }

    // Get client information for audit logging and rate limiting
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                     request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    // Verify reCAPTCHA (if configured)
    let recaptchaScore: number | undefined
    if (isReCaptchaConfigured()) {
      console.log('[API /auth/signin] Verifying reCAPTCHA')
      const recaptchaResult = await verifyReCaptcha(recaptchaToken, 'signin')
      recaptchaScore = recaptchaResult.score

      if (!recaptchaResult.success) {
        console.warn('[API /auth/signin] reCAPTCHA failed:', recaptchaResult.error)

        await logAuthAttempt(
          AuditEvent.FAILED_LOGIN,
          {
            ipAddress,
            userAgent,
            endpoint: '/api/auth/signin',
          },
          {
            email,
            method: 'email',
            reason: 'recaptcha_failed',
            recaptchaScore: recaptchaResult.score,
          },
          'failure'
        )

        return NextResponse.json(
          {
            error: {
              code: 'RECAPTCHA_FAILED',
              message: recaptchaResult.error || 'reCAPTCHA verification failed. Please try again.',
            },
          },
          {
            status: 403,
            headers: getSecurityHeaders(),
          }
        )
      }
      console.log('[API /auth/signin] reCAPTCHA passed with score:', recaptchaResult.score)
    }

    // Check if account is locked out
    const emailIdentifier = `email:${email}`
    const ipIdentifier = `ip:${ipAddress}`
    
    const isEmailLocked = await isLockedOut(emailIdentifier)
    const isIPLocked = await isLockedOut(ipIdentifier)
    
    if (isEmailLocked || isIPLocked) {
      await logAuthAttempt(
        AuditEvent.FAILED_LOGIN,
        {
          ipAddress,
          userAgent,
          endpoint: '/api/auth/signin',
        },
        {
          email,
          method: 'email',
          reason: 'account_locked',
        },
        'failure'
      )

      return NextResponse.json(
        {
          error: {
            code: 'AUTH_TOO_MANY_ATTEMPTS',
            message: 'Account locked due to too many failed attempts. Try again in 15 minutes.',
          },
        },
        { 
          status: 429,
          headers: getSecurityHeaders(),
        }
      )
    }

    // Check rate limiting
    const rateLimitResult = await checkSigninRateLimit(request, email)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: rateLimitResult.message || 'Too many signin attempts',
          },
        },
        { 
          status: 429,
          headers: {
            ...getSecurityHeaders(),
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      )
    }

    try {
      // Verify credentials via Firebase Auth REST API
      let authResult: FirebaseRestSignInResult
      try {
        authResult = await verifyPasswordWithFirebase(email, validatedData.password, firebaseApiKey)
      } catch (error: any) {
        const reason = error?.code || 'auth_failed'
        const isInvalidCredentials = reason === 'EMAIL_NOT_FOUND' || reason === 'INVALID_PASSWORD'
        const isUserDisabled = reason === 'USER_DISABLED'

        await trackAuthAttempt(emailIdentifier, false)
        await trackAuthAttempt(ipIdentifier, false)

        await logAuthAttempt(
          AuditEvent.FAILED_LOGIN,
          {
            ipAddress,
            userAgent,
            endpoint: '/api/auth/signin',
          },
          {
            email,
            method: 'email',
            reason: isInvalidCredentials ? 'invalid_credentials' : reason,
          },
          'failure'
        )

        if (isUserDisabled) {
          return NextResponse.json(
            {
              error: {
                code: 'AUTH_USER_DISABLED',
                message: 'This account has been disabled',
              },
            },
            {
              status: 403,
              headers: {
                ...getSecurityHeaders(),
                ...getRateLimitHeaders(rateLimitResult),
              },
            }
          )
        }

        return NextResponse.json(
          {
            error: {
              code: 'AUTH_INVALID_CREDENTIALS',
              message: 'Invalid email or password',
            },
          },
          { 
            status: 401,
            headers: {
              ...getSecurityHeaders(),
              ...getRateLimitHeaders(rateLimitResult),
            },
          }
        )
      }

      const userId = authResult.localId

      // Fetch user record for additional checks
      const userRecord = await adminAuth!.getUser(userId)

      // Get user profile from Firestore to check state and tier
      const userDoc = await adminFirestore!.collection('users').doc(userRecord.uid).get()
      const userData = userDoc.data()

      console.log('[Signin] User document exists:', userDoc.exists)
      console.log('[Signin] User data subscription:', JSON.stringify(userData?.subscription))

      if (!userData) {
        throw new Error('User profile not found')
      }

      // Check if user account is suspended or deleted
      if (userData.userState === 'suspended') {
        await logAuthAttempt(
          AuditEvent.FAILED_LOGIN,
          {
            userId: userRecord.uid,
            ipAddress,
            userAgent,
            endpoint: '/api/auth/signin',
          },
          {
            email,
            method: 'email',
            reason: 'account_suspended',
          },
          'failure'
        )

        return NextResponse.json(
          {
            error: {
              code: 'AUTH_ACCOUNT_SUSPENDED',
              message: 'Your account has been suspended. Please contact support.',
            },
          },
          { 
            status: 403,
            headers: {
              ...getSecurityHeaders(),
              ...getRateLimitHeaders(rateLimitResult),
            },
          }
        )
      }

      if (userData.userState === 'deleted') {
        await logAuthAttempt(
          AuditEvent.FAILED_LOGIN,
          {
            userId: userRecord.uid,
            ipAddress,
            userAgent,
            endpoint: '/api/auth/signin',
          },
          {
            email,
            method: 'email',
            reason: 'account_deleted',
          },
          'failure'
        )

        return NextResponse.json(
          {
            error: {
              code: 'AUTH_ACCOUNT_DELETED',
              message: 'This account has been deleted.',
            },
          },
          { 
            status: 403,
            headers: {
              ...getSecurityHeaders(),
              ...getRateLimitHeaders(rateLimitResult),
            },
          }
        )
      }

      // Check if email is verified (optional enforcement)
      if (!userRecord.emailVerified && process.env.ENFORCE_EMAIL_VERIFICATION === 'true') {
        await logAuthAttempt(
          AuditEvent.FAILED_LOGIN,
          {
            userId: userRecord.uid,
            ipAddress,
            userAgent,
            endpoint: '/api/auth/signin',
          },
          {
            email,
            method: 'email',
            reason: 'email_not_verified',
          },
          'failure'
        )

        return NextResponse.json(
          {
            error: {
              code: 'AUTH_EMAIL_NOT_VERIFIED',
              message: 'Please verify your email before signing in',
            },
          },
          { 
            status: 403,
            headers: {
              ...getSecurityHeaders(),
              ...getRateLimitHeaders(rateLimitResult),
            },
          }
        )
      }

      // Clear failed attempts on successful login
      await trackAuthAttempt(emailIdentifier, true)
      await trackAuthAttempt(ipIdentifier, true)

      // Ensure user profile exists (creates it if it doesn't)
      await ensureUserProfile(userRecord.uid, userRecord.email)

      // Determine if user is admin
      const isAdmin = await isAdminUserCached(userRecord.uid)
      
      // Set Firebase custom claims for admin users
      if (isAdmin) {
        const claimsSet = await setAdminClaims(userRecord.uid, true)
        console.log('[API /auth/signin] Admin claims set:', claimsSet)
      }

      // Phase 5: Stop including tier in new sessions (using TierCache instead)
      // The tier will be fetched from TierCache when needed
      console.log('[Signin] Creating session WITHOUT embedded tier (Phase 5 migration)');
      console.log('[Signin] Tier will be fetched from TierCache with 60s TTL');

      // Warm up the tier cache for this user (pre-fetch for better UX)
      if (userData?.subscription) {
        const tier = (userData.subscription.status === 'active' || userData.subscription.status === 'trialing')
          && userData.subscription.plan
          ? userData.subscription.plan
          : 'free';
        console.log(`[Signin] Pre-warming tier cache with: ${tier}`);

        // Import tierCache for cache warming
        const { tierCache } = await import('@/lib/auth/tier-cache');
        await tierCache.setTier(userRecord.uid, tier as any);
      }

      // Create session WITHOUT tier (Phase 5)
      const session = await createSession(
        {
          uid: userRecord.uid,
          email: userRecord.email || email,
          // tier is intentionally omitted here
          admin: isAdmin,
        },
        {
          userAgent,
          ipAddress,
          rememberMe,
        }
      )

      // Log successful signin
      await logAuthAttempt(
        AuditEvent.SIGN_IN,
        {
          userId: userRecord.uid,
          sessionId: session.sessionId,
          ipAddress,
          userAgent,
          endpoint: '/api/auth/signin',
        },
        {
          email,
          method: 'email',
        },
        'success'
      )

      // Update last login time
      await adminFirestore!.collection('users').doc(userRecord.uid).update({
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })

      // Return success response
      return NextResponse.json(
        {
          success: true,
          user: {
            uid: userRecord.uid,
            email: userRecord.email,
            tier: userData.tier || 'free',
            emailVerified: userRecord.emailVerified,
            displayName: userData.displayName || userRecord.displayName,
          },
          redirectTo: '/dashboard',
          recaptcha: recaptchaScore !== undefined ? {
            verified: true,
            score: recaptchaScore,
          } : undefined,
        },
        { 
          status: 200,
          headers: {
            ...getSecurityHeaders(),
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      )

    } catch (authError: unknown) {
      // Track failed attempt
      await trackAuthAttempt(emailIdentifier, false)
      await trackAuthAttempt(ipIdentifier, false)

      // Handle authentication-specific errors
      let errorCode = 'AUTH_SIGNIN_FAILED'
      let errorMessage = 'Invalid email or password'
      let statusCode = 401

      const error = authError as any
      if (error?.code === 'auth/invalid-password') {
        errorCode = 'AUTH_INVALID_CREDENTIALS'
        errorMessage = 'Invalid email or password'
      } else if (error?.code === 'auth/user-disabled') {
        errorCode = 'AUTH_USER_DISABLED'
        errorMessage = 'This account has been disabled'
        statusCode = 403
      } else if (error?.code === 'auth/too-many-requests') {
        errorCode = 'AUTH_TOO_MANY_REQUESTS'
        errorMessage = 'Too many failed attempts. Please try again later.'
        statusCode = 429
      }

      // Log failed signin attempt
      await logAuthAttempt(
        AuditEvent.FAILED_LOGIN,
        {
          ipAddress,
          userAgent,
          endpoint: '/api/auth/signin',
        },
        {
          email,
          method: 'email',
          reason: error?.code || 'authentication_failed',
        },
        'failure'
      )

      return NextResponse.json(
        {
          error: {
            code: errorCode,
            message: errorMessage,
          },
        },
        { 
          status: statusCode,
          headers: {
            ...getSecurityHeaders(),
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      )
    }

  } catch (error) {
    console.error('Signin error:', error)
    
    // Log system error
    await logAuditEvent(
      AuditEvent.SYSTEM_ERROR,
      {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/signin',
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
          message: 'Internal server error',
        },
      },
      { 
        status: 500,
        headers: getSecurityHeaders(),
      }
    )
  }
}

export async function GET() {
  return NextResponse.json(
    { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } },
    { status: 405, headers: getSecurityHeaders() }
  )
}
