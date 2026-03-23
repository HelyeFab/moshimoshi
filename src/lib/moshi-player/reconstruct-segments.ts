/**
 * Stage C1/C2.5 — Segment reconstruction.
 *
 * Build ReconstructedTextSegment[] from RawTranscriptUnit[].
 * Responsibilities:
 * - preserve already-good lineation (locally)
 * - repair broken fragments
 * - merge overlapping units
 * - track provenance
 *
 * Stage C2.5: Uses local cluster-based evaluation instead of global preserve/rebuild.
 */

import type { RawTranscriptUnit, ReconstructedTextSegment } from './transcript-types'
import {
  shouldMergeUnits,
  endsWithSentenceBoundary,
  looksLikeIncompleteFragment,
  cleanContamination,
  shouldPreserveCluster,
} from './reconstruction-heuristics'

/**
 * Reconstruct learner-facing text segments from raw units.
 *
 * Stage C2.5 Strategy:
 * - Process units in local clusters
 * - Evaluate each cluster's quality independently
 * - Make preserve/rebuild decisions per cluster
 * - This allows mixed behavior: bad intro can rebuild while good later content preserves
 */
export function reconstructSegments(
  rawUnits: RawTranscriptUnit[],
): ReconstructedTextSegment[] {
  if (rawUnits.length === 0) return []

  // Stage C2.5: Use local cluster-based reconstruction
  return reconstructWithLocalClusters(rawUnits)
}

// ─── Stage C2.5: Local cluster-based reconstruction ────────────────────────

/**
 * Reconstruct segments using local cluster-based evaluation.
 *
 * Instead of making a global preserve/rebuild decision, this evaluates
 * quality locally and handles each region appropriately.
 *
 * Process:
 * 1. Group units into natural clusters (following merge signals)
 * 2. If cluster has multiple units (merge signals present), merge them
 * 3. If cluster has single unit, evaluate quality to preserve or rebuild
 *
 * Stage C2.5: If units were clustered together due to merge signals
 * (duplicates, overlap, continuations), they are ALWAYS merged in output.
 */
function reconstructWithLocalClusters(
  rawUnits: RawTranscriptUnit[],
): ReconstructedTextSegment[] {
  const reconstructed: ReconstructedTextSegment[] = []
  let segmentIndex = 0
  let i = 0

  while (i < rawUnits.length) {
    // Build a cluster by following merge signals
    const cluster = buildCluster(rawUnits, i)
    i += cluster.length

    if (cluster.length === 1) {
      // Single unit — evaluate quality locally
      const unit = cluster[0]
      if (shouldPreserveCluster(cluster)) {
        // Good single unit — preserve
        reconstructed.push({
          id: `recon-${segmentIndex++}`,
          text: cleanContamination(unit.text),
          sourceIds: [unit.id],
          strategy: 'preserve',
          confidence: 0.9,
        })
      } else {
        // Bad single unit — still output but mark with lower confidence
        reconstructed.push({
          id: `recon-${segmentIndex++}`,
          text: cleanContamination(unit.text),
          sourceIds: [unit.id],
          strategy: 'preserve',
          confidence: 0.7,
        })
      }
    } else {
      // Multiple units clustered together — ALWAYS merge
      // Merge signals (duplicates, overlap, continuations) were present
      const mergedText = mergeGroupText(cluster)
      const confidence = calculateConfidence(cluster, mergedText)

      reconstructed.push({
        id: `recon-${segmentIndex++}`,
        text: mergedText,
        sourceIds: cluster.map((u) => u.id),
        strategy: 'merge',
        confidence,
      })
    }
  }

  return reconstructed
}

/**
 * Build a cluster of units that should be evaluated together.
 * Groups units that have merge signals between them.
 */
function buildCluster(rawUnits: RawTranscriptUnit[], startIndex: number): RawTranscriptUnit[] {
  const cluster: RawTranscriptUnit[] = [rawUnits[startIndex]]
  let i = startIndex

  while (i < rawUnits.length - 1) {
    const current = rawUnits[i]
    const next = rawUnits[i + 1]

    if (shouldMergeUnits(current, next)) {
      cluster.push(next)
      i++
    } else {
      break
    }
  }

  return cluster
}

// ─── Preserve strategy (legacy) ─────────────────────────────────────────────

/**
 * Preserve source lineation 1:1 when it's already good.
 * Used for videos like 9LW9DpmhrPE.
 * Applies contamination cleaning even when preserving structure.
 *
 * NOTE: This is preserved for backward compatibility but not used in the
 * main reconstruction pipeline. Local cluster-based evaluation is used instead.
 */
function preserveLineation(
  rawUnits: RawTranscriptUnit[],
): ReconstructedTextSegment[] {
  return rawUnits.map((unit, index) => ({
    id: `recon-${index}`,
    text: cleanContamination(unit.text), // Clean junk prefixes
    sourceIds: [unit.id],
    strategy: 'preserve' as const,
    confidence: 0.95, // High confidence — source is already good
  }))
}

// ─── Rebuild strategy (legacy) ──────────────────────────────────────────────

