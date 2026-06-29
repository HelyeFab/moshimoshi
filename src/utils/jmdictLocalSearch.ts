import { JapaneseWord, WordType, JLPTLevel, DictionaryEntryDetail } from '@/types/vocabulary'
import { ValidationUtils } from '@/lib/review-engine/validation/validation-utils'
import { getJLPTLevel, isN5Word, isN4Word } from '@/data/jlpt-conjugatable-words'
import { deinflect, looksInflected } from '@/utils/japaneseDeinflector'
import * as fs from 'fs'
import * as path from 'path'

// Entry shapes come from the official jmdict-simplified schema package so the
// structure stays in sync with the data file we ship and any schema drift is
// caught at compile time. Aliased to the names used throughout this module.
import type {
  JMdictWord as JMDictWord,
  JMdictKanji as JMDictKanji,
  JMdictKana as JMDictKana,
  JMdictSense as JMDictSense,
  JMdictGloss as JMDictGloss,
} from '@scriptin/jmdict-simplified-types'

// Minimal container type (the loader also tolerates an empty fallback).
interface JMDictData {
  words: JMDictWord[]
}

let jmdictData: JMDictData | null = null
let loadPromise: Promise<void> | null = null

// Cache for conjugatable words
let conjugatableWordsCache: {
  all: JapaneseWord[] | null
  verbs: JapaneseWord[] | null
  adjectives: JapaneseWord[] | null
  lastUpdated: number
} = {
  all: null,
  verbs: null,
  adjectives: null,
  lastUpdated: 0
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache

// Load JMDict data - works both server-side and client-side
export async function loadJMdictData(): Promise<void> {
  if (jmdictData) return
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      // Detect if we're running server-side or client-side
      const isServer = typeof window === 'undefined'

      if (isServer) {
        // Server-side: use fs.readFile
        const filePath = path.join(process.cwd(), 'public', 'data', 'dictionary', 'jmdict-eng-common.json')
        const fileContent = fs.readFileSync(filePath, 'utf-8')
        const data = JSON.parse(fileContent)
        jmdictData = data
        console.log(`[Server] Loaded ${jmdictData?.words?.length ?? 0} JMDict entries from filesystem`)
      } else {
        // Client-side: use fetch
        const response = await fetch('/data/dictionary/jmdict-eng-common.json')
        const data = await response.json()
        jmdictData = data
        console.log(`[Client] Loaded ${jmdictData?.words?.length ?? 0} JMDict entries via fetch`)
      }
    } catch (error) {
      console.error('Failed to load JMDict:', error)
      jmdictData = { words: [] }
    }
  })()

  return loadPromise
}

/**
 * Get the loaded JMdict data.
 * Must call loadJMdictData() first to ensure data is loaded.
 * Returns null if data not loaded yet. (Used by kanjiVocabularyLookup.)
 */
export function getLoadedJMdictData(): JMDictData | null {
  return jmdictData
}

// ---------------------------------------------------------------------------
// Corpus frequency bands (id → band; 1 = most frequent ~500 words, ascending).
//
// This is the data-driven replacement for the old hardcoded COMMON_WORDS table.
// It is precomputed (scripts/build-jmdict-freq) from the upstream EDRDG JMdict
// priority data (nfXX frequency bands + the news1/ichi1/spec1/gai1 "(P)"
// markers) — the same dictionary, same licence — into a compact ~370 KB sidecar
// keyed by JMdict entry id. The common-only JMDict JSON we ship has these tags
// stripped, which is why the table existed in the first place.
// ---------------------------------------------------------------------------
let freqData: Record<string, number> | null = null
let freqPromise: Promise<void> | null = null

export async function loadFreqData(): Promise<void> {
  if (freqData) return
  if (freqPromise) return freqPromise

  freqPromise = (async () => {
    try {
      if (typeof window === 'undefined') {
        const filePath = path.join(process.cwd(), 'public', 'data', 'dictionary', 'jmdict-freq.json')
        freqData = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
      } else {
        const res = await fetch('/data/dictionary/jmdict-freq.json')
        freqData = await res.json()
      }
    } catch (error) {
      console.error('Failed to load JMDict frequency data:', error)
      freqData = {}
    }
  })()

  return freqPromise
}

/** Frequency band for an entry (lower = more common), or undefined if unranked. */
function getFreqBand(id: string): number | undefined {
  return freqData ? freqData[id] : undefined
}

