/**
 * PracticeSegment Shape & Safety Tests
 *
 * Agent 04 — QA & Benchmarks
 *
 * These tests validate that the real builder output from practiceSegments.ts
 * conforms to the type contracts in practiceSegmentTypes.ts, and that the
 * universal playback safety invariants hold on actual builder output.
 *
 * Every assertion runs against real builder functions, not fabricated objects.
 */

import {
  buildSourceSegments,
  buildComputedPracticeSegments,
  buildFinalPracticeSegments,
  type PipelineSegment,
  type PipelineMetadata,
} from '../practiceSegments'
import type {
  ComputedPracticeSegment,
  FinalPracticeSegment,
  BoundaryMethod,
  TimingMethod,
  ContentKind,
  SegmentationPolicy,
  SegmentFlag,
} from '../practiceSegmentTypes'

// ---------------------------------------------------------------------------
// Valid enum sets (derived from the real exported types)
// ---------------------------------------------------------------------------

const VALID_CONTENT_KINDS: ContentKind[] = ['speech', 'lyrics', 'mixed', 'unknown']
const VALID_POLICIES: SegmentationPolicy[] = [
  'speech-utterance',
  'lyrics-lineation',
  'mixed-adaptive',
  'fallback-safe',
]
const VALID_BOUNDARY_METHODS: BoundaryMethod[] = [
  'gap-based',
  'punctuation-restored',
  'morphology-informed',
  'wtpsplit',
  'ai-resegment',
  'text+vad',
  'text+alignment',
]
const VALID_TIMING_METHODS: TimingMethod[] = [
  'segment-inherited',
  'word-anchored',
  'proportional',
  'vad-refined',
  'acoustic-aligned',
]
const VALID_FLAGS: SegmentFlag[] = [
  'low-confidence-boundary',
  'mid-clause-risk',
  'timing-refined',
  'contains-long-gap',
  'fallback-generated',
]

// ---------------------------------------------------------------------------
// Fixtures — real pipeline input
// ---------------------------------------------------------------------------

const NORMAL_SEGMENTS: PipelineSegment[] = [
  { text: 'こんにちは。', start: 0, end: 3 },
  { text: '今日はとてもいい天気ですね。', start: 3.1, end: 7 },
  { text: '散歩に行きましょう。', start: 7.2, end: 10 },
]

const FRAGMENTED_SEGMENTS: PipelineSegment[] = [
  { text: 'あ', start: 0, end: 0.5 },
  { text: 'い', start: 0.5, end: 1 },
  { text: 'う', start: 1, end: 1.5 },
  { text: 'え', start: 1.5, end: 2 },
  { text: 'お', start: 2, end: 2.5 },
  { text: 'テスト文です', start: 2.5, end: 5 },
]

const LONG_SEGMENT: PipelineSegment[] = [
  {
    text: '今日はとてもいい天気ですね。散歩に行きたいと思います。公園で友達に会えたらいいですね。',
    start: 0,
    end: 15,
  },
]

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
// Playback safety validators (applied to real builder output)
// ---------------------------------------------------------------------------

function validatePlaybackSafety(
  segments: Array<{ startTime: number; endTime: number }>
): string[] {
  const errors: string[] = []
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]
    if (seg.startTime < 0) errors.push(`Segment ${i}: negative startTime`)
    if (seg.endTime < 0) errors.push(`Segment ${i}: negative endTime`)
    if (seg.startTime >= seg.endTime) errors.push(`Segment ${i}: startTime >= endTime`)

    if (i > 0) {
      const prev = segments[i - 1]
      if (seg.startTime < prev.startTime) errors.push(`Segment ${i}: non-monotonic`)
      if (seg.startTime < prev.endTime) errors.push(`Segment ${i}: overlaps previous`)
    }
  }
  return errors
}

// ---------------------------------------------------------------------------
// Helper: run full pipeline from raw segments
// ---------------------------------------------------------------------------

function runFullPipeline(
  raw: PipelineSegment[],
  meta: PipelineMetadata
): {
  computed: ComputedPracticeSegment[]
  final: FinalPracticeSegment[]
} {
  const source = buildSourceSegments(raw, meta.source)
  const computed = buildComputedPracticeSegments(raw, source, meta)
  const final = buildFinalPracticeSegments(computed)
  return { computed, final }
}

// ---------------------------------------------------------------------------
// Tests: ComputedPracticeSegment shape from real builder
// ---------------------------------------------------------------------------

