/**
 * API Route: /api/dictionary/search
 *
 * Server-side JMDict lookup. The dictionary JSON (~15 MB, 22.5k common
 * entries) is loaded once into the server process and scanned there, so the
 * browser only ever receives the ~30 matched results instead of downloading
 * and parsing the whole dictionary on every visit.
 *
 * Query params:
 *   q      - search term (kanji / kana / romaji / English). Required.
 *   limit  - max results (default 30, capped at 100).
 *   strict - "1"/"true" to use the exact-match-only search (romaji/English).
 */

import { NextRequest, NextResponse } from 'next/server'
import { searchJMdictWords, searchJMdictWordsStrict } from '@/utils/jmdictLocalSearch'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const q = (params.get('q') || '').trim()
    const strict = params.get('strict') === '1' || params.get('strict') === 'true'
    const limit = Math.min(parseInt(params.get('limit') || '30', 10) || 30, 100)

    if (!q) {
      return NextResponse.json({ source: 'jmdict', term: q, results: [] })
    }

    const results = strict
      ? await searchJMdictWordsStrict(q, limit)
      : await searchJMdictWords(q, limit)

    return NextResponse.json(
      { source: 'jmdict', term: q, count: results.length, results },
      {
        headers: {
          // Results are deterministic for a given query; let the CDN/browser
          // cache them briefly to absorb repeated lookups.
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
        },
      }
    )
  } catch (error) {
    console.error('[api/dictionary/search] failed:', error)
    return NextResponse.json(
      { source: 'jmdict', results: [], error: 'Dictionary search failed' },
      { status: 500 }
    )
  }
}