// ---------------------------------------------------------------------------
// Inverted search index
//
// Building this once turns each query from an O(n) scan of every entry (with
// per-entry array flattening + regex) into a lookup that returns a small
// candidate set. The scorer then runs over only those candidates, so ranking
// is unchanged — we just avoid touching entries that can't possibly match.
// ---------------------------------------------------------------------------
interface SearchIndex {
  /** Every JP character appearing in kanji[0]/kana[0] → entry indices. */
  byJpChar: Map<string, number[]>
  /** Exact kanji[0]/kana[0] text → entry indices (deinflected + common forms). */
  jpExact: Map<string, number[]>
  /** Unique lowercased English gloss tokens (scanned for prefix/substring). */
  glossTokens: string[]
  /** English token → entry indices. */
  tokenToEntries: Map<string, number[]>
}

let searchIndex: SearchIndex | null = null

function pushTo(map: Map<string, number[]>, key: string, idx: number): void {
  const arr = map.get(key)
  if (arr) {
    if (arr[arr.length - 1] !== idx) arr.push(idx)
  } else {
    map.set(key, [idx])
  }
}

function getSearchIndex(): SearchIndex {
  if (searchIndex) return searchIndex

  const byJpChar = new Map<string, number[]>()
  const jpExact = new Map<string, number[]>()
  const tokenToEntries = new Map<string, number[]>()

  const words = jmdictData?.words || []
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    const kanjiText = word.kanji?.[0]?.text || ''
    const kanaText = word.kana?.[0]?.text || ''

    for (const text of [kanjiText, kanaText]) {
      if (!text) continue
      // Index every character so "term is a substring of text" is captured by
      // the first character of the term (a guaranteed superset).
      const chars = new Set(text)
      for (const c of chars) pushTo(byJpChar, c, i)
      pushTo(jpExact, text, i)
    }

    // Index all English gloss tokens across all senses.
    for (const sense of word.sense || []) {
      for (const gloss of sense.gloss || []) {
        if (gloss.lang && gloss.lang !== 'eng') continue
        const tokens = gloss.text.toLowerCase().split(/[^a-z0-9]+/)
        for (const tok of tokens) {
          if (tok) pushTo(tokenToEntries, tok, i)
        }
      }
    }
  }

  searchIndex = {
    byJpChar,
    jpExact,
    glossTokens: Array.from(tokenToEntries.keys()),
    tokenToEntries,
  }
  return searchIndex
}

const HAS_JP_CHAR = /[぀-ヿ一-龯]/
const HAS_LATIN = /[a-z0-9]/i

/**
 * Resolve the candidate entries for a query from the index. Guaranteed to be a
 * superset of everything the scorer would score > 0, so ranking is preserved.
 * Falls back to a full scan for multi-word English queries (which can match on
 * whole-gloss substrings the token index doesn't bound) and as a safety net.
 */
function collectCandidateWords(
  index: SearchIndex,
  q: {
    term: string
    lowerTerm: string
    isShortTerm: boolean
    deinflectSet: Set<string>
  }
): JMDictWord[] {
  const words = jmdictData?.words || []
  const { term, lowerTerm, isShortTerm, deinflectSet } = q

  // Multi-word / punctuated English queries: the scorer matches against whole
  // glosses (e.g. "get on"), which a single-token index can't bound. Full scan.
  const isMultiToken = HAS_LATIN.test(lowerTerm) && /[^a-z0-9]/.test(lowerTerm.trim())
  if (isMultiToken) return words

  const candidates = new Set<number>()

  // Japanese: "text contains term" ⊆ entries containing term's first char.
  if (HAS_JP_CHAR.test(term) && term.length > 0) {
    for (const idx of index.byJpChar.get(term[0]) || []) candidates.add(idx)
  }
  // Deinflected dictionary forms (exact JP writing).
  for (const form of deinflectSet) {
    for (const idx of index.jpExact.get(form) || []) candidates.add(idx)
  }

  // English: exact + word-start (short terms) / substring (longer terms) all
  // reduce to "some gloss token startsWith/includes the term".
  if (HAS_LATIN.test(lowerTerm)) {
    for (const tok of index.glossTokens) {
      const hit = isShortTerm ? tok.startsWith(lowerTerm) : tok.includes(lowerTerm)
      if (hit) {
        for (const idx of index.tokenToEntries.get(tok) || []) candidates.add(idx)
      }
    }
  }

  // Safety net: if the index produced nothing, fall back to a full scan so we
  // never silently return fewer results than the exhaustive scan would.
  if (candidates.size === 0) return words

  return Array.from(candidates, idx => words[idx])
}

