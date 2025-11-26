/**
 * Word Extractor Utility
 * Extracts top 100 Japanese words from article content for pre-caching
 * Filters out particles, common words, and prioritizes meaningful vocabulary
 */

import * as logger from 'firebase-functions/logger';

export interface ExtractedWord {
  word: string;
  frequency: number;
  type: 'kanji' | 'hiragana' | 'katakana' | 'mixed';
  estimatedJLPT?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
}

export interface WordExtractionResult {
  words: ExtractedWord[];
  totalWordCount: number;
  uniqueWordCount: number;
  extractedCount: number;
}

// Common particles and connectors to filter out
const COMMON_PARTICLES = new Set([
  'は', 'が', 'を', 'に', 'へ', 'と', 'で', 'の', 'や', 'か', 'も',
  'から', 'まで', 'より', 'など', 'ので', 'のに', 'ば', 'たら',
  'けど', 'けれど', 'けれども', 'し', 'て', 'た', 'だ', 'です', 'ます'
]);

// Common N5 words that don't need explanation (very basic)
const BASIC_WORDS = new Set([
  'これ', 'それ', 'あれ', 'ここ', 'そこ', 'あそこ', 'どこ',
  'この', 'その', 'あの', 'どの', 'だれ', 'なに', 'なん',
  'はい', 'いいえ', 'ええ', 'うん', 'ううん'
]);

/**
 * Extract top 100 words from article content
 */
export function extractTopWords(
  content: string,
  limit: number = 100
): WordExtractionResult {
  const startTime = Date.now();

  try {
    // Clean and normalize content
    const normalizedContent = normalizeText(content);

    // Extract all Japanese words/phrases
    const wordMatches = extractJapaneseWords(normalizedContent);

    // Count word frequencies
    const wordFrequency = countWordFrequency(wordMatches);

    // Filter out particles, basic words, and very short words
    const filteredWords = filterWords(wordFrequency);

    // Sort by frequency and importance
    const sortedWords = sortWordsByImportance(filteredWords);

    // Take top N words
    const topWords = sortedWords.slice(0, limit);

    const duration = Date.now() - startTime;

    logger.debug('[WordExtractor] Extraction complete', {
      totalWordCount: wordMatches.length,
      uniqueWordCount: Object.keys(wordFrequency).length,
      extractedCount: topWords.length,
      durationMs: duration
    });

    return {
      words: topWords,
      totalWordCount: wordMatches.length,
      uniqueWordCount: Object.keys(wordFrequency).length,
      extractedCount: topWords.length
    };

  } catch (error) {
    logger.error('[WordExtractor] Error extracting words', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      words: [],
      totalWordCount: 0,
      uniqueWordCount: 0,
      extractedCount: 0
    };
  }
}

/**
 * Normalize text by removing HTML, special characters, etc.
 */
function normalizeText(text: string): string {
  // Remove HTML tags
  let normalized = text.replace(/<[^>]*>/g, ' ');

  // Remove URLs
  normalized = normalized.replace(/https?:\/\/[^\s]+/g, ' ');

  // Remove numbers
  normalized = normalized.replace(/[0-9]+/g, ' ');

  // Remove punctuation but keep Japanese characters
  normalized = normalized.replace(/[.,!?;:()「」『』【】〈〉《》〔〕［］｛｝]/g, ' ');

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

/**
 * Extract Japanese words/phrases using character ranges
 */
function extractJapaneseWords(text: string): string[] {
  const words: string[] = [];

  // Match sequences of Japanese characters (kanji, hiragana, katakana)
  // This regex matches one or more Japanese characters
  const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3400-\u4DBF]+/g;
  const matches = text.match(japaneseRegex);

  if (matches) {
    // Further split by character type changes to get individual words
    matches.forEach(match => {
      const segments = segmentByCharType(match);
      words.push(...segments);
    });
  }

  return words;
}

/**
 * Segment text by character type changes
 * E.g., "食べます" -> ["食べます"] (keep together if mixed)
 * "食べる" -> ["食べる"]
 */
function segmentByCharType(text: string): string[] {
  const segments: string[] = [];
  let currentSegment = '';
  let currentType: string | null = null;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const charType = getCharType(char);

    // Keep kanji+hiragana together (common pattern like 食べる)
    // But split pure hiragana runs from pure kanji runs
    if (currentType === null || shouldContinueSegment(currentType, charType)) {
      currentSegment += char;
      currentType = charType;
    } else {
      if (currentSegment.length >= 2) { // Only keep segments of 2+ chars
        segments.push(currentSegment);
      }
      currentSegment = char;
      currentType = charType;
    }
  }

  // Add final segment
  if (currentSegment.length >= 2) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * Determine if we should continue the current segment
 */
