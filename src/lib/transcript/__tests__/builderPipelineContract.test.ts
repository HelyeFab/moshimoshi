/**
 * Route-Contract Tests — Transcript API Response Shape
 *
 * Agent 05 — Route Contract & Benchmark Validation
 *
 * These tests exercise the same builder pipeline that the route handler
 * uses (buildSourceSegments → buildComputedPracticeSegments →
 * buildFinalPracticeSegments) and validate that the resulting response
 * shape satisfies the contract the page (extractSegmentsFromResponse)
 * depends on.
 *
 * This is the "tightly scoped server-side test harness" form described
 * in 05-AGENT-ROUTE-CONTRACT-AND-BENCHMARK-VALIDATION.md.
 *
 * Why not call the route HTTP endpoint directly:
 *   The route handler depends on external services (YouTube API, Firebase,
 *   Railway, Sheldon, Supa). Mocking all of them would produce a fake
 *   confidence test — the exact failure mode the assignment rejects.
 *   Instead, we exercise the real code path that every route exit uses.
 */

import {
  buildSourceSegments,
  buildComputedPracticeSegments,
  buildFinalPracticeSegments,
  type PipelineSegment,
  type PipelineMetadata,
} from '../practiceSegments'
import type {
  SourceTranscriptSegment,
  ComputedPracticeSegment,
  FinalPracticeSegment,
  ContentKind,
  SegmentationPolicy,
} from '../practiceSegmentTypes'

// ---------------------------------------------------------------------------
// Helpers — replicate the route's buildPracticeSegmentLayers transform
// ---------------------------------------------------------------------------

/**
 * Mirrors the private `buildPracticeSegmentLayers()` in
 * src/app/api/youtube/transcript/[videoId]/route.ts (lines 551-583).
 *
 * Accepts the same inputs the route does (final cleaned segments, raw
 * provider segments, AI pipeline result metadata) and returns the same
 * three layer objects that get spread into the NextResponse.
 */
function buildPracticeSegmentLayers(
  finalSegments: Array<{ text: string; start: number; end: number; words?: string[] }>,
  rawSegments: Array<{ text: string; start: number; end: number; words?: string[] }>,
  aiResult: { method: 'ai' | 'deterministic'; qualityAfter: number },
  transcriptSource: SourceTranscriptSegment['source'],
): {
  sourceSegments: SourceTranscriptSegment[]
  computedPracticeSegments: ComputedPracticeSegment[]
  finalPracticeSegments: FinalPracticeSegment[]
} {
  const sourceSegs = buildSourceSegments(
    rawSegments.map((s) => ({ text: s.text, start: s.start, end: s.end, words: s.words })),
    transcriptSource,
  )

  const meta: PipelineMetadata = {
    method: aiResult.method,
    source: transcriptSource as PipelineMetadata['source'],
    transcriptQualityScore: aiResult.qualityAfter,
  }

  const computed = buildComputedPracticeSegments(
    finalSegments.map((s) => ({ text: s.text, start: s.start, end: s.end, words: s.words })),
    sourceSegs,
    meta,
  )

  const final = buildFinalPracticeSegments(computed)

  return { sourceSegments: sourceSegs, computedPracticeSegments: computed, finalPracticeSegments: final }
}

// ---------------------------------------------------------------------------
// Realistic fixture data — representative of normal speech transcript
// ---------------------------------------------------------------------------

const RAW_SEGMENTS: PipelineSegment[] = [
  { text: 'みなさんこんにちは。', start: 0.5, end: 2.1 },
  { text: '今日は日本語の勉強について話します。', start: 2.2, end: 5.8 },
  { text: 'まず最初に文法を見てみましょう。', start: 6.0, end: 9.1 },
  { text: 'これは大事なポイントです。', start: 9.3, end: 12.0 },
  { text: 'それでは始めましょう。', start: 12.5, end: 14.8 },
]

