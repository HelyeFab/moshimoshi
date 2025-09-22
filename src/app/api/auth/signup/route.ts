// User registration endpoint
// Creates new user accounts with email/password authentication

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminFirestore, ensureAdminInitialized, ensureUserProfile } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { createSession } from '@/lib/auth/session'
import { signUpSchema, getSecurityHeaders, formatZodErrors } from '@/lib/auth/validation'
import { checkSignupRateLimit, getRateLimitHeaders } from '@/lib/auth/rateLimit'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  console.log('[API /auth/signup] Request received')
  
  try {
    // Ensure Firebase Admin is initialized
    console.log('[API /auth/signup] Initializing Firebase Admin')
    ensureAdminInitialized()

    // Check rate limiting
    console.log('[API /auth/signup] Checking rate limit')
    const rateLimitResult = await checkSignupRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: rateLimitResult.message || 'Too many signup attempts',
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

    // Parse and validate request body
    const body = await request.json()
    
    let validatedData
    try {
      validatedData = signUpSchema.parse(body)
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

    const { email, password, displayName } = validatedData
    console.log('[API /auth/signup] Validated data:', { email, displayName })

    // Get client information for audit logging
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    try {
      // Create Firebase user
      console.log('[API /auth/signup] Creating Firebase user for:', email)
      const userRecord = await adminAuth!.createUser({
        email,
        password,
        displayName: displayName || email.split('@')[0],
        emailVerified: true, // Set to true since we're not sending verification emails yet
      })

      // Create user profile in Firestore with complete schema
      await ensureUserProfile(userRecord.uid, email)

      // Update with authentication-specific fields using merge
      await adminFirestore!.collection('users').doc(userRecord.uid).set({
        displayName: displayName || email.split('@')[0],
        emailVerified: true,
        authProvider: 'email',
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })

      // Create session
      await createSession(
        {
          uid: userRecord.uid,
          email,
          tier: 'free',
        },
        {
          userAgent,
          ipAddress,
          rememberMe: false,
        }
      )

      // Log successful signup
      await logAuditEvent(
        AuditEvent.SIGN_UP,
        {
          userId: userRecord.uid,
          ipAddress,
          userAgent,
          endpoint: '/api/auth/signup',
        },
        {
          email,
          displayName: displayName || null,
        },
        'success'
      )

      // Return success response
      const response = NextResponse.json(
        {
          success: true,
          user: {
            uid: userRecord.uid,
            email,
            tier: 'free',
            emailVerified: true,
          },
          requiresVerification: false, // Not requiring verification since we're not sending emails yet
        },
        { 
          status: 201,
          headers: {
            ...getSecurityHeaders(),
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      )

      return response

    } catch (firebaseError: unknown) {
      // Handle Firebase-specific errors
      const error = firebaseError as any
      console.error('[API /auth/signup] Firebase error:', error?.code, error?.message, error)

      let errorCode = 'AUTH_SIGNUP_FAILED'
      let errorMessage = 'Failed to create account'
      let statusCode = 500

      // Firebase Admin SDK uses 'auth/email-already-exists'
      // But sometimes it might be 'auth/email-already-in-use'
      if (error?.code === 'auth/email-already-exists' || error?.code === 'auth/email-already-in-use') {
        errorCode = 'AUTH_EMAIL_EXISTS'
        errorMessage = 'This email is already registered. Please sign in instead.'
        statusCode = 409
      } else if (error?.code === 'auth/weak-password') {
        errorCode = 'AUTH_WEAK_PASSWORD'
        errorMessage = 'Password does not meet security requirements'
        statusCode = 400
      } else if (error?.code === 'auth/invalid-email') {
        errorCode = 'AUTH_INVALID_EMAIL'
        errorMessage = 'Invalid email address'
        statusCode = 400
      }

      // Log failed signup attempt
      await logAuditEvent(
        AuditEvent.SIGN_UP,
        {
          ipAddress,
          userAgent,
          endpoint: '/api/auth/signup',
        },
        {
          email,
          errorCode,
          errorMessage: error?.message || errorMessage,
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
    console.error('[API /auth/signup] Unexpected error:', error)
    
    // Log system error
    await logAuditEvent(
      AuditEvent.SYSTEM_ERROR,
      {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/signup',
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