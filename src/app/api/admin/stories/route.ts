import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'

/**
 * GET /api/admin/stories
 * List all published stories
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

    // Fetch published stories
    const snapshot = await adminFirestore
      .collection('stories')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    const stories = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || data.publishedAt,
      }
    })

    return NextResponse.json({ stories })
  } catch (error) {
    console.error('Error fetching stories:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch stories',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/stories
 * Delete a story by ID
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
    const storyId = searchParams.get('id')

    if (!storyId) {
      return NextResponse.json({ error: 'Story ID required' }, { status: 400 })
    }

    // Check if it's a draft or published story
    if (storyId.startsWith('draft_')) {
      await adminFirestore.collection('ai_story_drafts').doc(storyId).delete()
    } else {
      await adminFirestore.collection('stories').doc(storyId).delete()
    }

    return NextResponse.json({ success: true, message: 'Story deleted' })
  } catch (error) {
    console.error('Error deleting story:', error)
    return NextResponse.json({ error: 'Failed to delete story' }, { status: 500 })
  }
}
