/**
 * Stage C1 — Rebuild-owned transcript types.
 *
 * Four-layer architecture:
 * 1. RawTranscriptUnit — normalized provider output
 * 2. ReconstructedTextSegment — learner-facing text
 * 3. AlignedPracticeSegment — text + coarse timing
 * 4. PlayerSegment — final contract
 */

// ─── Layer 1: Raw Transcript Unit ───────────────────────────────────────────

/**
 * Normalized provider output.
 * Direct representation of what the provider returned, cleaned but not restructured.
 */
export interface RawTranscriptUnit {
  /** Unique ID for this raw unit */
  id: string
  /** Start time in seconds */
  start: number
  /** End time in seconds */
  end: number
  /** Duration in seconds */
  duration: number
  /** Raw text from provider (may be fragmented) */
  text: string
  /** Source provider name */
  source: string
}

// ─── Layer 2: Reconstructed Text Segment ────────────────────────────────────

/**
 * Learner-facing text unit.
 * Responsibilities:
 * - merge overlapping fragments
 * - repair broken fixed expressions
 * - preserve already-good lineation
 * - prefer complete sentence-like units
 * - remove obvious junk
 * - keep provenance to source rows
 */
export interface ReconstructedTextSegment {
  /** Unique ID for this reconstructed segment */
  id: string
  /** Reconstructed learner-facing text */
  text: string
  /** IDs of raw units that contributed to this segment */
  sourceIds: string[]
  /** Reconstruction strategy used: 'preserve' | 'merge' | 'repair' */
  strategy: 'preserve' | 'merge' | 'repair'
  /** Confidence score 0-1 (1 = high confidence) */
  confidence: number
}

// ─── Layer 3: Aligned Practice Segment ──────────────────────────────────────

/**
 * Text segment paired with playback timing.
 * Stage C1 uses coarse timing only (earliest start, latest end from source units).
 * Later Stage C iterations can refine alignment.
 */
export interface AlignedPracticeSegment {
  /** Unique ID (same as reconstructed segment) */
  id: string
  /** Reconstructed text */
  text: string
  /** Coarse start time (earliest contributing source start) */
  start: number
  /** Coarse end time (latest contributing source end) */
  end: number
  /** Duration in seconds */
  duration: number
  /** IDs of raw units that contributed timing */
  sourceIds: string[]
  /** Reconstruction strategy used */
  strategy: 'preserve' | 'merge' | 'repair'
  /** Confidence score 0-1 */
  confidence: number
}

// ─── Layer 4: Player Segment ────────────────────────────────────────────────

/**
 * Final contract that the player consumes.
 * The player must not interpret raw provider rows — only PlayerSegment.
 */
export interface PlayerSegment {
  /** Unique segment ID */
  id: string
  /** Display text */
  text: string
  /** Playback start time in seconds */
  start: number
  /** Playback end time in seconds */
  end: number
  /** Duration in seconds */
  duration: number
  /** Confidence score 0-1 (affects UI display) */
  confidence: number
  /** Provenance: IDs of raw units that contributed */
  provenanceIds: string[]
}

// ─── Route Response Contract ────────────────────────────────────────────────

/**
 * Stage C1 route response.
 * Must expose all computed layers for transparency and debugging.
 *
 * BACKWARD COMPATIBILITY: Includes `segments` field to maintain compatibility
 * with the Stage A page until C2 migration is complete.
 */
export interface TranscriptComputedLayers {
  /** Availability flag */
  available: true

  /** Video metadata */
  videoId: string
  title: string
  language: string
  availableLanguages: string[]
  source: string
  totalDuration: number
  totalSegments: number

  /** BACKWARD COMPATIBILITY: Raw provider segments (deprecated, use playerSegments) */
  segments: Array<{
    start: number
    end: number
    duration: number
    text: string
  }>

  /** Layer 1: Normalized raw transcript */
  rawTranscript: RawTranscriptUnit[]

  /** Layer 2: Reconstructed text segments */
  reconstructedSegments: ReconstructedTextSegment[]

  /** Layer 4: Final player segments (Layer 3 is internal) */
  playerSegments: PlayerSegment[]
}
