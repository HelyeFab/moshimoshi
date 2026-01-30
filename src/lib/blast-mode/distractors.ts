/**
 * Distractor Generator for Blast Mode
 * Agent C - Distractor & Tile Logic
 *
 * Generates MCQ distractors for meaning, Japanese, and reading screens
 */

import type { BlastItem } from './types'
import {
  generatePhoneticNeighbors,
  countMora,
  filterByMoraCount,
  arePhoneticallySimilar
} from './phonetics'

/**
 * Distractor pool sources
 * Agent B will provide actual implementations via data adapters
 */
export interface DistractorPool {
  kanji?: string[]
  vocabulary?: Array<{ kanji?: string; kana: string; meaning: string; pos?: string }>
  readings?: Array<{ reading: string; type: 'onyomi' | 'kunyomi' }>
}

/**
 * Distractor generation options
 */
export interface DistractorOptions {
  count?: number
  pool?: DistractorPool
  avoidSimilar?: boolean
  matchLength?: boolean
  matchMoraCount?: boolean
  matchPOS?: boolean
  avoidList?: string[]
}

/**
 * Calculate string similarity using Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // deletion
          dp[i][j - 1] + 1,     // insertion
          dp[i - 1][j - 1] + 1  // substitution
        )
      }
    }
  }

  return dp[m][n]
}

/**
 * Calculate similarity ratio (0-1)
 */
function similarityRatio(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length)
  if (maxLen === 0) return 1
  const distance = levenshteinDistance(str1, str2)
  return 1 - distance / maxLen
}

/**
 * Check if two strings are too similar (avoid trivial distractors)
 */
function areTooSimilar(str1: string, str2: string, threshold: number = 0.7): boolean {
  return similarityRatio(str1.toLowerCase(), str2.toLowerCase()) >= threshold
}

/**
 * Extract Part of Speech from vocabulary item
 */
function extractPOS(vocabItem: { pos?: string }): string | null {
  if (!vocabItem.pos) return null

  // Simplify to major categories
  const pos = vocabItem.pos.toLowerCase()
  if (pos.includes('verb')) return 'verb'
  if (pos.includes('noun')) return 'noun'
  if (pos.includes('adjective')) return 'adjective'
  if (pos.includes('adverb')) return 'adverb'

  return null
}

/**
 * Generate meaning (English) distractors
 * Strategy: Same POS, similar length, avoid synonyms
 * @param rng - Optional random number generator (0-1), defaults to Math.random
 */
export function generateMeaningDistractors(
  correctMeaning: string,
  options: DistractorOptions = {},
  rng: () => number = Math.random
): string[] {
  const {
    count = 3,
    pool = {},
    avoidSimilar = true,
    matchPOS = true,
    avoidList = []
  } = options

  const candidates: string[] = []

  const targetLength = correctMeaning.length

  // Build candidate pool from vocabulary
  if (pool.vocabulary && pool.vocabulary.length > 0) {
    for (const item of pool.vocabulary) {
      const meaning = item.meaning

      // Skip the correct answer
      if (meaning.toLowerCase() === correctMeaning.toLowerCase()) continue

      // Check POS match if enabled
      if (matchPOS && item.pos) {
        const itemPOS = extractPOS(item)
        // Note: We'd need to know the target POS here
        // For now, just use all candidates
      }

      // Check length similarity (within 50%)
      const lengthRatio = Math.abs(meaning.length - targetLength) / targetLength
      if (lengthRatio > 0.5) continue

      // Avoid overly similar meanings
      if (avoidSimilar && areTooSimilar(meaning, correctMeaning, 0.7)) continue
      if (avoidList.some(a => a.toLowerCase() === meaning.toLowerCase())) continue

      candidates.push(meaning)
    }
  }

  // Deduplicate and exclude correct answer
  const unique = Array.from(new Set(candidates)).filter(c =>
    c.toLowerCase() !== correctMeaning.toLowerCase() &&
    !avoidList.some(a => a.toLowerCase() === c.toLowerCase())
  )

  // Shuffle and select
  const shuffled = unique.sort(() => rng() - 0.5)
  return shuffled.slice(0, count)
}

/**
 * Generate Japanese text distractors
 * Strategy: Same length, similar kana/kanji pattern
 * @param rng - Optional random number generator (0-1), defaults to Math.random
 */
export function generateJapaneseDistractors(
  correctText: string,
  options: DistractorOptions = {},
  rng: () => number = Math.random
): string[] {
  const {
    count = 3,
    pool = {},
    matchLength = true,
    avoidList = []
  } = options

  const candidates: string[] = []

  const targetLength = correctText.length
  const hasKanji = /[\u4E00-\u9FFF]/.test(correctText)
  const hasKatakana = /[\u30A0-\u30FF]/.test(correctText)

  // Build candidates from vocabulary pool
  if (pool.vocabulary && pool.vocabulary.length > 0) {
    for (const item of pool.vocabulary) {
      const text = item.kanji || item.kana

      // Skip the correct answer
      if (text === correctText) continue

      // Match length if enabled
      if (matchLength && Math.abs(text.length - targetLength) > 1) continue

      // Match script type (kanji vs kana only)
      const candidateHasKanji = /[\u4E00-\u9FFF]/.test(text)
      if (hasKanji !== candidateHasKanji) continue

      // Avoid too similar
      if (areTooSimilar(text, correctText, 0.6)) continue
      if (avoidList.includes(text)) continue

      candidates.push(text)
    }
  }

  // Deduplicate and exclude correct answer
  const unique = Array.from(new Set(candidates)).filter(
    c => c !== correctText && !avoidList.includes(c)
  )

  // Shuffle and select
  const shuffled = unique.sort(() => rng() - 0.5)
  return shuffled.slice(0, count)
}