/**
 * Rebuild segments by merging fragments and repairing breaks.
 * Used for videos like 45fMrqfNIXA where provider output is fragmented.
 *
 * NOTE: This is preserved for backward compatibility but not used in the
 * main reconstruction pipeline. Local cluster-based evaluation is used instead.
 */
function rebuildWithMerging(
  rawUnits: RawTranscriptUnit[],
): ReconstructedTextSegment[] {
  const reconstructed: ReconstructedTextSegment[] = []
  let currentGroup: RawTranscriptUnit[] = []
  let segmentIndex = 0

  for (let i = 0; i < rawUnits.length; i++) {
    const unit = rawUnits[i]
    const nextUnit = i < rawUnits.length - 1 ? rawUnits[i + 1] : null

    currentGroup.push(unit)

    // Decide whether to continue grouping or finalize this segment
    const shouldContinue = nextUnit && shouldMergeUnits(unit, nextUnit)

    if (!shouldContinue) {
      // Finalize current group
      const mergedText = mergeGroupText(currentGroup)
      const strategy = currentGroup.length === 1 ? 'preserve' : 'merge'
      const confidence = calculateConfidence(currentGroup, mergedText)

      reconstructed.push({
        id: `recon-${segmentIndex++}`,
        text: mergedText,
        sourceIds: currentGroup.map((u) => u.id),
        strategy,
        confidence,
      })

      currentGroup = []
    }
  }

  // Handle any remaining group
  if (currentGroup.length > 0) {
    const mergedText = mergeGroupText(currentGroup)
    const strategy = currentGroup.length === 1 ? 'preserve' : 'merge'
    const confidence = calculateConfidence(currentGroup, mergedText)

    reconstructed.push({
      id: `recon-${segmentIndex}`,
      text: mergedText,
      sourceIds: currentGroup.map((u) => u.id),
      strategy,
      confidence,
    })
  }

  return reconstructed
}

// ─── Text merging helpers ───────────────────────────────────────────────────

/**
 * Merge text from a group of raw units.
 * Handles proper joining logic:
 * - cleans contamination from each unit
 * - deduplicates identical text
 * - removes overlapping text
 * - handles substring relationships (fragments of earlier text)
 *
 * Stage C2.5: Smart merging to handle Sheldon-style duplicates and fragments.
 */
function mergeGroupText(group: RawTranscriptUnit[]): string {
  if (group.length === 0) return ''
  if (group.length === 1) return cleanContamination(group[0].text)

  let merged = cleanContamination(group[0].text)

  for (let i = 1; i < group.length; i++) {
    const nextText = cleanContamination(group[i].text)

    // Skip if next text is empty
    if (nextText.length === 0) continue

    // Check if next text is identical to merged (duplicate)
    if (merged === nextText) {
      // Duplicate - skip it completely
      continue
    }

    // Check if next text is already contained in merged (fragment)
    if (merged.includes(nextText)) {
      // Fragment already present - skip it
      continue
    }

    // Check if merged is contained in next text (next is more complete)
    if (nextText.includes(merged)) {
      // Replace merged with the more complete version
      merged = nextText
      continue
    }

    // Check for suffix-prefix overlap
    const overlap = findSuffixPrefixOverlap(merged, nextText)
    if (overlap.length >= 3) {
      // Remove overlap from next text and append
      merged += nextText.slice(overlap.length)
      continue
    }

    // No overlap or duplication - concatenate directly
    merged += nextText
  }

  return merged.trim()
}

/**
 * Find the longest suffix of text1 that matches a prefix of text2.
 * Returns the overlapping string (empty if no overlap).
 *
 * Example: "今日も一緒に" + "一緒にたくさん" → "一緒に"
 */
function findSuffixPrefixOverlap(text1: string, text2: string): string {
  const maxLen = Math.min(text1.length, text2.length)

  for (let len = maxLen; len >= 3; len--) {
    const suffix = text1.slice(-len)
    const prefix = text2.slice(0, len)
    if (suffix === prefix) {
      return suffix
    }
  }

  return ''
}

// ─── Confidence calculation ─────────────────────────────────────────────────

/**
 * Calculate confidence score for a reconstructed segment.
 * Factors:
 * - number of source units merged (1 = high confidence)
 * - whether result ends with sentence boundary
 * - whether result looks complete
 */
function calculateConfidence(
  sourceUnits: RawTranscriptUnit[],
  mergedText: string,
): number {
  let confidence = 0.8 // Base confidence

  // Single unit preserved — higher confidence
  if (sourceUnits.length === 1) {
    confidence = 0.9
  }

  // Ends with sentence boundary — boost confidence
  if (endsWithSentenceBoundary(mergedText)) {
    confidence += 0.05
  }

  // Still looks incomplete after merge — lower confidence
  if (looksLikeIncompleteFragment(mergedText)) {
    confidence -= 0.15
  }

  // Merged many units — slightly lower confidence
  if (sourceUnits.length > 3) {
    confidence -= 0.1
  }

  // Clamp to [0.5, 0.95]
  return Math.max(0.5, Math.min(0.95, confidence))
}
