import { NextRequest, NextResponse } from 'next/server'
import { tatoebaSentenceService } from '@/services/tatoebaSentenceService'

/**
 * GET /api/tatoeba/meaning
 * Search Tatoeba sentences by English meaning/keyword
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const meaning = searchParams.get('meaning')
    const limit = parseInt(searchParams.get('limit') || '5')

    if (!meaning) {
      return NextResponse.json({ error: 'Meaning parameter is required' }, { status: 400 })
    }

    // Cap at 20 to prevent abuse
    const safeLimit = Math.min(limit, 20)

    const sentences = await tatoebaSentenceService.searchByMeaning(meaning, safeLimit)

    return NextResponse.json({ sentences })
  } catch (error) {
    console.error('Error searching Tatoeba sentences by meaning:', error)
    return NextResponse.json({ error: 'Failed to search sentences' }, { status: 500 })
  }
}
