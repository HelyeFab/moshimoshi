import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { rateLimitMiddleware } from '@/lib/api/rate-limiter';
const kuromoji = require('kuromoji');

// Type definitions for Kuromoji
interface KuromojiToken {
  surface_form: string;
  reading?: string;
  pos: string;
  pos_detail_1?: string;
  pos_detail_2?: string;
  pos_detail_3?: string;
  conjugated_type?: string;
  conjugated_form?: string;
  basic_form?: string;
  pronunciation?: string;
  word_id?: number;
  word_type?: string;
  word_position?: number;
}

interface KuromojiTokenizer {
  tokenize(text: string): KuromojiToken[];
}

// Cache the tokenizer to avoid rebuilding it on every request
let cachedTokenizer: KuromojiTokenizer | null = null;
let tokenizerPromise: Promise<KuromojiTokenizer> | null = null;

function buildTokenizer(): Promise<KuromojiTokenizer> {
  if (tokenizerPromise) {
    return tokenizerPromise;
  }

  tokenizerPromise = new Promise((resolve, reject) => {
    const tokenizerPath = path.join(process.cwd(), 'public', 'kuromoji_dict');

    kuromoji.builder({ dicPath: tokenizerPath }).build((err: Error | null, tokenizer: KuromojiTokenizer) => {
      if (err) {
        console.error('Failed to build tokenizer:', err);
        reject(err);
        return;
      }

      cachedTokenizer = tokenizer;
      resolve(tokenizer);
    });
  });

  return tokenizerPromise;
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting (premium tier gets 5x multiplier = 1500 req/min)
    const rateLimitResponse = await rateLimitMiddleware(request, {
      category: 'furigana',
      endpoint: 'tokenize',
      tier: 'premium',
      bypassForAdmin: true,
    });

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { text } = body;

    // Input validation and sanitization
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text parameter is required and must be a string' },
        { status: 400 }
      );
    }

    // Prevent excessively long inputs (DoS protection)
    if (text.length > 10000) {
      return NextResponse.json(
        { error: 'Text exceeds maximum length of 10,000 characters' },
        { status: 400 }
      );
    }

    // Sanitize input - remove control characters except newlines/tabs
    const sanitizedText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // Get or build the tokenizer
    const tokenizer = cachedTokenizer || await buildTokenizer();

    // Tokenize the sanitized text
    const tokens = tokenizer.tokenize(sanitizedText);

    // Map tokens to include all necessary fields
    const mappedTokens = tokens.map((token, index) => ({
      word_id: index,
      word_type: 'KNOWN',
      word_position: index,
      surface_form: token.surface_form,
      pos: token.pos || '名詞',
      pos_detail_1: token.pos_detail_1 || '*',
      pos_detail_2: token.pos_detail_2 || '*',
      pos_detail_3: token.pos_detail_3 || '*',
      conjugated_type: token.conjugated_type || '*',
      conjugated_form: token.conjugated_form || '*',
      basic_form: token.basic_form || token.surface_form,
      reading: token.reading,
      pronunciation: token.pronunciation || token.reading
    }));

    return NextResponse.json({
      tokens: mappedTokens,
      tokenCount: tokens.length,
      success: true
    });

  } catch (error) {
    console.error('Tokenization error:', error);

    return NextResponse.json(
      {
        error: 'Failed to tokenize text',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}