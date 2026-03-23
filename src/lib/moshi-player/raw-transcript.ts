/**
 * Stage C1 — Raw transcript normalization.
 *
 * Converts provider output into rebuild-owned RawTranscriptUnit[].
 * No reconstruction logic here — just clean normalization.
 */

import type { RawSegment, TranscriptSuccess } from './transcript-providers'
import type { RawTranscriptUnit } from './transcript-types'

/**
 * Normalize provider segments into rebuild-owned raw transcript units.
 * Responsibilities:
 * - generate stable IDs
 * - clean whitespace
 * - preserve exact provider timing
 * - filter empty segments
 */
export function normalizeRawTranscript(
  providerResult: TranscriptSuccess,
): RawTranscriptUnit[] {
  const { segments, source } = providerResult

  return segments
    .map((seg, index): RawTranscriptUnit | null => {
      const text = seg.text.trim()
      if (text.length === 0) return null

      return {
        id: `raw-${index}`,
        start: seg.start,
        end: seg.end,
        duration: seg.duration,
        text,
        source,
      }
    })
    .filter((unit): unit is RawTranscriptUnit => unit !== null)
}
