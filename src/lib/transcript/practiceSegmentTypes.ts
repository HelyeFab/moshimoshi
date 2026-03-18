/**
 * PracticeSegment type definitions.
 *
 * Three-layer model:
 *   SourceTranscriptSegment  → raw/near-raw timed transcript from upstream
 *   ComputedPracticeSegment  → pipeline-generated learner-facing candidate
 *   FinalPracticeSegment     → what the player actually loops
 *
 * Phase 1: introduce the types and populate core metadata fields.
 * No user overrides, no policy detection, no acoustic refinement.
 */

// ---------------------------------------------------------------------------
// Source layer
// ---------------------------------------------------------------------------

export interface SourceTranscriptSegment {
  id: string
  text: string
  normalizedText: string
  startTime: number
  endTime: number
  source:
    | 'youtubei-standard'
    | 'youtubei-enhanced'
    | 'youtube-json3'
    | 'firebase-cache'
    | 'supa-api'
    | 'railway-server'
    | 'sheldon-server'
    | 'aligned'
}

// ---------------------------------------------------------------------------
// Computed layer
// ---------------------------------------------------------------------------

export type BoundaryMethod =
  | 'gap-based'
  | 'punctuation-restored'
  | 'morphology-informed'
  | 'wtpsplit'
  | 'ai-resegment'
  | 'text+vad'
  | 'text+alignment'

export type TimingMethod =
  | 'segment-inherited'
  | 'word-anchored'
  | 'proportional'
  | 'vad-refined'
  | 'acoustic-aligned'

export type ContentKind = 'speech' | 'lyrics' | 'mixed' | 'unknown'

export type SegmentationPolicy =
  | 'speech-utterance'
  | 'lyrics-lineation'
  | 'mixed-adaptive'
  | 'fallback-safe'

export type SegmentFlag =
  | 'low-confidence-boundary'
  | 'mid-clause-risk'
  | 'timing-refined'
  | 'contains-long-gap'
  | 'fallback-generated'

export interface ComputedPracticeSegment {
  id: string
  text: string
  normalizedText: string
  startTime: number
  endTime: number
  sourceSegmentIds: string[]
  contentKind: ContentKind
  segmentationPolicy: SegmentationPolicy
  boundaryMethod: BoundaryMethod
  boundaryConfidence: number
  timingMethod: TimingMethod
  /** Transcript-level quality score (0-1), not segment-specific. */
  transcriptQualityScore?: number
  flags?: SegmentFlag[]
}

// ---------------------------------------------------------------------------
// Final layer (what the player consumes)
// ---------------------------------------------------------------------------

export interface FinalPracticeSegment {
  id: string
  text: string
  normalizedText: string
  startTime: number
  endTime: number
  computedSegmentIds: string[]
  sourceSegmentIds: string[]
  contentKind: ContentKind
  segmentationPolicy: SegmentationPolicy
  boundaryConfidence: number
  timingMethod: TimingMethod
  isUserEdited: boolean
}
