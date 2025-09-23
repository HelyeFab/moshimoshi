import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
const kuromoji = require('kuromoji');

// Type definitions for Kuromoji
interface KuromojiToken {
  surface_form: string;
  reading?: string;
  part_of_speech: string;
  pos_detail_1?: string;
  pos_detail_2?: string;
  pos_detail_3?: string;
  conjugated_type?: string;
  conjugated_form?: string;
  basic_form?: string;
  pronunciation?: string;
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

function convertKatakanaToHiragana(katakana: string): string {
  return katakana.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60)
  );
}

function hasKanji(text: string): boolean {
  return /[\u4e00-\u9faf]/.test(text);
}

function generateFurigana(tokens: KuromojiToken[]): string {
  return tokens
    .map((token) => {
      const { surface_form, reading, part_of_speech } = token;

      // Skip punctuation and symbols
      if (part_of_speech === '記号' || part_of_speech === '補助記号') {
        return surface_form;
      }

      // Only add furigana if the surface form contains kanji and we have a reading
      if (hasKanji(surface_form) && reading && reading !== surface_form) {
        const hiraganaReading = convertKatakanaToHiragana(reading);

        // Don't add furigana if the reading is the same as the surface form
        if (hiraganaReading === surface_form) {
          return surface_form;
        }

        return `<ruby>${surface_form}<rp>(</rp><rt>${hiraganaReading}</rt><rp>)</rp></ruby>`;
      } else {
        return surface_form;
      }
    })
    .join('');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text parameter is required and must be a string' },
        { status: 400 }
      );
    }

    // Get or build the tokenizer
    const tokenizer = cachedTokenizer || await buildTokenizer();

    // Tokenize the text
    const tokens = tokenizer.tokenize(text);

    // Generate furigana HTML
    const result = generateFurigana(tokens);

    return NextResponse.json({
      result,
      tokenCount: tokens.length,
      success: true
    });

  } catch (error) {
    console.error('Furigana generation error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate furigana',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    // Check if tokenizer can be built
    await buildTokenizer();

    return NextResponse.json({
      status: 'healthy',
      message: 'Furigana API is ready',
      tokenizerCached: !!cachedTokenizer
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Furigana API is not ready',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}