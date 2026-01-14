import { NextRequest, NextResponse } from 'next/server'
import { tatoebaSentenceService } from '@/services/tatoebaSentenceService'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const kanji = searchParams.get('kanji')
    const limit = parseInt(searchParams.get('limit') || '2')

    if (!kanji) {
      return NextResponse.json({ error: 'Kanji parameter is required' }, { status: 400 })
    }

    // Search for sentences containing the kanji
    console.log(`[Tatoeba API] Searching for sentences with kanji: ${kanji}`)
    const sentences = await tatoebaSentenceService.searchByKanji(kanji, limit)
    console.log(`[Tatoeba API] Found ${sentences.length} sentences`)

    // Return empty array instead of error if no sentences found
    return NextResponse.json({ sentences })
  } catch (error: any) {
    console.error('[Tatoeba API] Error searching Tatoeba sentences:', error?.message || error)
    // Return empty array on error for graceful degradation
    return NextResponse.json({ sentences: [] }, { status: 200 })
  }
}