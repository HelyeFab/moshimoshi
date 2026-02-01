import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import type { UserList } from '@/types/userLists'

// Helper for database availability check
function getDb() {
  if (!adminDb) {
    throw new Error('Database not available')
  }
  return adminDb
}

function normalizeListName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}

/**
 * GET /api/lists/[listId]
 * Get a single list by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { listId } = await params
    const db = getDb()

    // Get the list from Firebase
    const listDoc = await db
      .collection('users')
      .doc(session.uid)
      .collection('lists')
      .doc(listId)
      .get()

    if (!listDoc.exists) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    const list = { id: listDoc.id, ...listDoc.data() }

    return NextResponse.json({ list })
  } catch (error) {
    console.error('Error fetching list:', error)
    return NextResponse.json({ error: 'Failed to fetch list' }, { status: 500 })
  }
}

/**
 * PUT /api/lists/[listId]
 * Update a list (name, emoji, color, items)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { listId } = await params
    const body = await request.json()
    const { name, emoji, color, items } = body

    // Validate at least one field is provided
    if (!name && !emoji && !color && !items) {
      return NextResponse.json(
        { error: 'At least one field (name, emoji, color, or items) must be provided' },
        { status: 400 }
      )
    }

    const db = getDb()

    // Get the list to verify ownership
    const listRef = db.collection('users').doc(session.uid).collection('lists').doc(listId)

    const listDoc = await listRef.get()

    if (!listDoc.exists) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    if (name) {
      const existingListsSnapshot = await db
        .collection('users')
        .doc(session.uid)
        .collection('lists')
        .get()

      const normalizedName = normalizeListName(name)
      const duplicateList = existingListsSnapshot.docs.some(doc => {
        if (doc.id === listId) return false
        const data = doc.data() as UserList
        if (!data?.name || !data?.type) return false
        return data.type === (listDoc.data() as UserList).type &&
          normalizeListName(data.name) === normalizedName
      })

      if (duplicateList) {
        return NextResponse.json(
          { error: 'List name already exists for this type', code: 'DUPLICATE_LIST' },
          { status: 409 }
        )
      }
    }

    // Prepare update data
    const updateData: Partial<UserList> = {
      updatedAt: Date.now(),
    }

    if (name) updateData.name = name
    if (emoji) updateData.emoji = emoji
    if (color) updateData.color = color
    if (items) updateData.items = items // Support items update for SRS data persistence

    // Update the list
    await listRef.update(updateData)

    // Get updated list
    const updatedDoc = await listRef.get()
    const updatedList = { id: updatedDoc.id, ...updatedDoc.data() }

    return NextResponse.json({
      success: true,
      list: updatedList,
    })
  } catch (error) {
    console.error('Error updating list:', error)
    return NextResponse.json({ error: 'Failed to update list' }, { status: 500 })
  }
}

/**
 * DELETE /api/lists/[listId]
 * Delete a list
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const { listId } = await params
    console.log('[API DELETE /api/lists/[listId]] Starting delete for listId:', listId)

    const session = await getSession()
    if (!session) {
      console.log('[API DELETE] No session found')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log('[API DELETE] Session user:', session.uid, 'Deleting list:', listId)

    const db = getDb()

    // Verify the list exists and belongs to the user
    const listRef = db.collection('users').doc(session.uid).collection('lists').doc(listId)

    const listDoc = await listRef.get()

    if (!listDoc.exists) {
      console.log('[API DELETE] List not found in database')
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }

    console.log('[API DELETE] List found, proceeding with deletion')

    // Delete the list
    await listRef.delete()

    // Record deletion tombstone to prevent resurrection from stale local data
    const deletedListsRef = db.collection('users').doc(session.uid).collection('deletedLists')
    await deletedListsRef.doc(listId).set({
      deletedAt: Date.now(),
      listName: listDoc.data()?.name || 'Unknown'
    })

    console.log('[API DELETE] List deleted and tombstone recorded successfully')

    return NextResponse.json({
      success: true,
      message: 'List deleted successfully',
      deletedListId: listId
    })
  } catch (error) {
    console.error('[API DELETE] Error deleting list:', error)
    return NextResponse.json({ error: 'Failed to delete list' }, { status: 500 })
  }
}