function shouldContinueSegment(currentType: string, newType: string): boolean {
  // Keep kanji and hiragana together (verb/adjective patterns)
  if ((currentType === 'kanji' && newType === 'hiragana') ||
      (currentType === 'hiragana' && newType === 'kanji')) {
    return true;
  }

  // Continue if same type
  return currentType === newType;
}

/**
 * Get character type
 */
function getCharType(char: string): string {
  const code = char.charCodeAt(0);

  // Hiragana: U+3040 to U+309F
  if (code >= 0x3040 && code <= 0x309F) return 'hiragana';

  // Katakana: U+30A0 to U+30FF
  if (code >= 0x30A0 && code <= 0x30FF) return 'katakana';

  // Kanji: U+4E00 to U+9FAF (CJK Unified Ideographs)
  if (code >= 0x4E00 && code <= 0x9FAF) return 'kanji';

  // Extended Kanji: U+3400 to U+4DBF
  if (code >= 0x3400 && code <= 0x4DBF) return 'kanji';

  return 'other';
}

/**
 * Count word frequency
 */
function countWordFrequency(words: string[]): Record<string, number> {
  const frequency: Record<string, number> = {};

  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  return frequency;
}

/**
 * Filter out particles, basic words, and very short words
 */
function filterWords(wordFrequency: Record<string, number>): Record<string, number> {
  const filtered: Record<string, number> = {};

  Object.entries(wordFrequency).forEach(([word, count]) => {
    // Skip if too short (less than 2 characters)
    if (word.length < 2) return;

    // Skip if it's a common particle
    if (COMMON_PARTICLES.has(word)) return;

    // Skip if it's a basic word
    if (BASIC_WORDS.has(word)) return;

    // Skip if it's pure hiragana and very short (likely particle)
    if (word.length <= 2 && /^[\u3040-\u309F]+$/.test(word)) return;

    filtered[word] = count;
  });

  return filtered;
}

/**
 * Sort words by importance (frequency + character complexity)
 */
function sortWordsByImportance(wordFrequency: Record<string, number>): ExtractedWord[] {
  const words: ExtractedWord[] = [];

  Object.entries(wordFrequency).forEach(([word, frequency]) => {
    const type = determineWordType(word);
    const importance = calculateImportance(word, frequency);
    const estimatedJLPT = estimateJLPTLevel(word, type);

    words.push({
      word,
      frequency,
      type,
      estimatedJLPT
    });
  });

  // Sort by frequency (higher is better)
  words.sort((a, b) => b.frequency - a.frequency);

  return words;
}

/**
 * Determine word type based on characters
 */
function determineWordType(word: string): 'kanji' | 'hiragana' | 'katakana' | 'mixed' {
  const hasKanji = /[\u4E00-\u9FAF\u3400-\u4DBF]/.test(word);
  const hasHiragana = /[\u3040-\u309F]/.test(word);
  const hasKatakana = /[\u30A0-\u30FF]/.test(word);

  if (hasKanji && (hasHiragana || hasKatakana)) return 'mixed';
  if (hasKanji) return 'kanji';
  if (hasHiragana) return 'hiragana';
  if (hasKatakana) return 'katakana';

  return 'mixed';
}

/**
 * Calculate word importance score
 */
function calculateImportance(word: string, frequency: number): number {
  let score = frequency;

  // Boost kanji words (more important for learning)
  if (/[\u4E00-\u9FAF]/.test(word)) {
    score *= 1.5;
  }

  // Boost longer words (likely more specific/important)
  if (word.length >= 3) {
    score *= 1.2;
  }

  return score;
}

/**
 * Estimate JLPT level based on word characteristics
 * This is a rough heuristic - actual JLPT classification would need a dictionary
 */
function estimateJLPTLevel(word: string, type: string): 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | undefined {
  // Pure katakana words are often loanwords (N4-N3)
  if (type === 'katakana') {
    return word.length <= 3 ? 'N4' : 'N3';
  }

  // Pure hiragana words are often basic (N5-N4)
  if (type === 'hiragana') {
    return word.length <= 3 ? 'N5' : 'N4';
  }

  // Kanji words - estimate by length and complexity
  if (type === 'kanji' || type === 'mixed') {
    if (word.length <= 2) return 'N5';
    if (word.length === 3) return 'N4';
    if (word.length === 4) return 'N3';
    return 'N2'; // Longer words are generally more advanced
  }

  return undefined;
}

/**
 * Batch extract words from multiple articles
 */
export function extractWordsFromArticles(articles: Array<{ content: string }>, limit: number = 100): ExtractedWord[] {
  // Combine all article content
  const combinedContent = articles.map(a => a.content).join(' ');

  // Extract words
  const result = extractTopWords(combinedContent, limit);

  return result.words;
}
