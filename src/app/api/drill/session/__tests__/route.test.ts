import { NextRequest } from 'next/server'
import { POST } from '../route'
import { requireAuth } from '@/lib/auth/session'
import { adminDb } from '@/lib/firebase/admin'
import { evaluateFeatureAccess } from '@/lib/entitlements/server'
import { QuestionGenerator } from '@/lib/drill/question-generator'
import { WordUtils } from '@/lib/drill/word-utils'
import { searchJMdictWords } from '@/utils/jmdictLocalSearch'
import { detectWordType } from '@/lib/conjugation/wordTypeDetector'
import * as resolutionCache from '@/lib/drill/server/drill-word-resolution-cache'
import { DrillWordResolverProcessorHybrid } from '@/lib/ai/processors/DrillWordResolverProcessorHybrid'

jest.mock('@/lib/auth/session', () => ({
  requireAuth: jest.fn(),
  getSession: jest.fn(),
}))

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: { collection: jest.fn() },
}))

jest.mock('@/lib/entitlements/server', () => ({
  evaluateFeatureAccess: jest.fn(),
}))

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    increment: jest.fn((value: number) => ({ __increment: value })),
    serverTimestamp: jest.fn(() => 'mock-server-timestamp'),
  },
}))

jest.mock('@/lib/drill/question-generator', () => ({
  QuestionGenerator: {
    generateQuestions: jest.fn(),
    generateQuestionsForWord: jest.fn(),
  },
}))

jest.mock('@/lib/drill/word-utils', () => ({
  WordUtils: {
    isConjugable: jest.fn(),
    getCommonPracticeWords: jest.fn(),
    filterByType: jest.fn(),
  },
}))

jest.mock('@/utils/jmdictLocalSearch', () => ({
  getConjugatableWordsPractice: jest.fn(),
  searchJMdictWords: jest.fn(),
}))

jest.mock('@/lib/conjugation/wordTypeDetector', () => ({
  detectWordType: jest.fn(),
}))

jest.mock('@/lib/drill/server/drill-word-resolution-cache', () => ({
  get: jest.fn(),
  setResolved: jest.fn(),
  setUnresolved: jest.fn(),
  touchHit: jest.fn(),
}))

jest.mock('@/lib/ai/processors/DrillWordResolverProcessorHybrid', () => ({
  DrillWordResolverProcessorHybrid: jest.fn(),
}))

const mockedRequireAuth = requireAuth as jest.Mock
const mockedAdminDb = adminDb as unknown as { collection: jest.Mock }
const mockedEvaluateFeatureAccess = evaluateFeatureAccess as jest.Mock
const mockedQuestionGenerator = QuestionGenerator as unknown as {
  generateQuestionsForWord: jest.Mock
}
const mockedWordUtils = WordUtils as unknown as {
  isConjugable: jest.Mock
}
const mockedSearchJMdictWords = searchJMdictWords as jest.Mock
const mockedDetectWordType = detectWordType as jest.Mock
const mockedCacheGet = resolutionCache.get as jest.Mock
const mockedCacheSetResolved = resolutionCache.setResolved as jest.Mock
const mockedCacheSetUnresolved = resolutionCache.setUnresolved as jest.Mock
const mockedCacheTouchHit = resolutionCache.touchHit as jest.Mock
const MockedProcessorHybrid = DrillWordResolverProcessorHybrid as jest.Mock

function setupFirestoreMocks(plan: 'free' | 'premium_monthly' | 'premium_yearly' = 'free') {
  const userGet = jest.fn().mockResolvedValue({ data: () => ({ subscription: { plan } }) })
  const drillSessionSet = jest.fn().mockResolvedValue(undefined)
  const usageSet = jest.fn().mockResolvedValue(undefined)

  mockedAdminDb.collection.mockImplementation((collectionName: string) => {
    if (collectionName === 'users') {
      return {
        doc: jest.fn(() => ({
          get: userGet,
          collection: jest.fn((subCollectionName: string) => {
            if (subCollectionName !== 'usage') {
              throw new Error(`Unexpected users subcollection: ${subCollectionName}`)
            }
            return {
              doc: jest.fn(() => ({
                set: usageSet,
              })),
            }
          }),
        })),
      }
    }

    if (collectionName === 'drill_sessions') {
      return {
        doc: jest.fn(() => ({
          set: drillSessionSet,
        })),
      }
    }

    throw new Error(`Unexpected collection: ${collectionName}`)
  })

  return { userGet, drillSessionSet, usageSet }
}

