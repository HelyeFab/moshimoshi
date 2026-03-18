/**
 * Route-Level Contract Test — /api/youtube/transcript/[videoId]
 *
 * Agent 05 — Route Contract & Benchmark Validation
 *
 * This test imports and calls the real GET handler exported from route.ts.
 * External dependencies (Firebase cache, Supa, YouTube providers) are mocked
 * at the module boundary so the route's internal logic — cleanup, merge,
 * normalize, buildPracticeSegmentLayers — runs for real.
 *
 * The mock boundary:
 *   - @/lib/transcript/cache  → controlled cache entry
 *   - @/lib/supa/client       → disabled
 *   - @/lib/firebase/admin    → stubbed (no real Firestore)
 *   - youtubei.js             → stubbed (not reached on cache hit)
 *
 * Everything between the mock boundary and the NextResponse is real code.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Module mocks — must be declared before the route import
// ---------------------------------------------------------------------------

// Mock Firebase admin (imported by cache.ts and route.ts dependencies)
jest.mock('@/lib/firebase/admin', () => ({
  db: null,
  storage: null,
  adminAuth: null,
  adminFirestore: null,
  adminStorage: null,
  auth: null,
  FieldValue: { serverTimestamp: () => new Date() },
  Timestamp: { now: () => ({ toDate: () => new Date() }) },
  ensureAdminInitialized: jest.fn(),
  getAdminDb: jest.fn(),
}))

// Mock transcript cache — the controlled dependency boundary
const mockCacheGet = jest.fn()
const mockCacheUpdate = jest.fn().mockResolvedValue(undefined)
const mockCacheSave = jest.fn().mockResolvedValue(undefined)

jest.mock('@/lib/transcript/cache', () => ({
  transcriptCache: {
    get: (...args: any[]) => mockCacheGet(...args),
    updateTranscriptWithMetadata: (...args: any[]) => mockCacheUpdate(...args),
    save: (...args: any[]) => mockCacheSave(...args),
  },
}))

// Mock Supa client — disabled so we never reach it
jest.mock('@/lib/supa/client', () => ({
  isSupaConfigured: () => false,
  getTranscriptFromSupa: jest.fn().mockResolvedValue(null),
}))

// Mock youtubei.js — not reached on cache hit, but needs to resolve at import
jest.mock('youtubei.js', () => ({
  Innertube: { create: jest.fn() },
}))

// Mock firebase/cleanFirestoreData — imported by cache.ts
jest.mock('@/lib/firebase/cleanFirestoreData', () => ({
  prepareFirestoreData: (d: any) => d,
  cleanYouTubeMetadata: (d: any) => d,
}))

// ---------------------------------------------------------------------------
// Import the real route handler AFTER mocks are declared
// ---------------------------------------------------------------------------

import { GET } from '../[videoId]/route'

// ---------------------------------------------------------------------------
// Test fixture — realistic cached transcript entry
// ---------------------------------------------------------------------------

function buildCacheEntry() {
  return {
    id: 'youtube_testVideo123',
    contentId: 'youtube_testVideo123',
    contentType: 'youtube' as const,
    videoTitle: 'テスト動画',
    language: 'ja',
    createdAt: new Date(),
    lastAccessed: new Date(),
    accessCount: 5,
    transcript: [
      { id: 'l1', text: 'みなさんこんにちは。', startTime: 0.5, endTime: 2.1 },
      { id: 'l2', text: '今日は日本語の勉強について話します。', startTime: 2.3, endTime: 5.8 },
      { id: 'l3', text: 'まず最初に文法を見てみましょう。', startTime: 6.0, endTime: 9.1 },
      { id: 'l4', text: 'これは大事なポイントです。', startTime: 9.3, endTime: 12.0 },
      { id: 'l5', text: 'それでは始めましょう。', startTime: 12.5, endTime: 14.8 },
    ],
    metadata: {
      youtubeVideoId: 'testVideo123',
      // Set these to match route constants so needsAiUpgrade is false
      aiShadowingMethod: 'ai',
      aiShadowingPipelineVersion: '2.4.1',
      aiShadowingModel: 'gpt-4o-mini',
      aiShadowingChunkStrategyVersion: '1.0.0',
      aiShadowingReason: 'openai_segmented',
      aiShadowingQualityBefore: 0.5,
      aiShadowingQualityAfter: 0.72,
    },
  }
}

function createRequest(videoId: string): [NextRequest, { params: Promise<{ videoId: string }> }] {
  const url = `http://localhost:3000/api/youtube/transcript/${videoId}`
  const req = new NextRequest(url)
  const ctx = { params: Promise.resolve({ videoId }) }
  return [req, ctx]
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/youtube/transcript/[videoId] — route-level contract', () => {
  let responseBody: any

  beforeAll(async () => {
    mockCacheGet.mockResolvedValue(buildCacheEntry())
    const [req, ctx] = createRequest('testVideo123')
    const res = await GET(req, ctx)
    responseBody = await res.json()
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  // =========================================================================
  // 1. Response is successful
  // =========================================================================

  test('returns available: true', () => {
    expect(responseBody.available).toBe(true)
  })

  test('returns correct videoId', () => {
    expect(responseBody.videoId).toBe('testVideo123')
  })

  test('returns source as firebase-cache', () => {
    expect(responseBody.source).toBe('firebase-cache')
  })

  // =========================================================================
  // 2. Legacy segments field exists (backward compatibility)
  // =========================================================================

  test('segments array exists and is non-empty', () => {
    expect(Array.isArray(responseBody.segments)).toBe(true)
    expect(responseBody.segments.length).toBeGreaterThan(0)
  })

  test('legacy segments have start, end, text fields', () => {
    for (const seg of responseBody.segments) {
      expect(typeof seg.start).toBe('number')
      expect(typeof seg.end).toBe('number')
      expect(typeof seg.text).toBe('string')
      expect(seg.text.trim().length).toBeGreaterThan(0)
    }
  })

  // =========================================================================
  // 3. Practice segment layers exist
  // =========================================================================

  test('sourceSegments array exists and is non-empty', () => {
    expect(Array.isArray(responseBody.sourceSegments)).toBe(true)
    expect(responseBody.sourceSegments.length).toBeGreaterThan(0)
  })

  test('computedPracticeSegments array exists and is non-empty', () => {
    expect(Array.isArray(responseBody.computedPracticeSegments)).toBe(true)
    expect(responseBody.computedPracticeSegments.length).toBeGreaterThan(0)
  })

  test('finalPracticeSegments array exists and is non-empty', () => {
    expect(Array.isArray(responseBody.finalPracticeSegments)).toBe(true)
    expect(responseBody.finalPracticeSegments.length).toBeGreaterThan(0)
  })

  // =========================================================================
  // 4. Page-required fields on finalPracticeSegments
  //    (what extractSegmentsFromResponse in page.tsx reads)
  // =========================================================================

  test('every finalPracticeSegment has page-required fields', () => {
    for (const fps of responseBody.finalPracticeSegments) {
      // id
      expect(typeof fps.id).toBe('string')
      expect(fps.id.length).toBeGreaterThan(0)

      // text
      expect(typeof fps.text).toBe('string')
      expect(fps.text.trim().length).toBeGreaterThan(0)

      // startTime, endTime
      expect(typeof fps.startTime).toBe('number')
      expect(typeof fps.endTime).toBe('number')
      expect(fps.endTime).toBeGreaterThan(fps.startTime)

      // contentKind
      expect(['speech', 'lyrics', 'mixed', 'unknown']).toContain(fps.contentKind)

      // segmentationPolicy
      expect([
        'speech-utterance',
        'lyrics-lineation',
        'mixed-adaptive',
        'fallback-safe',
      ]).toContain(fps.segmentationPolicy)

      // boundaryConfidence
      expect(typeof fps.boundaryConfidence).toBe('number')
      expect(fps.boundaryConfidence).toBeGreaterThanOrEqual(0)
      expect(fps.boundaryConfidence).toBeLessThanOrEqual(1)

      // isUserEdited
      expect(fps.isUserEdited).toBe(false)
    }
  })

  // =========================================================================
  // 5. Timing safety on the real route output
  // =========================================================================

  test('finalPracticeSegments have no overlaps', () => {
    const fps = responseBody.finalPracticeSegments
    for (let i = 1; i < fps.length; i++) {
      expect(fps[i].startTime).toBeGreaterThanOrEqual(fps[i - 1].endTime)
    }
  })

  test('finalPracticeSegments have positive durations', () => {
    for (const fps of responseBody.finalPracticeSegments) {
      expect(fps.endTime - fps.startTime).toBeGreaterThan(0)
    }
  })

  test('finalPracticeSegments are in monotonic start-time order', () => {
    const fps = responseBody.finalPracticeSegments
    for (let i = 1; i < fps.length; i++) {
      expect(fps[i].startTime).toBeGreaterThan(fps[i - 1].startTime)
    }
  })

  // =========================================================================
  // 6. Provenance chain intact
  // =========================================================================

  test('every finalPracticeSegment has computedSegmentIds and sourceSegmentIds', () => {
    for (const fps of responseBody.finalPracticeSegments) {
      expect(Array.isArray(fps.computedSegmentIds)).toBe(true)
      expect(fps.computedSegmentIds.length).toBeGreaterThan(0)
      expect(Array.isArray(fps.sourceSegmentIds)).toBe(true)
      expect(fps.sourceSegmentIds.length).toBeGreaterThan(0)
    }
  })

  test('computedSegmentIds reference real computedPracticeSegments', () => {
    const cpsIds = new Set(responseBody.computedPracticeSegments.map((c: any) => c.id))
    for (const fps of responseBody.finalPracticeSegments) {
      for (const cid of fps.computedSegmentIds) {
        expect(cpsIds.has(cid)).toBe(true)
      }
    }
  })

  test('sourceSegmentIds reference real sourceSegments', () => {
    const srcIds = new Set(responseBody.sourceSegments.map((s: any) => s.id))
    for (const fps of responseBody.finalPracticeSegments) {
      for (const sid of fps.sourceSegmentIds) {
        expect(srcIds.has(sid)).toBe(true)
      }
    }
  })

  // =========================================================================
  // 7. Count consistency (Phase 1: no overrides)
  // =========================================================================

  test('finalPracticeSegments count matches segments count', () => {
    expect(responseBody.finalPracticeSegments.length).toBe(responseBody.segments.length)
  })

  // =========================================================================
  // 8. The route actually called the cache
  // =========================================================================

  test('transcriptCache.get was called with the correct content ID', () => {
    expect(mockCacheGet).toHaveBeenCalledWith('youtube_testVideo123')
  })

  // =========================================================================
  // 9. extractSegmentsFromResponse compatibility
  //    (replicate the exact page mapping to prove it works on real route output)
  // =========================================================================

  test('page extractSegmentsFromResponse logic produces valid TranscriptSegments', () => {
    // This is the exact mapping from page.tsx extractSegmentsFromResponse
    const mapped = responseBody.finalPracticeSegments.map((fps: any) => ({
      start: fps.startTime,
      end: fps.endTime,
      text: fps.text,
      contentKind: fps.contentKind,
      segmentationPolicy: fps.segmentationPolicy,
      boundaryConfidence: fps.boundaryConfidence,
      isUserEdited: fps.isUserEdited,
    }))

    expect(mapped.length).toBe(responseBody.segments.length)

    for (const seg of mapped) {
      expect(typeof seg.start).toBe('number')
      expect(typeof seg.end).toBe('number')
      expect(seg.end).toBeGreaterThan(seg.start)
      expect(typeof seg.text).toBe('string')
      expect(seg.text.trim().length).toBeGreaterThan(0)
    }
  })
})
