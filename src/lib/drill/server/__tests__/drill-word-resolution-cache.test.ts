import {
  normalizeKey,
  get,
  setResolved,
  setUnresolved,
  touchHit,
  type DrillWordResolutionResult,
  type DrillWordResolutionDoc,
} from '../drill-word-resolution-cache'

// ---------------------------------------------------------------------------
// Mock Firebase Admin
// ---------------------------------------------------------------------------

// Mutable store keyed by collection/docId
const mockStore: Record<string, Record<string, any>> = {}

const mockTimestamp = { toDate: () => new Date('2026-01-01T00:00:00Z'), _seconds: 1735689600, _nanoseconds: 0 }
let incrementCounter = 0

jest.mock('@/lib/firebase/admin', () => ({
  adminDb: null, // Tests always supply dbOverride
  Timestamp: {
    now: () => mockTimestamp,
  },
  FieldValue: {
    increment: (n: number) => {
      incrementCounter += n
      return `__increment_${n}__`
    },
  },
}))

// ---------------------------------------------------------------------------
// Firestore mock builder
// ---------------------------------------------------------------------------

function createMockFirestore(): any {
  // Reset the mock store for the default collection
  const COLLECTION = 'drill_word_resolutions'
  if (!mockStore[COLLECTION]) {
    mockStore[COLLECTION] = {}
  }

  return {
    collection: (name: string) => ({
      doc: (docId: string) => {
        const docPath = `${name}/${docId}`
        return {
          get: async () => {
            const data = mockStore[name]?.[docId]
            return {
              exists: !!data,
              data: () => data ? { ...data } : undefined,
              ref: {
                update: async (fields: any) => {
                  if (!mockStore[name]?.[docId]) {
                    throw new Error('NOT_FOUND')
                  }
                  mockStore[name][docId] = { ...mockStore[name][docId], ...fields }
                },
              },
            }
          },
          set: async (data: any, options?: { merge?: boolean }) => {
            if (options?.merge && mockStore[name]?.[docId]) {
              mockStore[name][docId] = { ...mockStore[name][docId], ...data }
            } else {
              if (!mockStore[name]) mockStore[name] = {}
              mockStore[name][docId] = { ...data }
            }
          },
          update: async (fields: any) => {
            if (!mockStore[name]?.[docId]) {
              throw new Error('NOT_FOUND')
            }
            mockStore[name][docId] = { ...mockStore[name][docId], ...fields }
          },
        }
      },
    }),
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  for (const key of Object.keys(mockStore)) {
    delete mockStore[key]
  }
  incrementCounter = 0
}

const SAMPLE_RESULT: DrillWordResolutionResult = {
  surface: '食べる',
  lemma: '食べる',
  reading: 'たべる',
  meaning: 'to eat',
  partOfSpeech: 'verb',
  conjugationType: 'Ichidan',
  confidence: 'high',
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('drill-word-resolution-cache', () => {
  beforeEach(() => {
    resetStore()
  })

  // =========================================================================
  // normalizeKey
  // =========================================================================

  describe('normalizeKey', () => {
    it('produces a deterministic SHA-256 hex string', () => {
      const key1 = normalizeKey('食べる')
      const key2 = normalizeKey('食べる')
      expect(key1).toBe(key2)
      expect(key1).toMatch(/^[0-9a-f]{64}$/)
    })

    it('trims whitespace before hashing', () => {
      expect(normalizeKey('  食べる  ')).toBe(normalizeKey('食べる'))
    })

    it('applies NFKC normalisation', () => {
      // Fullwidth 'A' (U+FF21) normalises to halfwidth 'a' via NFKC + lowercase
      expect(normalizeKey('\uFF21')).toBe(normalizeKey('A'))
    })

    it('lowercases input', () => {
      expect(normalizeKey('Taberu')).toBe(normalizeKey('taberu'))
    })

    it('produces different keys for different inputs', () => {
      expect(normalizeKey('食べる')).not.toBe(normalizeKey('飲む'))
    })
  })

  // =========================================================================
  // get — cache miss
  // =========================================================================

  describe('get', () => {
    it('returns null on cache miss', async () => {
      const db = createMockFirestore()
      const result = await get('nonexistent_word', db)
      expect(result).toBeNull()
    })

    it('returns null when db is null', async () => {
      const result = await get('anything', null as any)
      expect(result).toBeNull()
    })

    it('returns the cached document on hit', async () => {
      const db = createMockFirestore()
      const key = normalizeKey('食べる')

      // Manually seed the store
      mockStore['drill_word_resolutions'] = {
        [key]: {
          key,
          query: '食べる',
          result: SAMPLE_RESULT,
          source: 'ollama',
          status: 'resolved',
          cacheVersion: 1,
          hitCount: 3,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          lastUsedAt: mockTimestamp,
        } satisfies DrillWordResolutionDoc as any,
      }

      const doc = await get('食べる', db)
      expect(doc).not.toBeNull()
      expect(doc!.status).toBe('resolved')
      expect(doc!.result?.lemma).toBe('食べる')
      expect(doc!.hitCount).toBe(3)
    })

    it('returns unresolved entries too', async () => {
      const db = createMockFirestore()
      const key = normalizeKey('asdfghjkl')

      mockStore['drill_word_resolutions'] = {
        [key]: {
          key,
          query: 'asdfghjkl',
          result: null,
          source: 'openai',
          status: 'unresolved',
          cacheVersion: 1,
          hitCount: 1,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          lastUsedAt: mockTimestamp,
        } satisfies DrillWordResolutionDoc as any,
      }

      const doc = await get('asdfghjkl', db)
      expect(doc).not.toBeNull()
      expect(doc!.status).toBe('unresolved')
      expect(doc!.result).toBeNull()
    })
  })

  // =========================================================================
  // setResolved
  // =========================================================================

  describe('setResolved', () => {
    it('writes a resolved entry to Firestore', async () => {
      const db = createMockFirestore()

      await setResolved('食べる', SAMPLE_RESULT, 'ollama', db)

      const key = normalizeKey('食べる')
      const stored = mockStore['drill_word_resolutions']?.[key]

      expect(stored).toBeDefined()
      expect(stored.status).toBe('resolved')
      expect(stored.source).toBe('ollama')
      expect(stored.result.surface).toBe('食べる')
      expect(stored.result.reading).toBe('たべる')
      expect(stored.cacheVersion).toBe(1)
      expect(stored.hitCount).toBe(1)
    })

    it('does not write undefined fields into result', async () => {
      const db = createMockFirestore()
      const resultWithOptionals: DrillWordResolutionResult = {
        surface: '飲む',
        lemma: '飲む',
        reading: 'のむ',
        meaning: undefined,
        partOfSpeech: 'verb',
        conjugationType: 'Godan',
        confidence: 'medium',
        alternatives: undefined,
        notes: undefined,
      }

      await setResolved('飲む', resultWithOptionals, 'openai', db)

      const key = normalizeKey('飲む')
      const stored = mockStore['drill_word_resolutions']?.[key]

      expect(stored).toBeDefined()
      expect(stored.result).not.toHaveProperty('meaning')
      expect(stored.result).not.toHaveProperty('alternatives')
      expect(stored.result).not.toHaveProperty('notes')
      expect(stored.result.reading).toBe('のむ')
    })

    it('is a no-op when db is null', async () => {
      // Should not throw
      await setResolved('食べる', SAMPLE_RESULT, 'ollama', null as any)
    })
  })

  // =========================================================================
  // setUnresolved
  // =========================================================================

  describe('setUnresolved', () => {
    it('writes an unresolved entry with null result', async () => {
      const db = createMockFirestore()

      await setUnresolved('xyzzy', 'openai', db)

      const key = normalizeKey('xyzzy')
      const stored = mockStore['drill_word_resolutions']?.[key]

      expect(stored).toBeDefined()
      expect(stored.status).toBe('unresolved')
      expect(stored.result).toBeNull()
      expect(stored.source).toBe('openai')
      expect(stored.cacheVersion).toBe(1)
    })

    it('is a no-op when db is null', async () => {
      await setUnresolved('xyzzy', 'openai', null as any)
    })
  })

  // =========================================================================
  // touchHit
  // =========================================================================

  describe('touchHit', () => {
    it('increments hitCount and updates timestamps', async () => {
      const db = createMockFirestore()

      // Seed an entry first
      const key = normalizeKey('食べる')
      mockStore['drill_word_resolutions'] = {
        [key]: {
          key,
          query: '食べる',
          result: SAMPLE_RESULT,
          source: 'ollama',
          status: 'resolved',
          cacheVersion: 1,
          hitCount: 5,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          lastUsedAt: mockTimestamp,
        },
      }

      await touchHit('食べる', db)

      const stored = mockStore['drill_word_resolutions']?.[key]
      // FieldValue.increment returns a sentinel; in real Firestore it atomically increments.
      // In our mock it stores the sentinel string.
      expect(stored.hitCount).toBe('__increment_1__')
      expect(stored.lastUsedAt).toBe(mockTimestamp)
      expect(stored.updatedAt).toBe(mockTimestamp)
    })

    it('does not throw when document is missing', async () => {
      const db = createMockFirestore()
      // touchHit on a non-existent key should not throw (swallowed)
      await expect(touchHit('nonexistent', db)).resolves.toBeUndefined()
    })

    it('is a no-op when db is null', async () => {
      await touchHit('anything', null as any)
    })
  })

  // =========================================================================
  // Write + read roundtrip
  // =========================================================================

  describe('roundtrip', () => {
    it('setResolved then get returns the same data', async () => {
      const db = createMockFirestore()

      await setResolved('走る', {
        surface: '走る',
        lemma: '走る',
        reading: 'はしる',
        meaning: 'to run',
        partOfSpeech: 'verb',
        conjugationType: 'Godan',
        confidence: 'high',
        notes: 'u-verb',
      }, 'ollama', db)

      const doc = await get('走る', db)
      expect(doc).not.toBeNull()
      expect(doc!.status).toBe('resolved')
      expect(doc!.result!.lemma).toBe('走る')
      expect(doc!.result!.reading).toBe('はしる')
      expect(doc!.result!.conjugationType).toBe('Godan')
      expect(doc!.result!.notes).toBe('u-verb')
      expect(doc!.source).toBe('ollama')
    })

    it('setUnresolved then get returns unresolved doc', async () => {
      const db = createMockFirestore()

      await setUnresolved('gibberish', 'openai', db)

      const doc = await get('gibberish', db)
      expect(doc).not.toBeNull()
      expect(doc!.status).toBe('unresolved')
      expect(doc!.result).toBeNull()
    })
  })

  // =========================================================================
  // Overwrite preservation (createdAt, hitCount)
  // =========================================================================

  describe('overwrite preservation', () => {
    const oldTimestamp = { toDate: () => new Date('2025-06-01T00:00:00Z'), _seconds: 1717200000, _nanoseconds: 0 }

    it('setResolved preserves createdAt and hitCount when doc already exists', async () => {
      const db = createMockFirestore()
      const key = normalizeKey('食べる')

      // Seed an existing entry with history
      mockStore['drill_word_resolutions'] = {
        [key]: {
          key,
          query: '食べる',
          result: SAMPLE_RESULT,
          source: 'ollama',
          status: 'resolved',
          cacheVersion: 1,
          hitCount: 42,
          createdAt: oldTimestamp,
          updatedAt: oldTimestamp,
          lastUsedAt: oldTimestamp,
        },
      }

      // Re-resolve with updated result
      const updatedResult: DrillWordResolutionResult = {
        ...SAMPLE_RESULT,
        meaning: 'to eat (updated)',
      }
      await setResolved('食べる', updatedResult, 'openai', db)

      const stored = mockStore['drill_word_resolutions']?.[key]
      expect(stored.hitCount).toBe(42)           // preserved
      expect(stored.createdAt).toBe(oldTimestamp) // preserved
      expect(stored.updatedAt).toBe(mockTimestamp)  // refreshed
      expect(stored.result.meaning).toBe('to eat (updated)')
      expect(stored.source).toBe('openai')       // updated to new provider
    })

    it('setResolved uses defaults when doc does not exist', async () => {
      const db = createMockFirestore()

      await setResolved('新しい', {
        surface: '新しい',
        lemma: '新しい',
        reading: 'あたらしい',
        meaning: 'new',
        partOfSpeech: 'i-adjective',
        conjugationType: 'i-adjective',
        confidence: 'high',
      }, 'ollama', db)

      const key = normalizeKey('新しい')
      const stored = mockStore['drill_word_resolutions']?.[key]
      expect(stored.hitCount).toBe(1)
      expect(stored.createdAt).toBe(mockTimestamp)
    })

    it('setUnresolved preserves createdAt and hitCount when doc already exists', async () => {
      const db = createMockFirestore()
      const key = normalizeKey('xyzzy')

      mockStore['drill_word_resolutions'] = {
        [key]: {
          key,
          query: 'xyzzy',
          result: null,
          source: 'ollama',
          status: 'unresolved',
          cacheVersion: 1,
          hitCount: 10,
          createdAt: oldTimestamp,
          updatedAt: oldTimestamp,
          lastUsedAt: oldTimestamp,
        },
      }

      await setUnresolved('xyzzy', 'openai', db)

      const stored = mockStore['drill_word_resolutions']?.[key]
      expect(stored.hitCount).toBe(10)            // preserved
      expect(stored.createdAt).toBe(oldTimestamp)  // preserved
      expect(stored.updatedAt).toBe(mockTimestamp)   // refreshed
      expect(stored.source).toBe('openai')
    })
  })

  // =========================================================================
  // Key normalisation edge cases
  // =========================================================================

  describe('normalizeKey edge cases', () => {
    it('handles empty string', () => {
      const key = normalizeKey('')
      expect(key).toMatch(/^[0-9a-f]{64}$/)
    })

    it('handles mixed Japanese and English', () => {
      const key = normalizeKey('食べる eat')
      expect(key).toMatch(/^[0-9a-f]{64}$/)
    })

    it('normalizes katakana equivalents via NFKC', () => {
      // Halfwidth katakana ﾀﾍﾞﾙ → fullwidth タベル via NFKC
      const halfwidth = normalizeKey('ﾀﾍﾞﾙ')
      const fullwidth = normalizeKey('タベル')
      expect(halfwidth).toBe(fullwidth)
    })
  })
})
