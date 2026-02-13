import { NextRequest } from 'next/server'
import { POST } from '../route'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockFeatureEnabled = false

jest.mock('@/lib/features/featureFlags', () => ({
  isFeatureEnabled: jest.fn((flag: string) => {
    if (flag === 'AI_RESEGMENTATION') return mockFeatureEnabled
    return false
  }),
}))

const mockCacheGet = jest.fn().mockResolvedValue(null)
const mockCacheSet = jest.fn().mockResolvedValue(true)

jest.mock('@/lib/transcript/resegmentationCache', () => ({
  resegmentationCache: {
    get: (...args: unknown[]) => mockCacheGet(...args),
    set: (...args: unknown[]) => mockCacheSet(...args),
  },
}))

// Shared spy so we can assert on the same reference the route uses
const mockProcessTranscript = jest.fn().mockResolvedValue({
  success: true,
  data: {
    segments: [
      { text: 'AI resegmented', startTime: 0, endTime: 3 },
    ],
  },
})

jest.mock('@/lib/ai/AIService', () => ({
  AIService: {
    getInstance: () => ({
      processTranscript: mockProcessTranscript,
    }),
  },
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/youtube/resegment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validBody = {
  videoId: 'abc123',
  segments: [
    { text: 'こんにちは', start: 0, end: 2 },
    { text: '元気ですか', start: 2.5, end: 5 },
    { text: 'はい元気です', start: 5.5, end: 8 },
  ],
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('/api/youtube/resegment POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFeatureEnabled = false
    mockCacheGet.mockResolvedValue(null)
    mockCacheSet.mockResolvedValue(true)
    mockProcessTranscript.mockResolvedValue({
      success: true,
      data: {
        segments: [
          { text: 'AI resegmented', startTime: 0, endTime: 3 },
        ],
      },
    })
  })

  // -----------------------------------------------------------------------
  // Input validation
  // -----------------------------------------------------------------------

  describe('input validation', () => {
    it('returns 400 when body is empty', async () => {
      const req = new NextRequest('http://localhost:3000/api/youtube/resegment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.success).toBe(false)
      expect(json.error).toBe('VALIDATION_ERROR')
    })

    it('returns 400 when videoId is missing', async () => {
      const req = makeRequest({ segments: [{ text: 'a', start: 0, end: 1 }] })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.message).toContain('videoId')
    })

    it('returns 400 when segments is empty', async () => {
      const req = makeRequest({ videoId: 'abc', segments: [] })
      const res = await POST(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.message).toContain('segments')
    })

    it('returns 400 when a segment has wrong shape', async () => {
      const req = makeRequest({
        videoId: 'abc',
        segments: [{ text: 'ok', start: 0 }], // missing end
      })
      const res = await POST(req)
      expect(res.status).toBe(400)
    })
  })

  // -----------------------------------------------------------------------
  // Feature flag OFF (deterministic only)
  // -----------------------------------------------------------------------

  describe('feature flag OFF (deterministic path)', () => {
    it('returns deterministic resegmentation', async () => {
      const req = makeRequest(validBody)
      const res = await POST(req)
      expect(res.status).toBe(200)

      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.source).toBe('deterministic')
      expect(json.fromCache).toBe(false)
      expect(json.aiEnabled).toBe(false)
      expect(json.aiAttempted).toBe(false)
      expect(json.providerAttempted).toBe(null)
      expect(json.fallbackReason).toBe('flag_off')
      expect(Array.isArray(json.segments)).toBe(true)
      expect(json.segments.length).toBeGreaterThanOrEqual(1)
      expect(json.pipelineVersion).toBeDefined()
    })

    it('does NOT invoke AI when flag is off', async () => {
      const req = makeRequest(validBody)
      await POST(req)

      expect(mockProcessTranscript).not.toHaveBeenCalled()
    })

    it('caches the deterministic result', async () => {
      const req = makeRequest(validBody)
      await POST(req)

      expect(mockCacheSet).toHaveBeenCalledTimes(1)
      expect(mockCacheSet).toHaveBeenCalledWith(
        expect.objectContaining({ videoId: 'abc123' }),
        expect.any(Array),
        'deterministic'
      )
    })
  })

  // -----------------------------------------------------------------------
  // Cache behaviour
  // -----------------------------------------------------------------------

  describe('cache behaviour', () => {
    it('returns cached result on cache hit', async () => {
      mockCacheGet.mockResolvedValue({
        id: 'abc123:none:1.0.0',
        videoId: 'abc123',
        source: 'deterministic',
        segments: [{ text: 'cached', start: 0, end: 2 }],
        segmentCount: 1,
      })

      const req = makeRequest(validBody)
      const res = await POST(req)
      const json = await res.json()

      expect(json.success).toBe(true)
      expect(json.fromCache).toBe(true)
      expect(json.segments).toEqual([{ text: 'cached', start: 0, end: 2 }])
      expect(json.fallbackReason).toBe('cache_hit')
    })

    it('processes fresh on cache miss', async () => {
      mockCacheGet.mockResolvedValue(null)

      const req = makeRequest(validBody)
      const res = await POST(req)
      const json = await res.json()

      expect(json.success).toBe(true)
      expect(json.fromCache).toBe(false)
      expect(json.source).toBe('deterministic')
    })
  })

  // -----------------------------------------------------------------------
  // Deterministic fallback always available
  // -----------------------------------------------------------------------

  describe('deterministic fallback', () => {
    it('falls back to deterministic when AI flag is on but AI fails', async () => {
      mockFeatureEnabled = true
      mockProcessTranscript.mockRejectedValue(new Error('AI down'))

      const req = makeRequest(validBody)
      const res = await POST(req)
      const json = await res.json()

      expect(json.success).toBe(true)
      expect(json.source).toBe('deterministic')
    })

    it('falls back to deterministic when AI times out', async () => {
      jest.useFakeTimers()

      try {
        mockFeatureEnabled = true
        // Simulate a hung call that never resolves
        mockProcessTranscript.mockImplementation(
          () => new Promise(() => {}) // never settles
        )

        const req = makeRequest(validBody)
        const responsePromise = POST(req)

        // Advance past the 15s timeout, flushing microtasks between timer ticks
        // so the handler's awaits resolve and reach the Promise.race
        await jest.advanceTimersByTimeAsync(16_000)

        const res = await responsePromise
        const json = await res.json()

        expect(json.success).toBe(true)
        expect(json.source).toBe('deterministic')
        expect(json.aiEnabled).toBe(true)
        expect(json.aiAttempted).toBe(true)
        expect(json.fallbackReason).toBe('ai_timeout')
        expect(mockProcessTranscript).toHaveBeenCalledTimes(1)
      } finally {
        jest.useRealTimers()
      }
    })
  })

  // -----------------------------------------------------------------------
  // Output shape
  // -----------------------------------------------------------------------

  describe('response shape', () => {
    it('includes all expected fields in success response', async () => {
      const req = makeRequest(validBody)
      const res = await POST(req)
      const json = await res.json()

      expect(json).toEqual(
        expect.objectContaining({
          success: true,
          segments: expect.any(Array),
        source: expect.any(String),
        fromCache: expect.any(Boolean),
        pipelineVersion: expect.any(String),
        segmentCount: expect.any(Number),
        processingTime: expect.any(Number),
        aiEnabled: expect.any(Boolean),
        aiAttempted: expect.any(Boolean),
      })
    )
  })

    it('segments have text, start, end', async () => {
      const req = makeRequest(validBody)
      const res = await POST(req)
      const json = await res.json()

      for (const seg of json.segments) {
        expect(seg).toHaveProperty('text')
        expect(seg).toHaveProperty('start')
        expect(seg).toHaveProperty('end')
        expect(typeof seg.text).toBe('string')
        expect(typeof seg.start).toBe('number')
        expect(typeof seg.end).toBe('number')
      }
    })
  })
})