// Priority tags indicating common usage - higher weight for more common tags
const PRIORITY_SCORES: Record<string, number> = {
  'news1': 500,
  'ichi1': 400,
  'spec1': 300,
  'gai1': 200,
  'news2': 150,
  'ichi2': 120,
  'spec2': 100,
  'gai2': 80,
  'nf01': 70, 'nf02': 65, 'nf03': 60, 'nf04': 55, 'nf05': 50,
  'nf06': 45, 'nf07': 40, 'nf08': 35, 'nf09': 30, 'nf10': 25
}

// Common parts of speech with scores
const POS_SCORES: Record<string, number> = {
  'noun': 50,
  'verb': 40,
  'adjective': 35,
  'adverb': 30,
  'expression': 25,
  'pronoun': 20,
  'conjunction': 15,
  'interjection': 10,
  'compound': -20, // Penalty for compounds
  'technical': -30, // Penalty for technical terms
  'obscure': -40 // Penalty for obscure terms
}

// Helper function to get priority score from tags
function getPriorityScore(tags: string[]): number {
  let maxScore = 0
  for (const tag of tags) {
    if (PRIORITY_SCORES[tag]) {
      maxScore = Math.max(maxScore, PRIORITY_SCORES[tag])
    }
  }
  return maxScore
}

// Helper function to get part of speech score
function getPosScore(pos: string[]): number {
  let score = 0
  for (const p of pos) {
    for (const [posType, posScore] of Object.entries(POS_SCORES)) {
      if (p.toLowerCase().includes(posType)) {
        score += posScore
      }
    }
  }
  return score
}

// Helper function to get word length score (prefer simpler words)
function getWordLengthScore(word: JMDictWord): number {
  const kanjiLength = word.kanji?.[0]?.text?.length || 0
  const kanaLength = word.kana?.[0]?.text?.length || 0

  if (kanjiLength <= 2 || kanaLength <= 3) {
    return 50 // Boost for very simple words
  } else if (kanjiLength <= 4 || kanaLength <= 5) {
    return 20 // Small boost for simple words
  } else if (kanjiLength >= 8 || kanaLength >= 10) {
    return -30 // Penalty for complex words
  }
  return 0
}

// Helper function to check if word is compound
function isCompoundWord(word: JMDictWord): boolean {
  const kanjiText = word.kanji?.[0]?.text || ''
  const senseText = word.sense?.[0]?.gloss?.map((g) => g.text).join(' ') || ''

  // Check for compound markers in the sense
  if (senseText.includes('compound') || senseText.includes('combination')) {
    return true
  }

  // Check for multiple distinct kanji (rough heuristic)
  // Most single-concept words have 1-3 kanji
  if (kanjiText.length > 4) {
    return true
  }

  return false
}

// Helper to determine word type from parts of speech
function determineWordType(pos: string[] | undefined): WordType {
  if (!pos || pos.length === 0) return 'other'

  const posStr = pos.join(' ').toLowerCase()

  // Check for verbs (any type)
  if (posStr.includes('v1') || posStr.includes('v5') || posStr.includes('ichidan') ||
      posStr.includes('godan') || posStr.includes('irregular') || posStr.includes('suru') ||
      posStr.includes('kuru') || posStr.includes('vs-i') || posStr.includes('vs-s') ||
      posStr.includes('vs') || posStr.includes('vk') || posStr.includes('verb')) {
    return 'verb'
  }

  // Check for i-adjectives
  if (posStr.includes('adj-i') || (posStr.includes('adj') && !posStr.includes('adj-na'))) {
    return 'i-adjective'
  }

  // Check for na-adjectives
  if (posStr.includes('adj-na')) {
    return 'na-adjective'
  }

  // Check for nouns
  if (posStr.includes('n')) {
    return 'noun'
  }

  return 'other'
}

// Convert JMDict entry to our word format
function convertJMDictToWord(entry: JMDictWord): JapaneseWord {
  const kanji = entry.kanji?.[0]?.text || ''
  const kana = entry.kana?.[0]?.text || ''

  // Get all English meanings
  const meanings: string[] = []
  if (entry.sense) {
    for (const sense of entry.sense) {
      if (sense.gloss) {
        for (const gloss of sense.gloss) {
          if (gloss.lang === 'eng' || !gloss.lang) {
            meanings.push(gloss.text)
          }
        }
      }
    }
  }

  // Get word type from first sense
  const wordType = determineWordType(entry.sense?.[0]?.partOfSpeech)

  // JLPT level: the common-only JMDict distribution carries no JLPT data, so
  // we can only assign a reliable level for conjugatable words via our curated
  // N5/N4 lists. Everything else is left undefined so the UI doesn't render a
  // misleading badge (previously every result was hardcoded to "N5").
  let jlpt: JLPTLevel | undefined
  const conjType =
    wordType === 'verb' ? 'verb'
    : wordType === 'i-adjective' ? 'i-adjective'
    : wordType === 'na-adjective' ? 'na-adjective'
    : null
  if (conjType) {
    const level = getJLPTLevel(kanji, kana, conjType)
    if (level === 'N5' || level === 'N4') jlpt = level
  }

  // Check if common
  const isCommon = entry.kanji?.[0]?.common || entry.kana?.[0]?.common || false

  // Get tags for priority scoring
  const tags = [
    ...(entry.kanji?.flatMap(k => k.tags || []) || []),
    ...(entry.kana?.flatMap(k => k.tags || []) || [])
  ]
  const partsOfSpeech = entry.sense?.flatMap(s => s.partOfSpeech || []) || []

  return {
    id: `jmdict-${entry.id}`,
    kanji: kanji,
    kana: kana,
    romaji: '', // Not provided by JMDict
    meaning: meanings.join(', '),
    type: wordType,
    jlpt, // Only set for known N5/N4 conjugatable words; otherwise undefined
    tags: tags,
    partsOfSpeech
  }
}

