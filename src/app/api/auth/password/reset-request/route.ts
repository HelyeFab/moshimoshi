// Password Reset Request API Route
// Handles password reset request initiation

import { NextRequest, NextResponse } from 'next/server'
import { checkPasswordResetRateLimit } from '@/lib/auth/rateLimit'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'
import { adminAuth, adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { redis, CacheTTL } from '@/lib/redis/client'
import { z } from 'zod'
import crypto from 'crypto'

// Password reset request schema
const PasswordResetRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export interface PasswordResetToken {
  token: string
  userId: string
  email: string
  createdAt: string
  expiresAt: string
  used: boolean
  ipAddress: string
  userAgent: string
}

/**
 * Generate secure password reset token
 */
function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Send password reset email (mock implementation)
 * In production, integrate with your email service (SendGrid, Postmark, etc.)
 */
async function sendPasswordResetEmail(email: string, resetToken: string, userDisplayName?: string) {
  // Mock email sending - replace with real email service
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`
  
  console.log(`
    ===========================================
    PASSWORD RESET EMAIL (MOCK)
    ===========================================
    To: ${email}
    Subject: Reset Your Moshimoshi Password
    
    Hello ${userDisplayName || 'there'},
    
    You requested a password reset for your Moshimoshi account.
    
    Click the link below to reset your password:
    ${resetUrl}
    
    This link will expire in 1 hour.
    
    If you didn't request this, please ignore this email.
    
    Best regards,
    The Moshimoshi Team
    ===========================================
  `)

  // In production, replace with actual email service:
  // await emailService.send({
  //   to: email,
  //   subject: 'Reset Your Moshimoshi Password',
  //   template: 'password-reset',
  //   data: {
  //     resetUrl,
  //     userDisplayName: userDisplayName || 'there',
  //   }
  // })
}

/**
 * POST /api/auth/password/reset-request
 * Request password reset
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized()

    // Parse and validate request body
    const body = await request.json()
    const validationResult = PasswordResetRequestSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid email address',
            details: validationResult.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const { email } = validationResult.data

    // Check rate limiting
    const rateLimitResult = await checkPasswordResetRateLimit(request, email)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'RATE_LIMITED',
            message: rateLimitResult.message,
          },
        },
        { status: 429 }
      )
    }

    // Check if user exists
    let user
    try {
      user = await adminAuth!.getUserByEmail(email)
    } catch {
      // For security, don't reveal if user exists or not
      // Always return success to prevent email enumeration attacks
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      })
    }

    // Check if user account is disabled
    if (user.disabled) {
      // Don't reveal account status, but log the attempt
      await logAuditEvent(
        AuditEvent.SUSPICIOUS_ACTIVITY,
        {
          userId: user.uid,
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          endpoint: '/api/auth/password/reset-request',
        },
        {
          email,
          reason: 'password_reset_attempt_disabled_account',
        },
        'warning'
      )

      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      })
    }

    // Check for existing valid reset token - OPTIMIZED: Use batch operation
    const existingTokens = await redis.keys(`password_reset:*:${user.uid}`)
    
    if (existingTokens.length > 0) {
      // OPTIMIZATION: Batch fetch all tokens at once using MGET
      const tokenDataArray = await redis.mget(...existingTokens)
      
      // Check if any existing tokens are still valid
      for (const tokenData of tokenDataArray) {
        if (tokenData) {
          const token: PasswordResetToken = JSON.parse(tokenData as string)
          if (!token.used && new Date(token.expiresAt) > new Date()) {
            // Valid token exists, don't create a new one
            return NextResponse.json({
              success: true,
              message: 'If an account with that email exists, a password reset link has been sent.',
            })
          }
        }
      }
    }

    // Generate reset token
    const resetToken = generateResetToken()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour

    const resetTokenData: PasswordResetToken = {
      token: resetToken,
      userId: user.uid,
      email: user.email || email,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      used: false,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }

    // Store reset token in Redis
    const resetKey = `password_reset:${resetToken}:${user.uid}`
    await redis.setex(resetKey, CacheTTL.PASSWORD_RESET, JSON.stringify(resetTokenData))

    // Store user-specific reset token reference for cleanup
    const userResetKey = `user_password_reset:${user.uid}`
    await redis.setex(userResetKey, CacheTTL.PASSWORD_RESET, resetToken)

    // Get user display name for personalized email
    let userDisplayName: string | undefined
    try {
      const userDoc = await adminFirestore!
        .collection('users')
        .doc(user.uid)
        .get()
      
      if (userDoc.exists) {
        userDisplayName = userDoc.data()?.displayName
      }
    } catch (error) {
      console.warn('Could not fetch user display name:', error)
    }

    // Send reset email
    try {
      await sendPasswordResetEmail(email, resetToken, userDisplayName)
    } catch (error) {
      console.error('Failed to send reset email:', error)
      
      // Clean up the token since email failed
      await redis.del(resetKey)
      await redis.del(userResetKey)
      
      return NextResponse.json(
        {
          error: {
            code: 'EMAIL_SEND_FAILED',
            message: 'Failed to send reset email. Please try again.',
          },
        },
        { status: 500 }
      )
    }

    // Log audit event
    await logAuditEvent(
      AuditEvent.PASSWORD_RESET_REQUEST,
      {
        userId: user.uid,
        ipAddress: resetTokenData.ipAddress,
        userAgent: resetTokenData.userAgent,
        endpoint: '/api/auth/password/reset-request',
      },
      {
        email,
        resetTokenId: resetToken.substring(0, 8) + '...', // Only log partial token for security
        expiresAt: expiresAt.toISOString(),
      },
      'success'
    )

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
      data: {
        email,
        expiresIn: '1 hour',
      },
    })

  } catch (error) {
    console.error('Error requesting password reset:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process password reset request',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/password/reset-request?token=xxx
 * Validate reset token (for reset form)
 */
export async function GET(request: NextRequest) {
  try {
    ensureAdminInitialized()

    const url = new URL(request.url)
    const token = url.searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        {
          error: {
            code: 'MISSING_TOKEN',
            message: 'Reset token is required',
          },
        },
        { status: 400 }
      )
    }

    // Find token in Redis (we need to check all possible keys)
    const tokenKeys = await redis.keys(`password_reset:${token}:*`)
    
    if (tokenKeys.length === 0) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired reset token',
          },
        },
        { status: 404 }
      )
    }

    const tokenKey = tokenKeys[0]
    const tokenDataStr = await redis.get(tokenKey)
    
    if (!tokenDataStr) {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_TOKEN',
            message: 'Invalid or expired reset token',
          },
        },
        { status: 404 }
      )
    }

    const tokenData: PasswordResetToken = JSON.parse(tokenDataStr as string)

    // Check if token is used
    if (tokenData.used) {
      return NextResponse.json(
        {
          error: {
            code: 'TOKEN_USED',
            message: 'Reset token has already been used',
          },
        },
        { status: 410 }
      )
    }

    // Check if token is expired
    if (new Date(tokenData.expiresAt) <= new Date()) {
      // Clean up expired token
      await redis.del(tokenKey)
      await redis.del(`user_password_reset:${tokenData.userId}`)
      
      return NextResponse.json(
        {
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Reset token has expired',
          },
        },
        { status: 410 }
      )
    }

    // Token is valid
    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        email: tokenData.email,
        expiresAt: tokenData.expiresAt,
      },
    })

  } catch (error) {
    console.error('Error validating reset token:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to validate reset token',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/auth/password/reset-request
 * Handle preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}