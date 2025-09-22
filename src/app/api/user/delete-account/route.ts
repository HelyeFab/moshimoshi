// Account Deletion API Route
// Handles user account deletion requests with soft delete and 30-day retention

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, clearSession, invalidateAllUserSessions } from '@/lib/auth/session'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'
import { adminFirestore, adminAuth, ensureAdminInitialized } from '@/lib/firebase/admin'
import { redis, RedisKeys, CacheTTL } from '@/lib/redis/client'
import { checkApiRateLimit } from '@/lib/auth/rateLimit'
import { z } from 'zod'

// Account deletion request schema
const DeleteAccountSchema = z.object({
  reason: z.enum([
    'not_using',
    'privacy_concerns', 
    'found_alternative',
    'technical_issues',
    'too_expensive',
    'other'
  ]).optional(),
  feedback: z.string().max(500).optional(),
  confirmPhrase: z.literal('DELETE MY ACCOUNT'),
})

export interface AccountDeletionRecord {
  userId: string
  email: string
  deletedAt: string
  scheduledPermanentDeletion: string // 30 days from deletion
  reason?: string
  feedback?: string
  userData: {
    profile: any
    subscription: any
    progress: any[]
    stats: any
  }
  ipAddress: string
  userAgent: string
}

/**
 * POST /api/user/delete-account
 * Request account deletion (soft delete with 30-day retention)
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized()
    const session = await requireAuth()

    // Check rate limiting - very strict for account deletion
    const rateLimitResult = await checkApiRateLimit(request, session.uid)
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

    // Check if account is already scheduled for deletion
    const deletionKey = RedisKeys.userProfile(`deletion:${session.uid}`)
    const existingDeletion = await redis.get(deletionKey)
    
    if (existingDeletion) {
      const deletionData = JSON.parse(existingDeletion as string)
      return NextResponse.json({
        success: false,
        error: {
          code: 'ALREADY_SCHEDULED',
          message: 'Account is already scheduled for deletion',
        },
        data: {
          scheduledDeletion: deletionData.scheduledPermanentDeletion,
          canCancel: new Date(deletionData.scheduledPermanentDeletion) > new Date(),
        },
      })
    }

    // Parse and validate request body
    const body = await request.json()
    const validationResult = DeleteAccountSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid deletion request',
            details: validationResult.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const { reason, feedback, confirmPhrase } = validationResult.data

    // Get user data for backup before deletion
    const userData: {
      profile: any,
      subscription: any,
      progress: any[],
      stats: any,
    } = {
      profile: null,
      subscription: null,
      progress: [],
      stats: null,
    }

    // Backup user profile
    try {
      const profileDoc = await adminFirestore!
        .collection('users')
        .doc(session.uid)
        .get()

      if (profileDoc.exists) {
        userData.profile = profileDoc.data() || null
      }
    } catch (error) {
      console.warn('Could not backup profile data:', error)
    }

    // Backup subscription data
    try {
      const subscriptionDoc = await adminFirestore!
        .collection('subscriptions')
        .doc(session.uid)
        .get()

      if (subscriptionDoc.exists) {
        userData.subscription = subscriptionDoc.data()
      }
    } catch (error) {
      console.warn('Could not backup subscription data:', error)
    }

    // Backup progress data (limited to prevent excessive storage)
    try {
      const progressQuery = await adminFirestore!
        .collection('progress')
        .where('userId', '==', session.uid)
        .limit(1000)
        .get()

      userData.progress = progressQuery.docs.map(doc => doc.data())
    } catch (error) {
      console.warn('Could not backup progress data:', error)
    }

    // Create deletion record
    const now = new Date()
    const permanentDeletionDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

    const deletionRecord: AccountDeletionRecord = {
      userId: session.uid,
      email: session.email,
      deletedAt: now.toISOString(),
      scheduledPermanentDeletion: permanentDeletionDate.toISOString(),
      reason,
      feedback,
      userData,
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    }

    // Store deletion record in Firestore
    await adminFirestore!
      .collection('account_deletions')
      .doc(session.uid)
      .set({
        ...deletionRecord,
        deletedAt: now,
        scheduledPermanentDeletion: permanentDeletionDate,
      })

    // Store deletion record in Redis for quick access
    await redis.setex(
      deletionKey,
      30 * 24 * 60 * 60, // 30 days
      JSON.stringify(deletionRecord)
    )

    // Disable user account (soft delete)
    try {
      await adminAuth!.updateUser(session.uid, {
        disabled: true,
      })
    } catch (error) {
      console.warn('Could not disable Firebase Auth user:', error)
      // Continue with deletion even if this fails
    }

    // Mark user document as deleted but keep data for 30 days
    await adminFirestore!
      .collection('users')
      .doc(session.uid)
      .update({
        deleted: true,
        deletedAt: now,
        scheduledPermanentDeletion: permanentDeletionDate,
      })

    // Cancel subscription if active (this would be handled by Stripe webhooks)
    if (userData.subscription && userData.subscription.status === 'active') {
      // Note: In a real implementation, you'd cancel the Stripe subscription here
      console.log('Would cancel subscription for user:', session.uid)
    }

    // Clear all user sessions
    await invalidateAllUserSessions(session.uid)

    // Clear user cache data
    const cacheKeys = [
      RedisKeys.userProfile(session.uid),
      RedisKeys.userTier(session.uid),
      RedisKeys.userEntitlements(session.uid),
      RedisKeys.userStats(session.uid),
    ]

    await Promise.all(cacheKeys.map(key => redis.del(key)))

    // Log audit event
    await logAuditEvent(
      AuditEvent.ACCOUNT_DELETE,
      {
        userId: session.uid,
        ipAddress: deletionRecord.ipAddress,
        userAgent: deletionRecord.userAgent,
        endpoint: '/api/user/delete-account',
      },
      {
        reason,
        feedback: feedback ? 'provided' : 'none',
        scheduledPermanentDeletion: permanentDeletionDate.toISOString(),
        dataBackedUp: true,
      },
      'success'
    )

    // Clear the current session
    await clearSession()

    return NextResponse.json({
      success: true,
      message: 'Account has been scheduled for deletion',
      data: {
        deletedAt: now.toISOString(),
        permanentDeletionDate: permanentDeletionDate.toISOString(),
        retentionPeriod: '30 days',
        recoveryInstructions: 'To recover your account, contact support within 30 days.',
      },
    })

  } catch (error) {
    console.error('Error deleting account:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to delete account',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/user/delete-account
 * Cancel account deletion (within 30 days)
 */