// Lazy id → array-index map for O(1) single-entry lookup.
let idIndex: Map<string, number> | null = null
function getIdIndex(): Map<string, number> {
  if (idIndex) return idIndex
  const m = new Map<string, number>()
  const words = jmdictData?.words || []
  for (let i = 0; i < words.length; i++) m.set(words[i].id, i)
  idIndex = m
  return m
}

/**
 * Fetch a single dictionary entry by id with its FULL structure preserved
 * (every sense kept separate, all variant kanji/kana writings, tags), for the
 * word-detail page. Accepts either "jmdict-1234567" or the bare "1234567".
 */
export async function getWordDetailById(rawId: string): Promise<DictionaryEntryDetail | null> {
  await loadJMdictData()
  await loadFreqData()
  if (!jmdictData) return null

  const id = String(rawId).replace(/^jmdict-/, '')
  const idx = getIdIndex().get(id)
  if (idx === undefined) return null
  const entry = jmdictData.words[idx]

  const kanji = (entry.kanji || [])
    .map(k => ({ text: k.text || '', common: !!k.common }))
    .filter(k => k.text)
  const kana = (entry.kana || [])
    .map(k => ({ text: k.text || '', common: !!k.common }))
    .filter(k => k.text)

  const senses = (entry.sense || [])
    .map(s => ({
      partsOfSpeech: (s.partOfSpeech || []) as string[],
      glosses: (s.gloss || [])
        .filter(g => g.lang === 'eng' || !g.lang)
        .map(g => g.text),
      field: s.field && s.field.length ? (s.field as string[]) : undefined,
      misc: s.misc && s.misc.length ? (s.misc as string[]) : undefined,
      info: s.info && s.info.length ? (s.info as string[]) : undefined,
    }))
    .filter(s => s.glosses.length > 0)

  const primaryKanji = kanji[0]?.text || ''
  const primaryKana = kana[0]?.text || ''
  const wordType = determineWordType(entry.sense?.[0]?.partOfSpeech)

  let jlpt: JLPTLevel | undefined
  const conjType =
    wordType === 'verb' ? 'verb'
    : wordType === 'i-adjective' ? 'i-adjective'
    : wordType === 'na-adjective' ? 'na-adjective'
    : null
  if (conjType) {
    const level = getJLPTLevel(primaryKanji, primaryKana, conjType)
    if (level === 'N5' || level === 'N4') jlpt = level
  }

  return {
    id: `jmdict-${entry.id}`,
    kanji,
    kana,
    senses,
    common: kanji.some(k => k.common) || kana.some(k => k.common),
    freqBand: getFreqBand(entry.id),
    primaryKanji,
    primaryKana,
    type: wordType,
    jlpt,
    partsOfSpeech: senses.flatMap(s => s.partsOfSpeech),
  }
}

