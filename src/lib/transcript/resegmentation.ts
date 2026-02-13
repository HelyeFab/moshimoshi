/**
 * Transcript Resegmentation
 *
 * Provides deterministic and (future) AI-powered resegmentation of transcript
 * segments for repeat-friendly shadowing practice.
 *
 * The deterministic path uses existing mergeSegments + chunkSegments utilities.
 * The AI path is fully feature-flagged behind AI_RESEGMENTATION (default: off).
 */

import {
  mergeTranscriptSegments,
  shouldMergeTranscriptSegments,
  type MergeableTranscriptSegment,
} from './mergeSegments'
import { chunkTranscriptSegments, type BasicTranscriptSegment } from './chunkSegments'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResegmentedSegment {
  text: string
  start: number
  end: number
}

export interface ResegmentationResult {
  segments: ResegmentedSegment[]
  source: 'deterministic' | 'ai'
  pipelineVersion: string
  validationPassed: boolean
  validationErrors: string[]
}

export interface ResegmentationInput {
  segments: ResegmentedSegment[]
  videoDurationHint?: number
}

/** Current deterministic pipeline version – bump when merge/chunk logic changes */
export const PIPELINE_VERSION = '1.0.1'

const TINY_DUPLICATE_MAX_CHARS = 4
const TINY_DUPLICATE_MAX_DURATION = 1.2
const TINY_DUPLICATE_MAX_GAP = 0.2
const ORPHAN_PARTICLE_REGEX = /^(ね|よ|な|か|さ|ぞ|ぜ|わ|よね|ねえ|ねぇ)[。！？!?]?$/

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationOptions {
  /** Maximum allowed duration for a single segment (seconds). Default: 30 */
  maxSegmentDuration?: number
  /** Minimum allowed duration for a single segment (seconds). Default: 0.1 */
  minSegmentDuration?: number
  /** Max allowed gap between consecutive segments (seconds). Default: 5 */
  maxGap?: number
  /** Coverage ratio threshold – total segment duration / video duration. Default: 0.5 */
  minCoverageRatio?: number
  /** Known video duration for coverage check. If absent, coverage is skipped. */
  videoDuration?: number
}

const DEFAULT_VALIDATION: Required<Omit<ValidationOptions, 'videoDuration'>> = {
  maxSegmentDuration: 30,
  minSegmentDuration: 0.1,
  maxGap: 5,
  minCoverageRatio: 0.5,
}

/**
 * Validate resegmented output:
 * 1. Monotonic timestamps (start[i] <= start[i+1], start < end per segment)
 * 2. Duration sanity bounds
 * 3. Coverage sanity check (if videoDuration provided)
 */
export function validateResegmentedOutput(
  segments: ResegmentedSegment[],
  options?: ValidationOptions
): { valid: boolean; errors: string[] } {
  const opts = { ...DEFAULT_VALIDATION, ...options }
  const errors: string[] = []

  if (!segments || segments.length === 0) {
    return { valid: false, errors: ['Empty segments array'] }
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]

    // Non-negative timestamps
    if (seg.start < 0) {
      errors.push(`Segment ${i}: negative start (${seg.start})`)
    }
    if (seg.end < 0) {
      errors.push(`Segment ${i}: negative end (${seg.end})`)
    }

    // Strict start < end (zero-duration segments are invalid)
    if (seg.start >= seg.end) {
      errors.push(`Segment ${i}: start (${seg.start}) >= end (${seg.end})`)
    }

    // Duration bounds
    const duration = seg.end - seg.start
    if (duration > opts.maxSegmentDuration) {
      errors.push(`Segment ${i}: duration ${duration.toFixed(2)}s exceeds max ${opts.maxSegmentDuration}s`)
    }
    if (duration < opts.minSegmentDuration) {
      errors.push(`Segment ${i}: duration ${duration.toFixed(2)}s below min ${opts.minSegmentDuration}s`)
    }

    // Empty text
    if (!seg.text || seg.text.trim().length === 0) {
      errors.push(`Segment ${i}: empty text`)
    }

    // Monotonic ordering + overlap detection
    if (i > 0) {
      const prev = segments[i - 1]
      if (seg.start < prev.start) {
        errors.push(
          `Segment ${i}: start (${seg.start}) < previous start (${prev.start}) – not monotonic`
        )
      }

      // Reject overlap: current segment starts before previous segment ends
      if (seg.start < prev.end) {
        errors.push(
          `Segment ${i}: overlaps previous segment (start ${seg.start} < prev end ${prev.end})`
        )
      }

      // Check gap between consecutive segments
      const gap = seg.start - prev.end
      if (gap > opts.maxGap) {
        errors.push(
          `Segment ${i}: gap ${gap.toFixed(2)}s from previous segment exceeds max ${opts.maxGap}s`
        )
      }
    }
  }

  // Coverage sanity check
  if (opts.videoDuration && opts.videoDuration > 0) {
    const totalSegmentDuration = segments.reduce(
      (sum, seg) => sum + Math.max(seg.end - seg.start, 0),
      0
    )
    const coverageRatio = totalSegmentDuration / opts.videoDuration
    if (coverageRatio < opts.minCoverageRatio) {
      errors.push(
        `Coverage ratio ${(coverageRatio * 100).toFixed(1)}% below minimum ${(opts.minCoverageRatio * 100).toFixed(1)}%`
      )
    }
  }

  return { valid: errors.length === 0, errors }
}

