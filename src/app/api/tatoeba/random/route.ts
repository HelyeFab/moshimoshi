import { NextRequest, NextResponse } from 'next/server'
import { tatoebaSentenceService } from '@/services/tatoebaSentenceService'

/**
 * GET /api/tatoeba/random
 * Fetch random Tatoeba sentences for use as distractors
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '20')

    // Cap at 50 to prevent abuse
    const safeLimit = Math.min(limit, 50)

    const sentences = await tatoebaSentenceService.getRandomSentences(safeLimit)

    return NextResponse.json({ sentences })
  } catch (error) {
    console.error('Error fetching random Tatoeba sentences:', error)
    return NextResponse.json({ error: 'Failed to fetch random sentences' }, { status: 500 })
  }
}
