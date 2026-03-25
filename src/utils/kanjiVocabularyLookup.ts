/**
 * Kanji Vocabulary Lookup Utility
 *
 * IMPORTANT LIMITATIONS:
 * - Uses heuristic kana substring matching to infer which reading is used in a word
 * - Does NOT authoritatively decompose word readings (rendaku, okurigana, irregular readings)
 * - Ranking is based on commonality heuristics, not pedagogical validation
 * - Match scores are relative rankings, not confidence percentages
 *
 * This module finds vocabulary words that likely use a specific kanji reading,
 * prioritizing common, learner-friendly examples. Use for vocabulary-first study card
 * generation where approximate matches are acceptable.
 */

import { toHiragana } from 'wanakana'
import { loadJMdictData, getLoadedJMdictData } from './jmdictLocalSearch'
import {
  getJLPTEntriesForExpression,
  getJLPTEntriesForLevel,
  getJLPTSearchLadder,
  type JLPTWordEntry,
} from './jlptWordIndex'
import type {
  VocabularyMatch,
  VocabularyLookupResult,
  VocabularySelectionCriteria,
} from '@/types/kanji-study'
import { DEFAULT_VOCABULARY_CRITERIA } from '@/types/kanji-study'
import type { JLPTLevel } from '@/types/kanji'

/**
 * JMDict data structures (reuse existing types from jmdictLocalSearch)
 */
interface JMDictGloss {
  lang: string
  text: string
}

interface JMDictSense {
  gloss?: JMDictGloss[]
  partOfSpeech?: string[]
}

interface JMDictKanji {
  text?: string
  tags?: string[]
  common?: boolean
}

interface JMDictKana {
  text?: string
  tags?: string[]
  common?: boolean
  appliesToKanji?: string[]
}

interface JMDictWord {
  id: string
  kanji?: JMDictKanji[]
  kana?: JMDictKana[]
  sense?: JMDictSense[]
}

interface JMDictData {
  words: JMDictWord[]
}

/**
 * Performance optimization: Character-based index
 * Maps kanji character -> list of word indices that contain it
 * Reduces O(n) full scan to O(m) where m = words containing the kanji
 */
interface KanjiIndex {
  [kanji: string]: number[] // kanji char -> word indices
}

let kanjiIndex: KanjiIndex | null = null
let indexBuildPromise: Promise<void> | null = null

/**
 * Build character-based index for fast lookup
 * Only builds once, cached for subsequent calls
 * Performance: O(n*k) where n=words, k=avg kanji per word
 */
async function buildKanjiIndex(): Promise<void> {
  if (kanjiIndex) return
  if (indexBuildPromise) return indexBuildPromise

  indexBuildPromise = (async () => {
    await loadJMdictData()
    const data = getLoadedJMdictData()

    if (!data || !data.words) {
      kanjiIndex = {}
      return
    }

    const index: KanjiIndex = {}

    for (let i = 0; i < data.words.length; i++) {
      const word = data.words[i]
      const kanjiText = word.kanji?.[0]?.text || ''

      // Index each kanji character in this word
      for (const char of kanjiText) {
        // Only index actual kanji characters (rough heuristic)
        if (char >= '\u4e00' && char <= '\u9faf') {
          if (!index[char]) {
            index[char] = []
          }
          index[char].push(i)
        }
      }
    }

    kanjiIndex = index
    console.log(`[VocabLookup] Built index for ${Object.keys(index).length} kanji characters`)
  })()

  await indexBuildPromise
}

/**
 * Per-kanji lookup cache
 * Caches results for (kanjiChar, reading, readingType, criteria) tuples
 * Avoids redundant lookups during card generation
 *
 * CORRECTNESS: Cache key includes all criteria fields that affect results
 * to prevent serving stale results when criteria change across calls
 */
interface LookupCacheKey {
  kanji: string
  reading: string
  type: 'onyomi' | 'kunyomi'
  jlptLevel?: JLPTLevel
  criteria: VocabularySelectionCriteria
}

