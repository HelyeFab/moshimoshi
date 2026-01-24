import { NextRequest, NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase/admin'
import { getSession, getTierForSession } from '@/lib/auth/session'
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator'
import type { FeatureId, PlanType, UsageBucket } from '@/types/entitlements'
import { FEATURE_IDS } from '@/types/FeatureId'
import { getSecurityHeaders } from '@/lib/auth/validation'

const VALID_FEATURES: Set<FeatureId> = new Set(FEATURE_IDS)
const UNIQUE_ITEM_FIELDS: Partial<Record<FeatureId, keyof UsageBucketWithUniqueItems>> = {
  kanji_mood_board: 'kanji_mood_board_boards',
  news: 'news_items',
  comics: 'comics_items',
  kanji_connection: 'kanji_connection_items',
  textbook_vocabulary: 'textbook_vocabulary_items',
  story: 'story_items'
}

type UsageBucketWithUniqueItems = UsageBucket & {
  kanji_mood_board_boards?: string[]
  news_items?: string[]
  comics_items?: string[]
  kanji_connection_items?: string[]
  textbook_vocabulary_items?: string[]
  story_items?: string[]
}

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
          ? (usageDoc.data() as UsageBucketWithUniqueItems)
          : { userId, date: bucketKey, updatedAt: nowUtcISO }

        const uniqueField = UNIQUE_ITEM_FIELDS[featureId]
        const hasStoredItems = !!uniqueField && Array.isArray((usageData as any)[uniqueField])
        const storedItems = hasStoredItems ? (usageData as any)[uniqueField] : []
        const usageBefore = uniqueField
          ? (hasStoredItems ? storedItems.length : (usageData[featureId] ?? 0))
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

        if (uniqueField && uniqueItems?.[featureId]) {
          const incoming = Array.isArray(uniqueItems[featureId])
            ? uniqueItems[featureId]
            : []
          const newItems = incoming.filter(
            (id: unknown) => typeof id === 'string' && !storedItems.includes(id)
          )
          const remainingForItems = limit === -1 ? newItems.length : Math.max(0, limit - usageBefore)
          const appliedItems = limit === -1 ? newItems : newItems.slice(0, remainingForItems)
          appliedDelta = appliedItems.length
          nextUsed = usageBefore + appliedDelta
          if (appliedItems.length > 0) {
            ;(usageData as Record<string, unknown>)[uniqueField] = [...storedItems, ...appliedItems]
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
