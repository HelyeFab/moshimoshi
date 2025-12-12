import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/firebase/admin';

/**
 * PUT /api/admin/books/update
 * Update a book or draft
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.uid) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    // Verify admin status
    const userDoc = await db.collection('users').doc(session.uid).get();
    const isAdmin = userDoc.data()?.isAdmin === true;

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { bookId, updates } = body;

    if (!bookId || !updates) {
      return NextResponse.json(
        { error: 'Missing bookId or updates' },
        { status: 400 }
      );
    }

    // Try to find in drafts first, then in books
    const draftDoc = await db.collection('book_drafts').doc(bookId).get();
    const bookDoc = await db.collection('books').doc(bookId).get();

    if (!draftDoc.exists && !bookDoc.exists) {
      return NextResponse.json(
        { error: 'Book not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {
      ...updates,
      updatedAt: new Date()
    };

    // Remove undefined values
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    // Update in BOTH collections if they exist (for published books)
    const updatePromises: Promise<any>[] = [];

    if (draftDoc.exists) {
      updatePromises.push(db.collection('book_drafts').doc(bookId).update(updateData));
    }

    if (bookDoc.exists) {
      updatePromises.push(db.collection('books').doc(bookId).update(updateData));
    }

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      message: 'Book updated successfully'
    });

  } catch (error) {
    console.error('Error updating book:', error);
    return NextResponse.json(
      { error: 'Failed to update book' },
      { status: 500 }
    );
  }
}
