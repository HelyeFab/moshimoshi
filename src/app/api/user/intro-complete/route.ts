// User Intro Tutorial Completion API Route
// Handles marking the intro tutorial as complete

import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminFirestore, ensureAdminInitialized } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

/**
 * POST /api/user/intro-complete
 * Mark intro tutorial as complete
 */
export async function POST() {
  try {
    ensureAdminInitialized()
    const session = await requireAuth()

    // Update Firestore with intro completion data in users collection
    const introData = {
      completed: true,
      completedAt: FieldValue.serverTimestamp(),
      viewCount: 1,
    }

    await adminFirestore!
      .collection('users')
      .doc(session.uid)
      .set(
        {
          intro: introData,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )

    console.log(`[API] Intro tutorial completed for user ${session.uid}`)

    return NextResponse.json({
      success: true,
      message: 'Intro tutorial completed successfully',
      data: {
        completed: true,
      },
    })
  } catch (error) {
    console.error('[API] Error completing intro tutorial:', error)

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to complete intro tutorial' } },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/user/intro-complete
 * Increment view count when user reviews the tutorial
 */
export async function PATCH() {
  try {
    ensureAdminInitialized()
    const session = await requireAuth()

    // Increment view count
    await adminFirestore!
      .collection('users')
      .doc(session.uid)
      .set(
        {
          intro: {
            viewCount: FieldValue.increment(1),
            lastViewedAt: FieldValue.serverTimestamp(),
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      )

    console.log(`[API] Intro tutorial view count incremented for user ${session.uid}`)

    return NextResponse.json({
      success: true,
      message: 'Intro tutorial view recorded',
    })
  } catch (error) {
    console.error('[API] Error recording intro view:', error)

    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to record intro view' } },
      { status: 500 }
    )
  }
}
