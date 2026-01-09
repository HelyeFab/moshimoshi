// Magic link request endpoint
// Generates and sends passwordless authentication links

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { magicLinkRequestSchema, getSecurityHeaders, formatZodErrors } from '@/lib/auth/validation'
import { checkMagicLinkRateLimit, getRateLimitHeaders } from '@/lib/auth/rateLimit'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'
import { sendMagicLinkEmail } from '@/lib/email/resend'
import { z } from 'zod'

// Magic link email sending is now handled by the imported sendMagicLinkEmail from @/lib/email/resend

export async function POST(request: NextRequest) {
  try {
    // Ensure Firebase Admin is initialized
    ensureAdminInitialized()

    // Check rate limiting
    const rateLimitResult = await checkMagicLinkRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: rateLimitResult.message || 'Too many magic link requests',
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
      validatedData = magicLinkRequestSchema.parse(body)
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

    const { email } = validatedData

    // Get client information for audit logging
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || 'unknown'

    try {
      // Check if user exists (but don't reveal this information to prevent email enumeration)
      let userRecord
      let userExists = false
      let displayName: string | undefined

      try {
        userRecord = await adminAuth!.getUserByEmail(email)
        userExists = true
        
        // Get display name from Firestore
        const userDoc = await adminFirestore!.collection('users').doc(userRecord.uid).get()
        const userData = userDoc.data()
        displayName = userData?.displayName || userRecord.displayName || undefined
        
        // Check if account is active
        if (userData?.userState === 'suspended') {
          await logAuditEvent(
            AuditEvent.MAGIC_LINK_REQUEST,
            {
              userId: userRecord.uid,
              ipAddress,
              userAgent,
              endpoint: '/api/auth/magic-link/request',
            },
            {
              email,
              reason: 'account_suspended',
            },
            'failure'
          )

          // Don't reveal account status, just return generic success message
          return NextResponse.json(
            {
              success: true,
              message: 'If an account exists with this email, a sign-in link has been sent',
            },
            { 
              status: 200,
              headers: {
                ...getSecurityHeaders(),
                ...getRateLimitHeaders(rateLimitResult),
              },
            }
          )
        }

        if (userData?.userState === 'deleted') {
          await logAuditEvent(
            AuditEvent.MAGIC_LINK_REQUEST,
            {
              ipAddress,
              userAgent,
              endpoint: '/api/auth/magic-link/request',
            },
            {
              email,
              reason: 'account_deleted',
            },
            'failure'
          )

          // Don't reveal account status
          return NextResponse.json(
            {
              success: true,
              message: 'If an account exists with this email, a sign-in link has been sent',
            },
            { 
              status: 200,
              headers: {
                ...getSecurityHeaders(),
                ...getRateLimitHeaders(rateLimitResult),
              },
            }
          )
        }

      } catch (error) {
        if ((error as any)?.code === 'auth/user-not-found') {
          userExists = false
        } else {
          throw error // Re-throw unexpected errors
        }
      }

      // Only send magic link if user exists and is active
      if (userExists && userRecord) {
        // Generate Firebase magic link using Firebase Admin SDK
        // Note: Using /en as default locale for magic links (will work for all users)
        const actionCodeSettings = {
          url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/en/auth/verify-magic-link`,
          handleCodeInApp: true,
        }

        const firebaseMagicLink = await adminAuth!.generateSignInWithEmailLink(
          email,
          actionCodeSettings
        )

        // Log the link in development for easy testing
        if (process.env.NODE_ENV === 'development') {
          console.log('🔗 Firebase Magic Link for', email, ':', firebaseMagicLink)
        }

        // Send the magic link email (Firebase handles token storage and validation)
        try {
          await sendMagicLinkEmail(email, firebaseMagicLink)
          
          // Log successful magic link request
          await logAuditEvent(
            AuditEvent.MAGIC_LINK_REQUEST,
            {
              userId: userRecord.uid,
              ipAddress,
              userAgent,
              endpoint: '/api/auth/magic-link/request',
            },
            {
              email,
              tokenGenerated: true,
            },
            'success'
          )

        } catch (emailError) {
          console.error('Failed to send magic link email:', emailError)

          // Note: Firebase handles token lifecycle, no cleanup needed

          await logAuditEvent(
            AuditEvent.MAGIC_LINK_REQUEST,
            {
              userId: userRecord.uid,
              ipAddress,
              userAgent,
              endpoint: '/api/auth/magic-link/request',
            },
            {
              email,
              error: 'email_send_failed',
            },
            'failure'
          )

          return NextResponse.json(
            {
              error: {
                code: 'EMAIL_SEND_FAILED',
                message: 'Failed to send magic link. Please try again.',
              },
            },
            { 
              status: 500,
              headers: {
                ...getSecurityHeaders(),
                ...getRateLimitHeaders(rateLimitResult),
              },
            }
          )
        }
      } else {
        // User doesn't exist, but we still log the attempt
        await logAuditEvent(
          AuditEvent.MAGIC_LINK_REQUEST,
          {
            ipAddress,
            userAgent,
            endpoint: '/api/auth/magic-link/request',
          },
          {
            email,
            reason: 'user_not_found',
          },
          'failure'
        )
      }

      // Always return success message to prevent email enumeration
      return NextResponse.json(
        {
          success: true,
          message: 'If an account exists with this email, a sign-in link has been sent',
        },
        { 
          status: 200,
          headers: {
            ...getSecurityHeaders(),
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      )

    } catch (magicLinkError) {
      console.error('Magic link request error:', magicLinkError)

      await logAuditEvent(
        AuditEvent.MAGIC_LINK_REQUEST,
        {
          ipAddress,
          userAgent,
          endpoint: '/api/auth/magic-link/request',
        },
        {
          email,
          error: magicLinkError instanceof Error ? magicLinkError.message : 'Unknown error',
        },
        'failure'
      )

      return NextResponse.json(
        {
          error: {
            code: 'MAGIC_LINK_FAILED',
            message: 'Failed to process magic link request',
          },
        },
        { 
          status: 500,
          headers: {
            ...getSecurityHeaders(),
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      )
    }

  } catch (error) {
    console.error('Magic link request endpoint error:', error)
    
    // Log system error
    await logAuditEvent(
      AuditEvent.SYSTEM_ERROR,
      {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/magic-link/request',
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