const lookupCache = new Map<string, VocabularyLookupResult>()

function getCacheKey(key: LookupCacheKey): string {
  const c = key.criteria
  // Include ALL criteria fields that affect results in cache key
  return `${key.kanji}:${key.type}:${key.reading}:${key.jlptLevel || 'any'}:${c.maxWordLength}:${c.minScore}:${c.requireCommonFlag}:${c.maxResultsPerReading}`
}

/**
 * Priority scores for JMdict tags (higher = more common/useful)
 */
const TAG_PRIORITY_SCORES: Record<string, number> = {
  'news1': 150,
  'ichi1': 140,
  'spec1': 120,
  'gai1': 100,
  'news2': 70,
  'ichi2': 60,
  'spec2': 50,
  'gai2': 40,
  'nf01': 35, 'nf02': 33, 'nf03': 31, 'nf04': 29, 'nf05': 27,
  'nf06': 25, 'nf07': 23, 'nf08': 21, 'nf09': 19, 'nf10': 17,
}

/**
 * Word type priority (prefer learner-friendly types)
 */
const WORD_TYPE_SCORES: Record<string, number> = {
  'noun': 60,
  'verb': 50,
  'i-adjective': 45,
  'na-adjective': 40,
  'expression': 35,
  'adverb': 25,
  'other': 10,
}

const FORM_PENALTY_SCORES: Record<string, number> = {
  ateji: -140,
  gikun: -140,
  rK: -90,
  iK: -80,
  ok: -60,
  oK: -60,
  rk: -50,
  sk: -25,
  sK: -25,
}

const TECHNICAL_GLOSS_KEYWORDS = [
  'uterus',
  'womb',
  'electron',
  'atomic',
  'atom',
  'gene',
  'genetic',
  'molecule',
  'chemical',
  'physics',
  'mathematical',
  'anatom',
  'medical',
  'biology',
  'technical',
  'factor',
  'lattice',
]

const AFFIX_OR_FUNCTION_GLOSS_PATTERNS = [
  /^-/,
  /\bcounter for\b/,
  /\bsuffix\b/,
  /\bprefix\b/,
]

const ABSTRACT_GLOSS_KEYWORDS = [
  'uniformity',
  'unity',
  'choosing one from among several',
  'number of persons',
]

function sanitizeGlossForDisplay(gloss: string): string {
  return gloss
    .replace(/\(same as [^)]+\)/gi, '')
    .replace(/\(i\.e\.[^)]+\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+,/g, ',')
    .trim()
}

function splitMeaningCandidates(text: string): string[] {
  return text
    .split(/[;,]/)
    .map(part => sanitizeGlossForDisplay(part))
    .filter(Boolean)
}

function pickBestDisplayCandidate(candidates: string[]): string | null {
  if (candidates.length === 0) return null

  const cleanShort = candidates.find(
    candidate => candidate.length <= 20 && !/[()]/.test(candidate)
  )
  if (cleanShort) return cleanShort

  const cleanMedium = candidates.find(
    candidate => candidate.length <= 32 && !/[()]/.test(candidate)
  )
  if (cleanMedium) return cleanMedium

  return candidates[0]
}

function chooseDisplayMeaning(jlptEntry: JLPTWordEntry | null, meanings: string[]): string {
  if (jlptEntry?.meaning) {
    const jlptCandidates = splitMeaningCandidates(jlptEntry.meaning)
    const bestJlptMeaning = pickBestDisplayCandidate(jlptCandidates)
    if (bestJlptMeaning && !/[()]/.test(bestJlptMeaning)) {
      return bestJlptMeaning
    }
  }

  const sanitized = meanings.flatMap(splitMeaningCandidates)

  if (sanitized.length === 0) return 'Unknown'

  return pickBestDisplayCandidate(sanitized) || 'Unknown'
}

