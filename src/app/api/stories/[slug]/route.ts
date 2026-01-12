import { NextRequest, NextResponse } from 'next/server'
import { FieldValue } from 'firebase-admin/firestore'
import { adminFirestore } from '@/lib/firebase/admin'
import { getSession } from '@/lib/auth/session'
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server'

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
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminFirestore) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    const nowUtcISO = new Date().toISOString()
    const plan = await getUserPlan(session.uid)
    const { decision } = await evaluateFeatureAccess({
      featureId: 'story',
      userId: session.uid,
      plan,
      nowUtcISO
    })

    if (!decision.allow) {
      return NextResponse.json(
        {
          error: decision.reason === 'limit_reached' ? 'Daily limit reached' : 'Access denied',
          decision
        },
        { status: decision.reason === 'limit_reached' ? 429 : 403 }
      )
    }

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
      return NextResponse.json({ error: 'Story not found' }, { status: 404 })
    }

    await adminFirestore.collection('stories').doc(storyId).update({
      viewCount: FieldValue.increment(1)
    })

    await evaluateFeatureAccess({
      featureId: 'story',
      userId: session.uid,
      plan,
      nowUtcISO,
      increment: true
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
