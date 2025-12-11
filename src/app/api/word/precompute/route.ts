import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { precomputeWordExplanations } from '@/lib/ai/precompute/wordPrecompute'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ success: false, error: 'UNAUTHENTICATED' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { contentId, contentType, text, limit } = body || {}

    if (!contentId || !contentType || !text) {
      return NextResponse.json(
        { success: false, error: 'contentId, contentType, and text are required' },
        { status: 400 }
      )
    }

    if (typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'text must be a non-empty string' },
        { status: 400 }
      )
    }

    // Guard against extremely large payloads
    if (text.length > 20000) {
      return NextResponse.json(
        { success: false, error: 'text too large (max 20k characters)' },
        { status: 400 }
      )
    }

    const result = await precomputeWordExplanations({
      contentId,
      contentType,
      text,
      limit: typeof limit === 'number' ? Math.min(Math.max(limit, 10), 400) : undefined,
    } as any)

    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('[WordPrecompute] error', error)
    return NextResponse.json({ success: false, error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
