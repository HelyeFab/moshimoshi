/**
 * Segment override helpers for Edit Mode MVP (Phase 3).
 *
 * Pure functions for merge, split, reset operations on transcript segments.
 * localStorage persistence keyed by videoId.
 *
 * Agent 03 — Edit Mode MVP
 */

// ---------------------------------------------------------------------------
// Types (compatible with page.tsx TranscriptSegment)
// ---------------------------------------------------------------------------

export interface EditableSegment {
  start: number;
  end: number;
  text: string;
  translation?: string;
  contentKind?: 'speech' | 'lyrics' | 'mixed' | 'unknown';
  segmentationPolicy?:
    | 'speech-utterance'
    | 'lyrics-lineation'
    | 'mixed-adaptive'
    | 'fallback-safe';
  boundaryConfidence?: number;
  isUserEdited?: boolean;
}

const OVERRIDES_KEY_PREFIX = 'moshiSegmentOverrides:';

// ---------------------------------------------------------------------------
// Merge
// ---------------------------------------------------------------------------

/**
 * Merge two adjacent segments into one.
 *
 * Timing: merged.start = first.start, merged.end = second.end.
 * Text: concatenated directly (Japanese text has no word spaces).
 * Translations: joined with a space if both exist.
 * Confidence: minimum of the two (conservative).
 */
export function mergeAdjacentSegments(
  segments: EditableSegment[],
  indexA: number,
  indexB: number,
): EditableSegment[] {
  if (indexB !== indexA + 1) {
    throw new Error('Can only merge adjacent segments');
  }
  if (indexA < 0 || indexB >= segments.length) {
    throw new Error('Segment index out of bounds');
  }

  const a = segments[indexA];
  const b = segments[indexB];

  const merged: EditableSegment = {
    start: a.start,
    end: b.end,
    text: a.text + b.text,
    translation:
      a.translation || b.translation
        ? [a.translation, b.translation].filter(Boolean).join(' ')
        : undefined,
    contentKind: a.contentKind,
    segmentationPolicy: a.segmentationPolicy,
    boundaryConfidence: Math.min(
      a.boundaryConfidence ?? 1,
      b.boundaryConfidence ?? 1,
    ),
    isUserEdited: true,
  };

  const result = [...segments];
  result.splice(indexA, 2, merged);
  return result;
}

// ---------------------------------------------------------------------------
// Split
// ---------------------------------------------------------------------------

/**
 * Split a segment at a character position.
 *
 * Timing: distributed proportionally by character count.
 * Text: sliced at charPosition.
 * Translation: kept on the first part only.
 */
export function splitSegmentAtPosition(
  segments: EditableSegment[],
  segmentIndex: number,
  charPosition: number,
): EditableSegment[] {
  if (segmentIndex < 0 || segmentIndex >= segments.length) {
    throw new Error('Segment index out of bounds');
  }

  const seg = segments[segmentIndex];
  const text = seg.text;

  if (charPosition <= 0 || charPosition >= text.length) {
    throw new Error('Split position must be within the text');
  }

  const textA = text.slice(0, charPosition);
  const textB = text.slice(charPosition);
  const ratio = charPosition / text.length;
  const duration = seg.end - seg.start;
  const splitTime = seg.start + duration * ratio;

  const segA: EditableSegment = {
    start: seg.start,
    end: splitTime,
    text: textA,
    translation: seg.translation,
    contentKind: seg.contentKind,
    segmentationPolicy: seg.segmentationPolicy,
    boundaryConfidence: seg.boundaryConfidence,
    isUserEdited: true,
  };

  const segB: EditableSegment = {
    start: splitTime,
    end: seg.end,
    text: textB,
    contentKind: seg.contentKind,
    segmentationPolicy: seg.segmentationPolicy,
    boundaryConfidence: seg.boundaryConfidence,
    isUserEdited: true,
  };

  const result = [...segments];
  result.splice(segmentIndex, 1, segA, segB);
  return result;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

/**
 * Save overridden segments for a video to localStorage.
 */
export function saveSegmentOverrides(
  videoId: string,
  segments: EditableSegment[],
): void {
  try {
    const key = OVERRIDES_KEY_PREFIX + videoId;
    localStorage.setItem(
      key,
      JSON.stringify({ videoId, segments, savedAt: Date.now() }),
    );
  } catch {
    console.warn('[SegmentOverrides] Failed to save overrides');
  }
}

/**
 * Load overridden segments for a video from localStorage.
 * Returns null if no overrides exist.
 */
export function loadSegmentOverrides(
  videoId: string,
): EditableSegment[] | null {
  try {
    const key = OVERRIDES_KEY_PREFIX + videoId;
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed?.segments) && parsed.segments.length > 0) {
      return parsed.segments;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Remove overrides for a video from localStorage.
 */
export function clearSegmentOverrides(videoId: string): void {
  try {
    localStorage.removeItem(OVERRIDES_KEY_PREFIX + videoId);
  } catch {
    // ignore
  }
}

/**
 * Check whether overrides exist for a video.
 */
export function hasSegmentOverrides(videoId: string): boolean {
  try {
    return localStorage.getItem(OVERRIDES_KEY_PREFIX + videoId) !== null;
  } catch {
    return false;
  }
}
