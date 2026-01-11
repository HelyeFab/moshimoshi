import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { precomputeWordExplanations } from '@/lib/ai/precompute/wordPrecompute'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    console.log('[WordPrecompute] Request received')

    const session = await getSession()
    if (!session) {
      console.log('[WordPrecompute] No session found')
      return NextResponse.json({ success: false, error: 'UNAUTHENTICATED' }, { status: 401 })
    }

    console.log('[WordPrecompute] Session valid, parsing body')
    const body = await request.json().catch((e) => {
      console.error('[WordPrecompute] Failed to parse JSON body:', e)
      return {}
    })
    const { contentId, contentType, text, limit, chunkIndex } = body || {}

    console.log('[WordPrecompute] Request params:', { contentId, contentType, textLength: text?.length, limit, chunkIndex })

    if (!contentId || !contentType || !text) {
      console.log('[WordPrecompute] Missing required fields')
      return NextResponse.json(
        { success: false, error: 'contentId, contentType, and text are required' },
        { status: 400 }
      )
    }

    if (typeof text !== 'string' || text.trim().length === 0) {
      console.log('[WordPrecompute] Invalid text field')
      return NextResponse.json(
        { success: false, error: 'text must be a non-empty string' },
        { status: 400 }
      )
    }

    // Guard against extremely large payloads
    if (text.length > 20000) {
      console.log('[WordPrecompute] Text too large:', text.length)
      return NextResponse.json(
        { success: false, error: 'text too large (max 20k characters)' },
        { status: 400 }
      )
    }

    console.log('[WordPrecompute] Starting precompute...')
    const result = await precomputeWordExplanations({
      contentId,
      contentType,
      text,
      limit: typeof limit === 'number' ? Math.min(Math.max(limit, 10), 1000) : undefined, // Increased from 400 to 1000
      chunkIndex: typeof chunkIndex === 'number' ? chunkIndex : undefined,
    } as any)

    console.log('[WordPrecompute] Success:', { generated: result.generated, cached: result.cached, total: result.total })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    console.error('[WordPrecompute] ERROR:', error)
    console.error('[WordPrecompute] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('[WordPrecompute] Error message:', error instanceof Error ? error.message : String(error))

    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        details: error instanceof Error ? error.message : String(error),
        stack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
