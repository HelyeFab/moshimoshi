import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { adminDb } from '@/lib/firebase/admin';
import { v4 as uuidv4 } from 'uuid';
import type { ListItem, ListType } from '@/types/userLists';

/**
 * Normalize content for duplicate comparison based on list type
 */
function normalizeForComparison(content: string, type: ListType): string {
  let normalized = content.trim().toLowerCase();

  if (type === 'sentence') {
    // Remove common punctuation and normalize spaces for sentences
    normalized = normalized
      .replace(/[。、！？.,!?\s]+/g, ' ') // Replace punctuation and spaces with single space
      .trim()
      .replace(/\s+/g, ' '); // Ensure only single spaces
  }

  return normalized;
}

/**
 * Check if content already exists in the list
 */
function isDuplicate(newContent: string, existingItems: ListItem[], type: ListType): boolean {
  const normalizedNew = normalizeForComparison(newContent, type);

  return existingItems.some(item => {
    const normalizedExisting = normalizeForComparison(item.content, type);
    return normalizedNew === normalizedExisting;
  });
}

/**
 * POST /api/lists/[listId]/items
 * Add an item to a list
 */
export async function POST(
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
    const { content, metadata } = body;

    if (!content) {
      return NextResponse.json(
        { error: 'Content is required' },
        { status: 400 }
      );
    }

    // Get the list to verify ownership and get the type
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

    const list = listDoc.data();
    const currentItems = list?.items || [];
    const listType = list?.type || 'word';

    // Check for duplicate content
    if (isDuplicate(content, currentItems, listType)) {
      return NextResponse.json(
        {
          error: 'This item already exists in the list',
          code: 'DUPLICATE_ITEM'
        },
        { status: 409 } // 409 Conflict
      );
    }

    // Create the new item
    const newItem: ListItem = {
      id: uuidv4(),
      content,
      type: listType,
      metadata: {
        ...metadata,
        addedAt: Date.now()
      }
    };

    // Add item to the list
    currentItems.push(newItem);

    // Update the list with the new item
    await listRef.update({
      items: currentItems,
      updatedAt: Date.now()
    });

    return NextResponse.json({
      success: true,
      item: newItem
    });
  } catch (error) {
    console.error('Error adding item to list:', error);
    return NextResponse.json(
      { error: 'Failed to add item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/lists/[listId]/items?itemId=xxx
 * Remove an item from a list
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { listId } = await params;
    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
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

    const list = listDoc.data();
    const currentItems = list?.items || [];

    // Remove the item
    const updatedItems = currentItems.filter((item: ListItem) => item.id !== itemId);

    if (updatedItems.length === currentItems.length) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Update the list without the removed item
    await listRef.update({
      items: updatedItems,
      updatedAt: Date.now()
    });

    return NextResponse.json({
      success: true,
      message: 'Item removed successfully'
    });
  } catch (error) {
    console.error('Error removing item from list:', error);
    return NextResponse.json(
      { error: 'Failed to remove item' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/lists/[listId]/items
 * Update an item in a list
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
    const { itemId, content, metadata } = body;

    if (!itemId) {
      return NextResponse.json(
        { error: 'Item ID is required' },
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

    const list = listDoc.data();
    const currentItems = list?.items || [];
    const listType = list?.type || 'word';

    // If content is being updated, check for duplicates
    if (content !== undefined) {
      // Get all items except the one being updated
      const otherItems = currentItems.filter((item: ListItem) => item.id !== itemId);

      if (isDuplicate(content, otherItems, listType)) {
        return NextResponse.json(
          {
            error: 'An item with this content already exists in the list',
            code: 'DUPLICATE_ITEM'
          },
          { status: 409 } // 409 Conflict
        );
      }
    }

    // Find and update the item
    let itemFound = false;
    const updatedItems = currentItems.map((item: ListItem) => {
      if (item.id === itemId) {
        itemFound = true;
        return {
          ...item,
          content: content !== undefined ? content : item.content,
          metadata: {
            ...item.metadata,
            ...metadata,
            updatedAt: Date.now()
          }
        };
      }
      return item;
    });

    if (!itemFound) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    // Update the list with the modified item
    await listRef.update({
      items: updatedItems,
      updatedAt: Date.now()
    });

    return NextResponse.json({
      success: true,
      message: 'Item updated successfully'
    });
  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    );
  }
}