interface SelectedWordData {
  kanjiText: string
  kanaText: string
  tags: string[]
  isCommon: boolean
  sourceOrder: number
}

function getBestJLPTEntryForTeaching(
  expression: string,
  targetKanji: string,
  targetReading: string,
  readingType: 'onyomi' | 'kunyomi'
): JLPTWordEntry | null {
  const entries = getJLPTEntriesForExpression(expression)
  if (entries.length === 0) return null

  let bestEntry: JLPTWordEntry | null = null
  let bestScore = 0

  for (const entry of entries) {
    const matchScore = calculateReadingMatchScore(
      expression,
      entry.reading,
      targetKanji,
      targetReading,
      readingType
    )

    if (matchScore > bestScore) {
      bestScore = matchScore
      bestEntry = entry
    }
  }

  return bestScore > 0 ? bestEntry : null
}

function getJLPTPedagogyBonus(
  jlptEntry: JLPTWordEntry | null,
  selectedKana: string,
  expression: string,
  targetKanji: string,
  targetReading: string,
  readingType: 'onyomi' | 'kunyomi'
): number {
  if (!jlptEntry) return 0

  let bonus = 220

  const entryReadingMatch = calculateReadingMatchScore(
    expression,
    jlptEntry.reading,
    targetKanji,
    targetReading,
    readingType
  )

  if (entryReadingMatch >= 140) bonus += 80
  else if (entryReadingMatch >= 100) bonus += 40

  if (normalizeKana(selectedKana) === normalizeKana(jlptEntry.reading)) {
    bonus += 50
  }

  // JLPT list meanings are usually more learner-facing than the first JMdict gloss.
  bonus += 25

  return bonus
}

/**
 * Normalize kana to hiragana for comparison
 *
 * CANONICAL NORMALIZATION for all vocabulary/reading matching
 * - Strips okurigana markers (. -)
 * - Converts to hiragana (katakana → hiragana)
 * - Trims whitespace
 *
 * Used by both JMdict lookup and fallback matching to ensure consistent behavior
 */
export function normalizeKana(text: string): string {
  return toHiragana(text.replace(/[\.\-]/g, '').trim())
}

/**
 * Extract word type from parts of speech
 */
function extractWordType(pos: string[] | undefined): string {
  if (!pos || pos.length === 0) return 'other'

  const posStr = pos.join(' ').toLowerCase()

  if (
    pos.includes('n') ||
    posStr.includes(' noun') ||
    posStr.startsWith('noun') ||
    posStr.includes('n,') ||
    posStr.includes('n-')
  ) return 'noun'
  if (posStr.includes('v1') || posStr.includes('v5') || posStr.includes('verb')) return 'verb'
  if (posStr.includes('adj-i')) return 'i-adjective'
  if (posStr.includes('adj-na')) return 'na-adjective'
  if (posStr.includes('adv')) return 'adverb'
  if (pos.includes('exp') || posStr.includes('expression') || posStr.includes('exp')) return 'expression'

  return 'other'
}

/**
 * Get priority score from tags
 */
function getTagScore(tags: string[]): number {
  let maxScore = 0
  for (const tag of tags) {
    if (TAG_PRIORITY_SCORES[tag]) {
      maxScore = Math.max(maxScore, TAG_PRIORITY_SCORES[tag])
    }
  }
  return maxScore
}

function getFormPenalty(tags: string[]): number {
  let penalty = 0
  for (const tag of tags) {
    penalty += FORM_PENALTY_SCORES[tag] || 0
  }
  return penalty
}

function getTechnicalGlossPenalty(meanings: string[]): number {
  const glossText = meanings.join(' ').toLowerCase()
  for (const keyword of TECHNICAL_GLOSS_KEYWORDS) {
    if (glossText.includes(keyword)) {
      return -90
    }
  }
  return 0
}

