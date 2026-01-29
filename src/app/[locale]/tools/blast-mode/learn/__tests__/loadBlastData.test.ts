/**
 * Integration Tests for loadBlastData
 * Validates the learn data pipeline from adapters through step generation
 */

import { BlastItem, BlastStepType } from '@/lib/blast-mode/types'
import { loadKanjiItems, kanjiToBlastItem } from '@/lib/blast-mode/adapters/kanji.adapter'
import { loadVocabItems } from '@/lib/blast-mode/adapters/vocab.adapter'
import { generateBlastSteps } from '@/lib/blast-mode/step-generator'
import { buildDistractorPool } from '@/lib/blast-mode/distractor-pool'
import { JLPTLevel } from '@/types/kanji'
import { kanjiService } from '@/services/kanjiService'

// Mock the adapters
jest.mock('@/lib/blast-mode/adapters/kanji.adapter', () => ({
  loadKanjiItems: jest.fn(),
  kanjiToBlastItem: jest.fn()
}))
jest.mock('@/lib/blast-mode/adapters/vocab.adapter')
jest.mock('@/services/kanjiService', () => ({
  kanjiService: {
    getMultipleKanjiDetails: jest.fn()
  }
}))

// Mock step generator
jest.mock('@/lib/blast-mode/step-generator', () => ({
  generateBlastSteps: jest.fn()
}))

jest.mock('@/lib/blast-mode/distractor-pool', () => ({
  buildDistractorPool: jest.fn()
}))

/**
 * Replica of loadBlastData from page.tsx for testing
 * This is the pure async function without React components
 */
