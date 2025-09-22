/**
 * Japanese text parsing utilities for furigana and ruby tag handling
 */

import { ParsedWord } from '@/types/story';

/**
 * Parse Japanese text and extract words with readings from ruby tags
 */
export function parseJapaneseText(text: string): ParsedWord[] {
  const words: ParsedWord[] = [];

  // Extract ruby elements
  const rubyRegex = /<ruby>([^<]+)<rt>([^<]+)<\/rt><\/ruby>/g;
  const rubyRegexWithRp = /<ruby>([^<]+)<rp>\(<\/rp><rt>([^<]+)<\/rt><rp>\)<\/rp><\/ruby>/g;

  let match;

  // Try both ruby formats
  while ((match = rubyRegex.exec(text)) !== null) {
    words.push({
      word: match[1],
      reading: match[2]
    });
  }

  // Reset lastIndex for the next regex
  rubyRegexWithRp.lastIndex = 0;

  while ((match = rubyRegexWithRp.exec(text)) !== null) {
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
    return text; // Return as-is if showing furigana
  }

  // Remove ruby tags but keep the base text
  return removeFurigana(text);
}

/**
 * Remove furigana ruby tags from text, keeping only the base text
 */
export function removeFurigana(text: string): string {
  // Handle ruby tags with rp elements
  let cleanedText = text.replace(/<ruby>([^<]+)<rp>\(<\/rp><rt>[^<]+<\/rt><rp>\)<\/rp><\/ruby>/g, '$1');

  // Handle simple ruby tags
  cleanedText = cleanedText.replace(/<ruby>([^<]+)<rt>[^<]+<\/rt><\/ruby>/g, '$1');

  return cleanedText;
}

/**
 * Clean text for TTS by properly handling ruby tags and removing HTML
 * This ensures that text with furigana doesn't get read twice
 */
export function cleanTextForTTS(text: string): string {
  // First, handle ruby tags by keeping only the base text (kanji)
  let cleanedText = removeFurigana(text);

  // Then remove all other HTML tags
  cleanedText = cleanedText.replace(/<[^>]*>/g, '');

  // Clean up extra whitespace and normalize
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

  return cleanedText;
}

/**
 * Convert katakana to hiragana
 */
export function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30A1-\u30FA]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

/**
 * Convert hiragana to katakana
 */
export function hiraganaToKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (match) => {
    const chr = match.charCodeAt(0) + 0x60;
    return String.fromCharCode(chr);
  });
}

/**
 * Check if a string contains kanji
 */
export function hasKanji(str: string): boolean {
  return /[\u4e00-\u9faf]/.test(str);
}

/**
 * Check if a string contains only hiragana
 */
export function isHiragana(str: string): boolean {
  return /^[\u3040-\u309F]+$/.test(str);
}

/**
 * Check if a string contains only katakana
 */
export function isKatakana(str: string): boolean {
  return /^[\u30A0-\u30FF]+$/.test(str);
}

/**
 * Check if a string contains only kana (hiragana or katakana)
 */
export function isKana(str: string): boolean {
  return /^[\u3040-\u309F\u30A0-\u30FF]+$/.test(str);
}

/**
 * Split text into sentences based on Japanese punctuation
 */
export function splitIntoSentences(text: string): string[] {
  // Split by Japanese sentence-ending punctuation
  const sentences = text.split(/([。！？\n])/);

  // Recombine the punctuation with the preceding sentence
  const result: string[] = [];
  let current = '';

  for (let i = 0; i < sentences.length; i++) {
    if (sentences[i].match(/[。！？\n]/)) {
      current += sentences[i];
      if (current.trim()) {
        result.push(current.trim());
      }
      current = '';
    } else {
      current += sentences[i];
    }
  }

  // Add any remaining text
  if (current.trim()) {
    result.push(current.trim());
  }

  return result;
}

/**
 * Wrap text with ruby tags for furigana display
 */
export function wrapWithRuby(kanji: string, reading: string, includeRp: boolean = true): string {
  // Convert katakana reading to hiragana for display
  const hiraganaReading = katakanaToHiragana(reading);

  // Don't add furigana if the reading is the same as the kanji
  if (hiraganaReading === kanji || !hasKanji(kanji)) {
    return kanji;
  }

  if (includeRp) {
    // Include <rp> tags for browsers that don't support ruby
    return `<ruby>${kanji}<rp>(</rp><rt>${hiraganaReading}</rt><rp>)</rp></ruby>`;
  } else {
    // Simple ruby tags
    return `<ruby>${kanji}<rt>${hiraganaReading}</rt></ruby>`;
  }
}

/**
 * Extract all unique kanji from text
 */
export function extractKanji(text: string): string[] {
  const kanjiRegex = /[\u4e00-\u9faf]/g;
  const matches = text.match(kanjiRegex);

  if (!matches) return [];

  // Return unique kanji
  return [...new Set(matches)];
}

/**
 * Count characters by type
 */
export interface CharacterCounts {
  kanji: number;
  hiragana: number;
  katakana: number;
  other: number;
  total: number;
}

export function countCharacterTypes(text: string): CharacterCounts {
  const cleanText = text.replace(/<[^>]*>/g, ''); // Remove HTML tags first

  const counts: CharacterCounts = {
    kanji: 0,
    hiragana: 0,
    katakana: 0,
    other: 0,
    total: 0
  };

  for (const char of cleanText) {
    if (/[\u4e00-\u9faf]/.test(char)) {
      counts.kanji++;
    } else if (/[\u3040-\u309F]/.test(char)) {
      counts.hiragana++;
    } else if (/[\u30A0-\u30FF]/.test(char)) {
      counts.katakana++;
    } else if (!/\s/.test(char)) { // Don't count whitespace
      counts.other++;
    }
  }

  counts.total = counts.kanji + counts.hiragana + counts.katakana + counts.other;

  return counts;
}

/**
 * Estimate reading difficulty based on character distribution
 */
export type ReadingDifficulty = 'beginner' | 'intermediate' | 'advanced';

export function estimateReadingDifficulty(text: string): ReadingDifficulty {
  const counts = countCharacterTypes(text);

  if (counts.total === 0) return 'beginner';

  const kanjiRatio = counts.kanji / counts.total;

  if (kanjiRatio < 0.1) {
    return 'beginner'; // Mostly kana
  } else if (kanjiRatio < 0.25) {
    return 'intermediate'; // Moderate kanji usage
  } else {
    return 'advanced'; // High kanji density
  }
}