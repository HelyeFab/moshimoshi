import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/firebase/admin';

/**
 * GET /api/admin/books/drafts
 * List all book drafts (admin view)
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

    // If bookId is provided, fetch single draft
    if (bookId) {
      const draftDoc = await db.collection('book_drafts').doc(bookId).get();

      if (!draftDoc.exists) {
        return NextResponse.json({
          success: false,
          draft: null
        });
      }

      const draft = {
        id: draftDoc.id,
        ...draftDoc.data(),
        createdAt: draftDoc.data()?.createdAt?.toDate?.() || draftDoc.data()?.createdAt,
        updatedAt: draftDoc.data()?.updatedAt?.toDate?.() || draftDoc.data()?.updatedAt
      };

      return NextResponse.json({
        success: true,
        draft
      });
    }

    // Get all drafts
    const draftsSnapshot = await db
      .collection('book_drafts')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const drafts = draftsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.() || doc.data().createdAt,
      updatedAt: doc.data().updatedAt?.toDate?.() || doc.data().updatedAt
    }));

    return NextResponse.json({
      success: true,
      drafts
    });

  } catch (error) {
    console.error('Error fetching book drafts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500 }
    );
  }
}
