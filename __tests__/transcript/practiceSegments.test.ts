import {
  buildSourceSegments,
  buildComputedPracticeSegments,
  buildFinalPracticeSegments,
  type PipelineSegment,
  type PipelineMetadata,
} from '@/lib/transcript/practiceSegments'
import type { SourceTranscriptSegment } from '@/lib/transcript/practiceSegmentTypes'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const RAW_SEGMENTS: PipelineSegment[] = [
  { text: 'こんにちは。', start: 0, end: 3 },
  { text: '今日はとてもいい天気ですね。', start: 3.1, end: 7 },
  { text: '散歩に行きましょう。', start: 7.2, end: 10 },
]

const SHORT_SEGMENT: PipelineSegment = { text: 'うん', start: 10, end: 10.5 }

const LONG_SEGMENT: PipelineSegment = {
  text: 'これは非常に長い文章で、話者がずっと話し続けている状況を表しています。',
  start: 0,
  end: 15,
}

const META_AI: PipelineMetadata = {
  method: 'ai',
  source: 'railway-server',
  transcriptQualityScore: 0.72,
}

const META_DETERMINISTIC: PipelineMetadata = {
  method: 'deterministic',
  source: 'youtubei-enhanced',
}

// ---------------------------------------------------------------------------
// buildSourceSegments
// ---------------------------------------------------------------------------

describe('buildSourceSegments', () => {
  it('converts raw segments to SourceTranscriptSegment[] with correct ids', () => {
    const result = buildSourceSegments(RAW_SEGMENTS, 'railway-server')

    expect(result).toHaveLength(3)
    expect(result[0].id).toBe('src-0001')
    expect(result[1].id).toBe('src-0002')
    expect(result[2].id).toBe('src-0003')
  })

  it('preserves text and timing', () => {
    const result = buildSourceSegments(RAW_SEGMENTS, 'firebase-cache')

    expect(result[0].text).toBe('こんにちは。')
    expect(result[0].startTime).toBe(0)
    expect(result[0].endTime).toBe(3)
    expect(result[0].source).toBe('firebase-cache')
  })

  it('normalizes text with trimming', () => {
    const segs: PipelineSegment[] = [
      { text: '  こんにちは  ', start: 0, end: 2 },
    ]
    const result = buildSourceSegments(segs, 'supa-api')

    expect(result[0].normalizedText).toBe('こんにちは')
  })
})

// ---------------------------------------------------------------------------
// buildComputedPracticeSegments
// ---------------------------------------------------------------------------

describe('buildComputedPracticeSegments', () => {
  const sourceSegs = buildSourceSegments(RAW_SEGMENTS, 'railway-server')

  it('produces one computed segment per processed segment', () => {
    const result = buildComputedPracticeSegments(RAW_SEGMENTS, sourceSegs, META_AI)

    expect(result).toHaveLength(3)
    expect(result[0].id).toBe('cps-0001')
  })

  it('tags AI method as ai-resegment', () => {
    const result = buildComputedPracticeSegments(RAW_SEGMENTS, sourceSegs, META_AI)

    expect(result[0].boundaryMethod).toBe('ai-resegment')
    expect(result[0].timingMethod).toBe('proportional')
  })

  it('tags deterministic method as gap-based', () => {
    const result = buildComputedPracticeSegments(
      RAW_SEGMENTS,
      sourceSegs,
      META_DETERMINISTIC
    )

    expect(result[0].boundaryMethod).toBe('gap-based')
    expect(result[0].timingMethod).toBe('segment-inherited')
  })

  it('defaults to unknown contentKind and fallback-safe policy in Phase 1', () => {
    const result = buildComputedPracticeSegments(RAW_SEGMENTS, sourceSegs, META_AI)

    expect(result[0].contentKind).toBe('unknown')
    expect(result[0].segmentationPolicy).toBe('fallback-safe')
  })

  it('gives higher confidence to sentence-ending AI segments', () => {
    const result = buildComputedPracticeSegments(RAW_SEGMENTS, sourceSegs, META_AI)

    // First segment ends with 。 → should get +0.15 boost
    expect(result[0].boundaryConfidence).toBeGreaterThanOrEqual(0.7)
  })

  it('penalizes very short segments without sentence endings', () => {
    const shortSegs: PipelineSegment[] = [SHORT_SEGMENT]
    const shortSource = buildSourceSegments(shortSegs, 'railway-server')
    const result = buildComputedPracticeSegments(
      shortSegs,
      shortSource,
      META_DETERMINISTIC
    )

    // Short text, no sentence end, deterministic → low confidence
    expect(result[0].boundaryConfidence).toBeLessThan(0.5)
  })

  it('flags low-confidence boundaries', () => {
    const shortSegs: PipelineSegment[] = [SHORT_SEGMENT]
    const shortSource = buildSourceSegments(shortSegs, 'railway-server')
    const result = buildComputedPracticeSegments(
      shortSegs,
      shortSource,
      META_DETERMINISTIC
    )

    expect(result[0].flags).toContain('low-confidence-boundary')
    expect(result[0].flags).toContain('mid-clause-risk')
    expect(result[0].flags).toContain('fallback-generated')
  })

  it('flags segments with long gaps', () => {
    const longSegs: PipelineSegment[] = [LONG_SEGMENT]
    const longSource = buildSourceSegments(longSegs, 'railway-server')
    const result = buildComputedPracticeSegments(
      longSegs,
      longSource,
      META_DETERMINISTIC
    )

    expect(result[0].flags).toContain('contains-long-gap')
  })

  it('maps source segment ids via time-range overlap', () => {
    const result = buildComputedPracticeSegments(RAW_SEGMENTS, sourceSegs, META_AI)

    // First processed segment (0-3) overlaps source src-0001 (0-3) only
    expect(result[0].sourceSegmentIds).toEqual(['src-0001'])
    // Second (3.1-7) overlaps src-0002 (3.1-7) only
    expect(result[1].sourceSegmentIds).toEqual(['src-0002'])
    // Third (7.2-10) overlaps src-0003 (7.2-10) only
    expect(result[2].sourceSegmentIds).toEqual(['src-0003'])
  })

  it('maps multiple source segments when a computed segment spans them', () => {
    // A wide processed segment that spans all three source segments
    const wideSegs: PipelineSegment[] = [
      { text: 'こんにちは。今日はとてもいい天気ですね。散歩に行きましょう。', start: 0, end: 10 },
    ]
    const result = buildComputedPracticeSegments(wideSegs, sourceSegs, META_AI)

    expect(result[0].sourceSegmentIds).toEqual(['src-0001', 'src-0002', 'src-0003'])
  })

  it('returns empty sourceSegmentIds when no source segment overlaps', () => {
    // Processed segment outside all source time ranges
    const disjointSegs: PipelineSegment[] = [
      { text: 'なにか', start: 50, end: 55 },
    ]
    const result = buildComputedPracticeSegments(disjointSegs, sourceSegs, META_AI)

    expect(result[0].sourceSegmentIds).toEqual([])
  })

  it('attaches transcriptQualityScore from metadata', () => {
    const result = buildComputedPracticeSegments(RAW_SEGMENTS, sourceSegs, META_AI)

    expect(result[0].transcriptQualityScore).toBe(0.72)
  })
})

