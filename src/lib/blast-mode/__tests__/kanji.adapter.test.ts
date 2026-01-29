/**
 * Tests for Kanji Adapter
 * Validates transformation of Kanji data into BlastItem format
 */

import { loadKanjiItems, kanjiToBlastItem } from '../adapters/kanji.adapter'
import { kanjiService } from '@/services/kanjiService'
import type { Kanji } from '@/types/kanji'

// Mock the kanji service
jest.mock('@/services/kanjiService', () => ({
  kanjiService: {
    loadKanjiByLevel: jest.fn()
  }
}))

describe('Kanji Adapter', () => {
  const mockKanji: Kanji[] = [
    {
      kanji: '日',
      meaning: 'sun; day',
      onyomi: ['ニチ', 'ジツ'],
      kunyomi: ['ひ', 'か'],
      jlpt: 'N5',
      grade: 1,
      strokes: 4,
      radical: '日',
      frequency: 1
    },
    {
      kanji: '月',
      meaning: 'moon; month',
      onyomi: ['ゲツ', 'ガツ'],
      kunyomi: ['つき'],
      jlpt: 'N5',
      grade: 1,
      strokes: 4,
      radical: '月',
      frequency: 2
    },
    {
      kanji: '火',
      meaning: 'fire',
      onyomi: ['カ'],
      kunyomi: ['ひ'],
      jlpt: 'N5',
      grade: 1,
      strokes: 4,
      radical: '火',
      frequency: 3
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('kanjiToBlastItem', () => {
    it('should return BlastItem with contentType="kanji"', () => {
      const kanji: Kanji = {
        kanji: '水',
        meaning: 'water',
        onyomi: ['スイ'],
        kunyomi: ['みず'],
        jlpt: 'N5',
        grade: 1,
        strokes: 4,
        radical: '水',
        frequency: 100
      }

      const blastItem = kanjiToBlastItem(kanji)

      expect(blastItem.contentType).toBe('kanji')
    })

    it('should use correct id prefix format', () => {
      const kanji: Kanji = {
        kanji: '火',
        meaning: 'fire',
        onyomi: ['カ'],
        kunyomi: ['ひ'],
        jlpt: 'N5',
        grade: 1,
        strokes: 4,
        radical: '火',
        frequency: 50
      }

      const blastItem = kanjiToBlastItem(kanji)

      expect(blastItem.id).toBe('kanji-火')
      expect(blastItem.id).toMatch(/^kanji-/)
    })

    it('should set readings correctly when both onyomi and kunyomi exist', () => {
      const kanji: Kanji = {
        kanji: '日',
        meaning: 'sun; day',
        onyomi: ['ニチ', 'ジツ'],
        kunyomi: ['ひ', 'か'],
        jlpt: 'N5',
        grade: 1,
        strokes: 4,
        radical: '日',
        frequency: 1
      }

      const blastItem = kanjiToBlastItem(kanji)

      expect(blastItem.readings?.onyomi).toEqual(['ニチ', 'ジツ'])
      expect(blastItem.readings?.kunyomi).toEqual(['ひ', 'か'])
    })

    it('should handle kanji with only onyomi', () => {
      const kanji: Kanji = {
        kanji: '銀',
        meaning: 'silver',
        onyomi: ['ギン'],
        kunyomi: [],
        jlpt: 'N3',
        grade: 3,
        strokes: 14,
        radical: '金',
        frequency: 500
      }

      const blastItem = kanjiToBlastItem(kanji)

      expect(blastItem.readings?.onyomi).toEqual(['ギン'])
      expect(blastItem.readings?.kunyomi).toBeUndefined()
    })

    it('should handle kanji with only kunyomi', () => {
      const kanji: Kanji = {
        kanji: '私',
        meaning: 'I; private',
        onyomi: [],
        kunyomi: ['わたし', 'わたくし'],
        jlpt: 'N5',
        grade: 6,
        strokes: 7,
        radical: '禾',
        frequency: 100
      }

      const blastItem = kanjiToBlastItem(kanji)

      expect(blastItem.readings?.onyomi).toBeUndefined()
      expect(blastItem.readings?.kunyomi).toEqual(['わたし', 'わたくし'])
    })

    it('should populate "other" readings when total readings > 2', () => {
      const kanji: Kanji = {
        kanji: '生',
        meaning: 'life; birth',
        onyomi: ['セイ', 'ショウ'],
        kunyomi: ['い.きる', 'う.まれる', 'なま'],
        jlpt: 'N4',
        grade: 1,
        strokes: 5,
        radical: '生',
        frequency: 10
      }

      const blastItem = kanjiToBlastItem(kanji)

      // First 2 readings: セイ, ショウ (onyomi)
      // "other" should contain remaining readings
      expect(blastItem.readings?.other).toBeDefined()
      expect(blastItem.readings?.other?.length).toBeGreaterThan(0)
      expect(blastItem.readings?.other).toEqual(['い.きる', 'う.まれる', 'なま'])
    })

    it('should not populate "other" readings when total readings <= 2', () => {
      const kanji: Kanji = {
        kanji: '火',
        meaning: 'fire',
        onyomi: ['カ'],
        kunyomi: ['ひ'],
        jlpt: 'N5',
        grade: 1,
        strokes: 4,
        radical: '火',
        frequency: 50
      }

      const blastItem = kanjiToBlastItem(kanji)

      expect(blastItem.readings?.other).toBeUndefined()
    })

    it('should set kanji and kana fields', () => {
      const kanji: Kanji = {
        kanji: '木',
        meaning: 'tree; wood',
        onyomi: ['モク', 'ボク'],
        kunyomi: ['き'],
        jlpt: 'N5',
        grade: 1,
        strokes: 4,
        radical: '木',
        frequency: 20
      }

      const blastItem = kanjiToBlastItem(kanji)

      expect(blastItem.kanji).toBe('木')
      expect(blastItem.kana).toBe('き') // First kunyomi
    })

    it('should fallback to onyomi if kunyomi is empty', () => {
      const kanji: Kanji = {
        kanji: '銀',
        meaning: 'silver',
        onyomi: ['ギン'],
        kunyomi: [],
        jlpt: 'N3',
        grade: 3,
        strokes: 14,
        radical: '金',
        frequency: 500
      }

      const blastItem = kanjiToBlastItem(kanji)

      expect(blastItem.kanji).toBe('銀')
      expect(blastItem.kana).toBe('ギン') // Fallback to first onyomi
    })

    it('should set meaningEn from kanji meaning', () => {
      const kanji: Kanji = {
        kanji: '雨',
        meaning: 'rain',
        onyomi: ['ウ'],
        kunyomi: ['あめ'],
        jlpt: 'N5',
        grade: 1,
        strokes: 8,
        radical: '雨',
        frequency: 150
      }

      const blastItem = kanjiToBlastItem(kanji)

      expect(blastItem.meaningEn).toBe('rain')
    })

    it('should include JLPT level in sourceTags', () => {
      const kanji: Kanji = {
        kanji: '学',
        meaning: 'learning; study',
        onyomi: ['ガク'],
        kunyomi: ['まな.ぶ'],
        jlpt: 'N5',
        grade: 1,
        strokes: 8,
        radical: '子',
        frequency: 30
      }

      const blastItem = kanjiToBlastItem(kanji)

      expect(blastItem.sourceTags).toContain('N5')
    })

    it('should include grade in sourceTags when present', () => {
      const kanji: Kanji = {
        kanji: '校',
        meaning: 'school',
        onyomi: ['コウ'],
        kunyomi: [],
        jlpt: 'N5',
        grade: 1,
        strokes: 10,
        radical: '木',
        frequency: 80
      }

      const blastItem = kanjiToBlastItem(kanji)

      expect(blastItem.sourceTags).toContain('N5')
      expect(blastItem.sourceTags).toContain('grade-1')
    })

    it('should set tokens to undefined', () => {
      const kanji: Kanji = {
        kanji: '山',
        meaning: 'mountain',
        onyomi: ['サン'],
        kunyomi: ['やま'],
        jlpt: 'N5',
        grade: 1,
        strokes: 3,
        radical: '山',
        frequency: 40
      }

      const blastItem = kanjiToBlastItem(kanji)

      // Tokens should be undefined, letting tile-splitter handle it
      expect(blastItem.tokens).toBeUndefined()
    })
  })

  describe('loadKanjiItems', () => {
    beforeEach(() => {
      ;(kanjiService.loadKanjiByLevel as jest.Mock).mockResolvedValue(mockKanji)
    })

    it('should call kanjiService.loadKanjiByLevel with correct level', async () => {
      await loadKanjiItems({ level: 'N5', count: 2 })

      expect(kanjiService.loadKanjiByLevel).toHaveBeenCalledWith('N5')
    })

    it('should return correct number of items', async () => {
      const items = await loadKanjiItems({ level: 'N5', count: 2 })

      expect(items.length).toBe(2)
    })

    it('should return all BlastItems with kanji contentType', async () => {
      const items = await loadKanjiItems({ level: 'N5', count: 3 })

      items.forEach(item => {
        expect(item.contentType).toBe('kanji')
      })
    })

    it('should use sequential selection when specified', async () => {
      const items = await loadKanjiItems({
        level: 'N5',
        count: 2,
        selection: 'sequential'
      })

      expect(items.length).toBe(2)
      // Sequential should pick first items from mockKanji
      expect(items[0].kanji).toBe('日')
      expect(items[1].kanji).toBe('月')
    })

    it('should use random selection by default', async () => {
      const items = await loadKanjiItems({
        level: 'N5',
        count: 2
      })

      expect(items.length).toBe(2)
      // All items should be from mockKanji (exact order may vary)
      const kanjiChars = items.map(i => i.kanji)
      kanjiChars.forEach(char => {
        expect(['日', '月', '火']).toContain(char)
      })
    })

    it('should handle count larger than available kanji', async () => {
      const items = await loadKanjiItems({
        level: 'N5',
        count: 10 // More than mockKanji length
      })

      // Should return all available kanji (3)
      expect(items.length).toBe(3)
    })

    it('should transform all items correctly', async () => {
      const items = await loadKanjiItems({
        level: 'N5',
        count: 3,
        selection: 'sequential'
      })

      // Verify all items have correct structure
      items.forEach(item => {
        expect(item.id).toMatch(/^kanji-/)
        expect(item.contentType).toBe('kanji')
        expect(item.kanji).toBeDefined()
        expect(item.meaningEn).toBeDefined()
        expect(item.readings).toBeDefined()
      })
    })

    it('should not make network or filesystem calls in tests', async () => {
      // This test verifies mocking is working correctly
      await loadKanjiItems({ level: 'N5', count: 2 })

      // Verify only the mock was called
      expect(kanjiService.loadKanjiByLevel).toHaveBeenCalledTimes(1)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty kanji list', async () => {
      ;(kanjiService.loadKanjiByLevel as jest.Mock).mockResolvedValue([])

      const items = await loadKanjiItems({ level: 'N5', count: 5 })

      expect(items.length).toBe(0)
    })

    it('should handle kanji with no grade', () => {
      const kanji: Kanji = {
        kanji: '々',
        meaning: 'iteration mark',
        onyomi: [],
        kunyomi: [],
        jlpt: 'N5',
        strokes: 3,
        radical: '々',
        frequency: 1000
        // grade is undefined
      }

      const blastItem = kanjiToBlastItem(kanji)

      expect(blastItem.sourceTags).toContain('N5')
      expect(blastItem.sourceTags).not.toContain('grade-undefined')
    })

    it('should handle kanji with empty readings arrays', () => {
      const kanji: Kanji = {
        kanji: '〇',
        meaning: 'zero; circle',
        onyomi: [],
        kunyomi: [],
        jlpt: 'N5',
        grade: 1,
        strokes: 1,
        radical: '〇',
        frequency: 2000
      }

      const blastItem = kanjiToBlastItem(kanji)

      expect(blastItem.readings?.onyomi).toBeUndefined()
      expect(blastItem.readings?.kunyomi).toBeUndefined()
      expect(blastItem.readings?.other).toBeUndefined()
    })
  })
})
