import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminFirestore } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'
import { getUserPlan } from '@/lib/entitlements/server'
import { evaluate, getBucketKey } from '@/lib/entitlements/evaluator'
import type { Decision, EvalContext, FeatureId } from '@/types/entitlements'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    if (!slug) {
      return NextResponse.json({ error: 'Story slug is required' }, { status: 400 })
    }

    const session = await getSession()
    if (!session?.uid) {
      console.log('[API Story Detail] No session found for slug:', slug)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminFirestore) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    const nowUtcISO = new Date().toISOString()
    const plan = await getUserPlan(session.uid)

    let storyDoc = null
    let storyId = ''

    const slugSnapshot = await adminFirestore
      .collection('stories')
      .where('slug', '==', slug)
      .where('status', '==', 'published')
      .limit(1)
      .get()

    if (!slugSnapshot.empty) {
      const doc = slugSnapshot.docs[0]
      storyDoc = doc.data()
      storyId = doc.id
    } else {
      const doc = await adminFirestore.collection('stories').doc(slug).get()
      if (doc.exists && doc.data()?.status === 'published') {
        storyDoc = doc.data()
        storyId = doc.id
      }
    }

    if (!storyDoc) {
      console.log('[API Story Detail] Story not found:', {
        slug,
        slugSnapshotEmpty: slugSnapshot.empty,
        slugSnapshotSize: slugSnapshot.size
      })
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    console.log('[API Story Detail] Story found:', {
      slug,
      storyId,
      title: storyDoc.title,
      status: storyDoc.status
    })

    const bucketKey = getBucketKey('story', session.uid, nowUtcISO)
    const usageRef = adminFirestore
      .collection('users')
      .doc(session.uid)
      .collection('usage')
      .doc(bucketKey)

    const decision = await adminFirestore.runTransaction<Decision>(async transaction => {
      const usageDoc = await transaction.get(usageRef)
      const usageData = usageDoc.exists
        ? (usageDoc.data() as Record<string, unknown>)
        : { userId: session.uid, date: bucketKey, updatedAt: nowUtcISO }

      const storyItems = Array.isArray(usageData.story_items)
        ? (usageData.story_items as string[])
        : []

      const usageBefore = storyItems.length > 0
        ? storyItems.length
        : (usageData.story as number | undefined) || 0

      const context: EvalContext = {
        userId: session.uid,
        plan,
        usage: { story: usageBefore } as Partial<Record<FeatureId, number>>,
        nowUtcISO
      }

      const evaluated = evaluate('story', context)

      if (!evaluated.allow) {
        return evaluated
      }

      if (storyItems.includes(storyId)) {
        return evaluated
      }

      const nextUsed = usageBefore + 1
      const limit = evaluated.limit ?? 0
      const nextDecision: Decision = {
        ...evaluated,
        usageBefore,
        remaining: limit === -1 ? -1 : Math.max(0, limit - nextUsed)
      }

      transaction.set(
        usageRef,
        {
          ...usageData,
          story: nextUsed,
          story_items: [...storyItems, storyId],
          updatedAt: nowUtcISO
        },
        { merge: true }
      )

      return nextDecision
    })

    if (!decision.allow) {
      console.log('[API Story Detail] Access denied:', {
        slug,
        userId: session.uid,
        reason: decision.reason,
        decision
      })
      return NextResponse.json(
        {
          error: decision.reason === 'limit_reached' ? 'Daily limit reached' : 'Access denied',
          decision
        },
        { status: decision.reason === 'limit_reached' ? 429 : 403 }
      )
    }

    await adminFirestore.collection('stories').doc(storyId).update({
      viewCount: FieldValue.increment(1)
    })

    const story = {
      id: storyId,
      ...storyDoc,
      createdAt: storyDoc.createdAt?.toDate?.()?.toISOString() || storyDoc.createdAt,
      updatedAt: storyDoc.updatedAt?.toDate?.()?.toISOString() || storyDoc.updatedAt,
      publishedAt: storyDoc.publishedAt?.toDate?.()?.toISOString() || storyDoc.publishedAt,
    }

    return NextResponse.json({ success: true, story })
  } catch (error) {
    console.error('[API] Error fetching story:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
