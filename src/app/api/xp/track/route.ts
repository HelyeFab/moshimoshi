import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'
import { xpSystem } from '@/lib/gamification/xp-system'
import { z } from 'zod'
import { getStorageDecision, createStorageResponse } from '@/lib/api/storage-helper'

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
    'daily_bonus',
    'drill_completed',
    'lesson_completed',
    'quiz_completed',
    'milestone_reached'
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

    // 3. Check for idempotency key to prevent duplicates
    const idempotencyKey = xpData.metadata?.idempotencyKey ||
                          (xpData.sessionId ? `session_${xpData.sessionId}` : null)

    // Check storage decision early to know if we should check Firebase
    const storageDecision = await getStorageDecision(session)

    if (idempotencyKey && storageDecision.shouldWriteToFirebase) {
      // For premium users, check Firebase for duplicate XP
      const existingXP = await adminDb
        .collection('users')
        .doc(session.uid)
        .collection('xp_history')
        .where('idempotencyKey', '==', idempotencyKey)
        .limit(1)
        .get()

      if (!existingXP.empty) {
        // XP already awarded, return existing data
        const existing = existingXP.docs[0].data()
        return createStorageResponse({
          xpGained: 0, // No new XP gained
          totalXP: existing.newTotalXP || 0,
          currentLevel: existing.currentLevel || 1,
          leveledUp: false,
          duplicate: true,
          message: 'XP already awarded for this action'
        }, storageDecision)
      }
    }
    // For free users, idempotency will be checked client-side in IndexedDB

    // 4. Get user data (for premium users from Firebase, for free users use defaults)
    const userRef = adminDb.collection('users').doc(session.uid)
    let userData: any = {}

    if (storageDecision.shouldWriteToFirebase) {
      const userDoc = await userRef.get()
      userData = userDoc.data() || {}
    }

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
      timestamp: Date.now(),
      metadata: xpData.metadata || {},
      sessionId: xpData.sessionId,
      contentType: xpData.contentType,
      idempotencyKey: idempotencyKey,
      feature: xpData.metadata?.feature || 'unknown',
      clientTimestamp: xpData.metadata?.timestamp || Date.now(),
      plan: storageDecision.plan,
      multiplierApplied: xpData.amount !== xpToAward ? xpSystem.getXPMultiplier(currentProgress.currentLevel) : 1.0
    }

    // 7. Only update Firebase for premium users
    if (storageDecision.shouldWriteToFirebase) {
      console.log(`[Storage] Premium user ${session.uid} - writing XP to Firebase`)

      const batch = adminDb.batch()

      // Update user's progress in Firebase
      batch.update(userRef, {
        'progress.totalXp': newTotalXP,
        'progress.currentLevel': newLevel,
        'progress.lastXpGain': xpToAward,
        'progress.updatedAt': FieldValue.serverTimestamp(),
        ...(leveledUp && { 'progress.lastLevelUp': FieldValue.serverTimestamp() })
      })

      // Add XP event to history
      const xpHistoryRef = adminDb
        .collection('users')
        .doc(session.uid)
        .collection('xp_history')
        .doc()

      batch.set(xpHistoryRef, {
        ...xpEvent,
        timestamp: FieldValue.serverTimestamp(),
        userId: session.uid,
        oldTotalXP,
        newTotalXP,
        leveledUp,
        currentLevel: newLevel
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
          userId: session.uid,
          idempotencyKey: `levelup_${newLevel}_${session.uid}`,
          feature: 'levels',
          currentLevel: newLevel
        })

        // Update total with bonus
        batch.update(userRef, {
          'progress.totalXp': FieldValue.increment(levelUpBonus)
        })
      }

      // Commit the batch
      await batch.commit()
    } else {
      console.log(`[Storage] Free user ${session.uid} - XP will be tracked locally only`)
      // Free users: XP is tracked in IndexedDB on client side
    }

    // 8. Return response with storage location
    const responseData = {
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

    return createStorageResponse(responseData, storageDecision)

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

    // Check storage decision
    const storageDecision = await getStorageDecision(session)

    let progress = {
      totalXp: 0,
      currentLevel: 1,
      lastXpGain: 0,
      updatedAt: null
    }

    let recentXPEvents: any[] = []

    // Only read from Firebase for premium users
    if (storageDecision.shouldWriteToFirebase) {
      const userDoc = await adminDb.collection('users').doc(session.uid).get()
      const userData = userDoc.data()

      progress = userData?.progress || progress

      // Get recent XP history from Firebase
      const historySnapshot = await adminDb
        .collection('users')
        .doc(session.uid)
        .collection('xp_history')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get()

      recentXPEvents = historySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    }
    // Free users will load XP data from IndexedDB on client side

    // Get level info
    const userLevel = xpSystem.getUserLevel(progress.totalXp)

    return createStorageResponse({
      totalXP: progress.totalXp,
      currentLevel: progress.currentLevel,
      lastXPGain: progress.lastXpGain,
      levelInfo: userLevel,
      levelBadge: xpSystem.getLevelBadge(progress.currentLevel),
      levelColor: xpSystem.getLevelColor(progress.currentLevel),
      recentEvents: recentXPEvents,
      updatedAt: progress.updatedAt
    }, storageDecision)

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