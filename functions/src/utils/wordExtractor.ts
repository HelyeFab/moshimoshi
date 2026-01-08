/**
 * Word Extractor Utility - KUROMOJI VERSION
 * Extracts Japanese words from article content using proper tokenization
 * Uses Kuromoji for accurate word boundary detection
 */

import * as logger from 'firebase-functions/logger'
import kuromoji from 'kuromoji'
import path from 'path'

export interface ExtractedWord {
  word: string
  frequency: number
  type: 'kanji' | 'hiragana' | 'katakana' | 'mixed'
  estimatedJLPT?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
}

export interface WordExtractionResult {
  words: ExtractedWord[]
  totalWordCount: number
  uniqueWordCount: number
  extractedCount: number
}

// Build kuromoji tokenizer once (server-side only)
let tokenizerPromise: Promise<kuromoji.Tokenizer<kuromoji.IpadicFeatures>> | null = null

async function getTokenizer() {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise((resolve, reject) => {
      // Try multiple possible dictionary paths
      const possiblePaths = [
        path.join(process.cwd(), 'node_modules/kuromoji/dict'),
        path.join(process.cwd(), '../node_modules/kuromoji/dict'),
        path.join(__dirname, '../../node_modules/kuromoji/dict'),
        path.join(__dirname, '../../../node_modules/kuromoji/dict'),
      ]

      let lastError: Error | null = null
      let attemptIndex = 0

      const tryNextPath = () => {
        if (attemptIndex >= possiblePaths.length) {
          reject(
            lastError ||
              new Error(
                `Failed to build kuromoji tokenizer. Tried paths: ${possiblePaths.join(', ')}`
              )
          )
          return
        }

        const dicPath = possiblePaths[attemptIndex]
        attemptIndex++

        kuromoji.builder({ dicPath }).build((err, tokenizer) => {
          if (err || !tokenizer) {
            lastError = err || new Error('Failed to build kuromoji tokenizer')
            logger.debug('[WordExtractor] Failed with path:', { dicPath, error: err?.message })
            tryNextPath()
            return
          }
          logger.info('[WordExtractor] Kuromoji tokenizer built successfully', { dicPath })
          resolve(tokenizer)
        })
      }

      tryNextPath()
    })
  }
  return tokenizerPromise
}

// Common particles to filter out
const COMMON_PARTICLES = new Set([
  'は',
  'が',
  'を',
  'に',
  'へ',
  'と',
  'で',
  'の',
  'や',
  'か',
  'も',
  'から',
  'まで',
  'より',
  'など',
  'ので',
  'のに',
  'ば',
  'たら',
  'けど',
  'けれど',
  'けれども',
  'し',
  'て',
  'た',
  'だ',
  'です',
  'ます',
  'する',
  'いる',
  'ある',
  'なる',
])

// Common N5 words that don't need explanation
const BASIC_WORDS = new Set([
  'これ',
  'それ',
  'あれ',
  'ここ',
  'そこ',
  'あそこ',
  'どこ',
  'この',
  'その',
  'あの',
  'どの',
  'だれ',
  'なに',
  'なん',
  'はい',
  'いいえ',
  'ええ',
  'うん',
  'ううん',
  'こと',
  'もの',
  'ため',
  'よう',
])

/**
 * Extract words using Kuromoji tokenizer (proper Japanese NLP)
 */
async function extractJapaneseWordsKuromoji(text: string): Promise<string[]> {
  const tokenizer = await getTokenizer()
  const tokens = tokenizer.tokenize(text || '')

  const words = tokens
    .map(token => token.basic_form || token.surface_form)
    .filter(Boolean)
    .filter(word => word.length > 1) // Filter tiny tokens

  return words
}

/**
 * Extract top N words from article content using Kuromoji tokenization
 */
