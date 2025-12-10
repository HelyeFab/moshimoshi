import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db, initAdmin } from '@/lib/firebase/admin'
import { BookDraft } from '@/types/book'
import { JLPTLevel } from '@/types/ai-story'

// Initialize Firebase Admin
initAdmin()

/**
 * POST /api/admin/books/init-draft
 * Creates a book draft and returns the ID immediately for real-time tracking
 * The actual generation is started by calling /api/admin/books/generate
 */
export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await getSession()
    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!db) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 })
    }

    // Verify admin status
    const userDoc = await db.collection('users').doc(session.uid).get()
    const isAdmin = userDoc.data()?.isAdmin === true

    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { bookName, author, jlptLevel, additionalContext, coverImageUrl, generateCover } = body

    // Validate input
    if (!bookName || !jlptLevel) {
      return NextResponse.json(
        { error: 'Missing required fields: bookName and jlptLevel' },
        { status: 400 }
      )
    }

    // Create draft document
    const draftRef = db.collection('book_drafts').doc()
    const draftId = draftRef.id

    const draft: BookDraft = {
      id: draftId,
      bookName,
      author,
      jlptLevel: jlptLevel as JLPTLevel,
      status: 'draft', // Will be changed to 'generating' when generation starts
      createdAt: new Date().toISOString(),
      createdBy: session.uid,
      coverImageUrl,
      metadata: {
        generationStep: 'content', // Initial step
        progress: 0,
        generateCover: generateCover || false,
        additionalContext,
      },
    }

    await draftRef.set(draft)

    console.log(`📋 [InitDraft] Created draft: ${draftId} for book: ${bookName}`)

    return NextResponse.json({
      success: true,
      draftId,
      message: 'Draft created. Call /api/admin/books/generate with this draftId to start generation.',
    })
  } catch (error) {
    console.error('Error initializing draft:', error)
    return NextResponse.json(
      {
        error: 'Failed to initialize draft',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
