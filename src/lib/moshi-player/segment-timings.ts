/**
 * Stage C1 — Coarse segment timing.
 *
 * Compute playback timing from source units.
 * Stage C1 uses coarse timing only:
 * - start = earliest contributing source start
 * - end = latest contributing source end
 *
 * Later Stage C iterations can refine alignment.
 */

import type {
  RawTranscriptUnit,
  ReconstructedTextSegment,
  AlignedPracticeSegment,
} from './transcript-types'

/**
 * Assign coarse timing to reconstructed segments.
 * Timing is computed from the union of contributing source units.
 */
export function assignCoarseTiming(
  reconstructedSegments: ReconstructedTextSegment[],
  rawUnits: RawTranscriptUnit[],
): AlignedPracticeSegment[] {
  // Build a lookup map for raw units
  const rawUnitMap = new Map<string, RawTranscriptUnit>()
  for (const unit of rawUnits) {
    rawUnitMap.set(unit.id, unit)
  }

  return reconstructedSegments.map((segment) => {
    const { start, end } = computeCoarseTiming(segment.sourceIds, rawUnitMap)
    const duration = end - start

    return {
      id: segment.id,
      text: segment.text,
      start,
      end,
      duration,
      sourceIds: segment.sourceIds,
      strategy: segment.strategy,
      confidence: segment.confidence,
    }
  })
}

/**
 * Compute coarse timing from source unit IDs.
 * Returns earliest start and latest end.
 */
function computeCoarseTiming(
  sourceIds: string[],
  rawUnitMap: Map<string, RawTranscriptUnit>,
): { start: number; end: number } {
  if (sourceIds.length === 0) {
    return { start: 0, end: 0 }
  }

  let earliestStart = Infinity
  let latestEnd = -Infinity

  for (const id of sourceIds) {
    const unit = rawUnitMap.get(id)
    if (!unit) continue

    if (unit.start < earliestStart) {
      earliestStart = unit.start
    }
    if (unit.end > latestEnd) {
      latestEnd = unit.end
    }
  }

  // Fallback if no valid units found
  if (!isFinite(earliestStart) || !isFinite(latestEnd)) {
    return { start: 0, end: 0 }
  }

  return { start: earliestStart, end: latestEnd }
}
