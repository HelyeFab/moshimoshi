// Magic Link authentication endpoint
// Sends a passwordless sign-in link to the user's email

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, ensureAdminInitialized } from '@/lib/firebase/admin'
import { getSecurityHeaders } from '@/lib/auth/validation'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'
import { sendMagicLinkEmail } from '@/lib/email/resend'

export async function POST(request: NextRequest) {
  console.log('[API /auth/magic-link] Request received')

  try {
    // Ensure Firebase Admin is initialized
    console.log('[API /auth/magic-link] Initializing Firebase Admin')
    try {
      ensureAdminInitialized()
    } catch (initError: any) {
      console.error('[API /auth/magic-link] Firebase Admin initialization failed:', initError)
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
    const { email } = body

    if (!email) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_EMAIL',
            message: 'Email is required',
          },
        },
        {
          status: 400,
          headers: getSecurityHeaders(),
        }
      )
    }

    console.log('[API /auth/magic-link] Generating magic link for:', email)

    // Generate the magic link URL
    const actionCodeSettings = {
      // URL to redirect to after the user clicks the link
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://moshimoshi.app'}/auth/verify-magic-link`,
      // This must be true for email link sign-in
      handleCodeInApp: true,
    }

    try {
      // Generate the sign-in link
      const link = await adminAuth!.generateSignInWithEmailLink(email, actionCodeSettings)

      console.log('[API /auth/magic-link] Magic link generated successfully')

      // Send the magic link via email
      try {
        await sendMagicLinkEmail(email, link)
        console.log('[API /auth/magic-link] Email sent successfully')
      } catch (emailError) {
        console.error('[API /auth/magic-link] Failed to send email:', emailError)
        // Continue even if email fails in development
        if (process.env.NODE_ENV !== 'development') {
          throw emailError
        }
      }

      // Log the event
      await logAuditEvent(
        AuditEvent.MAGIC_LINK_REQUEST,
        {
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          endpoint: '/api/auth/magic-link',
        },
        {
          email,
        },
        'success'
      )

      // In development, return the link for testing
      if (process.env.NODE_ENV === 'development') {
        return NextResponse.json(
          {
            success: true,
            message: 'Magic link sent to your email',
            // Remove this in production!
            devLink: link,
          },
          {
            status: 200,
            headers: getSecurityHeaders(),
          }
        )
      }

      // In production, just confirm the email was sent
      return NextResponse.json(
        {
          success: true,
          message: 'Magic link sent to your email',
        },
        {
          status: 200,
          headers: getSecurityHeaders(),
        }
      )

    } catch (linkError: any) {
      console.error('[API /auth/magic-link] Failed to generate magic link:', linkError)

      // Check if user exists
      if (linkError.code === 'auth/user-not-found') {
        // Optionally create the user first
        try {
          await adminAuth!.createUser({
            email,
            emailVerified: false,
          })

          // Retry generating the link
          const link = await adminAuth!.generateSignInWithEmailLink(email, actionCodeSettings)

          console.log('[API /auth/magic-link] User created and magic link sent')

          return NextResponse.json(
            {
              success: true,
              message: 'Magic link sent to your email',
              newUser: true,
            },
            {
              status: 200,
              headers: getSecurityHeaders(),
            }
          )
        } catch (createError: any) {
          console.error('[API /auth/magic-link] Failed to create user:', createError)
          throw createError
        }
      }

      throw linkError
    }

  } catch (error: any) {
    console.error('[API /auth/magic-link] Error:', error?.message || error)

    // Log error
    await logAuditEvent(
      AuditEvent.SYSTEM_ERROR,
      {
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/magic-link',
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
          code: 'MAGIC_LINK_FAILED',
          message: error.message || 'Failed to send magic link',
        },
      },
      {
        status: 500,
        headers: getSecurityHeaders(),
      }
    )
  }
}