function getGlossPedagogyAdjustment(meanings: string[], wordKanji: string): number {
  let adjustment = 0

  for (const meaning of meanings) {
    const gloss = meaning.toLowerCase().trim()

    if (!gloss) continue

    if (wordKanji.length === 1) {
      if (AFFIX_OR_FUNCTION_GLOSS_PATTERNS.some(pattern => pattern.test(gloss))) {
        adjustment -= 240
      }
      if (gloss.length >= 30) {
        adjustment -= 40
      }
    }

    if (ABSTRACT_GLOSS_KEYWORDS.some(keyword => gloss.includes(keyword))) {
      adjustment -= 80
    }

    if (/(ity|ness|tion|sion)$/.test(gloss)) {
      adjustment -= 35
    }

    if (gloss === 'only' || gloss === 'single') {
      adjustment += 25
    }
  }

  return adjustment
}

function countKanji(text: string): number {
  return Array.from(text).filter(char => char >= '\u4e00' && char <= '\u9faf').length
}

function selectPreferredWordData(
  word: JMDictWord,
  targetKanji: string,
  sourceOrder: number
): SelectedWordData | null {
  const kanjiOptions = (word.kanji || []).filter(entry => (entry.text || '').includes(targetKanji))
  const kanaOptions = word.kana || []

  if (kanjiOptions.length === 0 || kanaOptions.length === 0) {
    return null
  }

  const sortedKanji = [...kanjiOptions].sort((a, b) => {
    const commonDelta = Number(Boolean(b.common)) - Number(Boolean(a.common))
    if (commonDelta !== 0) return commonDelta

    const penaltyDelta = getFormPenalty(a.tags || []) - getFormPenalty(b.tags || [])
    if (penaltyDelta !== 0) return penaltyDelta

    return (a.text || '').length - (b.text || '').length
  })

  const sortedKana = [...kanaOptions].sort((a, b) => {
    const commonDelta = Number(Boolean(b.common)) - Number(Boolean(a.common))
    if (commonDelta !== 0) return commonDelta
    return (a.text || '').length - (b.text || '').length
  })

  const selectedKanji = sortedKanji[0]
  const selectedKana = sortedKana[0]

  if (!selectedKanji?.text || !selectedKana?.text) {
    return null
  }

  return {
    kanjiText: selectedKanji.text,
    kanaText: selectedKana.text,
    tags: [...(selectedKanji.tags || []), ...(selectedKana.tags || [])],
    isCommon: Boolean(selectedKanji.common || selectedKana.common),
    sourceOrder,
  }
}

/**
 * HEURISTIC reading match scoring
 *
 * LIMITATIONS:
 * - Uses kana substring matching, not morphological analysis
 * - Cannot handle all rendaku (voicing) changes accurately
 * - Okurigana matching is approximate
 * - Does not account for irregular readings or ateji
 *
 * Returns a heuristic score (0 = no match, higher = likely match)
 * NOT a confidence percentage - use for relative ranking only
 */
function calculateReadingMatchScore(
  wordKanji: string,
  wordKana: string,
  targetKanji: string,
  targetReading: string,
  readingType: 'onyomi' | 'kunyomi'
): number {
  const kanaNorm = normalizeKana(wordKana)
  const targetNorm = normalizeKana(targetReading)

  if (!kanaNorm || !targetNorm) return 0

  // For single-kanji words, exact match is best
  if (wordKanji === targetKanji) {
    if (kanaNorm === targetNorm) return 200 // Perfect match
    if (kanaNorm.startsWith(targetNorm)) return 150 // Likely okurigana
    if (kanaNorm.includes(targetNorm)) return 100 // Contains reading
  }

  // For multi-kanji words
  const kanjiIndex = wordKanji.indexOf(targetKanji)
  if (kanjiIndex === -1) return 0 // Target kanji not in word

  // HEURISTIC: Different strategies for on/kun readings
  if (readingType === 'kunyomi') {
    // Kunyomi: often standalone or with okurigana
    if (kanaNorm === targetNorm) return 180

    if (kanjiIndex === 0) {
      if (kanaNorm.startsWith(targetNorm)) return 140
      if (targetNorm.length > 1 && kanaNorm.includes(targetNorm)) return 75
    } else if (kanjiIndex === wordKanji.length - 1) {
      if (kanaNorm.endsWith(targetNorm)) return 140
      if (targetNorm.length > 1 && kanaNorm.includes(targetNorm)) return 75
    } else if (targetNorm.length > 1 && kanaNorm.includes(targetNorm)) {
      return 80
    }
  } else {
    // Onyomi: often embedded in compounds
    if (kanjiIndex === 0 && kanaNorm.startsWith(targetNorm)) return 160
    if (kanjiIndex === wordKanji.length - 1 && kanaNorm.endsWith(targetNorm)) return 140
    if (kanjiIndex > 0 && kanjiIndex < wordKanji.length - 1 && kanaNorm.includes(targetNorm)) {
      return 120
    }
  }

  return 0
}

