import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { xpSystem } from '@/lib/gamification/xp-system'
import { z } from 'zod'

/**
 * XP Tracking API
 * Awards XP for review activities and tracks level progression
 * Following patterns from FEATURE_IMPLEMENTATION.md
 */

// Input validation schema
const TrackXPSchema = z.object({
  eventType: z.enum([
    'review_completed',
    'achievement_unlocked',
    'streak_bonus',
    'perfect_session',
    'speed_bonus',
    'daily_bonus'
  ]),
  amount: z.number().min(0).max(1000),
  source: z.string(),
  metadata: z.record(z.any()).optional(),
  sessionId: z.string().optional(),
  contentType: z.string().optional()
})

export type TrackXPInput = z.infer<typeof TrackXPSchema>

/**
 * POST /api/xp/track
 * Award XP to authenticated user and update their level
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Authentication using session-based auth (PATTERN: requireAuth)
    const session = await requireAuth()

    // 2. Validate input with Zod schema
    const body = await request.json()
    const validationResult = TrackXPSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid XP tracking data',
            details: validationResult.error.issues
          }
        },
        { status: 400 }
      )
    }

    const xpData = validationResult.data

    // 3. CRITICAL: Get FRESH user data (NEVER use session.tier!)
    const userRef = adminDb.collection('users').doc(session.uid)
    const userDoc = await userRef.get()
    const userData = userDoc.data()

    // Get current XP state from Firebase progress
    const currentProgress = userData?.progress || {
      totalXp: 0,
      currentLevel: 1,
      lastXpGain: 0,
      xpHistory: []
    }

    // 4. Calculate XP with multipliers (premium users could get bonus)
    const plan = userData?.subscription?.plan || 'free'
    let xpToAward = xpData.amount

    // Apply premium multiplier if applicable
    if (plan === 'premium_monthly' || plan === 'premium_annual' || plan === 'premium_lifetime') {
      const levelMultiplier = xpSystem.getXPMultiplier(currentProgress.currentLevel)
      xpToAward = Math.floor(xpToAward * levelMultiplier)
    }

    // 5. Calculate new totals and check for level up
    const oldTotalXP = currentProgress.totalXp || 0
    const newTotalXP = oldTotalXP + xpToAward
    const oldLevel = xpSystem.getLevelFromXP(oldTotalXP)
    const newLevel = xpSystem.getLevelFromXP(newTotalXP)
    const leveledUp = newLevel > oldLevel

    // Get level info for response
    const userLevel = xpSystem.getUserLevel(newTotalXP)

    // 6. Create XP event record
    const xpEvent = {
      type: xpData.eventType,
      xpGained: xpToAward,
      source: xpData.source,
      timestamp: FieldValue.serverTimestamp(),
      metadata: xpData.metadata || {},
      sessionId: xpData.sessionId,
      contentType: xpData.contentType
    }

    // 7. Update Firebase with atomic batch operation
    const batch = adminDb.batch()

    // Update user's progress
    batch.update(userRef, {
      'progress.totalXp': newTotalXP,
      'progress.currentLevel': newLevel,
      'progress.lastXpGain': xpToAward,
      'progress.updatedAt': FieldValue.serverTimestamp(),
      ...(leveledUp && { 'progress.lastLevelUp': FieldValue.serverTimestamp() })
    })

    // Add XP event to history (subcollection for detailed tracking)
    const xpHistoryRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('xp_history')
      .doc()

    batch.set(xpHistoryRef, {
      ...xpEvent,
      userId: session.uid,
      oldTotalXP,
      newTotalXP,
      leveledUp
    })

    // Also add to xp_events for backwards compatibility
    const xpEventsRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('xp_events')
      .doc()

    batch.set(xpEventsRef, {
      type: xpData.eventType,
      xp: xpToAward,
      timestamp: FieldValue.serverTimestamp(),
      source: xpData.source,
      metadata: xpData.metadata || {}
    })

    // If level up, add bonus XP event
    if (leveledUp) {
      const levelUpBonus = newLevel * 10
      const bonusRef = adminDb
        .collection('users')
        .doc(session.uid)
        .collection('xp_history')
        .doc()

      batch.set(bonusRef, {
        type: 'achievement_unlocked',
        xpGained: levelUpBonus,
        source: `Level ${newLevel} reached!`,
        timestamp: FieldValue.serverTimestamp(),
        metadata: { levelUp: true, newLevel },
        userId: session.uid
      })

      // Also add to xp_events for backwards compatibility
      const bonusEventsRef = adminDb
        .collection('users')
        .doc(session.uid)
        .collection('xp_events')
        .doc()

      batch.set(bonusEventsRef, {
        type: 'achievement_unlocked',
        xp: levelUpBonus,
        timestamp: FieldValue.serverTimestamp(),
        source: `Level ${newLevel} reached!`,
        metadata: { levelUp: true, newLevel }
      })

      // Update total with bonus
      batch.update(userRef, {
        'progress.totalXp': FieldValue.increment(levelUpBonus)
      })
    }

    // Commit the batch
    await batch.commit()

    // 8. Return response with XP state
    return NextResponse.json({
      success: true,
      data: {
        xpGained: xpToAward,
        totalXP: newTotalXP + (leveledUp ? newLevel * 10 : 0),
        currentLevel: newLevel,
        leveledUp,
        levelInfo: userLevel,
        ...(leveledUp && {
          levelUpBonus: newLevel * 10,
          newLevelTitle: xpSystem.getUserLevel(newTotalXP).title,
          levelBadge: xpSystem.getLevelBadge(newLevel)
        })
      }
    }, { status: 200 })

  } catch (error: any) {
    console.error('Error tracking XP:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to track XP' } },
      { status: 500 }
    )
  }
}

/**
 * GET /api/xp/track
 * Get current XP status for authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const session = await requireAuth()

    // Get user data from Firebase
    const userDoc = await adminDb.collection('users').doc(session.uid).get()
    const userData = userDoc.data()

    const progress = userData?.progress || {
      totalXp: 0,
      currentLevel: 1,
      lastXpGain: 0,
      updatedAt: null
    }

    // Get level info
    const userLevel = xpSystem.getUserLevel(progress.totalXp)

    // Get recent XP history
    const historySnapshot = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('xp_history')
      .orderBy('timestamp', 'desc')
      .limit(10)
      .get()

    const recentXPEvents = historySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    return NextResponse.json({
      success: true,
      data: {
        totalXP: progress.totalXp,
        currentLevel: progress.currentLevel,
        lastXPGain: progress.lastXpGain,
        levelInfo: userLevel,
        levelBadge: xpSystem.getLevelBadge(progress.currentLevel),
        levelColor: xpSystem.getLevelColor(progress.currentLevel),
        recentEvents: recentXPEvents,
        updatedAt: progress.updatedAt
      }
    })

  } catch (error: any) {
    console.error('Error fetching XP status:', error)

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch XP status' } },
      { status: 500 }
    )
  }
}