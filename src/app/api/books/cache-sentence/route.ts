import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { db } from '@/lib/firebase/admin'

// Map content types to their Firebase collections
const COLLECTION_MAP: Record<string, string> = {
  book: 'book_sentence_data',
  article: 'news_article_translations',
  story: 'story_sentence_data',
}

/**
 * POST /api/books/cache-sentence
 * Cache a sentence translation or audio URL for any content type
 * Supports: book, article, story
 * Any authenticated user can cache translations (benefits all users)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.uid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!db) {
      return NextResponse.json(
        { error: 'Database not initialized' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { contentId, contentType = 'book', sentenceIndex, translation, audioUrl } = body

    // Support legacy bookId parameter
    const id = contentId || body.bookId

    if (!id || sentenceIndex === undefined || sentenceIndex === null) {
      return NextResponse.json(
        { error: 'Missing contentId or sentenceIndex' },
        { status: 400 }
      )
    }

    if (!translation && !audioUrl) {
      return NextResponse.json(
        { error: 'Missing translation or audioUrl' },
        { status: 400 }
      )
    }

    const collection = COLLECTION_MAP[contentType]
    if (!collection) {
      return NextResponse.json(
        { error: `Invalid contentType: ${contentType}` },
        { status: 400 }
      )
    }

    // Get the current document
    const docRef = db.collection(collection).doc(id)
    const docSnap = await docRef.get()

    if (!docSnap.exists) {
      return NextResponse.json(
        { error: `${contentType} sentence data not found` },
        { status: 404 }
      )
    }

    const data = docSnap.data()

    // Handle different data structures for stories (pages) vs articles/books (sentences)
    if (contentType === 'story' && data?.pages) {
      // Stories have pages with sentences
      // For now, we need pageNumber in the request to update stories
      const { pageNumber } = body
      if (pageNumber === undefined) {
        return NextResponse.json(
          { error: 'Missing pageNumber for story content' },
          { status: 400 }
        )
      }

      const updatedPages = [...data.pages]
      const pageIndex = updatedPages.findIndex((p: any) => p.pageNumber === pageNumber)

      if (pageIndex === -1) {
        return NextResponse.json(
          { error: 'Page not found' },
          { status: 404 }
        )
      }

      if (!updatedPages[pageIndex].sentences || sentenceIndex >= updatedPages[pageIndex].sentences.length) {
        return NextResponse.json(
          { error: 'Sentence index out of bounds' },
          { status: 400 }
        )
      }

      if (translation) {
        updatedPages[pageIndex].sentences[sentenceIndex] = {
          ...updatedPages[pageIndex].sentences[sentenceIndex],
          translation,
        }
      }

      if (audioUrl) {
        updatedPages[pageIndex].sentences[sentenceIndex] = {
          ...updatedPages[pageIndex].sentences[sentenceIndex],
          audioUrl,
        }
      }

      await docRef.update({
        pages: updatedPages,
        lastUpdated: new Date(),
      })
    } else {
      // Articles and books have flat sentences array
      if (!data?.sentences || !Array.isArray(data.sentences)) {
        return NextResponse.json(
          { error: 'Invalid sentence data structure' },
          { status: 500 }
        )
      }

      if (sentenceIndex < 0 || sentenceIndex >= data.sentences.length) {
        return NextResponse.json(
          { error: 'Sentence index out of bounds' },
          { status: 400 }
        )
      }

      const updatedSentences = [...data.sentences]

      if (translation) {
        updatedSentences[sentenceIndex] = {
          ...updatedSentences[sentenceIndex],
          translation,
        }
      }

      if (audioUrl) {
        updatedSentences[sentenceIndex] = {
          ...updatedSentences[sentenceIndex],
          audioUrl,
        }
      }

      await docRef.update({
        sentences: updatedSentences,
        lastUpdated: new Date(),
      })
    }

    console.log(`[CacheSentence] Updated ${contentType} sentence ${sentenceIndex} in ${id}`)

    return NextResponse.json({
      success: true,
      message: 'Sentence cached successfully',
    })
  } catch (error: any) {
    console.error('[CacheSentence] Error:', error)
    return NextResponse.json(
      { error: 'Failed to cache sentence', details: error.message },
      { status: 500 }
    )
  }
}
