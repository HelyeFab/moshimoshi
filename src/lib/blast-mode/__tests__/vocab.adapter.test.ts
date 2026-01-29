/**
 * Tests for Vocabulary Adapter
 * Validates transformation of JMDict vocabulary into BlastItem format
 */

import { loadVocabItems, vocabToBlastItem } from '../adapters/vocab.adapter'
import { getCommonJMdictWords } from '@/utils/jmdictLocalSearch'
import type { JapaneseWord } from '@/types/vocabulary'

// Mock the JMDict search utility
jest.mock('@/utils/jmdictLocalSearch', () => ({
  getCommonJMdictWords: jest.fn(),
  searchJMdictWords: jest.fn()
}))

describe('Vocabulary Adapter', () => {
  const mockVocabulary: JapaneseWord[] = [
    {
      id: '1',
      kanji: '食べる',
      kana: 'たべる',
      meaning: 'to eat',
      jlpt: 'N5',
      type: 'verb',
      commonness: 90
    },
    {
      id: '2',
      kanji: '飲む',
      kana: 'のむ',
      meaning: 'to drink',
      jlpt: 'N5',
      type: 'verb',
      commonness: 85
    },
    {
      id: '3',
      kanji: '行く',
      kana: 'いく',
      meaning: 'to go',
      jlpt: 'N5',
      type: 'verb',
      commonness: 95
    },
    {
      id: '4',
      kanji: '来る',
      kana: 'くる',
      meaning: 'to come',
      jlpt: 'N4',
      type: 'verb',
      commonness: 88
    },
    {
      id: '5',
      kana: 'ありがとう',
      meaning: 'thank you',
      jlpt: 'N5',
      type: 'expression',
      commonness: 100
    },
    {
      id: '6',
      kanji: '学校',
      kana: 'がっこう',
      meaning: 'school',
      jlpt: 'N5',
      type: 'noun',
      commonness: 92
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('vocabToBlastItem', () => {
    it('should return BlastItem with contentType="vocabulary"', () => {
      const vocab: JapaneseWord = {
        id: '1',
        kanji: '犬',
        kana: 'いぬ',
        meaning: 'dog',
        jlpt: 'N5',
        type: 'noun',
        commonness: 90
      }

      const blastItem = vocabToBlastItem(vocab)

      expect(blastItem.contentType).toBe('vocabulary')
    })

    it('should use correct id prefix format', () => {
      const vocab: JapaneseWord = {
        id: '42',
        kanji: '猫',
        kana: 'ねこ',
        meaning: 'cat',
        jlpt: 'N5',
        type: 'noun',
        commonness: 88
      }

      const blastItem = vocabToBlastItem(vocab)

      expect(blastItem.id).toBe('vocab-42')
      expect(blastItem.id).toMatch(/^vocab-/)
    })

    it('should set kanji and kana for kanji+kana words', () => {
      const vocab: JapaneseWord = {
        id: '1',
        kanji: '食べる',
        kana: 'たべる',
        meaning: 'to eat',
        jlpt: 'N5',
        type: 'verb',
        commonness: 90
      }

      const blastItem = vocabToBlastItem(vocab)

      expect(blastItem.kanji).toBe('食べる')
      expect(blastItem.kana).toBe('たべる')
    })

    it('should handle kana-only words', () => {
      const vocab: JapaneseWord = {
        id: '5',
        kana: 'ありがとう',
        meaning: 'thank you',
        jlpt: 'N5',
        type: 'expression',
        commonness: 100
      }

      const blastItem = vocabToBlastItem(vocab)

      expect(blastItem.kanji).toBeUndefined()
      expect(blastItem.kana).toBe('ありがとう')
    })

    it('should not set kanji when kanji equals kana', () => {
      const vocab: JapaneseWord = {
        id: '10',
        kanji: 'ひらがな',
        kana: 'ひらがな',
        meaning: 'hiragana',
        jlpt: 'N5',
        type: 'noun',
        commonness: 70
      }

      const blastItem = vocabToBlastItem(vocab)

      // When kanji equals kana, treat as kana-only
      expect(blastItem.kanji).toBeUndefined()
      expect(blastItem.kana).toBe('ひらがな')
    })

    it('should set meaningEn from vocab meaning', () => {
      const vocab: JapaneseWord = {
        id: '6',
        kanji: '学校',
        kana: 'がっこう',
        meaning: 'school',
        jlpt: 'N5',
        type: 'noun',
        commonness: 92
      }

      const blastItem = vocabToBlastItem(vocab)

      expect(blastItem.meaningEn).toBe('school')
    })

    it('should set readings to undefined for vocabulary', () => {
      const vocab: JapaneseWord = {
        id: '1',
        kanji: '食べる',
        kana: 'たべる',
        meaning: 'to eat',
        jlpt: 'N5',
        type: 'verb',
        commonness: 90
      }

      const blastItem = vocabToBlastItem(vocab)

      // Vocab typically doesn't have separate onyomi/kunyomi
      expect(blastItem.readings).toBeUndefined()
    })

    it('should set tokens to undefined', () => {
      const vocab: JapaneseWord = {
        id: '1',
        kanji: '食べる',
        kana: 'たべる',
        meaning: 'to eat',
        jlpt: 'N5',
        type: 'verb',
        commonness: 90
      }

      const blastItem = vocabToBlastItem(vocab)

      // Let tile-splitter handle this deterministically
      expect(blastItem.tokens).toBeUndefined()
    })

    it('should include JLPT level in sourceTags', () => {
      const vocab: JapaneseWord = {
        id: '3',
        kanji: '行く',
        kana: 'いく',
        meaning: 'to go',
        jlpt: 'N5',
        type: 'verb',
        commonness: 95
      }

      const blastItem = vocabToBlastItem(vocab)

      expect(blastItem.sourceTags).toContain('N5')
    })

    it('should include type in sourceTags when present', () => {
      const vocab: JapaneseWord = {
        id: '1',
        kanji: '食べる',
        kana: 'たべる',
        meaning: 'to eat',
        jlpt: 'N5',
        type: 'verb',
        commonness: 90
      }

      const blastItem = vocabToBlastItem(vocab)

      expect(blastItem.sourceTags).toContain('type-verb')
    })

    it('should handle missing JLPT level', () => {
      const vocab: JapaneseWord = {
        id: '99',
        kanji: 'テスト',
        kana: 'てすと',
        meaning: 'test',
        type: 'noun',
        commonness: 50
      }

      const blastItem = vocabToBlastItem(vocab)

      expect(blastItem.sourceTags).not.toContain('N5')
      expect(blastItem.sourceTags).not.toContain(undefined)
    })

    it('should handle missing type', () => {
      const vocab: JapaneseWord = {
        id: '98',
        kanji: 'テスト',
        kana: 'てすと',
        meaning: 'test',
        jlpt: 'N3',
        commonness: 50
      }

      const blastItem = vocabToBlastItem(vocab)

      expect(blastItem.sourceTags).toContain('N3')
      expect(blastItem.sourceTags?.length).toBe(1) // Only JLPT tag
    })

    it('should handle missing meaning with fallback', () => {
      const vocab: JapaneseWord = {
        id: '100',
        kanji: '謎',
        kana: 'なぞ',
        jlpt: 'N2',
        type: 'noun',
        commonness: 40
      }

      const blastItem = vocabToBlastItem(vocab)

      expect(blastItem.meaningEn).toBe('Unknown')
    })
  })

  describe('loadVocabItems', () => {
    beforeEach(() => {
      ;(getCommonJMdictWords as jest.Mock).mockResolvedValue(mockVocabulary)
    })

    it('should call getCommonJMdictWords with correct count', async () => {
      await loadVocabItems({ count: 3 })

      // Should request 5x the count for filtering
      expect(getCommonJMdictWords).toHaveBeenCalledWith(15)
    })

    it('should return correct number of items', async () => {
      const items = await loadVocabItems({ count: 3 })

      expect(items.length).toBe(3)
    })

    it('should filter by JLPT level when specified', async () => {
      const items = await loadVocabItems({
        count: 3,
        level: 'N5'
      })

      // All returned items should be N5
      items.forEach(item => {
        expect(item.sourceTags).toContain('N5')
      })
    })

    it('should fall back to all words when insufficient matches for JLPT level', async () => {
      // Mock returns only one N3 word
      const limitedVocab: JapaneseWord[] = [
        {
          id: '1',
          kanji: '速い',
          kana: 'はやい',
          meaning: 'fast',
          jlpt: 'N3',
          type: 'adjective',
          commonness: 70
        }
      ]
      ;(getCommonJMdictWords as jest.Mock).mockResolvedValue(limitedVocab)

      // Request 5 N3 words but only 1 available
      const items = await loadVocabItems({
        count: 5,
        level: 'N3'
      })

      // Should fall back and return what's available
      expect(items.length).toBe(1)
    })

    it('should use common selection by default', async () => {
      const items = await loadVocabItems({
        count: 3
      })

      expect(items.length).toBe(3)
      // Common selection should pick first items from mockVocabulary
      expect(items[0].kanji).toBe('食べる')
    })

    it('should use random selection when specified', async () => {
      const items = await loadVocabItems({
        count: 3,
        selection: 'random'
      })

      expect(items.length).toBe(3)
      // All items should be from mockVocabulary (exact order may vary)
      const vocabIds = items.map(i => i.id.replace('vocab-', ''))
      vocabIds.forEach(id => {
        expect(['1', '2', '3', '4', '5', '6']).toContain(id)
      })
    })

    it('should return all BlastItems with vocabulary contentType', async () => {
      const items = await loadVocabItems({ count: 3 })

      items.forEach(item => {
        expect(item.contentType).toBe('vocabulary')
      })
    })

    it('should handle count larger than available vocabulary', async () => {
      const items = await loadVocabItems({
        count: 20 // More than mockVocabulary length
      })

      // Should return all available vocabulary (6)
      expect(items.length).toBe(6)
    })

    it('should transform all items correctly', async () => {
      const items = await loadVocabItems({
        count: 3,
        selection: 'common'
      })

      // Verify all items have correct structure
      items.forEach(item => {
        expect(item.id).toMatch(/^vocab-/)
        expect(item.contentType).toBe('vocabulary')
        expect(item.kana).toBeDefined()
        expect(item.meaningEn).toBeDefined()
      })
    })

    it('should log warning when falling back from JLPT filter', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      // Mock returns only one N1 word, request 10
      const limitedVocab: JapaneseWord[] = [
        {
          id: '1',
          kanji: '難解',
          kana: 'なんかい',
          meaning: 'difficult',
          jlpt: 'N1',
          type: 'adjective',
          commonness: 30
        }
      ]
      ;(getCommonJMdictWords as jest.Mock).mockResolvedValue(limitedVocab)

      await loadVocabItems({
        count: 10,
        level: 'N1'
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Not enough vocabulary for N1')
      )

      consoleSpy.mockRestore()
    })

    it('should not make network calls in tests', async () => {
      // This test verifies mocking is working correctly
      await loadVocabItems({ count: 2 })

      // Verify only the mock was called
      expect(getCommonJMdictWords).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty vocabulary list', async () => {
      ;(getCommonJMdictWords as jest.Mock).mockResolvedValue([])

      const items = await loadVocabItems({ count: 5 })

      expect(items.length).toBe(0)
    })

    it('should handle vocabulary with all fields missing', () => {
      const vocab: JapaneseWord = {
        id: '999',
        kana: 'test',
        commonness: 1
      }

      const blastItem = vocabToBlastItem(vocab)

      expect(blastItem.contentType).toBe('vocabulary')
      expect(blastItem.meaningEn).toBe('Unknown')
      expect(blastItem.sourceTags?.length).toBe(0)
    })

    it('should handle vocabulary without kanji field', () => {
      const vocab: JapaneseWord = {
        id: '88',
        kana: 'こんにちは',
        meaning: 'hello',
        jlpt: 'N5',
        type: 'expression',
        commonness: 100
      }

      const blastItem = vocabToBlastItem(vocab)

      expect(blastItem.kanji).toBeUndefined()
      expect(blastItem.kana).toBe('こんにちは')
    })

    it('should handle level filter with no matching words', async () => {
      // Mock returns no N1 words
      ;(getCommonJMdictWords as jest.Mock).mockResolvedValue(mockVocabulary)

      const items = await loadVocabItems({
        count: 5,
        level: 'N1' // No N1 words in mockVocabulary
      })

      // Should fall back to all words
      expect(items.length).toBeGreaterThan(0)
    })
  })
})
