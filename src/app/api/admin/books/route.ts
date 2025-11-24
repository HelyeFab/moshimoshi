import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/firebase/admin';
import { Book } from '@/types/book';

/**
 * GET /api/admin/books
 * List all published books (admin view)
 */
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const bookId = searchParams.get('bookId');
    const limit = parseInt(searchParams.get('limit') || '100');

    // If bookId is provided, fetch single book
    if (bookId) {
      const bookDoc = await db.collection('books').doc(bookId).get();

      if (!bookDoc.exists) {
        return NextResponse.json({
          success: false,
          book: null
        });
      }

      const book = {
        id: bookDoc.id,
        ...bookDoc.data(),
        createdAt: bookDoc.data()?.createdAt?.toDate?.() || bookDoc.data()?.createdAt,
        updatedAt: bookDoc.data()?.updatedAt?.toDate?.() || bookDoc.data()?.updatedAt
      };

      return NextResponse.json({
        success: true,
        book
      });
    }

    // Get all published books
    const booksSnapshot = await db
      .collection('books')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const books = booksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
    }));

    return NextResponse.json({
      success: true,
      books
    });

  } catch (error) {
    console.error('Error fetching books:', error);
    return NextResponse.json(
      { error: 'Failed to fetch books' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/books
 * Delete a book
 */
export async function DELETE(request: NextRequest) {
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
    const { bookId } = body;

    if (!bookId) {
      return NextResponse.json(
        { error: 'Missing bookId' },
        { status: 400 }
      );
    }

    // Delete from books collection
    await db.collection('books').doc(bookId).delete();

    // Also delete from drafts if exists
    const draftDoc = await db.collection('book_drafts').doc(bookId).get();
    if (draftDoc.exists) {
      await db.collection('book_drafts').doc(bookId).delete();
    }

    return NextResponse.json({
      success: true,
      message: 'Book deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting book:', error);
    return NextResponse.json(
      { error: 'Failed to delete book' },
      { status: 500 }
    );
  }
}
