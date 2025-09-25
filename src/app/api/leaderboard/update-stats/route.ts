/**
 * Leaderboard Stats Update API
 *
 * CRITICAL: This updates the minimal public stats for the leaderboard.
 * Available to ALL authenticated users (not just premium).
 *
 * This is justified because:
 * 1. Leaderboard is a public/social feature that benefits all users
 * 2. Extremely minimal data footprint (~200 bytes per user)
 * 3. Infrequent updates (only on significant events)
 * 4. Creates community engagement and network effects
 *
 * This is DIFFERENT from personal data storage which follows dual storage.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import logger from '@/lib/logger'

interface LeaderboardStatsUpdate {
  totalXP?: number
  currentStreak?: number
  level?: number
  displayName?: string
  photoURL?: string
  lastActivityDate?: Date
}

// Rate limiting: Max updates per time period
const UPDATE_COOLDOWN_MS = 60 * 1000 // 1 minute between updates
const SIGNIFICANT_XP_CHANGE = 50 // Only update if XP changes by this amount

/**
 * GET - Get current user's leaderboard stats
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const statsDoc = await adminDb
      .collection('leaderboard_stats')
      .doc(session.uid)
      .get()

    if (!statsDoc.exists) {
      return NextResponse.json({
        exists: false,
        stats: null
      })
    }

    return NextResponse.json({
      exists: true,
      stats: statsDoc.data()
    })

  } catch (error) {
    logger.error('[Leaderboard Stats GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to get leaderboard stats' },
      { status: 500 }
    )
  }
}

/**
 * POST - Update user's leaderboard stats
 *
 * This should be called sparingly:
 * - After session completion
 * - On level up
 * - On streak change
 * - Max once per minute for XP updates
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const updates: LeaderboardStatsUpdate = {}

    // Get current stats to check for significant changes
    const currentStatsDoc = await adminDb
      .collection('leaderboard_stats')
      .doc(session.uid)
      .get()

    const currentStats = currentStatsDoc.data() || {}
    const lastUpdate = currentStats.updatedAt?.toDate()

    // Check cooldown (except for streak updates which are once daily)
    if (lastUpdate && !body.forceUpdate) {
      const timeSinceUpdate = Date.now() - lastUpdate.getTime()
      if (timeSinceUpdate < UPDATE_COOLDOWN_MS && !body.currentStreak) {
        return NextResponse.json({
          success: false,
          message: 'Update cooldown active',
          cooldownRemaining: UPDATE_COOLDOWN_MS - timeSinceUpdate
        })
      }
    }

    // Only update if there are significant changes
    let hasSignificantChange = false

    // XP update (only if significant change)
    if (body.totalXP !== undefined) {
      const xpDiff = Math.abs(body.totalXP - (currentStats.totalXP || 0))
      if (xpDiff >= SIGNIFICANT_XP_CHANGE || !currentStats.totalXP) {
        updates.totalXP = body.totalXP
        hasSignificantChange = true
      }
    }

    // Streak update (always significant - happens once daily)
    if (body.currentStreak !== undefined && body.currentStreak !== currentStats.currentStreak) {
      updates.currentStreak = body.currentStreak
      hasSignificantChange = true
    }

    // Level update (always significant)
    if (body.level !== undefined && body.level !== currentStats.level) {
      updates.level = body.level
      hasSignificantChange = true
    }

    // Profile updates (name/avatar)
    if (body.displayName && body.displayName !== currentStats.displayName) {
      updates.displayName = body.displayName
      hasSignificantChange = true
    }

    if (body.photoURL !== undefined && body.photoURL !== currentStats.photoURL) {
      updates.photoURL = body.photoURL
      hasSignificantChange = true
    }

    // Only write if there are significant changes
    if (!hasSignificantChange && !body.forceUpdate) {
      return NextResponse.json({
        success: true,
        message: 'No significant changes to update',
        stats: currentStats
      })
    }

    // Update the stats
    await adminDb
      .collection('leaderboard_stats')
      .doc(session.uid)
      .set({
        ...updates,
        userId: session.uid,
        lastActivityDate: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true })

    logger.info(`[Leaderboard Stats] Updated for user ${session.uid}:`, {
      updates,
      hasSignificantChange
    })

    return NextResponse.json({
      success: true,
      message: 'Leaderboard stats updated',
      updates
    })

  } catch (error) {
    logger.error('[Leaderboard Stats POST] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update leaderboard stats' },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Remove user from leaderboard stats
 * (Used when user deletes account)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await adminDb
      .collection('leaderboard_stats')
      .doc(session.uid)
      .delete()

    logger.info(`[Leaderboard Stats] Deleted stats for user ${session.uid}`)

    return NextResponse.json({
      success: true,
      message: 'Leaderboard stats removed'
    })

  } catch (error) {
    logger.error('[Leaderboard Stats DELETE] Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete leaderboard stats' },
      { status: 500 }
    )
  }
}