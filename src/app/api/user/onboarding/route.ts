// User Onboarding API Route
// Handles saving onboarding completion status and preferences

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { onboardingCache, OnboardingData } from '@/lib/auth/onboarding-cache'
import { z } from 'zod'
import { FieldValue } from 'firebase-admin/firestore'

// Validation schema for onboarding completion
const OnboardingCompleteSchema = z.object({
  learningGoal: z.enum(['jlpt', 'travel', 'anime', 'conversation']),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']),
  language: z.enum(['en', 'ja', 'de', 'fr', 'es', 'it']).optional(),
})

/**
 * GET /api/user/onboarding
 * Get user's onboarding status
 */
export async function GET() {
  try {
    ensureAdminInitialized()
    const session = await requireAuth()

    const onboardingStatus = await onboardingCache.getOnboardingStatus(session.uid)

    return NextResponse.json({
      success: true,
      data: onboardingStatus,
    })
  } catch (error) {
    console.error('[API] Error getting onboarding status:', error)

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get onboarding status' } },
      { status: 500 }
    )
  }
}

/**
 * POST /api/user/onboarding
 * Mark onboarding as complete and save user preferences
 */
export async function POST(request: NextRequest) {
  try {
    ensureAdminInitialized()
    const session = await requireAuth()

    // Parse and validate request body
    const body = await request.json()
    const validationResult = OnboardingCompleteSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid onboarding data',
            details: validationResult.error.issues,
          },
        },
        { status: 400 }
      )
    }

    const { learningGoal, experienceLevel, language } = validationResult.data

    // Update Firestore with onboarding data in users collection
    const onboardingData = {
      completed: true,
      completedAt: FieldValue.serverTimestamp(),
      learningGoal,
      experienceLevel,
      ...(language && { language }),
    }

    await adminFirestore!
      .collection('users')
      .doc(session.uid)
      .set(
        {
          onboarding: onboardingData,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )

    // Also save to top-level onboarding collection for analytics/querying
    await adminFirestore!
      .collection('onboarding')
      .doc(session.uid)
      .set({
        userId: session.uid,
        userEmail: session.email,
        learningGoal,
        experienceLevel,
        language: language || 'en', // Default to 'en' if not provided
        completedAt: FieldValue.serverTimestamp(),
      })

    // Update cache immediately
    await onboardingCache.markCompleted(session.uid, {
      learningGoal,
      experienceLevel,
    })

    console.log(`[API] Onboarding completed for user ${session.uid}`, {
      learningGoal,
      experienceLevel,
      language,
    })

    return NextResponse.json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        completed: true,
        learningGoal,
        experienceLevel,
      },
    })
  } catch (error) {
    console.error('[API] Error completing onboarding:', error)

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to complete onboarding' } },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user/onboarding
 * Update onboarding preferences (for users who want to change their goal/level)
 */
export async function PATCH(request: NextRequest) {
  try {
    ensureAdminInitialized()
    const session = await requireAuth()

    const body = await request.json()

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      'onboarding.updatedAt': FieldValue.serverTimestamp(),
    }

    if (body.learningGoal) {
      const goalResult = z.enum(['jlpt', 'travel', 'anime', 'conversation']).safeParse(body.learningGoal)
      if (goalResult.success) {
        updateData['onboarding.learningGoal'] = goalResult.data
      }
    }

    if (body.experienceLevel) {
      const levelResult = z.enum(['beginner', 'intermediate', 'advanced']).safeParse(body.experienceLevel)
      if (levelResult.success) {
        updateData['onboarding.experienceLevel'] = levelResult.data
      }
    }

    await adminFirestore!
      .collection('users')
      .doc(session.uid)
      .update(updateData)

    // Also update top-level onboarding collection
    const onboardingUpdateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    }
    if (body.learningGoal) {
      onboardingUpdateData.learningGoal = body.learningGoal
    }
    if (body.experienceLevel) {
      onboardingUpdateData.experienceLevel = body.experienceLevel
    }

    await adminFirestore!
      .collection('onboarding')
      .doc(session.uid)
      .update(onboardingUpdateData)
      .catch(() => {
        // Document might not exist if user completed onboarding before this feature
        // In that case, create it
        return adminFirestore!
          .collection('onboarding')
          .doc(session.uid)
          .set({
            userId: session.uid,
            userEmail: session.email,
            ...onboardingUpdateData,
          })
      })

    // Invalidate cache to force refresh
    await onboardingCache.invalidate(session.uid)

    return NextResponse.json({
      success: true,
      message: 'Onboarding preferences updated',
    })
  } catch (error) {
    console.error('[API] Error updating onboarding:', error)

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to update onboarding' } },
      { status: 500 }
    )
  }
}
