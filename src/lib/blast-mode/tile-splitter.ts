/**
 * Tile Splitter for Blast Mode
 * Agent C - Distractor & Tile Logic
 *
 * Splits Japanese text into tiles for reassembly exercises
 * Priority: Morpheme > Kana Chunk > Kanji Order
 */

import type { BlastItem } from './types'

/**
 * Tile splitting strategy
 */
export type TileSplitStrategy = 'morpheme' | 'kana-chunk' | 'kanji-order' | 'character'

/**
 * Result of tile splitting with metadata
 */
export interface TileSplitResult {
  tiles: string[]
  strategy: TileSplitStrategy
  confidence: 'high' | 'medium' | 'low'
  metadata?: {
    originalText: string
    tokenCount: number
  }
}

/**
 * Common Japanese particles and auxiliary verbs
 */
const PARTICLES = ['は', 'が', 'を', 'に', 'へ', 'と', 'で', 'や', 'の', 'か', 'も', 'ね', 'よ']
const AUX_VERBS = ['です', 'ます', 'ました', 'でした', 'ません', 'ない']

/**
 * Verb endings (ichidan, godan patterns)
 */
const VERB_ENDINGS = [
  'る', 'う', 'く', 'ぐ', 'す', 'つ', 'ぬ', 'ぶ', 'む',
  'た', 'って', 'んで', 'いて', 'して'
]

/**
 * Check if character is kanji
 */
function isKanji(char: string): boolean {
  const code = char.charCodeAt(0)
  return (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
         (code >= 0x3400 && code <= 0x4DBF)    // CJK Extension A
}

/**
 * Check if character is hiragana
 */
function isHiragana(char: string): boolean {
  const code = char.charCodeAt(0)
  return code >= 0x3040 && code <= 0x309F
}

/**
 * Check if character is katakana
 */
function isKatakana(char: string): boolean {
  const code = char.charCodeAt(0)
  return code >= 0x30A0 && code <= 0x30FF
}

/**
 * Split by morpheme boundaries (heuristic)
 * Looks for kanji/kana boundaries, particles, verb conjugations
 */
export function splitByMorpheme(text: string, providedTokens?: string[]): TileSplitResult {
  // If tokens are provided by the item, use them (highest confidence)
  if (providedTokens && providedTokens.length > 0) {
    return {
      tiles: providedTokens,
      strategy: 'morpheme',
      confidence: 'high',
      metadata: {
        originalText: text,
        tokenCount: providedTokens.length
      }
    }
  }

  const tiles: string[] = []
  let currentTile = ''
  let lastType: 'kanji' | 'hiragana' | 'katakana' | null = null

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    let currentType: 'kanji' | 'hiragana' | 'katakana' | null = null

    if (isKanji(char)) currentType = 'kanji'
    else if (isHiragana(char)) currentType = 'hiragana'
    else if (isKatakana(char)) currentType = 'katakana'

    // Type boundary detected
    if (currentType && lastType && currentType !== lastType) {
      // Special case: keep kanji + okurigana together (e.g., 食べる)
      if (lastType === 'kanji' && currentType === 'hiragana') {
        // Look ahead: collect all hiragana after this point
        let lookAhead = ''
        for (let j = i; j < text.length && isHiragana(text[j]); j++) {
          lookAhead += text[j]
        }

        // Check if this hiragana sequence ends with a verb ending
        const hasVerbEnding = VERB_ENDINGS.some(ending => lookAhead.endsWith(ending))

        // Also check for i-adjectives (ending in い)
        const isAdjective = lookAhead.length >= 2 && lookAhead.endsWith('い')

        if (hasVerbEnding || isAdjective) {
          // Include all okurigana with the kanji
          currentTile += lookAhead
          i += lookAhead.length - 1 // Skip ahead (loop will increment)
          lastType = currentType
          continue
        }
      }

      // Push accumulated tile and start new one
      if (currentTile) {
        tiles.push(currentTile)
      }
      currentTile = char
    } else {
      currentTile += char
    }

    lastType = currentType
  }

  // Push final tile
  if (currentTile) {
    tiles.push(currentTile)
  }

  // Split out particles if they got merged
  const refinedTiles: string[] = []
  for (const tile of tiles) {
    let processed = false

    // Check if tile ends with a particle (but not if it's part of a verb conjugation)
    for (const particle of PARTICLES) {
      if (tile.endsWith(particle) && tile.length > particle.length) {
        // Don't split if this looks like a verb conjugation
        const endsWithVerbForm = VERB_ENDINGS.some(ending => tile.endsWith(ending))
        if (endsWithVerbForm) {
          // Keep together - it's likely a verb conjugation
          continue
        }

        refinedTiles.push(tile.slice(0, -particle.length))
        refinedTiles.push(particle)
        processed = true
        break
      }
    }

    if (!processed) {
      refinedTiles.push(tile)
    }
  }

  return {
    tiles: refinedTiles.filter(t => t.length > 0),
    strategy: 'morpheme',
    confidence: providedTokens ? 'high' : 'medium',
    metadata: {
      originalText: text,
      tokenCount: refinedTiles.length
    }
  }
}

