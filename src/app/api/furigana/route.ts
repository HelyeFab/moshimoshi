import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { rateLimitMiddleware, getRateLimitHeaders } from '@/lib/api/rate-limiter';
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

const isKanjiChar = (ch: string): boolean => /[\u4e00-\u9faf]/.test(ch);

/**
 * Build ruby that annotates ONLY the kanji, leaving \u043e\u043aurigana/kana plain \u2014 so
 * \u5408\u3046 \u2192 \u5408(\u3042)\u3046, not \u5408\u3046(\u3042\u3046). For the common single-kanji-run token we strip
 * the matching leading/trailing kana from the reading and wrap just the kanji
 * run; anything more complex (multiple kanji runs, mismatched kana) falls back
 * to wrapping the whole token, which is the previous behaviour.
 */
function buildRubyHtml(surface: string, reading: string): string {
  const whole = `<ruby>${surface}<rp>(</rp><rt>${reading}</rt><rp>)</rp></ruby>`;
  const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

  // Segment the surface into consecutive kanji / non-kanji runs.
  const segs: { kanji: boolean; text: string }[] = [];
  for (const ch of surface) {
    const k = isKanjiChar(ch);
    const last = segs[segs.length - 1];
    if (last && last.kanji === k) last.text += ch;
    else segs.push({ kanji: k, text: ch });
  }
  if (!segs.some(s => s.kanji)) return surface;

  // Walk left→right, fitting the reading to each run. Kana runs must match the
  // reading; a kanji run takes the reading up to the next kana run. Any mismatch
  // bails to the whole-token ruby (safe).
  const rd = toHira(reading);
  let out = '';
  let pos = 0;
  for (let idx = 0; idx < segs.length; idx++) {
    const seg = segs[idx];
    if (!seg.kanji) {
      const segH = toHira(seg.text);
      if (rd.slice(pos, pos + segH.length) !== segH) return whole;
      out += seg.text;
      pos += segH.length;
    } else {
      const next = segs[idx + 1]; // always a kana run when present
      let kr: string;
      if (next) {
        const found = rd.indexOf(toHira(next.text), pos);
        if (found <= pos) return whole;
        kr = reading.slice(pos, found);
        pos = found;
      } else {
        kr = reading.slice(pos);
        pos = rd.length;
      }
      if (!kr) return whole;
      out += `<ruby>${seg.text}<rp>(</rp><rt>${kr}</rt><rp>)</rp></ruby>`;
    }
  }
  if (pos !== rd.length) return whole;
  return out;
}

const PARTICLE_FORMS = new Set(['の', 'は', 'が', 'を', 'で', 'に', 'と', 'へ', 'も']);
const KUNYOMI_OVERRIDES: Record<string, string> = {
  '風': 'かぜ',
};

// Check if a word should have spacing after it (not particles, connectors, etc.)
function shouldAddWordSpacing(token: KuromojiToken, nextToken?: KuromojiToken): boolean {
  const { part_of_speech, surface_form } = token;

  // Don't add spacing after punctuation
  if (part_of_speech === '記号' || part_of_speech === '補助記号') {
    return false;
  }

  // Don't add spacing after particles
  if (part_of_speech === '助詞') {
    return false;
  }

  // Don't add spacing after auxiliary verbs
  if (part_of_speech === '助動詞') {
    return false;
  }

  // Don't add spacing before particles if next token is a particle
  if (nextToken && nextToken.part_of_speech === '助詞') {
    return false;
  }

  // Don't add spacing before punctuation
  if (nextToken && (nextToken.part_of_speech === '記号' || nextToken.part_of_speech === '補助記号')) {
    return false;
  }

  return true;
}

function resolveReadingOverride(
  token: KuromojiToken,
  nextToken?: KuromojiToken
): string | null {
  const surface = token.surface_form;
  if (surface.length !== 1) return null;
  if (!hasKanji(surface)) return null;
  if (!nextToken || !PARTICLE_FORMS.has(nextToken.surface_form)) return null;
  return KUNYOMI_OVERRIDES[surface] || null;
}

function generateFurigana(tokens: KuromojiToken[]): string {
  return tokens
    .map((token, index) => {
      const { surface_form, reading, part_of_speech } = token;
      const nextToken = tokens[index + 1];

      // Handle Japanese full stop - add line break after it with proper spacing
      if (surface_form === '。') {
        return '。<div style="height: 1.5em;"></div>';
      }

      let wordHtml = '';

      // Skip other punctuation and symbols
      if (part_of_speech === '記号' || part_of_speech === '補助記号') {
        wordHtml = surface_form;
      }
      // Only add furigana if the surface form contains kanji and we have a reading
      else if (hasKanji(surface_form) && reading && reading !== surface_form) {
        const overrideReading = resolveReadingOverride(token, nextToken);
        const hiraganaReading = overrideReading
          ? overrideReading
          : convertKatakanaToHiragana(reading);

        // Don't add furigana if the reading is the same as the surface form
        if (hiraganaReading === surface_form) {
          wordHtml = surface_form;
        } else {
          // Annotate only the kanji, leaving okurigana/kana plain.
          wordHtml = buildRubyHtml(surface_form, hiraganaReading);
        }
      } else {
        wordHtml = surface_form;
      }

      // Add word spacing after certain types of words
      if (shouldAddWordSpacing(token, nextToken)) {
        wordHtml += '<span style="margin-right: 0.25em;"></span>';
      }

      return wordHtml;
    })
    .join('');
}

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting (premium tier gets 5x multiplier = 1500 req/min)
    const rateLimitResponse = await rateLimitMiddleware(request, {
      category: 'furigana',
      endpoint: 'generate',
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
