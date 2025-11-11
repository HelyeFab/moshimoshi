// Kuromoji service for Japanese morphological analysis
// This service now uses the /api/furigana endpoint instead of client-side kuromoji

export interface TokenFeatures {
  word_id: number;
  word_type: string;
  word_position: number;
  surface_form: string;
  pos: string;
  pos_detail_1: string;
  pos_detail_2: string;
  pos_detail_3: string;
  conjugated_type: string;
  conjugated_form: string;
  basic_form: string;
  reading?: string;
  pronunciation?: string;
}

export interface TokenWithHighlight extends TokenFeatures {
  highlightClass?: string;
  color?: string;
}

// Part of speech mapping to English categories
const POS_MAPPING: Record<string, string> = {
  '名詞': 'noun',           // Noun
  '動詞': 'verb',           // Verb
  '形容詞': 'adjective',    // I-adjective
  '形容動詞': 'adjective',  // Na-adjective
  '副詞': 'adverb',         // Adverb
  '助詞': 'particle',       // Particle
  '助動詞': 'auxiliary',    // Auxiliary verb
  '接続詞': 'conjunction',  // Conjunction
  '感動詞': 'interjection', // Interjection
  '連体詞': 'adnominal',    // Adnominal
  '接頭詞': 'prefix',       // Prefix
  '記号': 'symbol',         // Symbol/punctuation
  'フィラー': 'filler',     // Filler
  'その他': 'other',        // Other
};

// Color scheme for different parts of speech (balanced for both themes)
export const POS_COLORS: Record<string, string> = {
  noun: '#3b82f6',       // Blue - balanced (blue-500)
  verb: '#cc1d2b',       // Red - balanced (red-500)
  adjective: '#10b981',  // Green - balanced (green-500)
  adverb: '#f59e0b',     // Amber - balanced (amber-500)
  particle: '#8b5cf6',   // Purple - balanced (purple-500)
  auxiliary: '#ec4899',  // Pink - balanced (pink-500)
  conjunction: '#06b6d4', // Cyan - balanced (cyan-500)
  interjection: '#f97316', // Orange - balanced (orange-500)
  adnominal: '#6366f1',  // Indigo - balanced (indigo-500)
  prefix: '#84cc16',     // Lime - balanced (lime-500)
  symbol: '#6b7280',     // Gray (gray-500)
  filler: '#a78bfa',     // Light purple - balanced (purple-400)
  other: '#9ca3af',      // Light gray (gray-400)
};

class KuromojiService {
  private static instance: KuromojiService;

  private constructor() {}

  static getInstance(): KuromojiService {
    if (!KuromojiService.instance) {
      KuromojiService.instance = new KuromojiService();
    }
    return KuromojiService.instance;
  }

  async tokenize(text: string): Promise<TokenWithHighlight[]> {
    try {
      // Call the furigana API which uses kuromoji for tokenization
      const response = await fetch('/api/furigana/tokenize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        // If API fails, use fallback
        return this.fallbackTokenize(text);
      }

      const data = await response.json();
      if (data.tokens) {
        // Map the API tokens to our format with highlighting
        return data.tokens.map((token: any) => {
          const englishPos = POS_MAPPING[token.pos] || 'other';
          return {
            ...token,
            highlightClass: `pos-${englishPos}`,
            color: POS_COLORS[englishPos],
          } as TokenWithHighlight;
        });
      }
    } catch (error) {
      console.error('Tokenization API error:', error);
    }

    // If all else fails, use fallback
    return this.fallbackTokenize(text);
  }

  private fallbackTokenize(text: string): TokenWithHighlight[] {
    // Use Intl.Segmenter if available for better word segmentation
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
      const segments = Array.from(segmenter.segment(text));
      return segments.map((segment, index) => this.createToken(segment.segment, index));
    }

    // Otherwise use regex-based tokenization
    const tokens: TokenWithHighlight[] = [];

    // Pattern to match Japanese words and particles
    const pattern = /[\u3040-\u309F]+|[\u30A0-\u30FF]+|[\u4E00-\u9FAF]+|[ぁ-んァ-ヶー一-龯]+|[。、！？]+|[a-zA-Z0-9]+/g;
    const matches = text.match(pattern) || [];

    let lastIndex = 0;

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const index = text.indexOf(match, lastIndex);

      // Add any spaces or other characters before this match
      if (index > lastIndex) {
        const between = text.substring(lastIndex, index);
        if (between.trim()) {
          tokens.push(this.createToken(between, tokens.length));
        }
      }

