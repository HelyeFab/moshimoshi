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

// Color scheme for different parts of speech
export const POS_COLORS: Record<string, string> = {
  noun: '#3b82f6',       // Blue
  verb: '#ef4444',       // Red
  adjective: '#10b981',  // Green
  adverb: '#f59e0b',     // Amber
  particle: '#8b5cf6',   // Purple
  auxiliary: '#ec4899',  // Pink
  conjunction: '#06b6d4', // Cyan
  interjection: '#f97316', // Orange
  adnominal: '#6366f1',  // Indigo
  prefix: '#84cc16',     // Lime
  symbol: '#6b7280',     // Gray
  filler: '#a78bfa',     // Light purple
  other: '#9ca3af',      // Light gray
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
    // For now, use fallback tokenization
    // In the future, this could call a server-side API for proper tokenization
    return this.fallbackTokenize(text);
  }

  private fallbackTokenize(text: string): TokenWithHighlight[] {
    // Simple fallback that splits by common Japanese punctuation and spaces
    const segments = text.split(/([。、！？\s]+)/);
    return segments
      .filter(segment => segment.length > 0)
      .map((segment, index) => ({
        word_id: index,
        word_type: 'KNOWN',
        word_position: index,
        surface_form: segment,
        pos: '名詞',
        pos_detail_1: '一般',
        pos_detail_2: '*',
        pos_detail_3: '*',
        conjugated_type: '*',
        conjugated_form: '*',
        basic_form: segment,
        reading: segment,
        pronunciation: segment,
        highlightClass: 'grammar-noun',
        color: POS_COLORS.noun,
      }));
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