/**
 * Split into 2-3 mora kana chunks
 * Fallback for kana-only text
 */
export function splitByKanaChunk(text: string): TileSplitResult {
  const tiles: string[] = []
  let currentChunk = ''
  let moraCount = 0
  const targetMora = 2 // Aim for 2-mora chunks

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    currentChunk += char

    // Don't count small kana as separate mora
    if (!/[ゃゅょャュョっッ]/.test(char)) {
      moraCount++
    }

    // Split at target mora count or at word boundaries
    if (moraCount >= targetMora || PARTICLES.includes(char)) {
      if (currentChunk) {
        tiles.push(currentChunk)
      }
      currentChunk = ''
      moraCount = 0
    }
  }

  // Push remaining
  if (currentChunk) {
    tiles.push(currentChunk)
  }

  return {
    tiles: tiles.filter(t => t.length > 0),
    strategy: 'kana-chunk',
    confidence: 'medium',
    metadata: {
      originalText: text,
      tokenCount: tiles.length
    }
  }
}

/**
 * Split by individual kanji characters
 * Fallback for kanji-only or mixed text
 */
export function splitByKanjiOrder(text: string): TileSplitResult {
  const tiles: string[] = []

  for (const char of text) {
    if (isKanji(char)) {
      tiles.push(char)
    } else {
      // Group consecutive non-kanji together
      if (tiles.length > 0 && !isKanji(tiles[tiles.length - 1])) {
        tiles[tiles.length - 1] += char
      } else {
        tiles.push(char)
      }
    }
  }

  return {
    tiles: tiles.filter(t => t.length > 0),
    strategy: 'kanji-order',
    confidence: 'low',
    metadata: {
      originalText: text,
      tokenCount: tiles.length
    }
  }
}

/**
 * Split into individual characters
 * Last resort fallback
 */
export function splitByCharacter(text: string): TileSplitResult {
  return {
    tiles: text.split('').filter(t => t.trim().length > 0),
    strategy: 'character',
    confidence: 'low',
    metadata: {
      originalText: text,
      tokenCount: text.length
    }
  }
}

/**
 * Main tile splitting function with automatic strategy selection
 * Implements priority: Morpheme > Kana Chunk > Kanji Order > Character
 */
export function splitIntoTiles(item: BlastItem): TileSplitResult {
  const text = item.kanji || item.kana || ''

  if (!text) {
    return {
      tiles: [],
      strategy: 'morpheme',
      confidence: 'low',
      metadata: { originalText: '', tokenCount: 0 }
    }
  }

  // Priority 1: Use provided tokens (morpheme split)
  if (item.tokens && item.tokens.length > 0) {
    return splitByMorpheme(text, item.tokens)
  }

  // Count character types
  const hasKanji = Array.from(text).some(isKanji)
  const hasHiragana = Array.from(text).some(isHiragana)
  const hasKatakana = Array.from(text).some(isKatakana)

  // Priority 2: Morpheme split for mixed kanji/kana
  if (hasKanji && (hasHiragana || hasKatakana)) {
    const result = splitByMorpheme(text)
    // If we got reasonable chunks (2-6 tiles), use it
    if (result.tiles.length >= 2 && result.tiles.length <= 6) {
      return result
    }
  }

  // Priority 3: Kana chunk split for kana-only
  if (!hasKanji && (hasHiragana || hasKatakana)) {
    const result = splitByKanaChunk(text)
    if (result.tiles.length >= 2) {
      return result
    }
  }

  // Priority 4: Kanji order for kanji-heavy text
  if (hasKanji) {
    const result = splitByKanjiOrder(text)
    if (result.tiles.length >= 2) {
      return result
    }
  }

  // Priority 5: Character split (fallback)
  return splitByCharacter(text)
}

/**
 * Shuffle tiles for the reassembly exercise
 * Ensures the shuffled order is different from the original
 */
export function shuffleTiles(tiles: string[]): string[] {
  if (tiles.length <= 1) return [...tiles]

  let shuffled = [...tiles]
  let attempts = 0
  const maxAttempts = 10

  do {
    shuffled = [...tiles].sort(() => Math.random() - 0.5)
    attempts++
  } while (
    attempts < maxAttempts &&
    shuffled.every((tile, i) => tile === tiles[i])
  )

  return shuffled
}

/**
 * Validate tile reassembly answer
 * Checks if the tiles are in the correct order
 */
export function validateTileAnswer(
  userTiles: string[],
  correctTiles: string[]
): boolean {
  if (userTiles.length !== correctTiles.length) return false

  return userTiles.every((tile, i) => tile === correctTiles[i])
}
