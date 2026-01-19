import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/admin';
import { getSession } from '@/lib/auth/session';
import { evaluateFeatureAccess, getUserPlan } from '@/lib/entitlements/server';
import { Book, BookListResponse } from '@/types/book';

/**
 * GET /api/library/books
 * Public endpoint to fetch published books
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const bookId = searchParams.get('id');
    const jlptLevel = searchParams.get('jlptLevel');
    const category = searchParams.get('category');
    const searchQuery = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '12');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      );
    }

    // Get single book by ID
    if (bookId) {
      const session = await getSession();
      if (!session?.uid) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const nowUtcISO = new Date().toISOString();
      const plan = await getUserPlan(session.uid);
      const { decision } = await evaluateFeatureAccess({
        featureId: 'books',
        userId: session.uid,
        plan,
        nowUtcISO
      });

      if (!decision.allow) {
        return NextResponse.json(
          {
            error: decision.reason === 'limit_reached' ? 'Daily limit reached' : 'Access denied',
            decision
          },
          { status: decision.reason === 'limit_reached' ? 429 : 403 }
        );
      }

      const bookDoc = await db.collection('books').doc(bookId).get();

      if (!bookDoc.exists) {
        return NextResponse.json(
          { error: 'Book not found' },
          { status: 404 }
        );
      }

      const data = bookDoc.data();

      // Increment view count
      await bookDoc.ref.update({
        viewCount: (data?.viewCount || 0) + 1
      });

      await evaluateFeatureAccess({
        featureId: 'books',
        userId: session.uid,
        plan,
        nowUtcISO,
        increment: true
      });

      return NextResponse.json({
        success: true,
        book: {
          id: bookDoc.id,
          ...data,
          createdAt: data?.createdAt?.toDate?.() || data?.createdAt,
          updatedAt: data?.updatedAt?.toDate?.() || data?.updatedAt
        }
      });
    }

    // Build query with indexed fields (status + createdAt)
    // Note: Falls back to fetch all if index is still building
    let snapshot;
    try {
      const query = db.collection('books')
        .where('status', '==', 'published')
        .orderBy('createdAt', 'desc');
      snapshot = await query.get();
    } catch (error: any) {
      // Index is still building, fall back to fetching all books
      if (error.code === 9) {
        console.log('📚 Index building, fetching all books as fallback...');
        snapshot = await db.collection('books').get();
      } else {
        throw error;
      }
    }

    // Convert to array and format dates
    let books = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() || data.updatedAt
      };
    });

    // Filter by status (published only) - needed for fallback case
    books = books.filter((book: any) => book.status === 'published');

    // Sort by creation date (newest first) - needed for fallback case
    books.sort((a: any, b: any) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    // Apply additional filters server-side (avoiding additional indexes)
    if (jlptLevel && jlptLevel !== 'all') {
      books = books.filter((book: any) => book.jlptLevel === jlptLevel);
    }

    if (category && category !== 'all') {
      books = books.filter((book: any) => book.category === category);
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      books = books.filter((book: any) =>
        book.title?.toLowerCase().includes(lowerQuery) ||
        book.titleJa?.toLowerCase().includes(lowerQuery) ||
        book.bookName?.toLowerCase().includes(lowerQuery) ||
        book.author?.toLowerCase().includes(lowerQuery) ||
        book.summary?.toLowerCase().includes(lowerQuery)
      );
    }

    const totalCount = books.length;
    const hasMore = (offset + limit) < totalCount;

    // Apply pagination
    books = books.slice(offset, offset + limit);

    const response: BookListResponse = {
      success: true,
      books,
      totalCount,
      hasMore,
      meta: {
        offset,
        limit,
        cached: false
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching books:', error);

    // Return empty list on error
    return NextResponse.json({
      success: true,
      books: [],
      totalCount: 0,
      hasMore: false,
      meta: {
        cached: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}
