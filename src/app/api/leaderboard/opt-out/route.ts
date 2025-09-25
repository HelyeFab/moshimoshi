/**
 * Leaderboard Opt-Out API
 *
 * IMPORTANT: This is a PRIVACY feature, not a premium feature.
 * All authenticated users (free and premium) can opt-out of the leaderboard.
 *
 * We maintain a minimal Firebase collection 'leaderboard_optouts' that only
 * stores userId and timestamp. This is acceptable because:
 * 1. It's a privacy/GDPR compliance feature
 * 2. Very small storage footprint (just user IDs)
 * 3. Affects what OTHER users see (public visibility)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import logger from '@/lib/logger'

/**
 * GET - Check if user has opted out of leaderboard
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check opt-out status
    const optOutDoc = await adminDb
      .collection('leaderboard_optouts')
      .doc(session.uid)
      .get()

    const isOptedOut = optOutDoc.exists

    return NextResponse.json({
      success: true,
      optedOut: isOptedOut,
      updatedAt: optOutDoc.data()?.updatedAt?.toDate() || null
    })

  } catch (error) {
    logger.error('[Leaderboard Opt-out GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to check opt-out status' },
      { status: 500 }
    )
  }
}

/**
 * POST - Opt out of leaderboard
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Add to opt-out list (minimal data for privacy)
    await adminDb
      .collection('leaderboard_optouts')
      .doc(session.uid)
      .set({
        userId: session.uid,
        optedOut: true,
        updatedAt: FieldValue.serverTimestamp()
      })

    logger.info(`[Leaderboard Opt-out] User ${session.uid} opted out`)

    return NextResponse.json({
      success: true,
      message: 'You have been removed from the leaderboard'
    })

  } catch (error) {
    logger.error('[Leaderboard Opt-out POST] Error:', error)
    return NextResponse.json(
      { error: 'Failed to opt out of leaderboard' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Opt back into leaderboard
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Remove from opt-out list
    await adminDb
      .collection('leaderboard_optouts')
      .doc(session.uid)
      .delete()

    logger.info(`[Leaderboard Opt-out] User ${session.uid} opted back in`)

    return NextResponse.json({
      success: true,
      message: 'You have been added back to the leaderboard'
    })

  } catch (error) {
    logger.error('[Leaderboard Opt-out DELETE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to opt back into leaderboard' },
      { status: 500 }
    )
  }
}