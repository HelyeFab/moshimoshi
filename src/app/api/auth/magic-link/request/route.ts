// Magic link request endpoint
// Generates and sends passwordless authentication links

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { magicLinkRequestSchema, getSecurityHeaders, formatZodErrors } from '@/lib/auth/validation'
import { checkMagicLinkRateLimit, getRateLimitHeaders } from '@/lib/auth/rateLimit'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'
import { createEmailVerificationToken } from '@/lib/auth/jwt'
import { redis, RedisKeys, CacheTTL } from '@/lib/redis/client'
import { z } from 'zod'

// In a real implementation, you would integrate with an email service like:
// - SendGrid
// - AWS SES
// - Mailgun
// - Resend
// For now, we'll simulate the email sending
async function sendMagicLinkEmail(
  email: string, 
  magicToken: string
): Promise<void> {
  const magicLink = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/magic-link/verify?token=${magicToken}`
  
  // In development, log the magic link
  if (process.env.NODE_ENV === 'development') {
    console.log('🔗 Magic Link for', email, ':', magicLink)
  }

  // TODO: Integrate with actual email service
  // Example with SendGrid:
  /*
  const msg = {
    to: email,
    from: process.env.EMAIL_FROM,
    subject: 'Sign in to Moshimoshi',
    html: `
      <h1>Sign in to Moshimoshi</h1>
      <p>Hello ${displayName || 'there'},</p>
      <p>Click the link below to sign in to your account:</p>
      <a href="${magicLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Sign In</a>
      <p>This link will expire in 15 minutes.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
  }
  
  await sgMail.send(msg)
  */
}

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
        // Generate magic link token
        const magicToken = createEmailVerificationToken(
          email,
          userRecord.uid,
          15 * 60 * 1000 // 15 minutes
        )

        // Store token in Redis for verification
        const magicLinkKey = RedisKeys.magicLink(magicToken)
        await redis.setex(magicLinkKey, CacheTTL.MAGIC_LINK, JSON.stringify({
          userId: userRecord.uid,
          email,
          createdAt: new Date().toISOString(),
          ipAddress,
          userAgent,
        }))

        // Send the magic link email
        try {
          await sendMagicLinkEmail(email, magicToken)
          
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
          
          // Clean up the token since email failed
          await redis.del(magicLinkKey)
          
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