// User Profile API Route
// Handles user profile retrieval and updates

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { checkProfileUpdateRateLimit } from '@/lib/auth/rateLimit'
import { logAuditEvent, AuditEvent } from '@/lib/auth/audit'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { redis, RedisKeys, CacheTTL } from '@/lib/redis/client'
import { z } from 'zod'

// User profile schema for validation
const ProfileUpdateSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  preferredLanguage: z.enum(['en', 'ja']).optional(),
  studyGoal: z.enum(['casual', 'intermediate', 'advanced', 'fluent']).optional(),
  studyTime: z.enum(['15min', '30min', '45min', '60min']).optional(),
  notifications: z.object({
    email: z.boolean().optional(),
    push: z.boolean().optional(),
    studyReminders: z.boolean().optional(),
    weeklyProgress: z.boolean().optional(),
  }).optional(),
  privacy: z.object({
    profileVisible: z.boolean().optional(),
    progressVisible: z.boolean().optional(),
  }).optional(),
})

export interface UserProfile {
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
  isAdmin: boolean
  preferredLanguage: 'en' | 'ja'
  studyGoal: 'casual' | 'intermediate' | 'advanced' | 'fluent'
  studyTime: '15min' | '30min' | '45min' | '60min'
  tier: 'guest' | 'free' | 'premium.monthly' | 'premium.yearly'
  createdAt: Date
  lastActiveAt: Date
  notifications: {
    email: boolean
    push: boolean
    studyReminders: boolean
    weeklyProgress: boolean
  }
  privacy: {
    profileVisible: boolean
    progressVisible: boolean
  }
  stats: {
    totalStudyTime: number
    lessonsCompleted: number
    streakDays: number
    lastStudyDate: Date | null
  }
}

/**
 * GET /api/user/profile
 * Retrieve user profile information
 */
export async function GET(request: NextRequest) {
  try {
    ensureAdminInitialized()
    const session = await requireAuth()

    // Try to get profile from cache first
    const cacheKey = RedisKeys.userProfile(session.uid)
    const cachedProfile = await redis.get(cacheKey)
    
    if (cachedProfile) {
      return NextResponse.json({
        success: true,
        data: JSON.parse(cachedProfile),
      })
    }

    // Get profile from Firestore
    const profileDoc = await adminFirestore!
      .collection('users')
      .doc(session.uid)
      .get()

    if (!profileDoc.exists) {
      return NextResponse.json(
        {
          error: {
            code: 'PROFILE_NOT_FOUND',
            message: 'User profile not found',
          },
        },
        { status: 404 }
      )
    }

    const profileData = profileDoc.data()
    const profile: UserProfile = {
      uid: session.uid,
      email: session.email,
      displayName: profileData?.displayName || null,
      photoURL: profileData?.photoURL || null,
      emailVerified: profileData?.emailVerified === true,
      isAdmin: profileData?.isAdmin === true, // Explicitly check for true to avoid undefined being truthy
      preferredLanguage: profileData?.preferredLanguage || 'en',
      studyGoal: profileData?.studyGoal || 'casual',
      studyTime: profileData?.studyTime || '30min',
      tier: session.tier,
      createdAt: profileData?.createdAt?.toDate() || new Date(),
      lastActiveAt: profileData?.lastActiveAt?.toDate() || new Date(),
      notifications: {
        email: profileData?.notifications?.email ?? true,
        push: profileData?.notifications?.push ?? true,
        studyReminders: profileData?.notifications?.studyReminders ?? true,
        weeklyProgress: profileData?.notifications?.weeklyProgress ?? true,
      },
      privacy: {
        profileVisible: profileData?.privacy?.profileVisible ?? false,
        progressVisible: profileData?.privacy?.progressVisible ?? false,
      },
      stats: {
        totalStudyTime: profileData?.stats?.totalStudyTime || 0,
        lessonsCompleted: profileData?.stats?.lessonsCompleted || 0,
        streakDays: profileData?.stats?.streakDays || 0,
        lastStudyDate: profileData?.stats?.lastStudyDate?.toDate() || null,
      },
    }

    // Cache the profile
    await redis.setex(cacheKey, CacheTTL.USER_PROFILE, JSON.stringify(profile))

    return NextResponse.json({
      success: true,
      data: profile,
    })

  } catch (error) {
    console.error('Error getting user profile:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to retrieve user profile',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user/profile
 * Update user profile information
 */
export async function PATCH(request: NextRequest) {
  try {
    ensureAdminInitialized()
    const session = await requireAuth()

    // Check rate limiting
    const rateLimitResult = await checkProfileUpdateRateLimit(request, session.uid)
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

    // Parse and validate request body
    const body = await request.json()
    const validationResult = ProfileUpdateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid profile data',
            details: validationResult.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const updates = validationResult.data

    // Build update object with only defined fields
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (updates.displayName !== undefined) {
      updateData.displayName = updates.displayName
    }
    if (updates.preferredLanguage !== undefined) {
      updateData.preferredLanguage = updates.preferredLanguage
    }
    if (updates.studyGoal !== undefined) {
      updateData.studyGoal = updates.studyGoal
    }
    if (updates.studyTime !== undefined) {
      updateData.studyTime = updates.studyTime
    }
    if (updates.notifications !== undefined) {
      updateData['notifications.email'] = updates.notifications.email
      updateData['notifications.push'] = updates.notifications.push
      updateData['notifications.studyReminders'] = updates.notifications.studyReminders
      updateData['notifications.weeklyProgress'] = updates.notifications.weeklyProgress
    }
    if (updates.privacy !== undefined) {
      updateData['privacy.profileVisible'] = updates.privacy.profileVisible
      updateData['privacy.progressVisible'] = updates.privacy.progressVisible
    }

    // Update profile in Firestore
    await adminFirestore!
      .collection('users')
      .doc(session.uid)
      .update(updateData)

    // Clear cache to force refresh
    const cacheKey = RedisKeys.userProfile(session.uid)
    await redis.del(cacheKey)

    // Log audit event
    await logAuditEvent(
      AuditEvent.PROFILE_UPDATE,
      {
        userId: session.uid,
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0] || 
                   request.headers.get('x-real-ip') || 
                   'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
        endpoint: '/api/user/profile',
      },
      {
        updatedFields: Object.keys(updates),
      },
      'success'
    )

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
    })

  } catch (error) {
    console.error('Error updating user profile:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to update user profile',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS /api/user/profile
 * Handle preflight requests
 */
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Allow': 'GET, PATCH, OPTIONS',
      'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}