// Search JMDict words
export async function searchJMdictWords(term: string, limit = 30): Promise<JapaneseWord[]> {
  await loadJMdictData()
  await loadFreqData()
  if (!jmdictData) return []

  const lowerTerm = term.toLowerCase().trim()
  const results: { word: JMDictWord; score: number }[] = []

  // For very short search terms, be more strict
  const isShortTerm = lowerTerm.length <= 3

  // Escape special regex characters
  const escapedTerm = lowerTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Precompile the English-gloss matchers ONCE per search instead of rebuilding
  // them inside the per-entry loop (previously ~22k recompiles per query).
  const wordBoundaryRegex = new RegExp(`\\b${escapedTerm}\\b`, 'i')
  const startsWordRegex = new RegExp(`\\b${escapedTerm}`, 'i')

  // Deinflect conjugated Japanese input (e.g. 乗った→乗る, 食べたい→食べる) so
  // searches for inflected forms recover their dictionary entry. For
  // non-inflected / non-Japanese input this is just [term], so behaviour for
  // ordinary searches is unchanged.
  const deinflectedForms = looksInflected(term) ? deinflect(term) : [term]
  const deinflectSet = new Set(deinflectedForms.filter(f => f !== term))

  // Gather candidate entries via the inverted index (superset-safe; far less
  // work than scanning all ~22.5k entries).
  const candidateWords = collectCandidateWords(getSearchIndex(), {
    term,
    lowerTerm,
    isShortTerm,
    deinflectSet,
  })

  for (const word of candidateWords) {
    let score = 0

    // Check kanji and kana matches
    const kanjiText = word.kanji?.[0]?.text || ''
    const kanaText = word.kana?.[0]?.text || ''

    // --- Japanese-text match -----------------------------------------------
    if (kanjiText === term || kanaText === term) {
      score += 1500
    } else if (deinflectSet.has(kanjiText) || deinflectSet.has(kanaText)) {
      // Dictionary form recovered from a conjugated query (e.g. 乗った→乗る).
      score += 1300
    } else if (kanjiText.includes(term) || kanaText.includes(term)) {
      score += 300
    }

    // --- English-gloss match (position-aware) ------------------------------
    // Find the BEST match across all senses, weighted by *position*: a match in
    // the primary sense/gloss is the word's main meaning (本→"book", 食べる→
    // "to eat", 猫→"cat …"), which is what users want; a match in a later sense
    // (頂く's humble "to eat") is incidental. Parenthetical qualifiers and the
    // English infinitive "to " are stripped so they don't block exact matches.
    let bestGlossScore = 0
    const senses = word.sense || []
    for (let si = 0; si < senses.length; si++) {
      const glosses = senses[si].gloss || []
      for (let gi = 0; gi < glosses.length; gi++) {
        const gloss = glosses[gi]
        if (gloss.lang && gloss.lang !== 'eng') continue

        const glossText = gloss.text.toLowerCase()
        // Strip parenthetical qualifiers inside-out so nested parens like
        // "dog (Canis (lupus) familiaris)" reduce all the way to "dog".
        let glossClean = glossText
        let prevClean
        do {
          prevClean = glossClean
          glossClean = glossClean.replace(/\([^()]*\)/g, '')
        } while (glossClean !== prevClean)
        glossClean = glossClean.replace(/\s+/g, ' ').trim()
        const normGloss = glossClean.replace(/^to\s+/, '')

        let base = 0
        let singleWordBonus = 0
        if (glossClean === lowerTerm || normGloss === lowerTerm) {
          base = 1000
          if (!normGloss.includes(' ') && !normGloss.includes(',')) singleWordBonus = 300
        } else {
          const parts = glossClean.split(/[,;\/]/).map(p => p.trim().replace(/^to\s+/, ''))
          if (parts[0] === lowerTerm) {
            // First listed meaning = the primary meaning; score it as strongly
            // as a standalone gloss so 家 ("house, residence, …") isn't beaten
            // by a loanword whose gloss is just "house".
            base = 1000
            if (!lowerTerm.includes(' ')) singleWordBonus = 300
          } else if (parts.includes(lowerTerm)) {
            base = 800
            if (!lowerTerm.includes(' ')) singleWordBonus = 150
          } else if (wordBoundaryRegex.test(glossText)) {
            base = 400
          } else if (glossText.includes(lowerTerm)) {
            if (isShortTerm && !startsWordRegex.test(glossText)) continue
            base = 30
          }
        }

        if (base > 0) {
          const sensePos = si === 0 ? 400 : si === 1 ? 150 : si === 2 ? 50 : 0
          const glossPos = gi === 0 ? 300 : gi <= 2 ? 100 : 0
          const total = base + singleWordBonus + sensePos + glossPos
          if (total > bestGlossScore) bestGlossScore = total
        }
      }
    }
    score += bestGlossScore

    // Add to results if we have any match
    if (score > 0) {
      const pos = word.sense?.flatMap((s) => s.partOfSpeech || []) || []

      // Part of speech score
      score += getPosScore(pos)

      // Word length score (prefer simpler words)
      score += getWordLengthScore(word)

      // Penalty for compound words (higher penalty for short search terms)
      if (isCompoundWord(word)) {
        score -= isShortTerm ? 400 : 200
      }

      // Frequency — the data-driven replacement for the old COMMON_WORDS table.
      // Uses JMdict's own corpus frequency bands as a TIEBREAKER among
      // similar-quality matches (本 beats 書籍, 猫 beats 山猫). Kept small enough
      // (≤160) that it never overrides a clearly better textual match.
      const band = getFreqBand(word.id)
      if (band) {
        score += Math.max(0, 160 - (band - 1) * 3)
      } else if (word.kanji?.[0]?.common || word.kana?.[0]?.common) {
        score += 40 // common but unranked
      }

      results.push({ word, score })
    }
  }

  // Sort by score and convert to our format
  results.sort((a, b) => b.score - a.score)

  return results
    .slice(0, limit)
    .map(r => convertJMDictToWord(r.word))
}