function mockEntitlementAllowed() {
  mockedEvaluateFeatureAccess.mockResolvedValue({
    decision: { allow: true, limit: 10, remaining: 9 },
    currentUsage: 1,
    bucketKey: 'conjugation_drill_2026-02-25',
  })
}

function buildQuestion() {
  return [
    {
      id: 'q1',
      word: {
        id: 'w1',
        kanji: '食べる',
        kana: 'たべる',
        meaning: 'to eat',
        type: 'Ichidan',
      },
      targetForm: 'past',
      stem: 'Conjugate',
      correctAnswer: '食べた',
      options: ['食べた', '食べて', '食べない', '食べる'],
    },
  ]
}

describe('/api/drill/session POST', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedDetectWordType.mockReturnValue({
      isConjugatable: false,
      conjugationType: null,
    })
    // Default: cache miss, no AI
    mockedCacheGet.mockResolvedValue(null)
    mockedCacheSetResolved.mockResolvedValue(undefined)
    mockedCacheSetUnresolved.mockResolvedValue(undefined)
    mockedCacheTouchHit.mockResolvedValue(undefined)
    MockedProcessorHybrid.mockImplementation(() => ({
      process: jest.fn().mockRejectedValue(new Error('No AI mock configured')),
    }))
  })

  it('returns 403 when entitlement denies', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    mockedEvaluateFeatureAccess.mockResolvedValueOnce({
      decision: { allow: false, remaining: 0, reason: 'limit_reached', limit: 5 },
      currentUsage: 5,
      bucketKey: 'conjugation_drill_2025-12-26',
    })

    setupFirestoreMocks('free')

    const request = new NextRequest('http://localhost/api/drill/session', {
      method: 'POST',
      body: JSON.stringify({ mode: 'random', wordTypeFilter: 'all' }),
    })

    const response = await POST(request)
    expect(response.status).toBe(403)
  })

  it('uses the exact selected focus word entry and skips server re-search', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    setupFirestoreMocks('free')
    mockEntitlementAllowed()
    mockedWordUtils.isConjugable.mockReturnValue(true)
    mockedQuestionGenerator.generateQuestionsForWord.mockResolvedValue(buildQuestion())

    const request = new NextRequest('http://localhost/api/drill/session', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'focus',
        wordTypeFilter: 'all',
        questionsCount: 5,
        focusWord: 'かえる',
        focusWordSelection: {
          id: 'jmdict-2',
          kanji: '帰る',
          kana: 'かえる',
          meaning: 'to return',
          type: 'Godan',
          partsOfSpeech: ['Godan verb - -ru'],
        },
      }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockedSearchJMdictWords).not.toHaveBeenCalled()
    expect(mockedQuestionGenerator.generateQuestionsForWord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'jmdict-2',
        kanji: '帰る',
        kana: 'かえる',
        type: 'Godan',
      }),
      5,
      undefined
    )
    expect(data.success).toBe(true)
    expect(data.data.session.mode).toBe('focus')
  })

  it('falls back to server search when no selected focus word is provided', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    setupFirestoreMocks('free')
    mockEntitlementAllowed()
    mockedSearchJMdictWords.mockResolvedValue([
      {
        id: 'n1',
        kanji: '橋',
        kana: 'はし',
        meaning: 'bridge',
        type: 'noun',
        partsOfSpeech: ['n'],
      },
      {
        id: 'v1',
        kanji: '走る',
        kana: 'はしる',
        meaning: 'to run',
        type: 'verb',
        partsOfSpeech: ['v5r'],
      },
    ])
    mockedDetectWordType
      .mockReturnValueOnce({ isConjugatable: false, conjugationType: null })
      .mockReturnValueOnce({ isConjugatable: true, conjugationType: 'Godan' })
    mockedQuestionGenerator.generateQuestionsForWord.mockResolvedValue(buildQuestion())

    const request = new NextRequest('http://localhost/api/drill/session', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'focus',
        wordTypeFilter: 'all',
        focusWord: 'はしる',
      }),
    })

    const response = await POST(request)

    expect(response.status).toBe(200)
    expect(mockedSearchJMdictWords).toHaveBeenCalledWith('はしる', 5)
    expect(mockedDetectWordType).toHaveBeenCalledWith('橋', 'はし', ['n'])
    expect(mockedDetectWordType).toHaveBeenCalledWith('走る', 'はしる', ['v5r'])
    expect(mockedQuestionGenerator.generateQuestionsForWord).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'v1',
        kanji: '走る',
        kana: 'はしる',
        type: 'Godan',
      }),
      10,
      undefined
    )
  })

  // ============================================
  // JMdict Confidence Gating
  // ============================================

  it('skips low-confidence JMdict match and falls through to cache/AI', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    setupFirestoreMocks('free')
    mockEntitlementAllowed()
    // JMdict returns a match, but detectWordType gives low confidence
    mockedSearchJMdictWords.mockResolvedValue([
      {
        id: 'v-ambig',
        kanji: '切る',
        kana: 'きる',
        meaning: 'to cut',
        type: 'verb',
        partsOfSpeech: ['v5r'],
      },
    ])
    mockedDetectWordType.mockReturnValue({
      isConjugatable: true,
      conjugationType: 'Godan',
      confidence: 'low',
    })
    // Cache has the resolved word
    mockedCacheGet.mockResolvedValue({
      key: 'kiru-hash',
      query: '切る',
      status: 'resolved',
      result: {
        surface: '切る',
        lemma: '切る',
        reading: 'きる',
        meaning: 'to cut',
        partOfSpeech: 'verb',
        conjugationType: 'Godan',
        confidence: 'high',
      },
      source: 'openai',
      cacheVersion: 1,
      hitCount: 1,
      createdAt: {} as any,
      updatedAt: {} as any,
      lastUsedAt: {} as any,
    })
    mockedQuestionGenerator.generateQuestionsForWord.mockResolvedValue(buildQuestion())

    const request = new NextRequest('http://localhost/api/drill/session', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'focus',
        wordTypeFilter: 'all',
        focusWord: '切る',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    // JMdict was searched but low-confidence result was skipped
    expect(mockedSearchJMdictWords).toHaveBeenCalledWith('切る', 5)
    expect(mockedDetectWordType).toHaveBeenCalled()
    // Fell through to cache
    expect(mockedCacheGet).toHaveBeenCalledWith('切る')
    expect(mockedCacheTouchHit).toHaveBeenCalledWith('切る')
  })

  // ============================================
  // Firebase Cache Integration Tests
  // ============================================

  it('uses cached resolved word when JMdict has no match', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    setupFirestoreMocks('free')
    mockEntitlementAllowed()
    mockedSearchJMdictWords.mockResolvedValue([]) // No JMdict match
    mockedCacheGet.mockResolvedValue({
      key: 'abc12345rest',
      query: '食べる',
      status: 'resolved',
      result: {
        surface: '食べる',
        lemma: '食べる',
        reading: 'たべる',
        meaning: 'to eat',
        partOfSpeech: 'verb',
        conjugationType: 'Ichidan',
        confidence: 'high',
      },
      source: 'openai',
      cacheVersion: 1,
      hitCount: 3,
      createdAt: {} as any,
      updatedAt: {} as any,
      lastUsedAt: {} as any,
    })
    mockedQuestionGenerator.generateQuestionsForWord.mockResolvedValue(buildQuestion())

    const request = new NextRequest('http://localhost/api/drill/session', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'focus',
        wordTypeFilter: 'all',
        focusWord: '食べる',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(mockedCacheGet).toHaveBeenCalledWith('食べる')
    expect(mockedCacheTouchHit).toHaveBeenCalledWith('食べる')
    // AI should not have been called
    const processorInstance = MockedProcessorHybrid.mock.results[0]
    expect(processorInstance).toBeUndefined() // Processor never instantiated
  })

  it('returns 400 for cached unresolved word', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    setupFirestoreMocks('free')
    mockEntitlementAllowed()
    mockedSearchJMdictWords.mockResolvedValue([])
    mockedCacheGet.mockResolvedValue({
      key: 'def67890rest',
      query: 'テーブル',
      status: 'unresolved',
      result: null,
      source: 'openai',
      cacheVersion: 1,
      hitCount: 1,
      createdAt: {} as any,
      updatedAt: {} as any,
      lastUsedAt: {} as any,
    })

    const request = new NextRequest('http://localhost/api/drill/session', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'focus',
        wordTypeFilter: 'all',
        focusWord: 'テーブル',
      }),
    })

    const response = await POST(request)
    const data = await response.json()
    expect(response.status).toBe(400)
    expect(data.error.code).toBe('NOT_CONJUGATABLE')
  })

  // ============================================
  // AI Resolution Integration Tests
  // ============================================

  it('resolves via AI when JMdict and cache miss, then caches result', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    setupFirestoreMocks('free')
    mockEntitlementAllowed()
    mockedSearchJMdictWords.mockResolvedValue([])
    mockedCacheGet.mockResolvedValue(null) // Cache miss

    const mockProcess = jest.fn().mockResolvedValue({
      data: {
        surface: '食べる',
        lemma: '食べる',
        reading: 'たべる',
        meaning: 'to eat',
        partOfSpeech: 'verb',
        conjugationType: 'Ichidan',
        confidence: 'high',
        alternatives: null,
        notes: null,
      },
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, estimatedCost: 0.001 },
      metadata: { provider: 'openai' },
    })
    MockedProcessorHybrid.mockImplementation(() => ({ process: mockProcess }))
    mockedQuestionGenerator.generateQuestionsForWord.mockResolvedValue(buildQuestion())

    const request = new NextRequest('http://localhost/api/drill/session', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'focus',
        wordTypeFilter: 'all',
        focusWord: '食べる',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(mockProcess).toHaveBeenCalledWith({ word: '食べる' })
    // Should write to cache
    expect(mockedCacheSetResolved).toHaveBeenCalledWith(
      '食べる',
      expect.objectContaining({
        lemma: '食べる',
        reading: 'たべる',
        conjugationType: 'Ichidan',
      }),
      'openai'
    )
  })

  it('returns 400 when AI returns low confidence', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    setupFirestoreMocks('free')
    mockEntitlementAllowed()
    mockedSearchJMdictWords.mockResolvedValue([])
    mockedCacheGet.mockResolvedValue(null)

    const mockProcess = jest.fn().mockResolvedValue({
      data: {
        surface: 'あれ',
        lemma: 'あれ',
        reading: 'あれ',
        meaning: 'that',
        partOfSpeech: 'pronoun' as any,
        conjugationType: null,
        confidence: 'low',
        alternatives: null,
        notes: null,
      },
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, estimatedCost: 0.001 },
      metadata: { provider: 'openai' },
    })
    MockedProcessorHybrid.mockImplementation(() => ({ process: mockProcess }))

    const request = new NextRequest('http://localhost/api/drill/session', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'focus',
        wordTypeFilter: 'all',
        focusWord: 'あれ',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    // Should NOT cache low confidence results
    expect(mockedCacheSetResolved).not.toHaveBeenCalled()
    expect(mockedCacheSetUnresolved).not.toHaveBeenCalled()
  })

  it('returns 400 and caches unresolved when AI identifies non-conjugatable word', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    setupFirestoreMocks('free')
    mockEntitlementAllowed()
    mockedSearchJMdictWords.mockResolvedValue([])
    mockedCacheGet.mockResolvedValue(null)

    const mockProcess = jest.fn().mockResolvedValue({
      data: {
        surface: '学校',
        lemma: '学校',
        reading: 'がっこう',
        meaning: 'school',
        partOfSpeech: 'noun',
        conjugationType: null,
        confidence: 'high',
        alternatives: null,
        notes: null,
      },
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150, estimatedCost: 0.001 },
      metadata: { provider: 'ollama' },
    })
    MockedProcessorHybrid.mockImplementation(() => ({ process: mockProcess }))

    const request = new NextRequest('http://localhost/api/drill/session', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'focus',
        wordTypeFilter: 'all',
        focusWord: '学校',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    // Should cache as unresolved
    expect(mockedCacheSetUnresolved).toHaveBeenCalledWith('学校', 'ollama')
  })

  it('returns 400 when AI call fails entirely', async () => {
    mockedRequireAuth.mockResolvedValue({ uid: 'user-1' })
    setupFirestoreMocks('free')
    mockEntitlementAllowed()
    mockedSearchJMdictWords.mockResolvedValue([])
    mockedCacheGet.mockResolvedValue(null)

    const mockProcess = jest.fn().mockRejectedValue(new Error('All providers down'))
    MockedProcessorHybrid.mockImplementation(() => ({ process: mockProcess }))

    const request = new NextRequest('http://localhost/api/drill/session', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'focus',
        wordTypeFilter: 'all',
        focusWord: 'なんか',
      }),
    })

    const response = await POST(request)
    expect(response.status).toBe(400)
    // Should not cache on transient failure
    expect(mockedCacheSetResolved).not.toHaveBeenCalled()
    expect(mockedCacheSetUnresolved).not.toHaveBeenCalled()
  })
})