function calculatePedagogicalWordShapeScore(
  wordKanji: string,
  wordKana: string,
  targetKanji: string,
  targetReading: string,
  readingType: 'onyomi' | 'kunyomi'
): number {
  const targetNorm = normalizeKana(targetReading)
  const kanaNorm = normalizeKana(wordKana)
  const kanjiCount = countKanji(wordKanji)
  const targetIndex = wordKanji.indexOf(targetKanji)
  let score = 0

  if (kanjiCount <= 2) score += 40
  else if (kanjiCount === 3) score += 15
  else score -= 25

  if (readingType === 'kunyomi') {
    if (kanaNorm.startsWith(targetNorm) || kanaNorm.endsWith(targetNorm)) score += 70
    else if (kanaNorm.includes(targetNorm)) score += 20

    if (wordKanji.includes('の')) score += 35
    if (/[ぁ-ん]/.test(wordKanji)) score += 25
    if (targetIndex === 0 || targetIndex === wordKanji.length - 1) score += 20
  } else {
    if (targetIndex === 0 && kanaNorm.startsWith(targetNorm)) score += 35
    if (targetIndex === wordKanji.length - 1 && kanaNorm.endsWith(targetNorm)) score += 45
    if (kanjiCount === 2) score += 20
  }

  return score
}

function getBareWordAdjustment(
  wordKanji: string,
  targetKanji: string,
  readingType: 'onyomi' | 'kunyomi'
): number {
  if (wordKanji !== targetKanji) {
    return 0
  }

  // Bare single-kanji entries are often dictionary-sense-like, especially for onyomi.
  // Vocabulary-first cards should prefer fuller lexical items unless a curated override
  // deliberately opts into the standalone form.
  return readingType === 'onyomi' ? -180 : -60
}

/**
 * Calculate composite score for ranking vocabulary matches
 */
function calculateCompositeScore(
  word: JMDictWord,
  selected: SelectedWordData,
  readingMatchScore: number,
  criteria: VocabularySelectionCriteria,
  targetKanji: string,
  targetReading: string,
  readingType: 'onyomi' | 'kunyomi',
  meanings: string[],
  jlptEntry: JLPTWordEntry | null
): number {
  let score = readingMatchScore // Start with reading match score

  // Tag priority (common words)
  const tags = selected.tags
  score += getTagScore(tags)
  score += getFormPenalty(tags)

  // Common flag bonus
  const isCommon = selected.isCommon
  if (isCommon) score += 100

  // Word type bonus
  const wordType = extractWordType(word.sense?.[0]?.partOfSpeech)
  score += WORD_TYPE_SCORES[wordType] || WORD_TYPE_SCORES.other

  // Word length bonus (prefer short, simple words)
  const kanjiText = selected.kanjiText
  const kanaText = selected.kanaText

  if (kanjiText.length === 2) {
    score += 80 // Two-kanji word (still good)
  } else if (kanjiText.length === 3) {
    score += 40 // Three-kanji word (acceptable)
  } else if (kanjiText.length >= criteria.maxWordLength + 2) {
    score -= 50 // Penalty for long words
  }

  // Penalize very long kana (indicates complex pronunciation)
  if (kanaText.length > 6) {
    score -= 30
  }

  // Reward learner-friendly shapes and demote opaque or domain-heavy examples.
  score += calculatePedagogicalWordShapeScore(
    kanjiText,
    kanaText,
    targetKanji,
    targetReading,
    readingType
  )
  score += getTechnicalGlossPenalty(meanings)
  score += getGlossPedagogyAdjustment(meanings, kanjiText)
  score += getBareWordAdjustment(kanjiText, targetKanji, readingType)
  score += getJLPTPedagogyBonus(
    jlptEntry,
    kanaText,
    kanjiText,
    targetKanji,
    targetReading,
    readingType
  )

  // Earlier JMdict entries are often more conventional/common senses.
  score += Math.max(0, 40 - selected.sourceOrder * 0.15)

  return score
}

