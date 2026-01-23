import { NextRequest, NextResponse } from 'next/server'
import { adminFirestore as db } from '@/lib/firebase/admin'

export const runtime = 'nodejs'

/**
 * Fetch precomputed word explanations for a content item.
 * Uses Admin SDK to avoid client-side permission issues.
 */
export async function GET(request: NextRequest) {
  try {
    const contentId = request.nextUrl.searchParams.get('contentId')
    const contentType = request.nextUrl.searchParams.get('contentType') as
      | 'article'
      | 'book'
      | 'story'
      | 'youtube'
      | 'video'
      | null

    if (!contentId || !contentType) {
      return NextResponse.json({ success: false, error: 'contentId and contentType are required' }, { status: 400 })
    }

    if (!db) {
      return NextResponse.json({ success: false, error: 'SERVICE_UNAVAILABLE' }, { status: 503 })
    }

    const collectionMap: Record<typeof contentType, string> = {
      article: 'news_article_word_explanations',
      book: 'book_word_explanations',
      story: 'story_word_explanations',
      youtube: 'youtube_word_explanations',
      video: 'video_word_explanations',
    }

    const collection = collectionMap[contentType]
    const snap = await db.collection(collection).doc(contentId).get()
    if (!snap.exists) {
      return NextResponse.json({ success: true, found: false })
    }

    return NextResponse.json({ success: true, found: true, data: snap.data() })
  } catch (error) {
    console.error('[WordPrecomputeFetch] error', error)
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
