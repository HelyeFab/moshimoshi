/**
 * Stage C1 — Reconstruction heuristics.
 *
 * Determines whether to preserve or rebuild source lineation.
 * Core principles:
 * 1. Preserve already-good lineation
 * 2. Repair obvious broken fragments
 * 3. Merge overlapping or fragmented units
 */

import type { RawTranscriptUnit } from './transcript-types'

// ─── Text cleaning ──────────────────────────────────────────────────────────

/**
 * Clean contamination from transcript text.
 * Removes common junk patterns that providers may include.
 * Examples: "-do", ">>", "♪", leading dashes, etc.
 */
export function cleanContamination(text: string): string {
  let cleaned = text

  // Remove music scale notation prefixes ONLY when dash-prefixed
  // Example: "-do君の中にある" → "君の中にある"
  // Does NOT match normal English like "Do you prefer tea?"
  // Do this first before removing other dashes
  cleaned = cleaned.replace(/^-(do|re|mi|fa|sol|la|si)(?=[^a-z])/i, '')

  // Remove leading junk patterns (loop until no more matches to handle combinations)
  let prevCleaned = ''
  while (prevCleaned !== cleaned) {
    prevCleaned = cleaned
    cleaned = cleaned.replace(/^[-–—]+/, '') // Leading dashes
    cleaned = cleaned.replace(/^[>»]+\s*/, '') // Leading angle brackets
    cleaned = cleaned.replace(/^♪+\s*/, '') // Leading music notes
    cleaned = cleaned.replace(/^#+\s*/, '') // Leading hash symbols
  }

  // Remove encoding artifacts
  cleaned = cleaned.replace(/\u00a0/g, ' ') // Non-breaking space
  cleaned = cleaned.replace(/&nbsp;/g, ' ')

  return cleaned.trim()
}

// ─── Sentence boundary markers ──────────────────────────────────────────────

const SENTENCE_ENDERS = ['。', '！', '？', '…']
const SENTENCE_ENDERS_SET = new Set(SENTENCE_ENDERS)

/**
 * Check if text ends with a sentence boundary marker.
 */
export function endsWithSentenceBoundary(text: string): boolean {
  if (text.length === 0) return false
  const lastChar = text[text.length - 1]
  return SENTENCE_ENDERS_SET.has(lastChar)
}

/**
 * Check if text starts with a sentence boundary marker (continuation).
 */
export function startsWithSentenceBoundary(text: string): boolean {
  if (text.length === 0) return false
  const firstChar = text[0]
  return SENTENCE_ENDERS_SET.has(firstChar)
}

// ─── Fragment detection ─────────────────────────────────────────────────────

/**
 * Common verb conjugation patterns that should not be split.
 * Examples: ます、ません、ました、ませんでした、etc.
 */
const VERB_ENDINGS = [
  'ます',
  'ません',
  'ました',
  'ませんでした',
  'ございます',
  'ございません',
  'ございました',
  'ございませんでした',
]

/**
 * Check if text looks like an incomplete fragment that should be merged.
 * Heuristics:
 * - very short (< 5 chars)
 * - ends with a particle that typically continues
 * - ends with broken verb conjugations
 * - ends with incomplete te-form markers
 */
export function looksLikeIncompleteFragment(text: string): boolean {
  if (text.length === 0) return false

  // Already has sentence boundary — not incomplete
  if (endsWithSentenceBoundary(text)) return false

  // Very short fragments are suspicious
  if (text.length < 5) return true

  // Ends with a particle (these usually continue)
  const particles = ['は', 'が', 'を', 'に', 'で', 'と', 'も', 'から', 'まで', 'や', 'の']
  if (particles.some((p) => text.endsWith(p))) return true

  // Broken verb conjugations — specific incomplete patterns only
  // Be precise: only flag genuinely incomplete forms, not all hiragana endings
  const brokenVerbPatterns = [
    /ござい$/, // Incomplete "ございます" (おはようござい)
    /っ$/, // Small tsu alone = incomplete te-form (頑張っ, 話っ)
  ]
  if (brokenVerbPatterns.some((pattern) => pattern.test(text))) {
    return true
  }

  return false
}

/**
 * Check if the next unit looks like a continuation of the current unit.
 * Examples:
 * - current: "おはようござい", next: "ます。"
 * - current: "日本語の勉強頑張っ", next: "てください。"
 */
export function looksLikeContinuation(current: string, next: string): boolean {
  if (next.length === 0) return false

  // Next starts with sentence boundary — likely a continuation
  if (startsWithSentenceBoundary(next)) return true

  // Current is incomplete and next is a verb ending
  if (looksLikeIncompleteFragment(current)) {
    if (VERB_ENDINGS.some((ending) => next.startsWith(ending))) return true
    // Next is very short and looks like it completes the verb
    if (next.length < 10 && next.match(/^[ぁ-ん]/)) return true
  }

  return false
}

// ─── Lineation quality assessment ───────────────────────────────────────────

/**
 * Assess whether a raw transcript unit represents good lineation.
 * Good lineation:
 * - ends with sentence boundary
 * - reasonable length and complete structure
 * - doesn't look like an incomplete fragment
 */
export function isGoodLineation(unit: RawTranscriptUnit): boolean {
  const { text } = unit

  // Too short — likely fragmented
  if (text.length < 3) return false

  // Ends with sentence boundary — strong indicator of completeness
  if (endsWithSentenceBoundary(text)) return true

  // REMOVED: Length-based threshold (was causing false positives)
  // Old logic: if (text.length >= 15 && !looksLikeIncompleteFragment(text)) return true
  // Problem: Broken fragments like "おはようござい" (19 chars) were passing

  // Only pass if it's reasonably long AND truly complete
  // Require minimum length of 6 chars to support short expressions like "もしかしたら" (7 chars)
  // while still filtering very short fragments
  if (text.length >= 6 && !looksLikeIncompleteFragment(text)) {
    return true
  }

  return false
}

/**
 * Check if an array of raw units has consistently good lineation.
 * Checks both individual unit quality AND relationships between consecutive units.
 * If obvious continuation markers exist, lineation is considered broken.
 *
 * NOTE: This function is preserved for backward compatibility but is not used
 * in the main reconstruction pipeline. Local cluster-based evaluation is used instead.
 */
export function hasGoodLineation(units: RawTranscriptUnit[]): boolean {
  if (units.length === 0) return false

  // First, check for obvious broken continuations between consecutive units
  // Examples: "おはようござい" → "ます。黒猫ママです"
  for (let i = 0; i < units.length - 1; i++) {
    const current = units[i]
    const next = units[i + 1]

    if (looksLikeContinuation(current.text, next.text)) {
      // Found obvious fragmentation — lineation is bad
      return false
    }
  }

  // Then check individual unit quality
  const goodCount = units.filter(isGoodLineation).length
  const goodRatio = goodCount / units.length

  // Require 80%+ good units
  return goodRatio >= 0.8
}

// ─── Local cluster-based quality assessment (Stage C2.5) ────────────────────

/**
 * Quality signals for a local cluster of units.
 * Combines multiple heuristics for more robust evaluation.
 */
export interface ClusterQualitySignals {
  /** Does the cluster end with a sentence boundary? */
  hasProperEnding: boolean
  /** Does the cluster have obvious continuation breaks? */
  hasContinuationBreaks: boolean
  /** Average text length per unit */
  avgLength: number
  /** Ratio of units with good individual lineation */
  goodLineationRatio: number
  /** Does the cluster contain contamination? */
  hasContamination: boolean
  /** Number of units in cluster */
  clusterSize: number
}

/**
 * Score the quality of a local cluster of units.
 * Returns a score from 0 (very poor) to 1 (excellent).
 *
 * Multi-signal scoring combines:
 * - Text completeness (proper endings)
 * - Continuation likelihood (broken fragments)
 * - Individual unit quality
 * - Contamination presence
 * - Cluster size (smaller clusters more suspicious)
 */
export function scoreClusterQuality(units: RawTranscriptUnit[]): number {
  if (units.length === 0) return 0

  const signals = analyzeClusterSignals(units)
  let score = 0.5 // Start neutral

  // Proper ending is a strong positive signal
  if (signals.hasProperEnding) {
    score += 0.25
  } else {
    score -= 0.15
  }

  // Continuation breaks are a strong negative signal
  if (signals.hasContinuationBreaks) {
    score -= 0.3
  }

  // Good individual lineation ratio
  if (signals.goodLineationRatio >= 0.8) {
    score += 0.2
  } else if (signals.goodLineationRatio >= 0.5) {
    score += 0.1
  } else {
    score -= 0.1
  }

  // Average length consideration
  if (signals.avgLength >= 15) {
    score += 0.1
  } else if (signals.avgLength < 8) {
    score -= 0.1
  }

  // Contamination penalty
  if (signals.hasContamination) {
    score -= 0.05
  }

  // Very small clusters are suspicious (unless it's a single good unit)
  if (signals.clusterSize === 1 && signals.goodLineationRatio === 1) {
    score += 0.1
  } else if (signals.clusterSize <= 2 && signals.avgLength < 10) {
    score -= 0.1
  }

  // Clamp to [0, 1]
  return Math.max(0, Math.min(1, score))
}

/**
 * Analyze quality signals for a cluster of units.
 */
export function analyzeClusterSignals(units: RawTranscriptUnit[]): ClusterQualitySignals {
  if (units.length === 0) {
    return {
      hasProperEnding: false,
      hasContinuationBreaks: false,
      avgLength: 0,
      goodLineationRatio: 0,
      hasContamination: false,
      clusterSize: 0,
    }
  }

  // Check for proper ending
  const lastUnit = units[units.length - 1]
  const hasProperEnding = endsWithSentenceBoundary(lastUnit.text)

  // Check for continuation breaks
  let hasContinuationBreaks = false
  for (let i = 0; i < units.length - 1; i++) {
    if (looksLikeContinuation(units[i].text, units[i + 1].text)) {
      hasContinuationBreaks = true
      break
    }
  }

  // Calculate average length
  const totalLength = units.reduce((sum, u) => sum + u.text.length, 0)
  const avgLength = totalLength / units.length

  // Calculate good lineation ratio
  const goodCount = units.filter(isGoodLineation).length
  const goodLineationRatio = goodCount / units.length

  // Check for contamination (simple check for common junk patterns)
  const hasContamination = units.some((u) => {
    const text = u.text
    return /^[-–—]+/.test(text) || /^[>»]+/.test(text) || /^♪+/.test(text) || /^-?(do|re|mi|fa|sol|la|si)[^a-z]/i.test(text)
  })

  return {
    hasProperEnding,
    hasContinuationBreaks,
    avgLength,
    goodLineationRatio,
    hasContamination,
    clusterSize: units.length,
  }
}

/**
 * Determine if a local cluster should be preserved or rebuilt.
 * Returns true if the cluster quality is good enough to preserve.
 *
 * Stage C2.5: This enables local decision-making instead of global preserve/rebuild.
 */
export function shouldPreserveCluster(units: RawTranscriptUnit[]): boolean {
  const score = scoreClusterQuality(units)
  // Threshold: 0.6+ = preserve, below = rebuild
  return score >= 0.6
}

// ─── Overlap and duplication detection (Stage C2.5) ────────────────────────

/**
 * Calculate text overlap ratio between two strings.
 * Returns 0-1 where 1 = complete overlap.
 *
 * Checks multiple overlap patterns:
 * 1. Suffix-prefix overlap: end of text1 overlaps with start of text2
 * 2. Substring: text2 is contained within text1
 * 3. Prefix-substring: text2 is a prefix of text1
 *
 * Example: "今日も私と一緒に" and "一緒にたくさん話し" → overlap "一緒に"
 * Example: "私は韓国人の友達が欲しいです。" and "私は韓国人の" → text2 is substring
 */
export function calculateOverlapRatio(text1: string, text2: string): number {
  if (text1.length === 0 || text2.length === 0) return 0

  const minLen = Math.min(text1.length, text2.length)

  // Check if text2 is a substring of text1 (or vice versa)
  // This handles the Sheldon-style "duplicate full line + fragment" case
  if (text1.includes(text2)) {
    return text2.length / minLen
  }
  if (text2.includes(text1)) {
    return text1.length / minLen
  }

  let maxOverlap = 0

  // Check if end of text1 overlaps with start of text2
  for (let len = minLen; len >= 3; len--) {
    const suffix = text1.slice(-len)
    const prefix = text2.slice(0, len)
    if (suffix === prefix) {
      maxOverlap = len
      break
    }
  }

  // Return ratio relative to shorter text
  return maxOverlap / minLen
}

/**
 * Calculate text similarity ratio (simple character-based).
 * Returns 0-1 where 1 = identical text.
 *
 * Uses Jaccard similarity on character bigrams.
 */
export function calculateSimilarity(text1: string, text2: string): number {
  if (text1 === text2) return 1
  if (text1.length === 0 || text2.length === 0) return 0

  // Create character bigram sets
  const bigrams1 = new Set<string>()
  const bigrams2 = new Set<string>()

  for (let i = 0; i < text1.length - 1; i++) {
    bigrams1.add(text1.slice(i, i + 2))
  }
  for (let i = 0; i < text2.length - 1; i++) {
    bigrams2.add(text2.slice(i, i + 2))
  }

  // Calculate Jaccard similarity
  const intersection = new Set([...bigrams1].filter((x) => bigrams2.has(x)))
  const union = new Set([...bigrams1, ...bigrams2])

  return intersection.size / union.size
}

/**
 * Check if two units are duplicates or near-duplicates.
 * Duplicates should be merged to avoid showing the same content twice.
 */
export function areDuplicates(unit1: RawTranscriptUnit, unit2: RawTranscriptUnit): boolean {
  const similarity = calculateSimilarity(unit1.text, unit2.text)
  // High similarity (>= 80%) indicates duplication
  return similarity >= 0.8
}

/**
 * Check if two units have significant text overlap.
 * Overlapping units should be merged to avoid redundancy.
 */
export function hasSignificantOverlap(
  unit1: RawTranscriptUnit,
  unit2: RawTranscriptUnit,
): boolean {
  const overlapRatio = calculateOverlapRatio(unit1.text, unit2.text)
  // Overlap > 30% is significant
  return overlapRatio > 0.3
}

// ─── Merging strategy ───────────────────────────────────────────────────────

/**
 * Determine if two consecutive units should be merged.
 *
 * Stage C2.5: Extended to handle overlap and duplication patterns.
 */
export function shouldMergeUnits(
  current: RawTranscriptUnit,
  next: RawTranscriptUnit,
): boolean {
  // Current is incomplete and next is a continuation
  if (looksLikeContinuation(current.text, next.text)) return true

  // Stage C2.5: Detect duplicates (Sheldon-style repeated lines)
  if (areDuplicates(current, next)) return true

  // Stage C2.5: Detect overlapping text (Sheldon-style redundancy)
  if (hasSignificantOverlap(current, next)) return true

  // Both are very short AND at least one is incomplete — likely fragmented
  // Don't merge if both have proper sentence endings
  if (current.text.length < 10 && next.text.length < 10) {
    // Only merge if at least one looks incomplete
    if (
      looksLikeIncompleteFragment(current.text) ||
      looksLikeIncompleteFragment(next.text)
    ) {
      return true
    }
  }

  // Current doesn't end with boundary and looks incomplete
  if (
    !endsWithSentenceBoundary(current.text) &&
    looksLikeIncompleteFragment(current.text)
  ) {
    return true
  }

  return false
}