function getCandidateExpressionsForLevel(level: JLPTLevel, kanjiChar: string): Set<string> {
  const entries = getJLPTEntriesForLevel(level)
  const expressions = new Set<string>()

  for (const entry of entries) {
    if (entry.expression.includes(kanjiChar)) {
      expressions.add(entry.expression)
    }
  }

  return expressions
}

function collectMatchesFromWordIndices(
  data: JMDictData,
  wordIndices: number[],
  kanjiChar: string,
  reading: string,
  readingType: 'onyomi' | 'kunyomi',
  criteria: VocabularySelectionCriteria,
  allowedExpressions?: Set<string>
): VocabularyMatch[] {
  const matches: VocabularyMatch[] = []

  for (const wordIndex of wordIndices) {
    const word = data.words[wordIndex]
    const selected = selectPreferredWordData(word, kanjiChar, wordIndex)
    if (!selected) continue

    const kanjiText = selected.kanjiText
    const kanaText = selected.kanaText

    if (allowedExpressions && !allowedExpressions.has(kanjiText)) {
      continue
    }

    if (criteria.maxWordLength > 0 && kanjiText.length > criteria.maxWordLength) {
      continue
    }

    const readingMatchScore = calculateReadingMatchScore(
      kanjiText,
      kanaText,
      kanjiChar,
      reading,
      readingType
    )

    if (readingMatchScore === 0) continue

    const jlptEntry = getBestJLPTEntryForTeaching(
      kanjiText,
      kanjiChar,
      reading,
      readingType
    )

    const meanings: string[] = []
    if (word.sense) {
      for (const sense of word.sense) {
        if (sense.gloss) {
          for (const gloss of sense.gloss) {
            if (gloss.lang === 'eng' || !gloss.lang) {
              meanings.push(gloss.text)
            }
          }
        }
      }
    }
    const meaning = chooseDisplayMeaning(jlptEntry, meanings)

    const compositeScore = calculateCompositeScore(
      word,
      selected,
      readingMatchScore,
      criteria,
      kanjiChar,
      reading,
      readingType,
      meanings,
      jlptEntry
    )

    if (compositeScore < criteria.minScore) continue

    const isCommon = selected.isCommon
    if (criteria.requireCommonFlag && !isCommon) continue

    const tags = selected.tags
    const wordType = extractWordType(word.sense?.[0]?.partOfSpeech)

    matches.push({
      word: kanjiText,
      wordReading: kanaText,
      meaning,
      score: compositeScore,
      isCommon,
      tags,
      wordType,
      matchQuality: getMatchQuality(compositeScore),
    })
  }

  matches.sort((a, b) => b.score - a.score)
  return matches.slice(0, criteria.maxResultsPerReading)
}

function buildLookupResult(
  reading: string,
  readingType: 'onyomi' | 'kunyomi',
  matches: VocabularyMatch[]
): VocabularyLookupResult {
  const hasGoodMatch = matches.length > 0 &&
    (matches[0].matchQuality === 'excellent' || matches[0].matchQuality === 'good')

  return {
    reading,
    readingType,
    words: matches,
    hasGoodMatch,
  }
}

