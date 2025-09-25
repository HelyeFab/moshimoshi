// Password Reset Confirm API Route
// Handles password reset with token verification

import { NextRequest, NextResponse } from 'next/server'
import { checkPasswordResetRateLimit } from '@/lib/auth/rateLimit'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'
import { adminAuth, adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { redis } from '@/lib/redis/client'
import { invalidateAllUserSessions, createSession } from '@/lib/auth/session'
import { z } from 'zod'

// Password reset confirm schema
const PasswordResetConfirmSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
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
 * POST /api/auth/password/reset-confirm
 * Confirm password reset with new password
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized()

    // Parse and validate request body
    const body = await request.json()
    const validationResult = PasswordResetConfirmSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid reset data',
            details: validationResult.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const { token, password } = validationResult.data

    // Check rate limiting
    const rateLimitResult = await checkPasswordResetRateLimit(request)
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

    // Find and validate reset token
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

    // Check if token is already used
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

    // Get user from Firebase Auth
    let user
    try {
      user = await adminAuth!.getUser(tokenData.userId)
    } catch (error) {
      console.error('User not found for reset token:', error)
      return NextResponse.json(
        {
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User account not found',
          },
        },
        { status: 404 }
      )
    }

    // Check if user account is disabled
    if (user.disabled) {
      await logAuditEvent(
        AuditEvent.SUSPICIOUS_ACTIVITY,
        {
          userId: user.uid,
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
          userAgent: request.headers.get('user-agent') || 'unknown',
          endpoint: '/api/auth/password/reset-confirm',
        },
        {
          email: tokenData.email,
          tokenId: token.substring(0, 8) + '...',
          reason: 'password_reset_attempt_disabled_account',
        },
        'warning'
      )

      return NextResponse.json(
        {
          error: {
            code: 'ACCOUNT_DISABLED',
            message: 'User account is disabled',
          },
        },
        { status: 403 }
      )
    }

    // Update password in Firebase Auth
    try {
      await adminAuth!.updateUser(tokenData.userId, {
        password: password,
      })
    } catch (error) {
      console.error('Failed to update password in Firebase Auth:', error)
      return NextResponse.json(
        {
          error: {
            code: 'PASSWORD_UPDATE_FAILED',
            message: 'Failed to update password',
          },
        },
        { status: 500 }
      )
    }

    // Mark token as used
    const updatedTokenData = {
      ...tokenData,
      used: true,
      usedAt: new Date().toISOString(),
      resetIpAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      resetUserAgent: request.headers.get('user-agent') || 'unknown',
    }

    await redis.setex(tokenKey, 24 * 60 * 60, JSON.stringify(updatedTokenData)) // Keep for 24h for audit

    // Clean up user reset token reference
    await redis.del(`user_password_reset:${tokenData.userId}`)

    // Invalidate all existing user sessions for security
    await invalidateAllUserSessions(tokenData.userId)

    // Update user document with password change timestamp
    try {
      await adminFirestore!
        .collection('users')
        .doc(tokenData.userId)
        .update({
          passwordChangedAt: new Date(),
          lastActiveAt: new Date(),
        })
    } catch (error) {
      console.warn('Could not update user document:', error)
    }

    // Get user tier for session creation
    let userTier: 'guest' | 'free' | 'premium_monthly' | 'premium_yearly' = 'free'
    try {
      const userDoc = await adminFirestore!
        .collection('users')
        .doc(tokenData.userId)
        .get()
      
      if (userDoc.exists) {
        userTier = userDoc.data()?.tier || 'free'
      }
    } catch (error) {
      console.warn('Could not fetch user tier:', error)
    }

    // Create new session for the user
    const newSession = await createSession(
      {
        uid: tokenData.userId,
        email: tokenData.email,
        tier: userTier,
        admin: user.customClaims?.admin === true,
      },
      {
        duration: 60 * 60 * 1000, // 1 hour
        userAgent: request.headers.get('user-agent') || 'unknown',
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      }
    )

    // Log audit event
    await logAuditEvent(
      AuditEvent.PASSWORD_RESET_CONFIRM,
      {
        userId: tokenData.userId,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/auth/password/reset-confirm',
      },
      {
        email: tokenData.email,
        tokenId: token.substring(0, 8) + '...',
        originalRequestIp: tokenData.ipAddress,
        sessionCreated: true,
        allSessionsInvalidated: true,
        requestedAt: tokenData.createdAt,
        completedAt: new Date().toISOString(),
      },
      'success'
    )

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully',
      data: {
        user: {
          uid: newSession.uid,
          email: newSession.email,
          tier: newSession.tier,
        },
        sessionCreated: true,
        redirectTo: '/dashboard',
      },
    })

  } catch (error) {
    console.error('Error confirming password reset:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to reset password',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/auth/password/reset-confirm
 * Handle preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'POST, OPTIONS',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}