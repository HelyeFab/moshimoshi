/**
 * API Route: /api/dictionary/word/[id]
 *
 * Returns the FULL structured JMDict entry for the dictionary word-detail page
 * (every sense kept separate + all variant writings) — unlike the search route,
 * which flattens glosses into a single string. Server-side, so the browser
 * never downloads the dictionary.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getWordDetailById } from '@/utils/jmdictLocalSearch'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const entry = await getWordDetailById(id)
    if (!entry) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json(
      { source: 'jmdict', entry },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    )
  } catch (error) {
    console.error('[api/dictionary/word/[id]] failed:', error)
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 })
  }
}
