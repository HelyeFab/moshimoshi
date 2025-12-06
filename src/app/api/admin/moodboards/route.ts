import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminFirestore } from '@/lib/firebase/admin'
import { FieldValue } from 'firebase-admin/firestore'

/**
 * GET /api/admin/moodboards
 * List all moodboards (for admin dashboard)
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
    const limit = parseInt(searchParams.get('limit') || '100')

    // Fetch all moodboards (admin sees all, including inactive)
    const snapshot = await adminFirestore
      .collection('moodBoards')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get()

    const moodboards = snapshot.docs.map(doc => {
      const data = doc.data()
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt,
      }
    })

    return NextResponse.json({ moodboards })
  } catch (error) {
    console.error('Error fetching moodboards:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch moodboards',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/moodboards
 * Create a new moodboard
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const { title, emoji, jlpt, background, description, kanji, isActive, sortOrder } = body

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const newMoodboard = {
      title,
      emoji: emoji || '📚',
      jlpt: jlpt || 'N5',
      background: background || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      description: description || '',
      kanji: kanji || [],
      isActive: isActive ?? true,
      sortOrder: sortOrder ?? 0,
      createdBy: 'admin',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }

    const docRef = await adminFirestore.collection('moodBoards').add(newMoodboard)

    return NextResponse.json({
      success: true,
      id: docRef.id,
      message: `Moodboard "${title}" created successfully`,
    })
  } catch (error) {
    console.error('Error creating moodboard:', error)
    return NextResponse.json(
      {
        error: 'Failed to create moodboard',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/admin/moodboards
 * Update an existing moodboard
 */
export async function PUT(request: NextRequest) {
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

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'Moodboard ID is required' }, { status: 400 })
    }

    // Check if moodboard exists
    const moodboardRef = adminFirestore.collection('moodBoards').doc(id)
    const moodboardDoc = await moodboardRef.get()

    if (!moodboardDoc.exists) {
      return NextResponse.json({ error: 'Moodboard not found' }, { status: 404 })
    }

    // Update with timestamp
    await moodboardRef.update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    })

    return NextResponse.json({
      success: true,
      message: 'Moodboard updated successfully',
    })
  } catch (error) {
    console.error('Error updating moodboard:', error)
    return NextResponse.json(
      {
        error: 'Failed to update moodboard',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/moodboards
 * Delete a moodboard
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
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Moodboard ID is required' }, { status: 400 })
    }

    // Check if moodboard exists
    const moodboardRef = adminFirestore.collection('moodBoards').doc(id)
    const moodboardDoc = await moodboardRef.get()

    if (!moodboardDoc.exists) {
      return NextResponse.json({ error: 'Moodboard not found' }, { status: 404 })
    }

    const title = moodboardDoc.data()?.title || 'Unknown'

    await moodboardRef.delete()

    return NextResponse.json({
      success: true,
      message: `Moodboard "${title}" deleted successfully`,
    })
  } catch (error) {
    console.error('Error deleting moodboard:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete moodboard',
        details: error instanceof Error ? error.message : 'Unknown',
      },
      { status: 500 }
    )
  }
}
