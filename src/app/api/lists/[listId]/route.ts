import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import type { UserList } from '@/types/userLists';

/**
 * GET /api/lists/[listId]
 * Get a single list by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { listId } = await params;

    // Get the list from Firebase
    const listDoc = await adminDb
      .collection('users')
      .doc(session.uid)
      .collection('lists')
      .doc(listId)
      .get();

    if (!listDoc.exists) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    const list = { id: listDoc.id, ...listDoc.data() };

    return NextResponse.json({ list });
  } catch (error) {
    console.error('Error fetching list:', error);
    return NextResponse.json(
      { error: 'Failed to fetch list' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/lists/[listId]
 * Update a list (name, emoji, color)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { listId } = await params;
    const body = await request.json();
    const { name, emoji, color } = body;

    // Validate at least one field is provided
    if (!name && !emoji && !color) {
      return NextResponse.json(
        { error: 'At least one field (name, emoji, or color) must be provided' },
        { status: 400 }
      );
    }

    // Get the list to verify ownership
    const listRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('lists')
      .doc(listId);

    const listDoc = await listRef.get();

    if (!listDoc.exists) {
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Partial<UserList> = {
      updatedAt: Date.now()
    };

    if (name) updateData.name = name;
    if (emoji) updateData.emoji = emoji;
    if (color) updateData.color = color;

    // Update the list
    await listRef.update(updateData);

    // Get updated list
    const updatedDoc = await listRef.get();
    const updatedList = { id: updatedDoc.id, ...updatedDoc.data() };

    return NextResponse.json({
      success: true,
      list: updatedList
    });
  } catch (error) {
    console.error('Error updating list:', error);
    return NextResponse.json(
      { error: 'Failed to update list' },
      { status: 500 }
    );
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
    const { listId } = await params;
    console.log('[API DELETE /api/lists/[listId]] Starting delete for listId:', listId);

    const session = await getSession();
    if (!session) {
      console.log('[API DELETE] No session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('[API DELETE] Session user:', session.uid, 'Deleting list:', listId);

    // Verify the list exists and belongs to the user
    const listRef = adminDb
      .collection('users')
      .doc(session.uid)
      .collection('lists')
      .doc(listId);

    const listDoc = await listRef.get();

    if (!listDoc.exists) {
      console.log('[API DELETE] List not found in database');
      return NextResponse.json(
        { error: 'List not found' },
        { status: 404 }
      );
    }

    console.log('[API DELETE] List found, proceeding with deletion');

    // Delete the list
    await listRef.delete();

    console.log('[API DELETE] List deleted successfully');

    return NextResponse.json({
      success: true,
      message: 'List deleted successfully'
    });
  } catch (error) {
    console.error('[API DELETE] Error deleting list:', error);
    return NextResponse.json(
      { error: 'Failed to delete list' },
      { status: 500 }
    );
  }
}