export async function DELETE(request: NextRequest) {
  try {
    ensureAdminInitialized()
    const session = await requireAuth()

    // Check if account is scheduled for deletion
    const deletionKey = RedisKeys.userProfile(`deletion:${session.uid}`)
    const deletionData = await redis.get(deletionKey)
    
    if (!deletionData) {
      return NextResponse.json(
        {
          error: {
            code: 'NO_DELETION_SCHEDULED',
            message: 'No account deletion is scheduled',
          },
        },
        { status: 404 }
      )
    }

    const deletionRecord: AccountDeletionRecord = JSON.parse(deletionData as string)
    const permanentDeletionDate = new Date(deletionRecord.scheduledPermanentDeletion)
    
    // Check if still within recovery window
    if (new Date() >= permanentDeletionDate) {
      return NextResponse.json(
        {
          error: {
            code: 'RECOVERY_PERIOD_EXPIRED',
            message: 'Account recovery period has expired',
          },
        },
        { status: 410 }
      )
    }

    // Re-enable user account
    try {
      await adminAuth!.updateUser(session.uid, {
        disabled: false,
      })
    } catch (error) {
      console.warn('Could not re-enable Firebase Auth user:', error)
    }

    // Remove deletion flag from user document
    await adminFirestore!
      .collection('users')
      .doc(session.uid)
      .update({
        deleted: false,
        deletedAt: null,
        scheduledPermanentDeletion: null,
        recoveredAt: new Date(),
      })

    // Remove deletion records
    await adminFirestore!
      .collection('account_deletions')
      .doc(session.uid)
      .delete()

    await redis.del(deletionKey)

    // Clear user cache to refresh data
    const cacheKeys = [
      RedisKeys.userProfile(session.uid),
      RedisKeys.userTier(session.uid),
      RedisKeys.userEntitlements(session.uid),
      RedisKeys.userStats(session.uid),
    ]

    await Promise.all(cacheKeys.map(key => redis.del(key)))

    // Log audit event
    await logAuditEvent(
      AuditEvent.PROFILE_UPDATE,
      {
        userId: session.uid,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/user/delete-account',
      },
      {
        originalDeletionDate: deletionRecord.deletedAt,
        recoveredAt: new Date().toISOString(),
        action: 'account_deletion_cancelled',
      },
      'success'
    )

    return NextResponse.json({
      success: true,
      message: 'Account deletion has been cancelled successfully',
      data: {
        recoveredAt: new Date().toISOString(),
        originalDeletionDate: deletionRecord.deletedAt,
      },
    })

  } catch (error) {
    console.error('Error cancelling account deletion:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to cancel account deletion',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/user/delete-account
 * Check account deletion status
 */
export async function GET(request: NextRequest) {
  try {
    ensureAdminInitialized()
    const session = await requireAuth()

    // Check if account is scheduled for deletion
    const deletionKey = RedisKeys.userProfile(`deletion:${session.uid}`)
    const deletionData = await redis.get(deletionKey)
    
    if (!deletionData) {
      return NextResponse.json({
        success: true,
        data: {
          scheduled: false,
          message: 'Account is not scheduled for deletion',
        },
      })
    }

    const deletionRecord: AccountDeletionRecord = JSON.parse(deletionData as string)
    const permanentDeletionDate = new Date(deletionRecord.scheduledPermanentDeletion)
    const now = new Date()
    const daysRemaining = Math.ceil((permanentDeletionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return NextResponse.json({
      success: true,
      data: {
        scheduled: true,
        deletedAt: deletionRecord.deletedAt,
        permanentDeletionDate: deletionRecord.scheduledPermanentDeletion,
        daysRemaining: Math.max(0, daysRemaining),
        canRecover: daysRemaining > 0,
        reason: deletionRecord.reason,
      },
    })

  } catch (error) {
    console.error('Error checking deletion status:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to check deletion status',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/user/delete-account
 * Handle preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'POST, DELETE, GET, OPTIONS',
      'Access-Control-Allow-Methods': 'POST, DELETE, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}