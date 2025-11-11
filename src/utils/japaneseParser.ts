/**
 * Japanese text parsing utilities
 */

export interface ParsedWord {
  word: string;
  reading?: string;
  type?: string;
}

/**
 * Parse Japanese text and extract words with readings
 */
export function parseJapaneseText(text: string): ParsedWord[] {
  // Simple implementation - can be enhanced with proper morphological analysis
  const words: ParsedWord[] = [];

  // Extract ruby elements
  const rubyRegex = /<ruby>([^<]+)<rt>([^<]+)<\/rt><\/ruby>/g;
  let match;

  while ((match = rubyRegex.exec(text)) !== null) {
    words.push({
      word: match[1],
      reading: match[2]
    });
  }

  return words;
}

/**
 * Process text with furigana - adds or removes furigana based on settings
 */
export function processTextWithFurigana(text: string, showFurigana: boolean = true): string {
  if (showFurigana) {
    return text;
  }

  // Remove ruby tags but keep the base text
  return text.replace(/<ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby>/g, '$1');
}

/**
 * Clean text for TTS by properly handling ruby tags and removing HTML
 * This ensures that text with furigana doesn't get read twice
 */
export function cleanTextForTTS(text: string): string {
  // First, handle ruby tags by keeping only the base text (kanji)
  let cleanedText = text.replace(/<ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby>/g, '$1');

  // Then remove all other HTML tags
  cleanedText = cleanedText.replace(/<[^>]*>/g, '');

  // Clean up extra whitespace and normalize
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

  return cleanedText;
}

/**
 * Convert katakana to hiragana
 */
export function convertKatakanaToHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30FA]/g, function (match) {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}