// Strict search for English gloss or romaji (exact matches only)
export async function searchJMdictWordsStrict(term: string, limit = 30): Promise<JapaneseWord[]> {
  await loadJMdictData()
  if (!jmdictData) return []

  const normalizedTerm = term.trim().toLowerCase()
  if (!normalizedTerm) return []

  const cleanRomaji = normalizedTerm.replace(/[\s\-]/g, '')
  const hiragana = ValidationUtils.romajiToHiragana(cleanRomaji)
  const katakana = ValidationUtils.romajiToKatakana(cleanRomaji)

  const results: { word: JMDictWord; score: number }[] = []

  for (const word of jmdictData.words) {
    let score = 0

    const kanjiEntries = word.kanji || []
    const kanaEntries = word.kana || []

    const kanaMatch = kanaEntries.some(k => k.text === hiragana || k.text === katakana)
    if (kanaMatch) {
      score += 1200
    }

    const kanjiMatch = kanjiEntries.some(k => k.text === term)
    if (kanjiMatch) {
      score += 1200
    }

    let glossMatch = false
    for (const sense of word.sense || []) {
      for (const gloss of sense.gloss || []) {
        if (gloss.lang === 'eng' || !gloss.lang) {
          const glossText = gloss.text.toLowerCase()
          if (glossText === normalizedTerm) {
            score += 1100
            glossMatch = true
            break
          }

          const parts = glossText.split(/[,;\/]/).map(p => p.trim())
          if (parts.includes(normalizedTerm)) {
            score += 900
            glossMatch = true
            break
          }
        }
      }
      if (glossMatch) break
    }

    if (score > 0) {
      const tags = [
        ...(word.kanji?.flatMap(k => k.tags || []) || []),
        ...(word.kana?.flatMap(k => k.tags || []) || [])
      ]

      score += getPriorityScore(tags)

      if (word.kanji?.[0]?.common || word.kana?.[0]?.common) {
        score += 100
      }

      results.push({ word, score })
    }
  }

  results.sort((a, b) => b.score - a.score)

  return results
    .slice(0, limit)
    .map(r => convertJMDictToWord(r.word))
}

// Get common JMDict words
export async function getCommonJMdictWords(limit = 100): Promise<JapaneseWord[]> {
  await loadJMdictData()
  if (!jmdictData) return []

  const commonWords = jmdictData.words
    .filter(word => word.kanji?.[0]?.common || word.kana?.[0]?.common)
    .slice(0, limit)
    .map(convertJMDictToWord)

  return commonWords
}

// Preload conjugatable words cache
export async function preloadConjugatableWords(): Promise<void> {
  await loadJMdictData()
  await loadFreqData()
  if (!jmdictData) return

  // Check if cache is still valid
  const now = Date.now()
  if (conjugatableWordsCache.lastUpdated && (now - conjugatableWordsCache.lastUpdated) < CACHE_DURATION) {
    return // Cache is still fresh
  }

  // Build cache for each type
  const allWords: { verbs: JapaneseWord[], adjectives: JapaneseWord[] } = {
    verbs: [],
    adjectives: []
  }

  // Process and score all conjugatable words
  for (const word of jmdictData.words) {
    const pos = word.sense?.[0]?.partOfSpeech || []
    const posStr = pos.join(' ').toLowerCase()

    const isVerb = posStr.includes('v1') || posStr.includes('v5') ||
                   posStr.includes('vs') || posStr.includes('vk') ||
                   posStr.includes('irregular')
    const isAdjective = posStr.includes('adj-i') || posStr.includes('adj-na')

    if (!isVerb && !isAdjective) continue

    // Calculate score
    let score = 0
    if (word.kanji?.[0]?.common || word.kana?.[0]?.common) {
      score += 1000
    }

    const tags = [
      ...(word.kanji?.flatMap(k => k.tags || []) || []),
      ...(word.kana?.flatMap(k => k.tags || []) || [])
    ]
    score += getPriorityScore(tags)

    const kanjiLength = word.kanji?.[0]?.text?.length || 0
    const kanaLength = word.kana?.[0]?.text?.length || 0
    if (kanjiLength <= 3 || kanaLength <= 4) {
      score += 200
    } else if (kanjiLength >= 6 || kanaLength >= 8) {
      score -= 100
    }

    // Frequency boost from JMdict corpus bands (replaces old COMMON_WORDS).
    const band = getFreqBand(word.id)
    if (band) score += Math.max(0, 500 - (band - 1) * 10)

    const converted = convertJMDictToWord(word)
    converted.partsOfSpeech = pos
    // Store the score in a custom property for sorting
    ;(converted as any).score = score

    if (isVerb) {
      allWords.verbs.push(converted)
    }
    if (isAdjective) {
      allWords.adjectives.push(converted)
    }
  }

  // Sort by score
  allWords.verbs.sort((a, b) => ((b as any).score || 0) - ((a as any).score || 0))
  allWords.adjectives.sort((a, b) => ((b as any).score || 0) - ((a as any).score || 0))

  // Update cache
  conjugatableWordsCache.verbs = allWords.verbs
  conjugatableWordsCache.adjectives = allWords.adjectives
  conjugatableWordsCache.all = [...allWords.verbs, ...allWords.adjectives]
    .sort((a, b) => ((b as any).score || 0) - ((a as any).score || 0))
  conjugatableWordsCache.lastUpdated = now
}

