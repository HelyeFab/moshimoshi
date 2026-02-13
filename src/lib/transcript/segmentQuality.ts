/**
 * Deterministic segment quality scorer.
 *
 * Computes a 0–1 quality score for a set of transcript segments.
 * Higher scores indicate segments better suited for shadowing practice.
 *
 * Scoring dimensions (equal weight):
 *   1. Sentence-terminal ratio — % of segments ending with sentence punctuation or natural pause
 *   2. Duration distribution — % of segments in the ideal 2.5–8s range
 *   3. Text length distribution — % of segments in the 15–80 character range (Japanese-tuned)
 */

export interface QualityInput {
  text: string;
  start: number;
  end: number;
}

export interface SegmentQualityResult {
  /** Overall quality score (0–1) */
  score: number;
  /** Ratio of segments ending with sentence punctuation or followed by a natural pause (0–1) */
  sentenceTerminalRatio: number;
  /** Ratio of segments with duration in ideal range (0–1) */
  durationInRangeRatio: number;
  /** Ratio of segments with text length in ideal range (0–1) */
  textLengthInRangeRatio: number;
  /** Total segments evaluated */
  totalSegments: number;
}

const SENTENCE_END_REGEX = /[。！？!?]$/;

/** Gap (seconds) between segments that indicates a natural pause boundary */
const PAUSE_GAP_THRESHOLD = 0.5;

const DURATION_MIN = 2.5;
const DURATION_MAX = 8.0;

const TEXT_LENGTH_MIN = 15;
const TEXT_LENGTH_MAX = 80;

/**
 * Compute a deterministic quality score for transcript segments.
 * Returns a value between 0 and 1, where 1 means all segments
 * meet ideal shadowing practice criteria.
 */
export function computeSegmentQuality(segments: QualityInput[]): SegmentQualityResult {
  if (segments.length === 0) {
    return {
      score: 0,
      sentenceTerminalRatio: 0,
      durationInRangeRatio: 0,
      textLengthInRangeRatio: 0,
      totalSegments: 0,
    };
  }

  let sentenceTerminalCount = 0;
  let durationInRangeCount = 0;
  let textLengthInRangeCount = 0;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const text = seg.text.trim();
    const duration = seg.end - seg.start;

    // Sentence-terminal check: punctuation OR natural pause to next segment
    const hasPunctuation = SENTENCE_END_REGEX.test(text);
    const nextSeg = segments[i + 1];
    const hasNaturalPause = nextSeg != null && (nextSeg.start - seg.end) > PAUSE_GAP_THRESHOLD;
    if (hasPunctuation || hasNaturalPause) {
      sentenceTerminalCount++;
    }

    // Duration in ideal range
    if (duration >= DURATION_MIN && duration <= DURATION_MAX) {
      durationInRangeCount++;
    }

    // Text length in ideal range
    if (text.length >= TEXT_LENGTH_MIN && text.length <= TEXT_LENGTH_MAX) {
      textLengthInRangeCount++;
    }
  }

  const total = segments.length;
  const sentenceTerminalRatio = sentenceTerminalCount / total;
  const durationInRangeRatio = durationInRangeCount / total;
  const textLengthInRangeRatio = textLengthInRangeCount / total;

  // Equal-weight average of three dimensions
  const score = (sentenceTerminalRatio + durationInRangeRatio + textLengthInRangeRatio) / 3;

  return {
    score,
    sentenceTerminalRatio,
    durationInRangeRatio,
    textLengthInRangeRatio,
    totalSegments: total,
  };
}