export async function extractTopWords(
  content: string,
  limit: number = 100
): Promise<WordExtractionResult> {
  const startTime = Date.now()

  try {
    // Clean and normalize content
    const normalizedContent = normalizeText(content)

    // Extract all Japanese words using Kuromoji
    const wordMatches = await extractJapaneseWordsKuromoji(normalizedContent)

    // Count word frequencies
    const wordFrequency = countWordFrequency(wordMatches)

    // Filter out particles, basic words, and very short words
    const filteredWords = filterWords(wordFrequency)

    // Sort by frequency and importance
    const sortedWords = sortWordsByImportance(filteredWords)

    // Take top N words
    const topWords = sortedWords.slice(0, limit)

    const duration = Date.now() - startTime

    logger.info('[WordExtractor] Extraction complete (Kuromoji)', {
      totalWordCount: wordMatches.length,
      uniqueWordCount: Object.keys(wordFrequency).length,
      extractedCount: topWords.length,
      durationMs: duration,
    })

    return {
      words: topWords,
      totalWordCount: wordMatches.length,
      uniqueWordCount: Object.keys(wordFrequency).length,
      extractedCount: topWords.length,
    }
  } catch (error) {
    logger.error('[WordExtractor] Error extracting words', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    return {
      words: [],
      totalWordCount: 0,
      uniqueWordCount: 0,
      extractedCount: 0,
    }
  }
}

/**
 * Normalize text by removing HTML, special characters, etc.
 */
function normalizeText(text: string): string {
  // Remove HTML tags
  let normalized = text.replace(/<[^>]*>/g, ' ')

  // Remove URLs
  normalized = normalized.replace(/https?:\/\/[^\s]+/g, ' ')

  // Remove numbers
  normalized = normalized.replace(/[0-9]+/g, ' ')

  // Remove punctuation but keep Japanese characters
  normalized = normalized.replace(/[.,!?;:()「」『』【】〈〉《》〔〕［］｛｝]/g, ' ')

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim()

  return normalized
}

/**
 * Count word frequency
 */
function countWordFrequency(words: string[]): Record<string, number> {
  const frequency: Record<string, number> = {}

  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1
  })

  return frequency
}

/**
 * Filter out particles, basic words, and very short words
 */
function filterWords(wordFrequency: Record<string, number>): Record<string, number> {
  const filtered: Record<string, number> = {}

  Object.entries(wordFrequency).forEach(([word, count]) => {
    // Skip if too short (less than 2 characters)
    if (word.length < 2) return

    // Skip if it's a common particle
    if (COMMON_PARTICLES.has(word)) return

    // Skip if it's a basic word
    if (BASIC_WORDS.has(word)) return

    // Skip if it's pure hiragana and very short (likely particle)
    if (word.length <= 2 && /^[\u3040-\u309F]+$/.test(word)) return

    filtered[word] = count
  })

  return filtered
}

/**
 * Sort words by importance (frequency + character complexity)
 */
function sortWordsByImportance(wordFrequency: Record<string, number>): ExtractedWord[] {
  const words: ExtractedWord[] = []

  Object.entries(wordFrequency).forEach(([word, frequency]) => {
    const type = determineWordType(word)
    const estimatedJLPT = estimateJLPTLevel(word, type)

    words.push({
      word,
      frequency,
      type,
      estimatedJLPT,
    })
  })

  // Sort by frequency (higher is better)
  words.sort((a, b) => b.frequency - a.frequency)

  return words
}

/**
 * Determine word type based on characters
 */
function determineWordType(word: string): 'kanji' | 'hiragana' | 'katakana' | 'mixed' {
  const hasKanji = /[\u4E00-\u9FAF\u3400-\u4DBF]/.test(word)
  const hasHiragana = /[\u3040-\u309F]/.test(word)
  const hasKatakana = /[\u30A0-\u30FF]/.test(word)

  if (hasKanji && (hasHiragana || hasKatakana)) return 'mixed'
  if (hasKanji) return 'kanji'
  if (hasHiragana) return 'hiragana'
  if (hasKatakana) return 'katakana'

  return 'mixed'
}

/**
 * Calculate word importance score
 */
function calculateImportance(word: string, frequency: number): number {
  let score = frequency

  // Boost kanji words (more important for learning)
  if (/[\u4E00-\u9FAF]/.test(word)) {
    score *= 1.5
  }

  // Boost longer words (likely more specific/important)
  if (word.length >= 3) {
    score *= 1.2
  }

  return score
}

/**
 * Estimate JLPT level based on word characteristics
 */
function estimateJLPTLevel(
  word: string,
  type: string
): 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | undefined {
  // Pure katakana words are often loanwords (N4-N3)
  if (type === 'katakana') {
    return word.length <= 3 ? 'N4' : 'N3'
  }

  // Pure hiragana words are often basic (N5-N4)
  if (type === 'hiragana') {
    return word.length <= 3 ? 'N5' : 'N4'
  }

  // Kanji words - estimate by length and complexity
  if (type === 'kanji' || type === 'mixed') {
    if (word.length <= 2) return 'N5'
    if (word.length === 3) return 'N4'
    if (word.length === 4) return 'N3'
    return 'N2' // Longer words are generally more advanced
  }

  return undefined
}

/**
 * Batch extract words from multiple articles
 */
export async function extractWordsFromArticles(
  articles: Array<{ content: string }>,
  limit: number = 100
): Promise<ExtractedWord[]> {
  // Combine all article content
  const combinedContent = articles.map(a => a.content).join(' ')

  // Extract words
  const result = await extractTopWords(combinedContent, limit)

  return result.words
}
