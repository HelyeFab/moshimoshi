import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { UserMnemonicDAO } from '@/lib/firebase/dao'
import { AIService } from '@/lib/ai/AIService'
import { setCachedKanjiMnemonic } from '@/lib/ai/cache/KanjiMnemonicCache'

/**
 * GET /api/kanji/mnemonic/regenerate?kanji=本
 * Check remaining regenerations for a specific kanji
 */
export async function GET(request: NextRequest) {
  console.log('[RegenerateMnemonic API] GET request received')
  try {
    const session = await getSession()
    console.log('[RegenerateMnemonic API] Session:', session ? 'authenticated' : 'not authenticated')
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const kanji = searchParams.get('kanji')?.trim()
    console.log('[RegenerateMnemonic API] Kanji param:', kanji)

    if (!kanji) {
      return NextResponse.json(
        { success: false, error: 'KANJI_REQUIRED' },
        { status: 400 }
      )
    }

    const dao = new UserMnemonicDAO()
    const limit = await dao.checkRegenerationLimit(session.uid, kanji)
    console.log('[RegenerateMnemonic API] Limit check result:', limit)

    return NextResponse.json({
      success: true,
      allowed: limit.allowed,
      remaining: limit.remaining,
      resetAtUtc: limit.resetAtUtc.toISOString(),
    })
  } catch (error) {
    console.error('[RegenerateMnemonic API] GET error:', error)
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/kanji/mnemonic/regenerate
 * Regenerate a mnemonic for a kanji (with rate limiting)
 * Body: { kanji: string, meaning?: string }
 */
export async function POST(request: NextRequest) {
  console.log('[RegenerateMnemonic API] POST request received')
  try {
    const session = await getSession()
    console.log('[RegenerateMnemonic API] POST Session:', session ? 'authenticated' : 'not authenticated')
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'UNAUTHENTICATED' },
        { status: 401 }
      )
    }

    const body = await request.json().catch(() => ({}))
    const kanji = body?.kanji?.trim()
    const meaning = body?.meaning?.trim()
    console.log('[RegenerateMnemonic API] POST body:', { kanji, meaning })

    if (!kanji) {
      return NextResponse.json(
        { success: false, error: 'KANJI_REQUIRED' },
        { status: 400 }
      )
    }

    if (kanji.length > 4) {
      return NextResponse.json(
        { success: false, error: 'SINGLE_KANJI_ONLY' },
        { status: 400 }
      )
    }

    // Check rate limit before generating
    console.log('[RegenerateMnemonic API] Checking rate limit...')
    const dao = new UserMnemonicDAO()
    const limit = await dao.checkRegenerationLimit(session.uid, kanji)
    console.log('[RegenerateMnemonic API] Rate limit result:', limit)

    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          remaining: 0,
          resetAtUtc: limit.resetAtUtc.toISOString(),
        },
        { status: 429 }
      )
    }

    // Generate new mnemonic with AI (force regenerate)
    console.log(`[RegenerateMnemonic API] Regenerating mnemonic for: ${kanji}`)
    let aiResponse
    try {
      const aiService = AIService.getInstance()
      aiResponse = await aiService.process({
        task: 'generate_kanji_mnemonic',
        content: { kanji, meaning },
        config: { cacheResults: false }, // Force new generation
      })
    } catch (aiError) {
      console.error('[RegenerateMnemonic API] AI Service error:', aiError)
      return NextResponse.json(
        {
          success: false,
          error: 'AI_SERVICE_ERROR',
          details: aiError instanceof Error ? aiError.message : 'Unknown AI error',
        },
        { status: 500 }
      )
    }

    if (!aiResponse.success || !aiResponse.data) {
      console.error('[RegenerateMnemonic API] AI response failed:', aiResponse.error)
      return NextResponse.json(
        {
          success: false,
          error: aiResponse.error || 'AI_PROCESSING_FAILED',
          metadata: aiResponse.metadata,
        },
        { status: 500 }
      )
    }

    // Save to cache (overwrite existing)
    await setCachedKanjiMnemonic(aiResponse.data)

    // Increment regeneration count
    const newLimit = await dao.incrementRegeneration(session.uid, kanji)

    return NextResponse.json({
      success: true,
      mnemonic: aiResponse.data,
      remaining: newLimit.remaining,
      resetAtUtc: newLimit.resetAtUtc.toISOString(),
      usage: aiResponse.usage,
    })
  } catch (error) {
    console.error('[RegenerateMnemonic API] POST error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        details: errorMessage,
      },
      { status: 500 }
    )
  }
}
