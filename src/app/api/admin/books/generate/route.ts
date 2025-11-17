import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db, storage } from '@/lib/firebase/admin';
import { bookSummaryProcessor } from '@/lib/ai/processors/BookSummaryProcessor';
import { Book, BookDraft } from '@/types/book';
import { JLPTLevel } from '@/types/ai-story';

/**
 * POST /api/admin/books/generate
 * Generate a condensed book summary using AI
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
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
    const { bookName, author, jlptLevel, additionalContext, coverImageUrl } = body;

    // Validate input
    if (!bookName || !jlptLevel) {
      return NextResponse.json(
        { error: 'Missing required fields: bookName and jlptLevel' },
        { status: 400 }
      );
    }

    // Create draft document
    const draftRef = db.collection('book_drafts').doc();
    const draftId = draftRef.id;

    const draft: BookDraft = {
      id: draftId,
      bookName,
      author,
      jlptLevel: jlptLevel as JLPTLevel,
      status: 'generating',
      createdAt: new Date(),
      createdBy: session.uid,
      metadata: {
        generationStep: 'content',
        progress: 10
      }
    };

    await draftRef.set(draft);

    // Step 1: Generate book summary content
    console.log(`📚 Generating book summary for: ${bookName}`);

    const bookRequest = {
      bookName,
      author,
      jlptLevel: jlptLevel as JLPTLevel,
      additionalContext
    };

    const result = await bookSummaryProcessor.process(bookRequest, {
      model: 'gpt-4o-mini',
      userId: session.uid,
      config: {
        timeout: 120000, // 2 minutes
        maxRetries: 2,
        temperature: 0.7
      }
    });

    console.log('📖 BookSummaryProcessor result:', {
      hasData: !!result.data,
      title: result.data?.title,
      titleJa: result.data?.titleJa,
      contentLength: result.data?.content?.length,
      summaryLength: result.data?.summary?.length,
      category: result.data?.category,
      author: result.data?.author || 'Not provided by AI',
      authorSource: result.data?.author && !author ? 'AI-generated' : 'User-provided'
    });

    if (!result.data) {
      throw new Error('Failed to generate book summary');
    }

    if (!result.data.title || !result.data.titleJa || !result.data.content || !result.data.summary) {
      console.error('❌ BookSummaryProcessor returned incomplete data:', result.data);
      throw new Error('AI generated incomplete book summary. Please try again.');
    }

    // Update draft with generated content
    const draftUpdate: any = {
      title: result.data.title,
      titleJa: result.data.titleJa,
      content: result.data.content,
      summary: result.data.summary,
      'metadata.generationStep': 'cover',
      'metadata.progress': 50
    };

    // Add optional fields only if they exist
    if (result.data.category) draftUpdate.category = result.data.category;
    if (coverImageUrl) draftUpdate.coverImageUrl = coverImageUrl;
    // Use AI-provided author if user didn't specify one
    if (result.data.author && !author) {
      draftUpdate.author = result.data.author;
      console.log(`✍️ AI provided author: ${result.data.author}`);
    } else if (author) {
      draftUpdate.author = author;
      console.log(`✍️ Using user-provided author: ${author}`);
    }

    await draftRef.update(draftUpdate);

    // Step 2: Generate TTS audio (pre-cache)
    console.log(`🔊 Pre-generating TTS audio for book: ${draftId}`);

    try {
      const ttsResponse = await fetch(`${request.nextUrl.origin}/api/tts/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: result.data.content,
          language: 'ja',
          cacheKey: `book_${draftId}`
        })
      });

      if (ttsResponse.ok) {
        const ttsData = await ttsResponse.json();

        // Upload audio to Firebase Storage
        if (ttsData.audioUrl) {
          const audioPath = `books/${draftId}/audio.mp3`;

          // Store audio URL in draft
          await draftRef.update({
            audioUrl: ttsData.audioUrl,
            'metadata.audioCached': true,
            'metadata.audioGeneratedAt': new Date()
          });
        }
      } else {
        console.warn('TTS generation failed, continuing without audio');
      }
    } catch (audioError) {
      console.error('Error generating audio:', audioError);
      // Continue without audio - can be generated later
    }

    // Update progress
    await draftRef.update({
      'metadata.generationStep': 'complete',
      'metadata.progress': 100,
      status: 'draft'
    });

    // Get final draft
    const finalDraft = await draftRef.get();

    return NextResponse.json({
      success: true,
      draftId,
      data: {
        id: finalDraft.id,
        ...finalDraft.data()
      }
    });

  } catch (error) {
    console.error('Error generating book:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate book',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
