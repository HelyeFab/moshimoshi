import { buildRound2TestSequence, type TestType } from '../testOrder'
import type { KanjiWithExamples } from '../LearnContent'

const makeKanji = (overrides: Partial<KanjiWithExamples> = {}): KanjiWithExamples => ({
  kanji: '日',
  meaning: 'sun',
  meanings: ['sun'],
  onyomi: ['ニチ'],
  kunyomi: ['ひ'],
  jlpt: 'N5',
  strokeCount: 4,
  examples: [],
  ...overrides
})

const makeRng = (seed: number) => {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

const hasAdjacentOnKun = (order: TestType[]) => {
  for (let i = 0; i < order.length - 1; i += 1) {
    const a = order[i]
    const b = order[i + 1]
    if ((a === 'onyomi' && b === 'kunyomi') || (a === 'kunyomi' && b === 'onyomi')) {
      return true
    }
  }
  return false
}

describe('buildRound2TestSequence', () => {
  it('returns only meaning + recognition when readings are missing', () => {
    const kanji = makeKanji({ onyomi: [], kunyomi: [] })
    const tests = buildRound2TestSequence(kanji, { rng: makeRng(1) })
    const types = tests.map(test => test.type)

    expect(types).toEqual(expect.arrayContaining(['meaning', 'recognition']))
    expect(types).not.toContain('onyomi')
    expect(types).not.toContain('kunyomi')
    expect(types.length).toBe(2)
  })

  it('avoids on/kun adjacency when constraint is enabled', () => {
    const kanji = makeKanji()
    const tests = buildRound2TestSequence(kanji, {
      rng: makeRng(7),
      forbidOnKunAdjacency: true
    })
    const types = tests.map(test => test.type)

    expect(hasAdjacentOnKun(types)).toBe(false)
  })

  it('avoids starting with last test type for session-level de-clumping', () => {
    const kanji = makeKanji()
    const tests = buildRound2TestSequence(kanji, {
      rng: makeRng(42),
      lastTestType: 'meaning'
    })

    expect(tests[0].type).not.toBe('meaning')
  })

  it('is deterministic with the same seeded RNG', () => {
    const kanji = makeKanji()
    const testsA = buildRound2TestSequence(kanji, {
      rng: makeRng(123),
      forbidOnKunAdjacency: true,
      lastTestType: 'recognition'
    })
    const testsB = buildRound2TestSequence(kanji, {
      rng: makeRng(123),
      forbidOnKunAdjacency: true,
      lastTestType: 'recognition'
    })

    expect(testsA.map(test => test.type)).toEqual(testsB.map(test => test.type))
  })

  it('falls back to rotation when maxShuffleAttempts is zero', () => {
    const kanji = makeKanji({ onyomi: [], kunyomi: [] })
    const tests = buildRound2TestSequence(kanji, {
      rng: makeRng(5),
      lastTestType: 'meaning',
      maxShuffleAttempts: 0
    })

    expect(tests).toHaveLength(2)
    expect(tests[0].type).not.toBe('meaning')
  })

  it('excludes only the missing reading type when one reading is absent', () => {
    const kanji = makeKanji({ kunyomi: [] })
    const tests = buildRound2TestSequence(kanji, { rng: makeRng(3) })
    const types = tests.map(test => test.type)

    expect(types).toEqual(expect.arrayContaining(['meaning', 'onyomi', 'recognition']))
    expect(types).not.toContain('kunyomi')
  })

  it('returns empty array when no valid tests are available', () => {
    const kanji = makeKanji({ meaning: '', meanings: [], onyomi: [], kunyomi: [] })
    const tests = buildRound2TestSequence(kanji, { rng: makeRng(9) })

    expect(tests).toEqual([])
  })

  it('satisfies constraints across many runs', () => {
    const kanji = makeKanji()

    for (let i = 0; i < 100; i += 1) {
      const tests = buildRound2TestSequence(kanji, {
        forbidOnKunAdjacency: true,
        lastTestType: 'meaning',
        rng: makeRng(i + 1)
      })
      const types = tests.map(test => test.type)

      expect(types[0]).not.toBe('meaning')
      expect(hasAdjacentOnKun(types)).toBe(false)
    }
  })
})