// ---------------------------------------------------------------------------
// buildFinalPracticeSegments
// ---------------------------------------------------------------------------

describe('buildFinalPracticeSegments', () => {
  const sourceSegs = buildSourceSegments(RAW_SEGMENTS, 'railway-server')
  const computed = buildComputedPracticeSegments(RAW_SEGMENTS, sourceSegs, META_AI)

  it('produces one final segment per computed segment', () => {
    const result = buildFinalPracticeSegments(computed)

    expect(result).toHaveLength(3)
    expect(result[0].id).toBe('fps-0001')
  })

  it('sets isUserEdited to false in Phase 1', () => {
    const result = buildFinalPracticeSegments(computed)

    result.forEach((seg) => {
      expect(seg.isUserEdited).toBe(false)
    })
  })

  it('references the computed segment id it came from', () => {
    const result = buildFinalPracticeSegments(computed)

    expect(result[0].computedSegmentIds).toEqual(['cps-0001'])
    expect(result[1].computedSegmentIds).toEqual(['cps-0002'])
  })

  it('carries through sourceSegmentIds from computed layer', () => {
    const result = buildFinalPracticeSegments(computed)

    expect(result[0].sourceSegmentIds).toEqual(computed[0].sourceSegmentIds)
  })

  it('preserves text, timing, and metadata', () => {
    const result = buildFinalPracticeSegments(computed)
    const first = result[0]

    expect(first.text).toBe('こんにちは。')
    expect(first.startTime).toBe(0)
    expect(first.endTime).toBe(3)
    expect(first.contentKind).toBe('unknown')
    expect(first.segmentationPolicy).toBe('fallback-safe')
    expect(first.boundaryConfidence).toBe(computed[0].boundaryConfidence)
    expect(first.timingMethod).toBe('proportional')
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles empty input', () => {
    const source = buildSourceSegments([], 'firebase-cache')
    expect(source).toHaveLength(0)

    const computed = buildComputedPracticeSegments([], source, META_AI)
    expect(computed).toHaveLength(0)

    const final = buildFinalPracticeSegments([])
    expect(final).toHaveLength(0)
  })

  it('handles single segment input', () => {
    const segs: PipelineSegment[] = [
      { text: 'はい。', start: 5, end: 6 },
    ]
    const source = buildSourceSegments(segs, 'youtubei-standard')
    const computed = buildComputedPracticeSegments(segs, source, META_DETERMINISTIC)
    const final = buildFinalPracticeSegments(computed)

    expect(final).toHaveLength(1)
    expect(final[0].isUserEdited).toBe(false)
    expect(final[0].text).toBe('はい。')
  })

  it('confidence is always in [0, 1]', () => {
    // Very ideal segment that stacks all bonuses
    const ideal: PipelineSegment[] = [
      { text: '今日の天気はとても良いですね。', start: 0, end: 5 },
    ]
    const source = buildSourceSegments(ideal, 'railway-server')
    const computed = buildComputedPracticeSegments(ideal, source, META_AI)

    expect(computed[0].boundaryConfidence).toBeLessThanOrEqual(1)
    expect(computed[0].boundaryConfidence).toBeGreaterThanOrEqual(0)
  })
})
