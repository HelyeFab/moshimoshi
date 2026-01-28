import { KanjiWithExamples } from './LearnContent'

export type TestType = 'meaning' | 'onyomi' | 'kunyomi' | 'recognition'

export interface TestDefinition {
  type: TestType
  question: string
  answer: string | string[]
}

export interface TestOrderOptions {
  /** Override RNG for deterministic testing (default: Math.random). */
  rng?: () => number
  /** Last test type from previous kanji for session-level de-clumping (Option C). */
  lastTestType?: TestType | null
  /** Prevent adjacent onyomi/kunyomi tests if true (default: false). */
  forbidOnKunAdjacency?: boolean
  /** Max shuffle attempts before fallback rotation (default: 25). */
  maxShuffleAttempts?: number
  /** Optional localized question overrides keyed by test type. */
  questionOverrides?: Partial<Record<TestType, string>>
}

const hasAdjacentOnKun = (order: TestType[]): boolean => {
  for (let i = 0; i < order.length - 1; i += 1) {
    const a = order[i]
    const b = order[i + 1]
    if ((a === 'onyomi' && b === 'kunyomi') || (a === 'kunyomi' && b === 'onyomi')) {
      return true
    }
  }
  return false
}

const shuffleWithRng = <T,>(items: T[], rng: () => number): T[] => {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const rotateToAvoidFirst = (order: TestType[], forbiddenFirst?: TestType | null): TestType[] => {
  if (!forbiddenFirst || order.length <= 1) return order
  if (order[0] !== forbiddenFirst) return order
  const rotated = [...order.slice(1), order[0]]
  return rotated
}

const isValidOrder = (
  order: TestType[],
  lastTestType: TestType | null | undefined,
  forbidOnKunAdjacency: boolean
): boolean => {
  if (order.length === 0) return false
  if (lastTestType && order[0] === lastTestType) return false
  if (forbidOnKunAdjacency && hasAdjacentOnKun(order)) return false
  return true
}

/**
 * Build a randomized test sequence for Round 2 of Kanji Mastery.
 *
 * @param kanji - The kanji to generate tests for.
 * @param options - Randomization and constraint options.
 * @returns Array of test definitions in the decided order.
 *
 * @example
 * const tests = buildRound2TestSequence(kanji, {
 *   forbidOnKunAdjacency: true,
 *   lastTestType: 'meaning'
 * })
 */
export function buildRound2TestSequence(
  kanji: KanjiWithExamples,
  options: TestOrderOptions = {}
): TestDefinition[] {
  const rng = options.rng ?? Math.random
  const lastTestType = options.lastTestType ?? null
  const forbidOnKunAdjacency = options.forbidOnKunAdjacency ?? false
  const maxShuffleAttempts = options.maxShuffleAttempts ?? 25 // 25 attempts is ample for <=4 tests with constraints.
  const questionOverrides = options.questionOverrides ?? {}

  const baseTests: TestDefinition[] = [
    {
      type: 'meaning',
      question: questionOverrides.meaning ?? `What is the meaning of ${kanji.kanji}?`,
      answer: kanji.meaning.toLowerCase()
    },
    {
      type: 'onyomi',
      question: questionOverrides.onyomi ?? `What is the on'yomi reading of ${kanji.kanji}?`,
      answer: kanji.onyomi || []
    },
    {
      type: 'kunyomi',
      question: questionOverrides.kunyomi ?? `What is the kun'yomi reading of ${kanji.kanji}?`,
      answer: kanji.kunyomi || []
    },
    {
      type: 'recognition',
      question: questionOverrides.recognition ?? `Which kanji means "${kanji.meaning}"?`,
      answer: kanji.kanji
    }
  ]

  const hasMeaning = Boolean(kanji.meaning && kanji.meaning.trim().length > 0)
  const availableTypes = baseTests
    .filter(test => {
      if (!hasMeaning && (test.type === 'meaning' || test.type === 'recognition')) return false
      if (test.type === 'onyomi' && (!kanji.onyomi || kanji.onyomi.length === 0)) return false
      if (test.type === 'kunyomi' && (!kanji.kunyomi || kanji.kunyomi.length === 0)) return false
      return true
    })
    .map(test => test.type)

  if (availableTypes.length === 0) {
    return []
  }

  let attempt = 0
  let order = [...availableTypes]

  while (attempt < maxShuffleAttempts) {
    const shuffled = shuffleWithRng(order, rng)
    if (isValidOrder(shuffled, lastTestType, forbidOnKunAdjacency)) {
      order = shuffled
      break
    }
    attempt += 1
  }

  // Fallback: rotate to avoid first-test repetition, even if adjacency remains.
  // This guarantees a stable sequence even if constraints cannot be satisfied.
  order = rotateToAvoidFirst(order, lastTestType)

  // Build final test objects in the decided order
  const testByType = new Map<TestType, TestDefinition>(baseTests.map(test => [test.type, test]))
  return order
    .map(type => testByType.get(type))
    .filter((test): test is TestDefinition => Boolean(test))
}
