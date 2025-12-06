import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'

/**
 * GET /api/admin/stories/drafts/[id]
 * Get a single story draft by ID
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminFirestore) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    // Verify admin status
    const userDoc = await adminFirestore.collection('users').doc(session.uid).get()
    if (!userDoc.data()?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params

    // Fetch draft from ai_story_drafts collection
    const draftDoc = await adminFirestore.collection('ai_story_drafts').doc(id).get()

    if (!draftDoc.exists) {
      return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
    }

    const data = draftDoc.data()
    const draft = {
      id: draftDoc.id,
      theme: data?.theme,
      jlptLevel: data?.jlptLevel,
      pageCount: data?.pageCount,
      status: data?.status,
      characterSheet: data?.characterSheet,
      outline: data?.outline,
      pages: data?.pages || [],
      quiz: data?.quiz,
      modelSheet: data?.modelSheet,
      pageImages: data?.pageImages,
      userId: data?.userId,
      createdAt: data?.createdAt?.toDate?.()?.toISOString() || data?.createdAt,
      updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || data?.updatedAt,
    }

    return NextResponse.json({ draft })
  } catch (error) {
    console.error('Error fetching story draft:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch draft',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/stories/drafts/[id]
 * Update a story draft
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminFirestore) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    // Verify admin status
    const userDoc = await adminFirestore.collection('users').doc(session.uid).get()
    if (!userDoc.data()?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Update draft
    await adminFirestore
      .collection('ai_story_drafts')
      .doc(id)
      .update({
        ...body,
        updatedAt: new Date(),
      })

    return NextResponse.json({ success: true, message: 'Draft updated' })
  } catch (error) {
    console.error('Error updating story draft:', error)
    return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/stories/drafts/[id]
 * Delete a story draft
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!adminFirestore) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    // Verify admin status
    const userDoc = await adminFirestore.collection('users').doc(session.uid).get()
    if (!userDoc.data()?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params

    await adminFirestore.collection('ai_story_drafts').doc(id).delete()

    return NextResponse.json({ success: true, message: 'Draft deleted' })
  } catch (error) {
    console.error('Error deleting story draft:', error)
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 })
  }
}
