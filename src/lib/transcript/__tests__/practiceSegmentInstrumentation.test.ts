/**
 * PracticeSegment Instrumentation Tests
 *
 * Agent 04 — QA & Benchmarks
 *
 * These tests validate that the instrumentation metadata produced by
 * the real builders in practiceSegments.ts conforms to the type
 * contracts in practiceSegmentTypes.ts.
 *
 * All assertions run against real builder output, not fabricated objects.
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
// Valid enum sets (from real exported types)
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
// Fixtures
// ---------------------------------------------------------------------------

const NORMAL_SEGMENTS: PipelineSegment[] = [
  { text: 'こんにちは。', start: 0, end: 3 },
  { text: '今日はとてもいい天気ですね。', start: 3.1, end: 7 },
  { text: '散歩に行きましょう。', start: 7.2, end: 10 },
]

const SHORT_SEGMENT: PipelineSegment[] = [
  { text: 'うん', start: 10, end: 10.5 },
]

const LONG_SEGMENT: PipelineSegment[] = [
  {
    text: 'これは非常に長い文章で、話者がずっと話し続けている状況を表しています。',
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
// Helper: run full pipeline
// ---------------------------------------------------------------------------

function runPipeline(raw: PipelineSegment[], meta: PipelineMetadata) {
  const source = buildSourceSegments(raw, meta.source)
  const computed = buildComputedPracticeSegments(raw, source, meta)
  const final = buildFinalPracticeSegments(computed)
  return { source, computed, final }
}

// ---------------------------------------------------------------------------
// Instrumentation validators (applied to real output)
// ---------------------------------------------------------------------------

function validateComputedInstrumentation(seg: ComputedPracticeSegment): string[] {
  const errors: string[] = []
  if (!VALID_CONTENT_KINDS.includes(seg.contentKind)) {
    errors.push(`Invalid contentKind: ${seg.contentKind}`)
  }
  if (!VALID_POLICIES.includes(seg.segmentationPolicy)) {
    errors.push(`Invalid segmentationPolicy: ${seg.segmentationPolicy}`)
  }
  if (!VALID_BOUNDARY_METHODS.includes(seg.boundaryMethod)) {
    errors.push(`Invalid boundaryMethod: ${seg.boundaryMethod}`)
  }
  if (!VALID_TIMING_METHODS.includes(seg.timingMethod)) {
    errors.push(`Invalid timingMethod: ${seg.timingMethod}`)
  }
  if (typeof seg.boundaryConfidence !== 'number') {
    errors.push('boundaryConfidence is not a number')
  } else if (seg.boundaryConfidence < 0 || seg.boundaryConfidence > 1) {
    errors.push(`boundaryConfidence ${seg.boundaryConfidence} out of [0, 1]`)
  }
  if (seg.flags) {
    for (const flag of seg.flags) {
      if (!VALID_FLAGS.includes(flag)) {
        errors.push(`Invalid flag: ${flag}`)
      }
    }
  }
  return errors
}

function validateFinalInstrumentation(seg: FinalPracticeSegment): string[] {
  const errors: string[] = []
  if (!VALID_CONTENT_KINDS.includes(seg.contentKind)) {
    errors.push(`Invalid contentKind: ${seg.contentKind}`)
  }
  if (!VALID_POLICIES.includes(seg.segmentationPolicy)) {
    errors.push(`Invalid segmentationPolicy: ${seg.segmentationPolicy}`)
  }
  if (!VALID_TIMING_METHODS.includes(seg.timingMethod)) {
    errors.push(`Invalid timingMethod: ${seg.timingMethod}`)
  }
  if (typeof seg.boundaryConfidence !== 'number') {
    errors.push('boundaryConfidence is not a number')
  } else if (seg.boundaryConfidence < 0 || seg.boundaryConfidence > 1) {
    errors.push(`boundaryConfidence ${seg.boundaryConfidence} out of [0, 1]`)
  }
  if (typeof seg.isUserEdited !== 'boolean') {
    errors.push('isUserEdited is not a boolean')
  }
  return errors
}

// ---------------------------------------------------------------------------
// Tests: boundaryMethod on real output
// ---------------------------------------------------------------------------

describe('boundaryMethod instrumentation (real output)', () => {
  it('should produce ai-resegment for AI pipeline', () => {
    const { computed } = runPipeline(NORMAL_SEGMENTS, META_AI)
    for (const seg of computed) {
      expect(seg.boundaryMethod).toBe('ai-resegment')
      expect(VALID_BOUNDARY_METHODS).toContain(seg.boundaryMethod)
    }
  })

  it('should produce gap-based for deterministic pipeline', () => {
    const { computed } = runPipeline(NORMAL_SEGMENTS, META_DETERMINISTIC)
    for (const seg of computed) {
      expect(seg.boundaryMethod).toBe('gap-based')
      expect(VALID_BOUNDARY_METHODS).toContain(seg.boundaryMethod)
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: timingMethod on real output
// ---------------------------------------------------------------------------

describe('timingMethod instrumentation (real output)', () => {
  it('should produce proportional for AI pipeline', () => {
    const { computed } = runPipeline(NORMAL_SEGMENTS, META_AI)
    for (const seg of computed) {
      expect(seg.timingMethod).toBe('proportional')
      expect(VALID_TIMING_METHODS).toContain(seg.timingMethod)
    }
  })

  it('should produce segment-inherited for deterministic pipeline', () => {
    const { computed } = runPipeline(NORMAL_SEGMENTS, META_DETERMINISTIC)
    for (const seg of computed) {
      expect(seg.timingMethod).toBe('segment-inherited')
      expect(VALID_TIMING_METHODS).toContain(seg.timingMethod)
    }
  })

  it('should propagate timingMethod from computed to final', () => {
    const { computed, final } = runPipeline(NORMAL_SEGMENTS, META_AI)
    for (let i = 0; i < final.length; i++) {
      expect(final[i].timingMethod).toBe(computed[i].timingMethod)
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: boundaryConfidence on real output
// ---------------------------------------------------------------------------

describe('boundaryConfidence instrumentation (real output)', () => {
  it('should always produce values in [0, 1]', () => {
    const inputs = [NORMAL_SEGMENTS, SHORT_SEGMENT, LONG_SEGMENT]
    const metas = [META_AI, META_DETERMINISTIC]

    for (const segs of inputs) {
      for (const meta of metas) {
        const { computed } = runPipeline(segs, meta)
        for (const seg of computed) {
          expect(seg.boundaryConfidence).toBeGreaterThanOrEqual(0)
          expect(seg.boundaryConfidence).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('should give higher base confidence to AI than deterministic', () => {
    const { computed: aiComputed } = runPipeline(NORMAL_SEGMENTS, META_AI)
    const { computed: detComputed } = runPipeline(NORMAL_SEGMENTS, META_DETERMINISTIC)

    // For the same text and timing, AI base should be higher
    // First segment: 'こんにちは。' ends with 。 so both get sentence boost
    // AI base = 0.65, deterministic base = 0.5 — both get +0.15 for 。
    expect(aiComputed[0].boundaryConfidence).toBeGreaterThan(detComputed[0].boundaryConfidence)
  })

  it('should penalize short segments without sentence endings', () => {
    const { computed } = runPipeline(SHORT_SEGMENT, META_DETERMINISTIC)
    // 'うん' — 2 chars < 8, no sentence ending, deterministic base 0.5
    // Should get -0.10 penalty → 0.40
    expect(computed[0].boundaryConfidence).toBeLessThan(0.5)
  })

  it('should propagate boundaryConfidence from computed to final', () => {
    const { computed, final } = runPipeline(NORMAL_SEGMENTS, META_AI)
    for (let i = 0; i < final.length; i++) {
      expect(final[i].boundaryConfidence).toBe(computed[i].boundaryConfidence)
    }
  })

  it('should support confidence bucketing for QA reporting', () => {
    // Mix of different segment types to get varied confidence
    const mixed: PipelineSegment[] = [
      { text: '今日はとてもいい天気ですね。', start: 0, end: 5 },  // sentence end + good duration
      { text: 'うん', start: 5.1, end: 5.5 },                      // short, no sentence end
      { text: '元気ですか？', start: 5.6, end: 8 },                // sentence end
    ]

    const { computed } = runPipeline(mixed, META_DETERMINISTIC)
    const high = computed.filter(s => s.boundaryConfidence >= 0.7)
    const low = computed.filter(s => s.boundaryConfidence < 0.5)

    // We should get at least some variation
    expect(high.length + low.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Tests: contentKind and segmentationPolicy (Phase 1 defaults)
// ---------------------------------------------------------------------------

describe('contentKind and segmentationPolicy (Phase 1 defaults)', () => {
  it('should default to unknown contentKind', () => {
    const { computed } = runPipeline(NORMAL_SEGMENTS, META_AI)
    for (const seg of computed) {
      expect(seg.contentKind).toBe('unknown')
      expect(VALID_CONTENT_KINDS).toContain(seg.contentKind)
    }
  })

  it('should default to fallback-safe segmentationPolicy', () => {
    const { computed } = runPipeline(NORMAL_SEGMENTS, META_AI)
    for (const seg of computed) {
      expect(seg.segmentationPolicy).toBe('fallback-safe')
      expect(VALID_POLICIES).toContain(seg.segmentationPolicy)
    }
  })

  it('should propagate contentKind from computed to final', () => {
    const { computed, final } = runPipeline(NORMAL_SEGMENTS, META_AI)
    for (let i = 0; i < final.length; i++) {
      expect(final[i].contentKind).toBe(computed[i].contentKind)
    }
  })

  it('should propagate segmentationPolicy from computed to final', () => {
    const { computed, final } = runPipeline(NORMAL_SEGMENTS, META_AI)
    for (let i = 0; i < final.length; i++) {
      expect(final[i].segmentationPolicy).toBe(computed[i].segmentationPolicy)
    }
  })

  it('should use consistent contentKind across all segments in a video', () => {
    const { computed } = runPipeline(NORMAL_SEGMENTS, META_AI)
    const kinds = new Set(computed.map(s => s.contentKind))
    expect(kinds.size).toBe(1)
  })

  it('should use consistent segmentationPolicy across all segments in a video', () => {
    const { computed } = runPipeline(NORMAL_SEGMENTS, META_DETERMINISTIC)
    const policies = new Set(computed.map(s => s.segmentationPolicy))
    expect(policies.size).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Tests: flags on real output
// ---------------------------------------------------------------------------

describe('Segment flags instrumentation (real output)', () => {
  it('should flag short non-sentence segments as low-confidence and mid-clause', () => {
    const { computed } = runPipeline(SHORT_SEGMENT, META_DETERMINISTIC)
    expect(computed[0].flags).toBeDefined()
    expect(computed[0].flags).toContain('low-confidence-boundary')
    expect(computed[0].flags).toContain('mid-clause-risk')
  })

  it('should flag deterministic segments as fallback-generated', () => {
    const { computed } = runPipeline(NORMAL_SEGMENTS, META_DETERMINISTIC)
    for (const seg of computed) {
      expect(seg.flags).toContain('fallback-generated')
    }
  })

  it('should flag long-duration segments', () => {
    const { computed } = runPipeline(LONG_SEGMENT, META_DETERMINISTIC)
    expect(computed[0].flags).toContain('contains-long-gap')
  })

  it('should not add fallback-generated flag for AI segments', () => {
    const { computed } = runPipeline(NORMAL_SEGMENTS, META_AI)
    for (const seg of computed) {
      if (seg.flags) {
        expect(seg.flags).not.toContain('fallback-generated')
      }
    }
  })

  it('should only produce valid flag values', () => {
    const inputs = [NORMAL_SEGMENTS, SHORT_SEGMENT, LONG_SEGMENT]
    const metas = [META_AI, META_DETERMINISTIC]

    for (const segs of inputs) {
      for (const meta of metas) {
        const { computed } = runPipeline(segs, meta)
        for (const seg of computed) {
          if (seg.flags) {
            for (const flag of seg.flags) {
              expect(VALID_FLAGS).toContain(flag)
            }
          }
        }
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: override rate / isUserEdited tracking (Phase 1)
// ---------------------------------------------------------------------------

describe('Override rate tracking (Phase 1)', () => {
  it('should report 0% override rate when no edits exist', () => {
    const { final } = runPipeline(NORMAL_SEGMENTS, META_AI)
    const overrideRate = final.filter(s => s.isUserEdited).length / final.length
    expect(overrideRate).toBe(0)
  })

  it('should have isUserEdited as boolean false on every final segment', () => {
    const { final } = runPipeline(NORMAL_SEGMENTS, META_DETERMINISTIC)
    for (const seg of final) {
      expect(seg.isUserEdited).toBe(false)
      expect(typeof seg.isUserEdited).toBe('boolean')
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: Full instrumentation validation on real pipeline output
// ---------------------------------------------------------------------------

describe('Full instrumentation validation (real pipeline)', () => {
  it('should pass instrumentation validation on AI pipeline output', () => {
    const { computed, final } = runPipeline(NORMAL_SEGMENTS, META_AI)

    for (const seg of computed) {
      expect(validateComputedInstrumentation(seg)).toHaveLength(0)
    }
    for (const seg of final) {
      expect(validateFinalInstrumentation(seg)).toHaveLength(0)
    }
  })

  it('should pass instrumentation validation on deterministic pipeline output', () => {
    const { computed, final } = runPipeline(NORMAL_SEGMENTS, META_DETERMINISTIC)

    for (const seg of computed) {
      expect(validateComputedInstrumentation(seg)).toHaveLength(0)
    }
    for (const seg of final) {
      expect(validateFinalInstrumentation(seg)).toHaveLength(0)
    }
  })

  it('should pass instrumentation validation on edge-case inputs', () => {
    const edgeCases: PipelineSegment[][] = [
      SHORT_SEGMENT,
      LONG_SEGMENT,
      [{ text: 'はい。', start: 100, end: 101 }],
    ]

    for (const segs of edgeCases) {
      const { computed, final } = runPipeline(segs, META_DETERMINISTIC)
      for (const seg of computed) {
        expect(validateComputedInstrumentation(seg)).toHaveLength(0)
      }
      for (const seg of final) {
        expect(validateFinalInstrumentation(seg)).toHaveLength(0)
      }
    }
  })

  it('should have transcriptQualityScore when metadata provides it', () => {
    const { computed } = runPipeline(NORMAL_SEGMENTS, META_AI)
    for (const seg of computed) {
      expect(seg.transcriptQualityScore).toBe(0.72)
    }
  })

  it('should omit transcriptQualityScore when metadata does not provide it', () => {
    const { computed } = runPipeline(NORMAL_SEGMENTS, META_DETERMINISTIC)
    for (const seg of computed) {
      expect(seg.transcriptQualityScore).toBeUndefined()
    }
  })
})