/**
 * Determine match quality based on score
 */
function getMatchQuality(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 400) return 'excellent'
  if (score >= 250) return 'good'
  if (score >= 150) return 'fair'
  return 'poor'
}

/**
 * Find vocabulary words for a specific kanji and reading
 *
 * Performance: O(m) where m = words containing the kanji (via index)
 * Caches results to avoid redundant lookups
 *
 * @param kanjiChar - The kanji character (e.g., "水")
 * @param reading - The specific reading (e.g., "みず" or "すい")
 * @param readingType - Whether this is onyomi or kunyomi
 * @param criteria - Selection criteria for filtering/ranking
 * @returns Lookup result with ranked matches
 */
export async function findWordsForKanjiReading(
  kanjiChar: string,
  reading: string,
  readingType: 'onyomi' | 'kunyomi',
  criteria: VocabularySelectionCriteria = DEFAULT_VOCABULARY_CRITERIA,
  kanjiJlptLevel?: JLPTLevel
): Promise<VocabularyLookupResult> {
  // Check cache first (key includes criteria for correctness)
  const cacheKey = getCacheKey({
    kanji: kanjiChar,
    reading,
    type: readingType,
    jlptLevel: kanjiJlptLevel,
    criteria,
  })
  const cached = lookupCache.get(cacheKey)
  if (cached) {
    return cached
  }

  // Build index if needed
  await buildKanjiIndex()

  // Get loaded data (already loaded by buildKanjiIndex)
  const data = getLoadedJMdictData()

  if (!data || !data.words || !kanjiIndex) {
    const emptyResult: VocabularyLookupResult = {
      reading,
      readingType,
      words: [],
      hasGoodMatch: false,
    }
    lookupCache.set(cacheKey, emptyResult)
    return emptyResult
  }

  // Use index to get only words containing this kanji
  const wordIndices = kanjiIndex[kanjiChar] || []
  let result: VocabularyLookupResult | null = null

  if (kanjiJlptLevel) {
    const ladder = getJLPTSearchLadder(kanjiJlptLevel)

    for (const level of ladder) {
      const allowedExpressions = getCandidateExpressionsForLevel(level, kanjiChar)
      if (allowedExpressions.size === 0) continue

      const levelMatches = collectMatchesFromWordIndices(
        data,
        wordIndices,
        kanjiChar,
        reading,
        readingType,
        criteria,
        allowedExpressions
      )

      if (levelMatches.length === 0) continue

      result = buildLookupResult(reading, readingType, levelMatches)
      if (result.hasGoodMatch) {
        break
      }
    }
  }

  if (!result) {
    const unrestrictedMatches = collectMatchesFromWordIndices(
      data,
      wordIndices,
      kanjiChar,
      reading,
      readingType,
      criteria
    )
    result = buildLookupResult(reading, readingType, unrestrictedMatches)
  }

  // Cache result
  lookupCache.set(cacheKey, result)

  return result
}

/**
 * Get the best vocabulary example for a kanji reading
 * Returns null if no good match found
 */
export function getBestVocabularyMatch(
  lookupResult: VocabularyLookupResult
): VocabularyMatch | null {
  if (!lookupResult.hasGoodMatch || lookupResult.words.length === 0) {
    return null
  }

  // Return the top-ranked match
  return lookupResult.words[0]
}

/**
 * Clear the lookup cache
 * Useful if JMdict data is reloaded or for testing
 */
export function clearLookupCache(): void {
  lookupCache.clear()
  console.log('[VocabLookup] Lookup cache cleared')
}

/**
 * Get cache statistics for monitoring
 */
export function getLookupCacheStats(): { size: number; indexSize: number } {
  return {
    size: lookupCache.size,
    indexSize: kanjiIndex ? Object.keys(kanjiIndex).length : 0,
  }
}