      tokens.push(this.createToken(match, tokens.length));
      lastIndex = index + match.length;
    }

    // Add any remaining text
    if (lastIndex < text.length) {
      const remaining = text.substring(lastIndex);
      if (remaining.trim()) {
        tokens.push(this.createToken(remaining, tokens.length));
      }
    }

    return tokens.length > 0 ? tokens : [this.createToken(text, 0)];
  }

  private createToken(text: string, index: number): TokenWithHighlight {
    // Simple heuristic-based POS tagging
    let pos = 'その他'; // Other

    // Check for punctuation
    if (/^[。、！？]$/.test(text)) {
      pos = '記号';
    }
    // Check for particles
    else if (/^[はがをにでとへからまでよりもやねのか]$/.test(text)) {
      pos = '助詞';
    }
    // Check for hiragana-only (likely verb endings or particles)
    else if (/^[\u3040-\u309F]+$/.test(text)) {
      if (text.length > 2 && /[うくぐすつぬぶむるる]$/.test(text)) {
        pos = '動詞'; // Likely a verb
      } else if (text.length <= 2) {
        pos = '助詞'; // Likely a particle
      } else {
        pos = '副詞'; // Possibly adverb
      }
    }
    // Check for katakana (likely noun)
    else if (/^[\u30A0-\u30FF]+$/.test(text)) {
      pos = '名詞';
    }
    // Check for kanji (likely noun or verb stem)
    else if (/[\u4E00-\u9FAF]/.test(text)) {
      // Check for common verb patterns with okurigana
      if (/[\u4E00-\u9FAF]+[うくぐすつぬぶむるる]$/.test(text)) {
        pos = '動詞';
      } else if (/[\u4E00-\u9FAF]+[いき]$/.test(text)) {
        pos = '形容詞';
      } else {
        pos = '名詞'; // Default to noun
      }
    }
    // Check for i-adjectives
    else if (/[いきしちにひみりぎじぢびぴ]$/.test(text)) {
      pos = '形容詞';
    }

    const englishPos = POS_MAPPING[pos] || 'other';

    return {
      word_id: index,
      word_type: 'KNOWN',
      word_position: index,
      surface_form: text,
      pos: pos,
      pos_detail_1: '一般',
      pos_detail_2: '*',
      pos_detail_3: '*',
      conjugated_type: '*',
      conjugated_form: '*',
      basic_form: text,
      reading: text,
      pronunciation: text,
      highlightClass: `pos-${englishPos}`,
      color: POS_COLORS[englishPos],
    };
  }

  getPartOfSpeech(token: TokenFeatures): string {
    return POS_MAPPING[token.pos] || 'other';
  }

  isContentWord(token: TokenFeatures): boolean {
    const posType = this.getPartOfSpeech(token);
    return ['noun', 'verb', 'adjective', 'adverb'].includes(posType);
  }

  isGrammarWord(token: TokenFeatures): boolean {
    const posType = this.getPartOfSpeech(token);
    return ['particle', 'auxiliary', 'conjunction'].includes(posType);
  }

  // Convert katakana to hiragana for furigana display
  katakanaToHiragana(str: string): string {
    return str.replace(/[\u30A1-\u30FA]/g, (match) => {
      const chr = match.charCodeAt(0) - 0x60;
      return String.fromCharCode(chr);
    });
  }

  // Check if a string contains kanji
  hasKanji(str: string): boolean {
    return /[\u4e00-\u9faf]/.test(str);
  }

  // Generate HTML ruby tags for furigana
  generateRubyTag(kanji: string, reading: string): string {
    const hiraganaReading = this.katakanaToHiragana(reading);

    // Don't add furigana if the reading is the same as the surface form
    if (hiraganaReading === kanji) {
      return kanji;
    }

    return `<ruby>${kanji}<rp>(</rp><rt>${hiraganaReading}</rt><rp>)</rp></ruby>`;
  }

  // Process text and add furigana ruby tags using the API
  async addFurigana(text: string): Promise<string> {
    try {
      // Call the furigana API endpoint
      const response = await fetch('/api/furigana', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        console.error('Furigana API request failed with status:', response.status);
        return text;
      }

      const data = await response.json();
      return data.result || text;
    } catch (error) {
      console.error('Failed to fetch furigana:', error);
      return text;
    }
  }

  // Remove furigana ruby tags from text
  removeFurigana(text: string): string {
    return text.replace(/<ruby>([^<]+)<rp>.*?<\/rp><rt>.*?<\/rt><rp>.*?<\/rp><\/ruby>/g, '$1');
  }

  // Clean text for TTS by removing HTML and ruby tags
  cleanTextForTTS(text: string): string {
    // First, handle ruby tags by keeping only the base text (kanji)
    let cleanedText = text.replace(/<ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby>/g, '$1');

    // Also handle ruby tags with rp elements
    cleanedText = cleanedText.replace(/<ruby>([^<]+)<rp>.*?<\/rp><rt>.*?<\/rt><rp>.*?<\/rp><\/ruby>/g, '$1');

    // Then remove all other HTML tags
    cleanedText = cleanedText.replace(/<[^>]*>/g, '');

    // Clean up extra whitespace and normalize
    cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

    return cleanedText;
  }
}

export default KuromojiService;