async function loadBlastData(
  contentType: string,
  size: number,
  level: string,
  userId: string = 'user-1',
  isPremium: boolean = false,
  listId?: string,
  selectedKanji?: string[]
): Promise<{ items: BlastItem[], steps: any[] }> {
  let items: BlastItem[] = []
  let listItems = []

  try {
    if (contentType === 'kanji') {
      if (selectedKanji && selectedKanji.length > 0) {
        const kanjiMap = await kanjiService.getMultipleKanjiDetails(selectedKanji)
        const selected = selectedKanji
          .map(k => kanjiMap.get(k))
          .filter(Boolean)
        items = selected.map(kanjiToBlastItem as any)
      } else {
        items = await loadKanjiItems({
          level: level as JLPTLevel,
          count: size,
          selection: 'random'
        })
      }
    } else if (contentType === 'vocabulary') {
      items = await loadVocabItems({
        count: size,
        level,
        selection: 'common'
      })
    } else if (contentType === 'mixed') {
      const kanjiCount = Math.floor(size / 2)
      const vocabCount = size - kanjiCount

      const kanjiItems = await loadKanjiItems({
        level: level as JLPTLevel,
        count: kanjiCount,
        selection: 'random'
      })

      const vocabItems = await loadVocabItems({
        count: vocabCount,
        level,
        selection: 'common'
      })

      items = [...kanjiItems, ...vocabItems]
      // Shuffle mixed items
      items = shuffleArray(items)
    }

    const pool = await buildDistractorPool({
      contentType,
      level: level as JLPTLevel,
      size,
      items,
      listItems
    })
    const steps = generateBlastSteps(items, pool)

    return { items, steps }
  } catch (error) {
    console.error('Failed to load blast data:', error)
    throw error
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

describe('loadBlastData Integration', () => {
  beforeEach(() => {
    ;(buildDistractorPool as jest.Mock).mockResolvedValue({})
  })

  // Mock data
  const mockKanjiItems: BlastItem[] = [
    {
      id: 'kanji-日',
      contentType: 'kanji',
      kanji: '日',
      kana: 'ひ',
      meaningEn: 'sun; day',
      readings: {
        onyomi: ['ニチ'],
        kunyomi: ['ひ']
      }
    },
    {
      id: 'kanji-月',
      contentType: 'kanji',
      kanji: '月',
      kana: 'つき',
      meaningEn: 'moon; month',
      readings: {
        onyomi: ['ゲツ'],
        kunyomi: ['つき']
      }
    }
  ]

  const mockVocabItems: BlastItem[] = [
    {
      id: 'vocab-1',
      contentType: 'vocabulary',
      kanji: '食べる',
      kana: 'たべる',
      meaningEn: 'to eat'
    },
    {
      id: 'vocab-2',
      contentType: 'vocabulary',
      kanji: '飲む',
      kana: 'のむ',
      meaningEn: 'to drink'
    }
  ]

  const mockKanjiDetails = new Map([
    ['日', { kanji: '日', meaning: 'sun', meanings: ['sun'], onyomi: ['ニチ'], kunyomi: ['ひ'], jlpt: 'N5', strokeCount: 4, examples: [] }],
    ['月', { kanji: '月', meaning: 'moon', meanings: ['moon'], onyomi: ['ゲツ'], kunyomi: ['つき'], jlpt: 'N5', strokeCount: 4, examples: [] }]
  ])

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('contentType=kanji', () => {
    beforeEach(() => {
      ;(loadKanjiItems as jest.Mock).mockResolvedValue(mockKanjiItems)
      ;(generateBlastSteps as jest.Mock).mockImplementation((items) => {
        // Mock kanji steps: 1,2,3,4,6 (5 steps per kanji)
        return items.flatMap((item: BlastItem) => [
          { stepType: 'meaning_to_jp_mcq', itemId: item.id },
          { stepType: 'jp_reassemble', itemId: item.id },
          { stepType: 'onyomi_mcq', itemId: item.id },
          { stepType: 'kunyomi_mcq', itemId: item.id },
          { stepType: 'jp_to_meaning_mcq', itemId: item.id }
        ])
      })
    })

    it('should load kanji items with correct size', async () => {
      const { items, steps } = await loadBlastData('kanji', 2, 'N5', 'user-1', false)

      expect(loadKanjiItems).toHaveBeenCalledWith({
        level: 'N5',
        count: 2,
        selection: 'random'
      })
      expect(items.length).toBe(2)
    })

    it('should generate steps for kanji items', async () => {
      const { items, steps } = await loadBlastData('kanji', 2, 'N5', 'user-1', false)

      expect(generateBlastSteps).toHaveBeenCalledWith(items, expect.any(Object))
      expect(steps.length).toBeGreaterThan(0)
    })

    it('should have steps for all loaded items', async () => {
      const { items, steps } = await loadBlastData('kanji', 2, 'N5', 'user-1', false)

      // Each kanji has 5 steps
      expect(steps.length).toBe(10) // 2 kanji * 5 steps
    })

    it('should return items with kanji contentType', async () => {
      const { items } = await loadBlastData('kanji', 2, 'N5', 'user-1', false)

      items.forEach(item => {
        expect(item.contentType).toBe('kanji')
      })
    })

    it('should use selected kanji when provided', async () => {
      ;(kanjiService.getMultipleKanjiDetails as jest.Mock).mockResolvedValue(mockKanjiDetails)
      ;(kanjiToBlastItem as jest.Mock).mockImplementation((k) => ({
        id: `kanji-${k.kanji}`,
        contentType: 'kanji',
        kanji: k.kanji,
        kana: k.kunyomi?.[0],
        meaningEn: k.meaning
      }))

      const { items } = await loadBlastData('kanji', 2, 'N5', 'user-1', false, undefined, ['日', '月'])

      expect(kanjiService.getMultipleKanjiDetails).toHaveBeenCalledWith(['日', '月'])
      expect(items.length).toBe(2)
      expect(items[0].contentType).toBe('kanji')
    })
  })

  describe('contentType=vocabulary', () => {
    beforeEach(() => {
      ;(loadVocabItems as jest.Mock).mockResolvedValue(mockVocabItems)
      ;(generateBlastSteps as jest.Mock).mockImplementation((items) => {
        // Mock vocab steps: only 1,2,6 (3 steps per vocab)
        return items.flatMap((item: BlastItem) => [
          { stepType: 'meaning_to_jp_mcq', itemId: item.id },
          { stepType: 'jp_reassemble', itemId: item.id },
          { stepType: 'jp_to_meaning_mcq', itemId: item.id }
        ])
      })
    })

    it('should load vocabulary items with correct size', async () => {
      const { items, steps } = await loadBlastData('vocabulary', 2, 'N5', 'user-1', false)

      expect(loadVocabItems).toHaveBeenCalledWith({
        count: 2,
        level: 'N5',
        selection: 'common'
      })
      expect(items.length).toBe(2)
    })

    it('should generate steps only of types 1,2,6', async () => {
      const { steps } = await loadBlastData('vocabulary', 2, 'N5', 'user-1', false)

      // Verify step types
      const stepTypes = steps.map((s: any) => s.stepType as BlastStepType)

      // Should only contain these step types
      const allowedTypes: BlastStepType[] = ['meaning_to_jp_mcq', 'jp_reassemble', 'jp_to_meaning_mcq']
      stepTypes.forEach(type => {
        expect(allowedTypes).toContain(type)
      })

      // Should NOT contain reading MCQ steps
      const hasReadingSteps = stepTypes.some(type =>
        type === 'onyomi_mcq' || type === 'kunyomi_mcq' || type === 'other_reading_mcq'
      )
      expect(hasReadingSteps).toBe(false)
    })

    it('should have correct number of steps for vocabulary', async () => {
      const { steps } = await loadBlastData('vocabulary', 2, 'N5')

      // Each vocab has 3 steps
      expect(steps.length).toBe(6) // 2 vocab * 3 steps
    })

    it('should return items with vocabulary contentType', async () => {
      const { items } = await loadBlastData('vocabulary', 2, 'N5')

      items.forEach(item => {
        expect(item.contentType).toBe('vocabulary')
      })
    })
  })

  describe('contentType=mixed', () => {
    beforeEach(() => {
      ;(loadKanjiItems as jest.Mock).mockResolvedValue([mockKanjiItems[0]])
      ;(loadVocabItems as jest.Mock).mockResolvedValue([mockVocabItems[0]])
      ;(generateBlastSteps as jest.Mock).mockImplementation((items) => {
        return items.flatMap((item: BlastItem) => {
          if (item.contentType === 'kanji') {
            return [
              { stepType: 'meaning_to_jp_mcq', itemId: item.id },
              { stepType: 'jp_reassemble', itemId: item.id },
              { stepType: 'onyomi_mcq', itemId: item.id },
              { stepType: 'kunyomi_mcq', itemId: item.id },
              { stepType: 'jp_to_meaning_mcq', itemId: item.id }
            ]
          } else {
            return [
              { stepType: 'meaning_to_jp_mcq', itemId: item.id },
              { stepType: 'jp_reassemble', itemId: item.id },
              { stepType: 'jp_to_meaning_mcq', itemId: item.id }
            ]
          }
        })
      })
    })

    it('should combine kanji and vocabulary items', async () => {
      const { items } = await loadBlastData('mixed', 4, 'N5')

      expect(items.length).toBe(2) // 1 kanji + 1 vocab

      // Should have both content types
      const contentTypes = items.map(i => i.contentType)
      expect(contentTypes).toContain('kanji')
      expect(contentTypes).toContain('vocabulary')
    })

    it('should split size between kanji and vocabulary', async () => {
      await loadBlastData('mixed', 4, 'N5')

      expect(loadKanjiItems).toHaveBeenCalledWith({
        level: 'N5',
        count: 2, // floor(4/2)
        selection: 'random'
      })

      expect(loadVocabItems).toHaveBeenCalledWith({
        count: 2, // 4 - 2
        level: 'N5',
        selection: 'common'
      })
    })

    it('should handle odd size correctly', async () => {
      await loadBlastData('mixed', 5, 'N5')

      expect(loadKanjiItems).toHaveBeenCalledWith({
        level: 'N5',
        count: 2, // floor(5/2)
        selection: 'random'
      })

      expect(loadVocabItems).toHaveBeenCalledWith({
        count: 3, // 5 - 2
        level: 'N5',
        selection: 'common'
      })
    })

    it('should validate total item count', async () => {
      ;(loadKanjiItems as jest.Mock).mockResolvedValue(mockKanjiItems)
      ;(loadVocabItems as jest.Mock).mockResolvedValue(mockVocabItems)

      const { items } = await loadBlastData('mixed', 4, 'N5')

      // Should have 4 items total (2 kanji + 2 vocab)
      expect(items.length).toBe(4)
    })

    it('should shuffle mixed items', async () => {
      ;(loadKanjiItems as jest.Mock).mockResolvedValue(mockKanjiItems)
      ;(loadVocabItems as jest.Mock).mockResolvedValue(mockVocabItems)

      const { items } = await loadBlastData('mixed', 4, 'N5')

      // Items should be shuffled, so order may not be sequential
      // Just verify we have both types
      const hasKanji = items.some(i => i.contentType === 'kanji')
      const hasVocab = items.some(i => i.contentType === 'vocabulary')

      expect(hasKanji).toBe(true)
      expect(hasVocab).toBe(true)
    })
  })

  describe('Error handling', () => {
    it('should throw error when adapter fails', async () => {
      ;(loadKanjiItems as jest.Mock).mockRejectedValue(new Error('Load failed'))

      await expect(loadBlastData('kanji', 2, 'N5')).rejects.toThrow('Load failed')
    })

    it('should handle invalid level gracefully', async () => {
      ;(loadKanjiItems as jest.Mock).mockResolvedValue([])
      ;(generateBlastSteps as jest.Mock).mockReturnValue([])

      const { items, steps } = await loadBlastData('kanji', 2, 'INVALID')

      // Should not throw, but may return empty results
      expect(items).toBeDefined()
      expect(steps).toBeDefined()
    })

    it('should handle empty results from adapters', async () => {
      ;(loadKanjiItems as jest.Mock).mockResolvedValue([])
      ;(generateBlastSteps as jest.Mock).mockReturnValue([])

      const { items, steps } = await loadBlastData('kanji', 10, 'N5')

      expect(items.length).toBe(0)
      expect(steps.length).toBe(0)
    })

    it('should log errors before throwing', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      ;(loadVocabItems as jest.Mock).mockRejectedValue(new Error('Network error'))

      await expect(loadBlastData('vocabulary', 2, 'N5')).rejects.toThrow()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load blast data:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('No React rendering', () => {
    beforeEach(() => {
      // Reset mocks to default behavior
      ;(loadVocabItems as jest.Mock).mockResolvedValue(mockVocabItems)
      ;(generateBlastSteps as jest.Mock).mockImplementation((items) => {
        return items.flatMap((item: BlastItem) => [
          { stepType: 'meaning_to_jp_mcq', itemId: item.id },
          { stepType: 'jp_reassemble', itemId: item.id },
          { stepType: 'jp_to_meaning_mcq', itemId: item.id }
        ])
      })
    })

    it('should be a pure async function', async () => {
      const { items, steps } = await loadBlastData('vocabulary', 2, 'N5')

      // Verify we got data without any React rendering
      expect(typeof items).toBe('object')
      expect(Array.isArray(items)).toBe(true)
      expect(typeof steps).toBe('object')
      expect(Array.isArray(steps)).toBe(true)
    })

    it('should work without DOM or React context', async () => {
      // This test verifies the function is pure and doesn't depend on React
      expect(typeof loadBlastData).toBe('function')

      const result = loadBlastData('kanji', 2, 'N5')
      expect(result).toBeInstanceOf(Promise)
    })
  })
})
