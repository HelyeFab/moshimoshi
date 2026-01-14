import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { getSession, getTierForSession } from '@/lib/auth/session'
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator'
import type { FeatureId, PlanType } from '@/types/entitlements'
import { FEATURE_IDS } from '@/types/FeatureId'
import { getSecurityHeaders } from '@/lib/auth/validation'

const VALID_FEATURES: Set<FeatureId> = new Set(FEATURE_IDS)

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401, headers: getSecurityHeaders() }
      )
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }
    const db = adminDb

    const body = await request.json()
    const { deltas, idempotencyKey, uniqueItems } = body || {}

    if (!idempotencyKey || typeof deltas !== 'object' || deltas === null) {
      return NextResponse.json(
        { error: { code: 'INVALID_REQUEST', message: 'Missing deltas or idempotencyKey' } },
        { status: 400, headers: getSecurityHeaders() }
      )
    }

    const userId = session.uid
    const plan: PlanType = await getTierForSession(session)
    const nowUtcISO = new Date().toISOString()

    const idempotencyRef = db
      .collection('idempotency')
      .doc(`${userId}_sync_${idempotencyKey}`)

    const idempotencyDoc = await idempotencyRef.get()
    if (idempotencyDoc.exists) {
      const cached = idempotencyDoc.data() as { snapshots: Record<string, unknown> }
      return NextResponse.json(
        { snapshots: cached.snapshots },
        { status: 200, headers: getSecurityHeaders() }
      )
    }

    const snapshots = await db.runTransaction(async transaction => {
      const nextSnapshots: Record<string, { used: number; limit: number; resetAtUtc: string }> = {}

      for (const [featureKey, deltaValue] of Object.entries(deltas)) {
        const featureId = featureKey as FeatureId
        if (!VALID_FEATURES.has(featureId)) continue
        const delta = Number(deltaValue)
        if (!Number.isFinite(delta) || delta <= 0) continue

        const bucketKey = getBucketKey(featureId, userId, nowUtcISO)
        const usageRef = db
          .collection('users')
          .doc(userId)
          .collection('usage')
          .doc(bucketKey)

        const usageDoc = await transaction.get(usageRef)
        const usageData = usageDoc.exists
          ? (usageDoc.data() as Record<string, number>)
          : { userId, date: bucketKey, updatedAt: nowUtcISO }

        const boards = Array.isArray((usageData as any).kanji_mood_board_boards)
          ? (usageData as any).kanji_mood_board_boards
          : []
        const newsItems = Array.isArray((usageData as any).news_items)
          ? (usageData as any).news_items
          : []
        const usageBefore = featureId === 'kanji_mood_board'
          ? boards.length
          : featureId === 'news'
            ? newsItems.length
            : (usageData[featureId] ?? 0)
        const context = {
          userId,
          plan,
          usage: { [featureId]: usageBefore },
          nowUtcISO
        }

        const decision = evaluate(featureId, context)
        const limit = decision.limit ?? 0
        let appliedDelta = limit === -1 ? delta : Math.min(delta, Math.max(0, limit - usageBefore))
        let nextUsed = usageBefore + appliedDelta

        if (featureId === 'kanji_mood_board' && uniqueItems?.kanji_mood_board) {
          const incoming = Array.isArray(uniqueItems.kanji_mood_board)
            ? uniqueItems.kanji_mood_board
            : []
          const newBoards = incoming.filter((id: unknown) => typeof id === 'string' && !boards.includes(id))
          const remainingForBoards = limit === -1 ? newBoards.length : Math.max(0, limit - usageBefore)
          const appliedBoards = limit === -1 ? newBoards : newBoards.slice(0, remainingForBoards)
          appliedDelta = appliedBoards.length
          nextUsed = usageBefore + appliedDelta
          if (appliedBoards.length > 0) {
            usageData.kanji_mood_board_boards = [...boards, ...appliedBoards]
          }
        } else if (featureId === 'news' && uniqueItems?.news) {
          const incoming = Array.isArray(uniqueItems.news)
            ? uniqueItems.news
            : []
          const newItems = incoming.filter((id: unknown) => typeof id === 'string' && !newsItems.includes(id))
          const remainingForItems = limit === -1 ? newItems.length : Math.max(0, limit - usageBefore)
          const appliedItems = limit === -1 ? newItems : newItems.slice(0, remainingForItems)
          appliedDelta = appliedItems.length
          nextUsed = usageBefore + appliedDelta
          if (appliedItems.length > 0) {
            usageData.news_items = [...newsItems, ...appliedItems]
          }
        }

        usageData[featureId] = nextUsed
        usageData.updatedAt = nowUtcISO
        transaction.set(usageRef, usageData)

        nextSnapshots[featureId] = {
          used: nextUsed,
          limit,
          resetAtUtc: decision.resetAtUtc || nowUtcISO
        }
      }

      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      transaction.set(idempotencyRef, {
        snapshots: nextSnapshots,
        createdAt: nowUtcISO,
        expiresAt
      })

      return nextSnapshots
    })

    return NextResponse.json({ snapshots }, { status: 200, headers: getSecurityHeaders() })
  } catch (error) {
    console.error('Usage sync error:', error)
    return NextResponse.json(
      { error: { code: 'SYNC_ERROR', message: 'Failed to sync offline usage' } },
      { status: 500, headers: getSecurityHeaders() }
    )
  }
}
