import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db } from '@/lib/firebase/admin';
import { Book } from '@/types/book';

/**
 * POST /api/admin/books/publish-draft
 * Publish a book draft to the books collection
 */
export async function POST(request: NextRequest) {
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
    const { draftId } = body;

    if (!draftId) {
      return NextResponse.json(
        { error: 'Missing draftId' },
        { status: 400 }
      );
    }

    // Get the draft
    const draftDoc = await db.collection('book_drafts').doc(draftId).get();

    if (!draftDoc.exists) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    const draftData = draftDoc.data();

    if (!draftData || draftData.status === 'generating') {
      return NextResponse.json(
        { error: 'Book is still being generated' },
        { status: 400 }
      );
    }

    // Validate required fields
    const missingFields = [];
    if (!draftData.title) missingFields.push('title');
    if (!draftData.titleJa) missingFields.push('titleJa');
    if (!draftData.content) missingFields.push('content');
    if (!draftData.summary) missingFields.push('summary');
    if (!draftData.bookName) missingFields.push('bookName');
    if (!draftData.jlptLevel) missingFields.push('jlptLevel');

    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          error: 'Draft is missing required fields',
          details: `Missing: ${missingFields.join(', ')}`,
          draftData: draftData
        },
        { status: 400 }
      );
    }

    // Create book document
    const bookId = draftId; // Use same ID for consistency
    const book: any = {
      title: draftData.title,
      titleJa: draftData.titleJa,
      bookName: draftData.bookName,
      content: draftData.content,
      summary: draftData.summary,
      jlptLevel: draftData.jlptLevel,
      tags: draftData.tags || [],
      createdAt: draftData.createdAt || new Date(),
      updatedAt: new Date(),
      createdBy: draftData.createdBy,
      status: 'published',
      viewCount: 0,
      readCount: 0,
      metadata: {
        wordCount: draftData.content?.length || 0,
        readingTime: Math.ceil((draftData.content?.length || 0) / 200) // Japanese: ~200 chars/min
      }
    };

    // Add optional fields only if they exist (Firestore doesn't allow undefined)
    if (draftData.author) book.author = draftData.author;
    if (draftData.coverImageUrl) book.coverImageUrl = draftData.coverImageUrl;
    if (draftData.audioUrl) book.audioUrl = draftData.audioUrl;
    if (draftData.category) book.category = draftData.category;
    if (draftData.metadata?.generationModel) book.metadata.generationModel = draftData.metadata.generationModel;
    if (draftData.metadata?.coverGenerated !== undefined) book.metadata.coverGenerated = draftData.metadata.coverGenerated;
    if (draftData.metadata?.audioCached !== undefined) book.metadata.audioCached = draftData.metadata.audioCached;
    if (draftData.metadata?.audioGeneratedAt) book.metadata.audioGeneratedAt = draftData.metadata.audioGeneratedAt;

    // Save to books collection
    await db.collection('books').doc(bookId).set(book);

    // Update draft status
    await draftDoc.ref.update({
      status: 'published',
      updatedAt: new Date()
    });

    return NextResponse.json({
      success: true,
      bookId,
      message: 'Book published successfully'
    });

  } catch (error) {
    console.error('Error publishing book draft:', error);
    return NextResponse.json(
      {
        error: 'Failed to publish book',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
