/**
 * PracticeSegment builder module.
 *
 * Converts current transcript pipeline output into the three-layer
 * practice segment model without changing any upstream processing.
 *
 * Phase 1 scope:
 *   - wrap existing segments into ComputedPracticeSegment[]
 *   - promote computed segments to FinalPracticeSegment[] (no overrides yet)
 *   - tag each segment with boundaryMethod, timingMethod, boundaryConfidence
 *   - convert raw provider output to SourceTranscriptSegment[]
 */

import type {
  SourceTranscriptSegment,
  ComputedPracticeSegment,
  FinalPracticeSegment,
  BoundaryMethod,
  TimingMethod,
  ContentKind,
  SegmentationPolicy,
  SegmentFlag,
} from './practiceSegmentTypes'

// ---------------------------------------------------------------------------
// Input types (match the route's internal TranscriptSegment shape)
// ---------------------------------------------------------------------------

export interface PipelineSegment {
  text: string
  start: number
  end: number
  words?: string[]
  translation?: string
}

export interface PipelineMetadata {
  /** 'ai' | 'deterministic' — from AiPipelineResult.method */
  method: 'ai' | 'deterministic'
  /** Source provider that supplied the raw transcript */
  source:
    | 'firebase-cache'
    | 'railway-server'
    | 'sheldon-server'
    | 'youtubei-enhanced'
    | 'youtubei-standard'
    | 'supa-api'
  /** Overall quality score from computeSegmentQuality (0-1) */
  transcriptQualityScore?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SENTENCE_END_REGEX = /[。！？!?]$/

function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

function makeId(prefix: string, index: number): string {
  return `${prefix}-${String(index + 1).padStart(4, '0')}`
}

/**
 * Infer the boundary method that produced a segment based on pipeline metadata.
 *
 * Phase 1 keeps this simple:
 *   - AI pipeline accepted → 'ai-resegment'
 *   - deterministic pipeline → 'gap-based'
 */
function inferBoundaryMethod(meta: PipelineMetadata): BoundaryMethod {
  return meta.method === 'ai' ? 'ai-resegment' : 'gap-based'
}

/**
 * Infer timing method.
 *
 * The current pipeline always inherits or proportionally distributes
 * timing from source segments.  AI chunks go through
 * alignAiTextsToSourceTimeline which is character-proportional,
 * while deterministic chunks preserve inherited segment timing.
 */
function inferTimingMethod(meta: PipelineMetadata): TimingMethod {
  return meta.method === 'ai' ? 'proportional' : 'segment-inherited'
}

/**
 * Compute a boundary confidence score for a single segment.
 *
 * Heuristic (Phase 1):
 *   base       = 0.5  (deterministic) | 0.65 (ai-accepted)
 *   +0.15      if segment ends with sentence punctuation
 *   +0.10      if duration is in the ideal 2.5-8s shadowing range
 *   -0.10      if very short text (< 8 chars) without sentence ending
 *
 * Result clamped to [0, 1].
 */
function computeBoundaryConfidence(
  text: string,
  startTime: number,
  endTime: number,
  meta: PipelineMetadata
): number {
  const trimmed = text.trim()
  let score = meta.method === 'ai' ? 0.65 : 0.5

  if (SENTENCE_END_REGEX.test(trimmed)) {
    score += 0.15
  }

  const duration = endTime - startTime
  if (duration >= 2.5 && duration <= 8) {
    score += 0.10
  }

  if (trimmed.length < 8 && !SENTENCE_END_REGEX.test(trimmed)) {
    score -= 0.10
  }

  return Math.max(0, Math.min(1, score))
}

/**
 * Detect potential flags for a segment.
 */
function detectFlags(
  text: string,
  startTime: number,
  endTime: number,
  confidence: number,
  meta: PipelineMetadata
): SegmentFlag[] {
  const flags: SegmentFlag[] = []
  const trimmed = text.trim()
  const duration = endTime - startTime

  if (confidence < 0.5) {
    flags.push('low-confidence-boundary')
  }

  if (
    trimmed.length > 0 &&
    !SENTENCE_END_REGEX.test(trimmed) &&
    trimmed.length < 8
  ) {
    flags.push('mid-clause-risk')
  }

  if (duration > 10) {
    flags.push('contains-long-gap')
  }

  if (meta.method === 'deterministic') {
    flags.push('fallback-generated')
  }

  return flags
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert raw provider segments into SourceTranscriptSegment[].
 */
export function buildSourceSegments(
  rawSegments: PipelineSegment[],
  source: SourceTranscriptSegment['source']
): SourceTranscriptSegment[] {
  return rawSegments.map((seg, i) => ({
    id: makeId('src', i),
    text: seg.text,
    normalizedText: normalizeText(seg.text),
    startTime: seg.start,
    endTime: seg.end,
    source,
  }))
}

/**
 * Convert processed pipeline output into ComputedPracticeSegment[].
 *
 * Each processed segment is tagged with metadata describing how it was
 * produced.  sourceSegmentIds collects every source segment whose time
 * range overlaps the computed segment's span.  This gives downstream
 * consumers honest provenance even when the pipeline has merged or
 * resegmented the original source material.
 */
export function buildComputedPracticeSegments(
  processedSegments: PipelineSegment[],
  sourceSegments: SourceTranscriptSegment[],
  meta: PipelineMetadata
): ComputedPracticeSegment[] {
  const boundaryMethod = inferBoundaryMethod(meta)
  const timingMethod = inferTimingMethod(meta)
  // Phase 1: default to unknown — policy detection is Phase 4
  const contentKind: ContentKind = 'unknown'
  const segmentationPolicy: SegmentationPolicy = 'fallback-safe'

  return processedSegments.map((seg, i) => {
    const confidence = computeBoundaryConfidence(
      seg.text,
      seg.start,
      seg.end,
      meta
    )
    const flags = detectFlags(seg.text, seg.start, seg.end, confidence, meta)

    // Collect all source segments whose time range overlaps this
    // computed segment's span.  Two intervals overlap when neither
    // ends before the other starts.
    const sourceSegmentIds = sourceSegments
      .filter((s) => s.startTime < seg.end && s.endTime > seg.start)
      .map((s) => s.id)

    return {
      id: makeId('cps', i),
      text: seg.text,
      normalizedText: normalizeText(seg.text),
      startTime: seg.start,
      endTime: seg.end,
      sourceSegmentIds,
      contentKind,
      segmentationPolicy,
      boundaryMethod,
      boundaryConfidence: confidence,
      timingMethod,
      transcriptQualityScore: meta.transcriptQualityScore,
      flags: flags.length > 0 ? flags : undefined,
    }
  })
}

/**
 * Promote ComputedPracticeSegment[] to FinalPracticeSegment[].
 *
 * Phase 1: no user overrides exist, so this is a 1:1 copy with
 * `isUserEdited: false`.
 */
export function buildFinalPracticeSegments(
  computed: ComputedPracticeSegment[]
): FinalPracticeSegment[] {
  return computed.map((seg, i) => ({
    id: makeId('fps', i),
    text: seg.text,
    normalizedText: seg.normalizedText,
    startTime: seg.startTime,
    endTime: seg.endTime,
    computedSegmentIds: [seg.id],
    sourceSegmentIds: seg.sourceSegmentIds,
    contentKind: seg.contentKind,
    segmentationPolicy: seg.segmentationPolicy,
    boundaryConfidence: seg.boundaryConfidence,
    timingMethod: seg.timingMethod,
    isUserEdited: false,
  }))
}