// ---------------------------------------------------------------------------
// Deterministic Resegmentation
// ---------------------------------------------------------------------------

/**
 * Deterministic resegmentation using existing merge + chunk pipeline.
 * Always available regardless of feature flag state.
 */
export function resegmentDeterministic(
  input: ResegmentationInput
): ResegmentationResult {
  const { segments, videoDurationHint } = input

  if (!segments || segments.length === 0) {
    return {
      segments: [],
      source: 'deterministic',
      pipelineVersion: PIPELINE_VERSION,
      validationPassed: false,
      validationErrors: ['Empty input segments'],
    }
  }

  // Convert to MergeableTranscriptSegment format
  const mergeable: MergeableTranscriptSegment[] = segments.map(seg => ({
    start: seg.start,
    end: seg.end,
    text: seg.text,
  }))

  // Step 1: Merge short fragments if needed
  let processed: MergeableTranscriptSegment[]
  if (shouldMergeTranscriptSegments(mergeable)) {
    processed = mergeTranscriptSegments(mergeable)
  } else {
    processed = mergeable
  }

  // Step 2: Chunk long segments
  const chunked: BasicTranscriptSegment[] = chunkTranscriptSegments(
    processed.map(seg => ({ start: seg.start, end: seg.end, text: seg.text }))
  )

  // Step 3: Remove tiny carry-over duplicates between adjacent segments,
  // e.g. "...だね。" followed by "ね。", which are usually ASR overlap artifacts.
  const deduped = dedupeTinyAdjacentOverlap(chunked)

  // Convert back to ResegmentedSegment
  const result: ResegmentedSegment[] = deduped.map(seg => ({
    text: seg.text,
    start: seg.start,
    end: seg.end,
  }))

  // Validate output
  const validation = validateResegmentedOutput(result, {
    videoDuration: videoDurationHint,
  })

  return {
    segments: result,
    source: 'deterministic',
    pipelineVersion: PIPELINE_VERSION,
    validationPassed: validation.valid,
    validationErrors: validation.errors,
  }
}

function dedupeTinyAdjacentOverlap(
  segments: BasicTranscriptSegment[]
): BasicTranscriptSegment[] {
  if (segments.length < 2) return segments

  const result: BasicTranscriptSegment[] = []
  for (const current of segments) {
    const prev = result[result.length - 1]
    if (!prev) {
      result.push(current)
      continue
    }

    const currentText = current.text.trim()
    const prevText = prev.text.trim()
    const currentDuration = current.end - current.start
    const gap = current.start - prev.end
    const isOverlappingDuplicate = current.start < prev.end
    const isLikelyOrphanParticle = ORPHAN_PARTICLE_REGEX.test(currentText)

    const isTinyDuplicate =
      currentText.length > 0 &&
      currentText.length <= TINY_DUPLICATE_MAX_CHARS &&
      (
        (currentDuration <= TINY_DUPLICATE_MAX_DURATION && gap <= TINY_DUPLICATE_MAX_GAP) ||
        isOverlappingDuplicate ||
        isLikelyOrphanParticle
      ) &&
      prevText.endsWith(currentText)

    if (isTinyDuplicate) {
      continue
    }

    result.push(current)
  }

  return result
}