const FINAL_SEGMENTS = RAW_SEGMENTS // In deterministic path, final = cleaned raw

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Route Contract — Transcript API Response Shape', () => {
  let result: ReturnType<typeof buildPracticeSegmentLayers>

  beforeAll(() => {
    result = buildPracticeSegmentLayers(
      FINAL_SEGMENTS,
      RAW_SEGMENTS,
      { method: 'deterministic', qualityAfter: 0.72 },
      'railway-server',
    )
  })

  // =========================================================================
  // Deliverable 1: All three practice segment arrays exist
  // =========================================================================

  describe('response includes all three practice segment layers', () => {
    test('sourceSegments is a non-empty array', () => {
      expect(Array.isArray(result.sourceSegments)).toBe(true)
      expect(result.sourceSegments.length).toBeGreaterThan(0)
    })

    test('computedPracticeSegments is a non-empty array', () => {
      expect(Array.isArray(result.computedPracticeSegments)).toBe(true)
      expect(result.computedPracticeSegments.length).toBeGreaterThan(0)
    })

    test('finalPracticeSegments is a non-empty array', () => {
      expect(Array.isArray(result.finalPracticeSegments)).toBe(true)
      expect(result.finalPracticeSegments.length).toBeGreaterThan(0)
    })
  })

  // =========================================================================
  // Deliverable 2: Legacy backward compatibility
  // =========================================================================

  describe('backward compatibility', () => {
    test('finalPracticeSegments count matches input segment count (Phase 1: no overrides)', () => {
      expect(result.finalPracticeSegments.length).toBe(FINAL_SEGMENTS.length)
    })

    test('source segment count matches raw input count', () => {
      expect(result.sourceSegments.length).toBe(RAW_SEGMENTS.length)
    })

    test('computed segment count matches final input count', () => {
      expect(result.computedPracticeSegments.length).toBe(FINAL_SEGMENTS.length)
    })

    test('response can still be consumed via legacy segments path', () => {
      // Simulates the page's legacy fallback:
      //   return Array.isArray(data.segments) ? data.segments : []
      // The route spreads ...psLayers onto the response alongside segments.
      // Both co-exist — the page only reads finalPracticeSegments if present.
      const mockResponse = {
        segments: FINAL_SEGMENTS,
        ...result,
      }
      expect(Array.isArray(mockResponse.segments)).toBe(true)
      expect(mockResponse.segments.length).toBe(FINAL_SEGMENTS.length)
      expect(Array.isArray(mockResponse.finalPracticeSegments)).toBe(true)
    })
  })

  // =========================================================================
  // Deliverable 3: Page-required fields on FinalPracticeSegment
  // =========================================================================

  describe('page-required fields on finalPracticeSegments', () => {
    // These are the exact fields page.tsx extractSegmentsFromResponse reads:
    //   fps.startTime, fps.endTime, fps.text, fps.contentKind,
    //   fps.segmentationPolicy, fps.boundaryConfidence, fps.isUserEdited

    test.each([0, 1, 2, 3, 4])('segment[%i] has id (string)', (i) => {
      expect(typeof result.finalPracticeSegments[i].id).toBe('string')
      expect(result.finalPracticeSegments[i].id.length).toBeGreaterThan(0)
    })

    test.each([0, 1, 2, 3, 4])('segment[%i] has text (string)', (i) => {
      expect(typeof result.finalPracticeSegments[i].text).toBe('string')
      expect(result.finalPracticeSegments[i].text.length).toBeGreaterThan(0)
    })

    test.each([0, 1, 2, 3, 4])('segment[%i] has startTime (number)', (i) => {
      expect(typeof result.finalPracticeSegments[i].startTime).toBe('number')
      expect(result.finalPracticeSegments[i].startTime).toBeGreaterThanOrEqual(0)
    })

    test.each([0, 1, 2, 3, 4])('segment[%i] has endTime > startTime', (i) => {
      expect(result.finalPracticeSegments[i].endTime).toBeGreaterThan(
        result.finalPracticeSegments[i].startTime,
      )
    })

    test.each([0, 1, 2, 3, 4])('segment[%i] has contentKind (valid enum)', (i) => {
      const validKinds: ContentKind[] = ['speech', 'lyrics', 'mixed', 'unknown']
      expect(validKinds).toContain(result.finalPracticeSegments[i].contentKind)
    })

    test.each([0, 1, 2, 3, 4])('segment[%i] has segmentationPolicy (valid enum)', (i) => {
      const validPolicies: SegmentationPolicy[] = [
        'speech-utterance',
        'lyrics-lineation',
        'mixed-adaptive',
        'fallback-safe',
      ]
      expect(validPolicies).toContain(result.finalPracticeSegments[i].segmentationPolicy)
    })

    test.each([0, 1, 2, 3, 4])('segment[%i] has boundaryConfidence (number 0-1)', (i) => {
      const c = result.finalPracticeSegments[i].boundaryConfidence
      expect(typeof c).toBe('number')
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThanOrEqual(1)
    })

    test.each([0, 1, 2, 3, 4])('segment[%i] has isUserEdited (boolean, false in Phase 1)', (i) => {
      expect(result.finalPracticeSegments[i].isUserEdited).toBe(false)
    })
  })

  // =========================================================================
  // Deliverable 4: extractSegmentsFromResponse compatibility
  // =========================================================================

  describe('extractSegmentsFromResponse compatibility', () => {
    test('page can map finalPracticeSegments to TranscriptSegment shape', () => {
      // Replicate the page's extractSegmentsFromResponse logic
      const mapped = result.finalPracticeSegments.map((fps) => ({
        start: fps.startTime,
        end: fps.endTime,
        text: fps.text,
        contentKind: fps.contentKind,
        segmentationPolicy: fps.segmentationPolicy,
        boundaryConfidence: fps.boundaryConfidence,
        isUserEdited: fps.isUserEdited,
      }))

      expect(mapped.length).toBe(FINAL_SEGMENTS.length)

      for (let i = 0; i < mapped.length; i++) {
        expect(typeof mapped[i].start).toBe('number')
        expect(typeof mapped[i].end).toBe('number')
        expect(typeof mapped[i].text).toBe('string')
        expect(mapped[i].end).toBeGreaterThan(mapped[i].start)
        expect(mapped[i].text.trim().length).toBeGreaterThan(0)
      }
    })

    test('mapped segments preserve original text content', () => {
      const mapped = result.finalPracticeSegments.map((fps) => fps.text)
      const original = FINAL_SEGMENTS.map((s) => s.text)
      expect(mapped).toEqual(original)
    })

    test('mapped segments preserve original timing (startTime/endTime)', () => {
      for (let i = 0; i < result.finalPracticeSegments.length; i++) {
        expect(result.finalPracticeSegments[i].startTime).toBe(FINAL_SEGMENTS[i].start)
        expect(result.finalPracticeSegments[i].endTime).toBe(FINAL_SEGMENTS[i].end)
      }
    })
  })

  // =========================================================================
  // Deliverable 5: Timing safety — universal playback contract
  // =========================================================================

  describe('timing safety invariants', () => {
    test('no overlapping segments', () => {
      const fps = result.finalPracticeSegments
      for (let i = 1; i < fps.length; i++) {
        expect(fps[i].startTime).toBeGreaterThanOrEqual(fps[i - 1].endTime)
      }
    })

    test('no negative durations', () => {
      for (const seg of result.finalPracticeSegments) {
        expect(seg.endTime - seg.startTime).toBeGreaterThan(0)
      }
    })

    test('monotonic start-time ordering', () => {
      const fps = result.finalPracticeSegments
      for (let i = 1; i < fps.length; i++) {
        expect(fps[i].startTime).toBeGreaterThan(fps[i - 1].startTime)
      }
    })
  })

  // =========================================================================
  // Deliverable 6: Provenance chain — computed → source linkage
  // =========================================================================

  describe('provenance chain', () => {
    test('every finalPracticeSegment references at least one computedSegmentId', () => {
      for (const fps of result.finalPracticeSegments) {
        expect(fps.computedSegmentIds.length).toBeGreaterThan(0)
      }
    })

    test('every finalPracticeSegment references at least one sourceSegmentId', () => {
      for (const fps of result.finalPracticeSegments) {
        expect(fps.sourceSegmentIds.length).toBeGreaterThan(0)
      }
    })

    test('computedSegmentIds reference existing computed segments', () => {
      const computedIds = new Set(result.computedPracticeSegments.map((c) => c.id))
      for (const fps of result.finalPracticeSegments) {
        for (const cid of fps.computedSegmentIds) {
          expect(computedIds.has(cid)).toBe(true)
        }
      }
    })

    test('sourceSegmentIds reference existing source segments', () => {
      const sourceIds = new Set(result.sourceSegments.map((s) => s.id))
      for (const fps of result.finalPracticeSegments) {
        for (const sid of fps.sourceSegmentIds) {
          expect(sourceIds.has(sid)).toBe(true)
        }
      }
    })
  })

  // =========================================================================
  // Deliverable 7: AI pipeline path produces same contract
  // =========================================================================

  describe('AI pipeline path produces same contract shape', () => {
    let aiResult: ReturnType<typeof buildPracticeSegmentLayers>

    beforeAll(() => {
      // AI pipeline may produce differently segmented output
      const aiProcessedSegments: PipelineSegment[] = [
        { text: 'みなさんこんにちは。今日は日本語の勉強について話します。', start: 0.5, end: 5.8 },
        { text: 'まず最初に文法を見てみましょう。これは大事なポイントです。', start: 6.0, end: 12.0 },
        { text: 'それでは始めましょう。', start: 12.5, end: 14.8 },
      ]

      aiResult = buildPracticeSegmentLayers(
        aiProcessedSegments,
        RAW_SEGMENTS,
        { method: 'ai', qualityAfter: 0.85 },
        'sheldon-server',
      )
    })

    test('all three layers exist', () => {
      expect(aiResult.sourceSegments.length).toBe(RAW_SEGMENTS.length)
      expect(aiResult.computedPracticeSegments.length).toBe(3)
      expect(aiResult.finalPracticeSegments.length).toBe(3)
    })

    test('page-required fields present on AI-path finalPracticeSegments', () => {
      for (const fps of aiResult.finalPracticeSegments) {
        expect(typeof fps.id).toBe('string')
        expect(typeof fps.text).toBe('string')
        expect(typeof fps.startTime).toBe('number')
        expect(typeof fps.endTime).toBe('number')
        expect(typeof fps.contentKind).toBe('string')
        expect(typeof fps.segmentationPolicy).toBe('string')
        expect(typeof fps.boundaryConfidence).toBe('number')
        expect(typeof fps.isUserEdited).toBe('boolean')
        expect(fps.isUserEdited).toBe(false)
      }
    })

    test('AI path uses correct boundary and timing methods', () => {
      for (const cps of aiResult.computedPracticeSegments) {
        expect(cps.boundaryMethod).toBe('ai-resegment')
        expect(cps.timingMethod).toBe('proportional')
      }
    })

    test('deterministic path uses correct boundary and timing methods', () => {
      for (const cps of result.computedPracticeSegments) {
        expect(cps.boundaryMethod).toBe('gap-based')
        expect(cps.timingMethod).toBe('segment-inherited')
      }
    })

    test('timing safety holds on AI path', () => {
      const fps = aiResult.finalPracticeSegments
      for (let i = 1; i < fps.length; i++) {
        expect(fps[i].startTime).toBeGreaterThanOrEqual(fps[i - 1].endTime)
      }
      for (const seg of fps) {
        expect(seg.endTime - seg.startTime).toBeGreaterThan(0)
      }
    })
  })

  // =========================================================================
  // Deliverable 8: Phase 1 defaults
  // =========================================================================

  describe('Phase 1 defaults', () => {
    test('contentKind defaults to unknown', () => {
      for (const fps of result.finalPracticeSegments) {
        expect(fps.contentKind).toBe('unknown')
      }
    })

    test('segmentationPolicy defaults to fallback-safe', () => {
      for (const fps of result.finalPracticeSegments) {
        expect(fps.segmentationPolicy).toBe('fallback-safe')
      }
    })

    test('transcriptQualityScore propagated to computed segments', () => {
      for (const cps of result.computedPracticeSegments) {
        expect(cps.transcriptQualityScore).toBe(0.72)
      }
    })
  })

  // =========================================================================
  // Deliverable 9: Negative assertions — fields NOT on FinalPracticeSegment
  // =========================================================================

  describe('negative assertions — absent fields', () => {
    test('finalPracticeSegments do NOT have sourceWordIds', () => {
      for (const fps of result.finalPracticeSegments) {
        expect(fps).not.toHaveProperty('sourceWordIds')
      }
    })

    test('finalPracticeSegments do NOT have editHistory', () => {
      for (const fps of result.finalPracticeSegments) {
        expect(fps).not.toHaveProperty('editHistory')
      }
    })

    test('finalPracticeSegments do NOT have transcriptQualityScore', () => {
      for (const fps of result.finalPracticeSegments) {
        expect(fps).not.toHaveProperty('transcriptQualityScore')
      }
    })
  })
})