/**
 * Generate reading (onyomi/kunyomi) distractors
 * Strategy: Same mora count, phonetic neighbors, avoid overlap
 * @param rng - Optional random number generator (0-1), defaults to Math.random
 */
export function generateReadingDistractors(
  correctReading: string,
  readingType: 'onyomi' | 'kunyomi',
  options: DistractorOptions = {},
  rng: () => number = Math.random
): string[] {
  const {
    count = 3,
    pool = {},
    matchMoraCount = true,
    avoidList = []
  } = options

  const phoneticCandidates: string[] = []
  const poolCandidates: string[] = []

  const targetMora = countMora(correctReading)

  // Strategy 1: Phonetic neighbors (intentionally confusable)
  const phoneticNeighbors = generatePhoneticNeighbors(correctReading, count * 2)
  phoneticCandidates.push(...phoneticNeighbors)

  // Strategy 2: Pool readings of same type and mora count
  if (pool.readings && pool.readings.length > 0) {
    const typeFiltered = pool.readings
      .filter(r => r.type === readingType && r.reading !== correctReading)
      .map(r => r.reading)

    if (matchMoraCount) {
      const moraFiltered = filterByMoraCount(typeFiltered, targetMora)
      // Filter pool readings to avoid TOO similar to correct answer
      poolCandidates.push(
        ...moraFiltered.filter(r => !arePhoneticallySimilar(r, correctReading, 0.6))
      )
    } else {
      // Filter pool readings to avoid TOO similar to correct answer
      poolCandidates.push(
        ...typeFiltered.filter(r => !arePhoneticallySimilar(r, correctReading, 0.6))
      )
    }
  }

  // Combine: phonetic neighbors (don't filter) + pool candidates (filtered)
  const filtered = [...phoneticCandidates, ...poolCandidates].filter(
    r => !avoidList.includes(r)
  )

  // Shuffle and select unique candidates
  const unique = Array.from(new Set(filtered))
  const shuffled = unique.sort(() => rng() - 0.5)
  return shuffled.slice(0, count)
}

/**
 * Build complete MCQ options (correct + distractors)
 * Returns shuffled array with correct answer included
 * @param rng - Optional random number generator (0-1), defaults to Math.random
 */
export function buildMcqOptions(
  correctAnswer: string,
  distractors: string[],
  rng: () => number = Math.random
): { options: string[]; correctIndex: number } {
  // Deduplicate and filter out correct answer from distractors
  const uniqueDistractors = Array.from(
    new Set(distractors.filter(d => d !== correctAnswer))
  )

  // Build options array with correct answer + unique distractors
  const options = [correctAnswer, ...uniqueDistractors]

  // Shuffle while tracking correct answer index
  const shuffled: string[] = []
  const indices = Array.from({ length: options.length }, (_, i) => i)

  while (indices.length > 0) {
    const randomIndex = Math.floor(rng() * indices.length)
    const optionIndex = indices.splice(randomIndex, 1)[0]
    shuffled.push(options[optionIndex])
  }

  const correctIndex = shuffled.indexOf(correctAnswer)

  return { options: shuffled, correctIndex }
}

/**
 * High-level API: Generate MCQ options for meaning screen
 * @param rng - Optional random number generator (0-1), defaults to Math.random
 */
export function generateMeaningMcq(
  item: BlastItem,
  pool?: DistractorPool,
  avoidList: string[] = [],
  rng: () => number = Math.random
): { options: string[]; correctIndex: number } {
  const distractors = generateMeaningDistractors(item.meaningEn, { pool, count: 3, avoidList }, rng)
  return buildMcqOptions(item.meaningEn, distractors, rng)
}

/**
 * High-level API: Generate MCQ options for Japanese screen
 * @param rng - Optional random number generator (0-1), defaults to Math.random
 */
export function generateJapaneseMcq(
  item: BlastItem,
  pool?: DistractorPool,
  avoidList: string[] = [],
  rng: () => number = Math.random
): { options: string[]; correctIndex: number } {
  const correctText = item.kanji || item.kana || ''
  const distractors = generateJapaneseDistractors(correctText, { pool, count: 3, avoidList }, rng)
  return buildMcqOptions(correctText, distractors, rng)
}

/**
 * High-level API: Generate MCQ options for reading screen
 * @param rng - Optional random number generator (0-1), defaults to Math.random
 */
export function generateReadingMcq(
  reading: string,
  readingType: 'onyomi' | 'kunyomi',
  pool?: DistractorPool,
  avoidList: string[] = [],
  rng: () => number = Math.random
): { options: string[]; correctIndex: number } {
  const distractors = generateReadingDistractors(reading, readingType, { pool, count: 3, avoidList }, rng)
  return buildMcqOptions(reading, distractors, rng)
}
