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
    const sentences = await tatoebaSentenceService.searchByKanji(kanji, limit)

    return NextResponse.json({ sentences })
  } catch (error) {
    console.error('Error searching Tatoeba sentences:', error)
    return NextResponse.json({ error: 'Failed to search sentences' }, { status: 500 })
  }
}