describe('ComputedPracticeSegment shape (real builder output)', () => {
  it('should have all required fields on every segment', () => {
    const { computed } = runFullPipeline(NORMAL_SEGMENTS, META_AI)

    for (const seg of computed) {
      expect(typeof seg.id).toBe('string')
      expect(seg.id.length).toBeGreaterThan(0)
      expect(typeof seg.text).toBe('string')
      expect(typeof seg.normalizedText).toBe('string')
      expect(typeof seg.startTime).toBe('number')
      expect(typeof seg.endTime).toBe('number')
      expect(Array.isArray(seg.sourceSegmentIds)).toBe(true)
      expect(typeof seg.contentKind).toBe('string')
      expect(typeof seg.segmentationPolicy).toBe('string')
      expect(typeof seg.boundaryMethod).toBe('string')
      expect(typeof seg.boundaryConfidence).toBe('number')
      expect(typeof seg.timingMethod).toBe('string')
    }
  })

  it('should produce valid contentKind values', () => {
    const { computed } = runFullPipeline(NORMAL_SEGMENTS, META_AI)
    for (const seg of computed) {
      expect(VALID_CONTENT_KINDS).toContain(seg.contentKind)
    }
  })

  it('should produce valid segmentationPolicy values', () => {
    const { computed } = runFullPipeline(NORMAL_SEGMENTS, META_DETERMINISTIC)
    for (const seg of computed) {
      expect(VALID_POLICIES).toContain(seg.segmentationPolicy)
    }
  })

  it('should produce valid boundaryMethod values', () => {
    const { computed: aiComputed } = runFullPipeline(NORMAL_SEGMENTS, META_AI)
    const { computed: detComputed } = runFullPipeline(NORMAL_SEGMENTS, META_DETERMINISTIC)

    for (const seg of [...aiComputed, ...detComputed]) {
      expect(VALID_BOUNDARY_METHODS).toContain(seg.boundaryMethod)
    }
  })

  it('should produce valid timingMethod values', () => {
    const { computed: aiComputed } = runFullPipeline(NORMAL_SEGMENTS, META_AI)
    const { computed: detComputed } = runFullPipeline(NORMAL_SEGMENTS, META_DETERMINISTIC)

    for (const seg of [...aiComputed, ...detComputed]) {
      expect(VALID_TIMING_METHODS).toContain(seg.timingMethod)
    }
  })

  it('should produce boundaryConfidence in [0, 1]', () => {
    const allInputs = [NORMAL_SEGMENTS, FRAGMENTED_SEGMENTS, LONG_SEGMENT]
    const allMeta = [META_AI, META_DETERMINISTIC]

    for (const segs of allInputs) {
      for (const meta of allMeta) {
        const { computed } = runFullPipeline(segs, meta)
        for (const seg of computed) {
          expect(seg.boundaryConfidence).toBeGreaterThanOrEqual(0)
          expect(seg.boundaryConfidence).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('should produce valid flags when present', () => {
    const { computed } = runFullPipeline(FRAGMENTED_SEGMENTS, META_DETERMINISTIC)
    for (const seg of computed) {
      if (seg.flags) {
        for (const flag of seg.flags) {
          expect(VALID_FLAGS).toContain(flag)
        }
      }
    }
  })

  it('should map sourceSegmentIds by time-range overlap', () => {
    const source = buildSourceSegments(NORMAL_SEGMENTS, 'railway-server')
    const computed = buildComputedPracticeSegments(NORMAL_SEGMENTS, source, META_AI)

    // Each segment should trace back to at least one source
    for (const seg of computed) {
      expect(seg.sourceSegmentIds.length).toBeGreaterThan(0)
      // Every referenced ID should exist in source
      for (const srcId of seg.sourceSegmentIds) {
        expect(source.some(s => s.id === srcId)).toBe(true)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: FinalPracticeSegment shape from real builder
// ---------------------------------------------------------------------------

describe('FinalPracticeSegment shape (real builder output)', () => {
  it('should have all required fields on every segment', () => {
    const { final } = runFullPipeline(NORMAL_SEGMENTS, META_AI)

    for (const seg of final) {
      expect(typeof seg.id).toBe('string')
      expect(seg.id.length).toBeGreaterThan(0)
      expect(typeof seg.text).toBe('string')
      expect(typeof seg.normalizedText).toBe('string')
      expect(typeof seg.startTime).toBe('number')
      expect(typeof seg.endTime).toBe('number')
      expect(Array.isArray(seg.computedSegmentIds)).toBe(true)
      expect(Array.isArray(seg.sourceSegmentIds)).toBe(true)
      expect(typeof seg.contentKind).toBe('string')
      expect(typeof seg.segmentationPolicy).toBe('string')
      expect(typeof seg.boundaryConfidence).toBe('number')
      expect(typeof seg.timingMethod).toBe('string')
      expect(typeof seg.isUserEdited).toBe('boolean')
    }
  })

  it('should set isUserEdited to false in Phase 1 (no overrides)', () => {
    const { final } = runFullPipeline(NORMAL_SEGMENTS, META_AI)
    for (const seg of final) {
      expect(seg.isUserEdited).toBe(false)
    }
  })

  it('should trace back to computed segment IDs that exist', () => {
    const { computed, final } = runFullPipeline(NORMAL_SEGMENTS, META_AI)
    const computedIds = new Set(computed.map(c => c.id))

    for (const seg of final) {
      expect(seg.computedSegmentIds.length).toBeGreaterThan(0)
      for (const cid of seg.computedSegmentIds) {
        expect(computedIds.has(cid)).toBe(true)
      }
    }
  })

  it('should produce 1:1 mapping in Phase 1 (no merges/splits)', () => {
    const { computed, final } = runFullPipeline(NORMAL_SEGMENTS, META_AI)
    expect(final).toHaveLength(computed.length)
  })

  it('should carry through sourceSegmentIds from computed layer', () => {
    const { computed, final } = runFullPipeline(NORMAL_SEGMENTS, META_AI)
    for (let i = 0; i < final.length; i++) {
      expect(final[i].sourceSegmentIds).toEqual(computed[i].sourceSegmentIds)
    }
  })

  it('should not have sourceWordIds (not in Phase 1 types)', () => {
    const { final } = runFullPipeline(NORMAL_SEGMENTS, META_AI)
    for (const seg of final) {
      expect(seg).not.toHaveProperty('sourceWordIds')
    }
  })

  it('should not have editHistory (not in Phase 1 types)', () => {
    const { final } = runFullPipeline(NORMAL_SEGMENTS, META_AI)
    for (const seg of final) {
      expect(seg).not.toHaveProperty('editHistory')
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: Universal playback safety on real builder output
// ---------------------------------------------------------------------------

describe('Universal playback safety (real builder output)', () => {
  const allInputs: Array<{ name: string; segments: PipelineSegment[] }> = [
    { name: 'normal', segments: NORMAL_SEGMENTS },
    { name: 'fragmented', segments: FRAGMENTED_SEGMENTS },
    { name: 'long', segments: LONG_SEGMENT },
  ]

  for (const { name, segments } of allInputs) {
    describe(`on ${name} input`, () => {
      it('should produce playback-safe computed segments (AI)', () => {
        const { computed } = runFullPipeline(segments, META_AI)
        const errors = validatePlaybackSafety(computed)
        expect(errors).toHaveLength(0)
      })

      it('should produce playback-safe computed segments (deterministic)', () => {
        const { computed } = runFullPipeline(segments, META_DETERMINISTIC)
        const errors = validatePlaybackSafety(computed)
        expect(errors).toHaveLength(0)
      })

      it('should produce playback-safe final segments (AI)', () => {
        const { final } = runFullPipeline(segments, META_AI)
        const errors = validatePlaybackSafety(final)
        expect(errors).toHaveLength(0)
      })

      it('should produce playback-safe final segments (deterministic)', () => {
        const { final } = runFullPipeline(segments, META_DETERMINISTIC)
        const errors = validatePlaybackSafety(final)
        expect(errors).toHaveLength(0)
      })
    })
  }

  it('should produce no overlaps on 50-fragment stress input', () => {
    const stress: PipelineSegment[] = Array.from({ length: 50 }, (_, i) => ({
      text: `フラグメント${i}`,
      start: i * 0.3,
      end: (i + 1) * 0.3,
    }))

    const { final } = runFullPipeline(stress, META_DETERMINISTIC)
    const errors = validatePlaybackSafety(final)
    expect(errors).toHaveLength(0)
  })

  it('should handle empty input without errors', () => {
    const { computed, final } = runFullPipeline([], META_AI)
    expect(computed).toHaveLength(0)
    expect(final).toHaveLength(0)
  })

  it('should handle single segment input', () => {
    const single: PipelineSegment[] = [{ text: 'はい。', start: 5, end: 6 }]
    const { final } = runFullPipeline(single, META_DETERMINISTIC)
    expect(final).toHaveLength(1)
    const errors = validatePlaybackSafety(final)
    expect(errors).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Tests: Deterministic fallback stability
// ---------------------------------------------------------------------------

describe('Deterministic fallback behavior', () => {
  it('should produce consistent output for the same input', () => {
    const { resegmentDeterministic } = require('../resegmentation')

    const input = {
      segments: [
        { text: 'こんにちは世界', start: 0, end: 3 },
        { text: '元気ですか', start: 3.5, end: 6 },
        { text: 'はい元気です', start: 6.5, end: 9 },
      ],
    }

    const result1 = resegmentDeterministic(input)
    const result2 = resegmentDeterministic(input)

    expect(result1.segments).toEqual(result2.segments)
    expect(result1.source).toBe('deterministic')
    expect(result2.source).toBe('deterministic')
  })

  it('should always produce valid output from reasonable input', () => {
    const { resegmentDeterministic, validateResegmentedOutput } = require('../resegmentation')

    const testCases = [
      { segments: NORMAL_SEGMENTS.map(s => ({ text: s.text, start: s.start, end: s.end })) },
      { segments: FRAGMENTED_SEGMENTS.map(s => ({ text: s.text, start: s.start, end: s.end })) },
      { segments: LONG_SEGMENT.map(s => ({ text: s.text, start: s.start, end: s.end })) },
    ]

    for (const input of testCases) {
      const result = resegmentDeterministic(input)
      expect(result.source).toBe('deterministic')
      expect(result.segments.length).toBeGreaterThan(0)

      for (const seg of result.segments) {
        expect(typeof seg.text).toBe('string')
        expect(seg.text.length).toBeGreaterThan(0)
        expect(seg.end).toBeGreaterThan(seg.start)
        expect(seg.start).toBeGreaterThanOrEqual(0)
      }

      const validation = validateResegmentedOutput(result.segments)
      const overlapErrors = validation.errors.filter((e: string) => e.includes('overlaps'))
      expect(overlapErrors).toHaveLength(0)
    }
  })

  it('should never produce overlapping segments on fragmented input', () => {
    const { resegmentDeterministic, validateResegmentedOutput } = require('../resegmentation')

    const fragments = Array.from({ length: 20 }, (_, i) => ({
      text: `テスト${i}`,
      start: i * 0.5,
      end: (i + 1) * 0.5,
    }))

    const result = resegmentDeterministic({ segments: fragments })
    const validation = validateResegmentedOutput(result.segments)
    const overlapErrors = validation.errors.filter((e: string) => e.includes('overlaps'))
    expect(overlapErrors).toHaveLength(0)
  })

  it('should handle empty input gracefully', () => {
    const { resegmentDeterministic } = require('../resegmentation')

    const result = resegmentDeterministic({ segments: [] })
    expect(result.segments).toHaveLength(0)
    expect(result.validationPassed).toBe(false)
    expect(result.source).toBe('deterministic')
  })
})

// ---------------------------------------------------------------------------
// Tests: Builder output → resegmentation pipeline round-trip safety
// ---------------------------------------------------------------------------

describe('Builder output feeds safely into resegmentation pipeline', () => {
  it('should produce valid resegmentation input from builder final segments', () => {
    const { resegmentDeterministic, validateResegmentedOutput } = require('../resegmentation')

    const { final } = runFullPipeline(NORMAL_SEGMENTS, META_AI)

    // Convert final segments to resegmentation input shape
    const resegInput = {
      segments: final.map(f => ({ text: f.text, start: f.startTime, end: f.endTime })),
    }

    const result = resegmentDeterministic(resegInput)
    expect(result.validationPassed).toBe(true)

    const validation = validateResegmentedOutput(result.segments)
    expect(validation.valid).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests: Compatibility bridge
// ---------------------------------------------------------------------------

describe('Compatibility bridge: FinalPracticeSegment → legacy TranscriptSegment', () => {
  it('should preserve playback-critical fields when mapped to legacy shape', () => {
    const { final } = runFullPipeline(NORMAL_SEGMENTS, META_AI)

    const legacy = final.map(f => ({
      text: f.text,
      startTime: f.startTime,
      endTime: f.endTime,
    }))

    expect(legacy).toHaveLength(final.length)
    for (let i = 0; i < final.length; i++) {
      expect(legacy[i].text).toBe(final[i].text)
      expect(legacy[i].startTime).toBe(final[i].startTime)
      expect(legacy[i].endTime).toBe(final[i].endTime)
    }

    const errors = validatePlaybackSafety(legacy)
    expect(errors).toHaveLength(0)
  })
})