// Get random conjugatable words for practice
export async function getRandomConjugatableWords(
  type: 'all' | 'verbs' | 'adjectives' = 'all',
  limit = 20
): Promise<JapaneseWord[]> {
  // Ensure cache is loaded
  await preloadConjugatableWords()

  // Get from cache
  let pool: JapaneseWord[]
  if (type === 'verbs') {
    pool = conjugatableWordsCache.verbs || []
  } else if (type === 'adjectives') {
    pool = conjugatableWordsCache.adjectives || []
  } else {
    pool = conjugatableWordsCache.all || []
  }

  if (pool.length === 0) {
    return [] // No data available
  }

  // Take top words and randomly select from them
  const topWords = pool.slice(0, Math.min(limit * 3, pool.length))
  const selected: JapaneseWord[] = []
  const usedIds = new Set<string>()

  // Weighted random selection - prefer higher scored words
  while (selected.length < limit && topWords.length > 0) {
    // Use weighted random - earlier indices (higher scores) more likely
    const weightedIndex = Math.floor(Math.random() * Math.random() * topWords.length)
    const candidate = topWords[weightedIndex]

    if (!usedIds.has(candidate.id)) {
      selected.push(candidate)
      usedIds.add(candidate.id)
    }

    // Safety check to avoid infinite loop
    if (usedIds.size >= topWords.length) break
  }

  return selected
}

/**
 * IMPROVED: Get conjugatable words with JLPT awareness and better variety
 *
 * This replaces the biased selection in getRandomConjugatableWords with:
 * 1. JLPT-level classification
 * 2. Stratified sampling across difficulty tiers
 * 3. True random selection (no quadratic bias)
 * 4. Larger pool size (500 instead of 60)
 * 5. Support for excluding recently seen words
 */
