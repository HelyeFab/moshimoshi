import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'

/**
 * GET /api/admin/stories/drafts
 * List all story drafts from ai_story_drafts collection
 */
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    // Fetch drafts from ai_story_drafts collection
    const snapshot = await adminFirestore
      .collection('ai_story_drafts')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    const drafts = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        theme: data.theme,
        jlptLevel: data.jlptLevel,
        pageCount: data.pageCount,
        status: data.status,
        characterSheet: data.characterSheet,
        outline: data.outline,
        pages: data.pages || [],
        quiz: data.quiz,
        modelSheet: data.modelSheet,
        pageImages: data.pageImages,
        userId: data.userId,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
      }
    })

    return NextResponse.json({ drafts })
  } catch (error) {
    console.error('Error fetching story drafts:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch drafts',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/stories/drafts
 * Delete a draft by ID
 */
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const draftId = searchParams.get('id')

    if (!draftId) {
      return NextResponse.json({ error: 'Draft ID required' }, { status: 400 })
    }

    await adminFirestore.collection('ai_story_drafts').doc(draftId).delete()

    return NextResponse.json({ success: true, message: 'Draft deleted' })
  } catch (error) {
    console.error('Error deleting draft:', error)
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 })
  }
}
