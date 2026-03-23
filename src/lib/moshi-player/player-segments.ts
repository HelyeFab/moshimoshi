/**
 * Stage C1 — Player segment builder.
 *
 * Build final PlayerSegment[] from aligned practice segments.
 * PlayerSegment is the only contract the player should consume.
 */

import type { AlignedPracticeSegment, PlayerSegment } from './transcript-types'

/**
 * Build final player segments from aligned practice segments.
 * This is a thin transformation layer — the real work is done earlier.
 */
export function buildPlayerSegments(
  alignedSegments: AlignedPracticeSegment[],
): PlayerSegment[] {
  return alignedSegments.map((segment) => ({
    id: segment.id,
    text: segment.text,
    start: segment.start,
    end: segment.end,
    duration: segment.duration,
    confidence: segment.confidence,
    provenanceIds: segment.sourceIds,
  }))
}
