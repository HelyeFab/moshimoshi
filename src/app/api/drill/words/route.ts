/**
 * API Route: /api/drill/words
 * Get practice words for drill sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { WordUtils } from '@/lib/drill/word-utils';
import type { JapaneseWord } from '@/types/drill';

// Cache for common words
let cachedWords: JapaneseWord[] | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 1000 * 60 * 60; // 1 hour

/**
 * GET /api/drill/words
 * Get practice words for drilling
 */
export async function GET(request: NextRequest) {
  try {
    // Session optional for this endpoint
    const session = await getSession();

    const wordType = request.nextUrl.searchParams.get('type') || 'all';
    const jlpt = request.nextUrl.searchParams.get('jlpt');
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '30');

    // Check cache
    const now = Date.now();
    if (!cachedWords || now - cacheTimestamp > CACHE_DURATION) {
      // In production, this would fetch from a word API or database
      // For now, use fallback words
      cachedWords = WordUtils.getCommonPracticeWords();
      cacheTimestamp = now;
    }

    let words = [...cachedWords];

    // Filter by word type
    if (wordType === 'verbs') {
      words = words.filter(w =>
        w.type === 'Ichidan' ||
        w.type === 'Godan' ||
        w.type === 'Irregular'
      );
    } else if (wordType === 'adjectives') {
      words = words.filter(w =>
        w.type === 'i-adjective' ||
        w.type === 'na-adjective'
      );
    }

    // Filter by JLPT level
    if (jlpt) {
      words = words.filter(w => w.jlpt === jlpt);
    }

    // Shuffle and limit
    words = shuffleArray(words).slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        words,
        total: words.length
      }
    });
  } catch (error) {
    console.error('Error in GET /api/drill/words:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/drill/words/search
 * Search for specific words
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body = await request.json();
    const { query, limit = 10 } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query required' },
        { status: 400 }
      );
    }

    // Get cached words
    const words = cachedWords || WordUtils.getCommonPracticeWords();

    // Search by kanji, kana, or meaning
    const results = words.filter(word =>
      word.kanji.includes(query) ||
      word.kana.includes(query) ||
      word.meaning.toLowerCase().includes(query.toLowerCase())
    ).slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        words: results,
        total: results.length
      }
    });
  } catch (error) {
    console.error('Error in POST /api/drill/words/search:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Helper: Shuffle array
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}