export async function getConjugatableWordsPractice(options: {
  type: 'all' | 'verbs' | 'adjectives'
  jlptLevels?: ('N5' | 'N4' | 'N3+')[]
  limit?: number
  excludeRecent?: string[]
  difficultyMix?: {
    N5: number  // 0-1 proportion
    N4: number
    'N3+': number
  }
}): Promise<JapaneseWord[]> {
  const {
    type,
    jlptLevels = ['N5', 'N4'], // Default to N5+N4 as requested
    limit = 20,
    excludeRecent = [],
    difficultyMix = { N5: 0.6, N4: 0.4, 'N3+': 0 } // 60% N5, 40% N4 by default
  } = options

  // Load JMDict data (but DON'T use the biased cache!)
  await loadJMdictData()
  if (!jmdictData) return []

  // Build fresh pool directly from JMDict to avoid biased cache
  const pool: JapaneseWord[] = []

  for (const word of jmdictData.words) {
    const pos = word.sense?.[0]?.partOfSpeech || []
    const posStr = pos.join(' ').toLowerCase()

    const isVerb = posStr.includes('v1') || posStr.includes('v5') ||
                   posStr.includes('vs') || posStr.includes('vk') ||
                   posStr.includes('irregular')
    const isAdjective = posStr.includes('adj-i') || posStr.includes('adj-na')

    // Filter by type
    if (type === 'verbs' && !isVerb) continue
    if (type === 'adjectives' && !isAdjective) continue
    if (type !== 'all' && !isVerb && !isAdjective) continue

    // Convert to our format
    const kanji = word.kanji?.[0]?.text || ''
    const kana = word.kana?.[0]?.text || ''
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

    const converted: JapaneseWord = {
      id: `jmdict-${word.id}`,
      kanji: kanji,
      kana: kana,
      romaji: '',
      meaning: meanings.join(', '),
      type: isVerb ? 'verb' : (posStr.includes('adj-i') ? 'i-adjective' : 'na-adjective'),
      jlpt: 'N5' as any,
      tags: [],
      partsOfSpeech: pos
    }

    pool.push(converted)
  }

  if (pool.length === 0) {
    return []
  }

  // Step 1: Classify words by JLPT level and filter by requested levels
  interface ClassifiedWord extends JapaneseWord {
    jlptLevel: 'N5' | 'N4' | 'N3+'
    conjugationType: 'verb' | 'i-adjective' | 'na-adjective'
  }

  const classifiedWords: ClassifiedWord[] = pool.map(word => {
    const kanji = word.kanji || ''
    const kana = word.kana || ''

    // Determine conjugation type
    let conjugationType: 'verb' | 'i-adjective' | 'na-adjective' = 'verb'
    if (word.type === 'i-adjective') {
      conjugationType = 'i-adjective'
    } else if (word.type === 'na-adjective') {
      conjugationType = 'na-adjective'
    }

    // Get JLPT level using our curated lists
    const jlptLevel = getJLPTLevel(kanji, kana, conjugationType)

    return {
      ...word,
      jlptLevel,
      conjugationType
    }
  })

  // Filter by requested JLPT levels
  const filteredByLevel = classifiedWords.filter(w => jlptLevels.includes(w.jlptLevel))

  // Step 2: Exclude recently seen words
  const excludeSet = new Set(excludeRecent)
  const availableWords = filteredByLevel.filter(w => !excludeSet.has(w.id))

  if (availableWords.length === 0) {
    console.warn('No words available after filtering. Returning empty array.')
    return []
  }

  // Step 3: Separate into JLPT tiers
  const tiers: Record<'N5' | 'N4' | 'N3+', ClassifiedWord[]> = {
    'N5': [],
    'N4': [],
    'N3+': []
  }

  availableWords.forEach(word => {
    tiers[word.jlptLevel].push(word)
  })

  // Step 4: Stratified sampling - take from each tier based on difficultyMix
  const selected: JapaneseWord[] = []
  const targetCounts = {
    N5: Math.round(limit * difficultyMix.N5),
    N4: Math.round(limit * difficultyMix.N4),
    'N3+': Math.round(limit * difficultyMix['N3+'])
  }

  // Adjust if rounding caused total to not equal limit
  const totalTarget = targetCounts.N5 + targetCounts.N4 + targetCounts['N3+']
  if (totalTarget < limit) {
    // Add extras to most common tier
    if (jlptLevels.includes('N5') && tiers.N5.length > 0) {
      targetCounts.N5 += (limit - totalTarget)
    } else if (jlptLevels.includes('N4') && tiers.N4.length > 0) {
      targetCounts.N4 += (limit - totalTarget)
    } else {
      targetCounts['N3+'] += (limit - totalTarget)
    }
  }

  // Sample from each tier with TRUE random selection (no bias!)
  for (const level of ['N5', 'N4', 'N3+'] as const) {
    const tierWords = tiers[level]
    const targetCount = Math.min(targetCounts[level], tierWords.length)

    // Use LARGER POOL (500 words instead of 60) to increase variety
    const poolSize = Math.min(500, tierWords.length)
    const tierPool = tierWords.slice(0, poolSize)

    // TRUE RANDOM shuffle using Fisher-Yates
    const shuffled = [...tierPool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    // Take the first N after shuffle
    selected.push(...shuffled.slice(0, targetCount))
  }

  // Step 5: Final shuffle of selected words
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]]
  }

  return selected.slice(0, limit)
}

/**
 * Helper: Get recently used word IDs from localStorage
 */
export function getRecentlyUsedWords(storageKey: string = 'conjugation-recent-words'): string[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(storageKey)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to load recent words:', error)
    return []
  }
}

/**
 * Helper: Save recently used word IDs to localStorage
 */
export function saveRecentlyUsedWords(wordIds: string[], storageKey: string = 'conjugation-recent-words', maxHistory: number = 100): void {
  if (typeof window === 'undefined') return

  try {
    // Keep only the most recent N words
    const recentWords = wordIds.slice(-maxHistory)
    localStorage.setItem(storageKey, JSON.stringify(recentWords))
  } catch (error) {
    console.error('Failed to save recent words:', error)
  }
}
