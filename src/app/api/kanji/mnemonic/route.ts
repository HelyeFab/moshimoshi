import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { AIService } from '@/lib/ai/AIService';
import type { KanjiMnemonic } from '@/lib/ai/types';
import {
  getCachedKanjiMnemonic,
  setCachedKanjiMnemonic,
} from '@/lib/ai/cache/KanjiMnemonicCache';

/**
 * GET /api/kanji/mnemonic?kanji=本
 * Fetch a mnemonic for a kanji character (checks cache first)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kanji = searchParams.get('kanji')?.trim();

    if (!kanji) {
      return NextResponse.json(
        { success: false, error: 'KANJI_REQUIRED' },
        { status: 400 }
      );
    }

    if (kanji.length > 4) {
      return NextResponse.json(
        { success: false, error: 'SINGLE_KANJI_ONLY' },
        { status: 400 }
      );
    }

    // Check cache first
    const cached = await getCachedKanjiMnemonic(kanji);
    if (cached) {
      return NextResponse.json({
        success: true,
        cached: true,
        mnemonic: cached,
      });
    }

    // Not in cache - need to generate
    // For GET requests, return null to indicate cache miss
    // Client should POST to generate
    return NextResponse.json({
      success: true,
      cached: false,
      mnemonic: null,
    });
  } catch (error) {
    console.error('[KanjiMnemonic API] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/kanji/mnemonic
 * Generate a mnemonic for a kanji character
 * Body: { kanji: string, meaning?: string, force?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const kanji = body?.kanji?.trim();
    const meaning = body?.meaning?.trim();
    const force = body?.force === true;

    if (!kanji) {
      return NextResponse.json(
        { success: false, error: 'KANJI_REQUIRED' },
        { status: 400 }
      );
    }

    if (kanji.length > 4) {
      return NextResponse.json(
        { success: false, error: 'SINGLE_KANJI_ONLY' },
        { status: 400 }
      );
    }

    // Require authentication for generation (to prevent abuse)
    // Allow either: 1) User session, or 2) Admin key (for batch scripts)
    const adminKey = request.headers.get('x-admin-key');
    const expectedAdminKey = process.env.ADMIN_API_KEY || process.env.CRON_SECRET;
    const isAdminRequest = adminKey && expectedAdminKey && adminKey === expectedAdminKey;

    if (!isAdminRequest) {
      const session = await getSession();
      if (!session) {
        return NextResponse.json(
          { success: false, error: 'UNAUTHENTICATED' },
          { status: 401 }
        );
      }
    }

    // Check cache first (unless force regenerate)
    if (!force) {
      const cached = await getCachedKanjiMnemonic(kanji);
      if (cached) {
        return NextResponse.json({
          success: true,
          cached: true,
          mnemonic: cached,
        });
      }
    }

    // Generate with AI
    console.log(`[KanjiMnemonic API] Generating mnemonic for: ${kanji}${force ? ' (force regenerate)' : ''}`);
    let aiResponse;
    try {
      const aiService = AIService.getInstance();
      // Use process() directly to avoid potential HMR caching issues with convenience methods
      aiResponse = await aiService.process({
        task: 'generate_kanji_mnemonic',
        content: { kanji, meaning },
        config: force ? { cacheResults: false } : undefined,
      });
    } catch (aiError) {
      console.error('[KanjiMnemonic API] AI Service error:', aiError);
      return NextResponse.json(
        {
          success: false,
          error: 'AI_SERVICE_ERROR',
          details: aiError instanceof Error ? aiError.message : 'Unknown AI error',
        },
        { status: 500 }
      );
    }

    if (!aiResponse.success || !aiResponse.data) {
      console.error('[KanjiMnemonic API] AI response failed:', aiResponse.error);
      return NextResponse.json(
        {
          success: false,
          error: aiResponse.error || 'AI_PROCESSING_FAILED',
          metadata: aiResponse.metadata,
        },
        { status: 500 }
      );
    }

    // Save to cache
    await setCachedKanjiMnemonic(aiResponse.data);

    return NextResponse.json({
      success: true,
      cached: false,
      mnemonic: aiResponse.data,
      usage: aiResponse.usage,
    });
  } catch (error) {
    console.error('[KanjiMnemonic API] POST error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error && 'code' in error ? (error as any).code : undefined;
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        details: errorMessage,
        code: errorDetails,
      },
      { status: 500 }
    );
  }
}
