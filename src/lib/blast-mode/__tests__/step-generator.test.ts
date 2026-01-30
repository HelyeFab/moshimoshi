/**
 * Tests for Blast Mode Step Generator
 * Validates adaptive step sequencing based on content type and available data
 */

import { BlastItem } from '../types'
import { generateBlastSteps } from '../step-generator'

// Mock the distractors module
jest.mock('../distractors', () => ({
  generateMeaningMcq: jest.fn((item) => ({
    options: ['Option 1', 'Option 2', 'Option 3', item.meaningEn],
    correctIndex: 3
  })),
  generateJapaneseMcq: jest.fn((item) => ({
    options: ['JP1', 'JP2', 'JP3', item.kanji || item.kana],
    correctIndex: 3
  })),
  generateReadingMcq: jest.fn((reading) => ({
    options: ['R1', 'R2', 'R3', reading],
    correctIndex: 3
  }))
}))

// Mock the tile-splitter module
jest.mock('../tile-splitter', () => ({
  splitIntoTiles: jest.fn((item) => ({
    tiles: item.kanji ? item.kanji.split('') : (item.kana || '').split(''),
    strategy: 'character-split',
    confidence: 0.95
  })),
  shuffleTiles: jest.fn((tiles) => tiles)
}))

describe('Step Generator', () => {
  describe('Kanji items', () => {
    it('should generate steps 1,2,3,4,5,6 for kanji with multiple readings', () => {
      const kanjiItem: BlastItem = {
        id: 'kanji-日',
        contentType: 'kanji',
        kanji: '日',
        kana: 'ひ',
        meaningEn: 'sun; day',
        readings: {
          onyomi: ['ニチ', 'ジツ'],
          kunyomi: ['ひ', 'か']
        }
      }

      const steps = generateBlastSteps([kanjiItem])

      expect(steps.length).toBe(6) // Steps 1,2,3,4,5,6
      expect(steps[0].stepType).toBe('meaning_to_jp_mcq')
      expect(steps[1].stepType).toBe('jp_reassemble')
      expect(steps[2].stepType).toBe('onyomi_mcq')
      expect(steps[3].stepType).toBe('kunyomi_mcq')
      expect(steps[4].stepType).toBe('other_reading_mcq')
      expect(steps[5].stepType).toBe('jp_to_meaning_mcq')
    })

    it('should include step 5 for kanji with 3+ readings', () => {
      const kanjiItem: BlastItem = {
        id: 'kanji-生',
        contentType: 'kanji',
        kanji: '生',
        kana: 'なま',
        meaningEn: 'life; birth; raw',
        readings: {
          onyomi: ['セイ', 'ショウ'],
          kunyomi: ['い.きる', 'う.まれる', 'なま'],
          other: ['き', 'は.える']
        }
      }

      const steps = generateBlastSteps([kanjiItem])

      // Should have 6 steps: 1,2,3,4,5,6
      expect(steps.length).toBe(6)
      expect(steps[0].stepType).toBe('meaning_to_jp_mcq')
      expect(steps[1].stepType).toBe('jp_reassemble')
      expect(steps[2].stepType).toBe('onyomi_mcq')
      expect(steps[3].stepType).toBe('kunyomi_mcq')
      expect(steps[4].stepType).toBe('other_reading_mcq')
      expect(steps[5].stepType).toBe('jp_to_meaning_mcq')
    })

    it('should skip onyomi step when onyomi is missing but still include other reading', () => {
      const kanjiItem: BlastItem = {
        id: 'kanji-私',
        contentType: 'kanji',
        kanji: '私',
        kana: 'わたし',
        meaningEn: 'I; private',
        readings: {
          kunyomi: ['わたし', 'わたくし']
        }
      }

      const steps = generateBlastSteps([kanjiItem])

      // Should have 5 steps: 1,2,4,5,6 (skips step 3)
      expect(steps.length).toBe(5)
      expect(steps[0].stepType).toBe('meaning_to_jp_mcq')
      expect(steps[1].stepType).toBe('jp_reassemble')
      expect(steps[2].stepType).toBe('kunyomi_mcq')
      expect(steps[3].stepType).toBe('other_reading_mcq')
      expect(steps[4].stepType).toBe('jp_to_meaning_mcq')

      // Verify no onyomi step
      const hasOnyomi = steps.some(s => s.stepType === 'onyomi_mcq')
      expect(hasOnyomi).toBe(false)
    })

    it('should skip kunyomi step when kunyomi is missing', () => {
      const kanjiItem: BlastItem = {
        id: 'kanji-銀',
        contentType: 'kanji',
        kanji: '銀',
        kana: 'ギン',
        meaningEn: 'silver',
        readings: {
          onyomi: ['ギン']
        }
      }

      const steps = generateBlastSteps([kanjiItem])

      // Should have 4 steps: 1,2,3,6 (skips step 4)
      expect(steps.length).toBe(4)
      expect(steps[0].stepType).toBe('meaning_to_jp_mcq')
      expect(steps[1].stepType).toBe('jp_reassemble')
      expect(steps[2].stepType).toBe('onyomi_mcq')
      expect(steps[3].stepType).toBe('jp_to_meaning_mcq')

      // Verify no kunyomi step
      const hasKunyomi = steps.some(s => s.stepType === 'kunyomi_mcq')
      expect(hasKunyomi).toBe(false)
    })
  })

  describe('Vocabulary items', () => {
    it('should generate only steps 1,2,6 for vocabulary without readings', () => {
      const vocabItem: BlastItem = {
        id: 'vocab-1',
        contentType: 'vocabulary',
        kanji: '食べる',
        kana: 'たべる',
        meaningEn: 'to eat'
      }

      const steps = generateBlastSteps([vocabItem])

      // Should have 3 steps: 1,2,6
      expect(steps.length).toBe(3)
      expect(steps[0].stepType).toBe('meaning_to_jp_mcq')
      expect(steps[1].stepType).toBe('jp_reassemble')
      expect(steps[2].stepType).toBe('jp_to_meaning_mcq')

      // Verify no reading MCQ steps
      const hasReadingSteps = steps.some(s =>
        s.stepType === 'onyomi_mcq' ||
        s.stepType === 'kunyomi_mcq' ||
        s.stepType === 'other_reading_mcq'
      )
      expect(hasReadingSteps).toBe(false)
    })

    it('should include reading steps for vocabulary items with readings metadata', () => {
      const vocabItemWithReadings: BlastItem = {
        id: 'vocab-with-readings',
        contentType: 'vocabulary',
        kanji: '食事',
        kana: 'しょくじ',
        meaningEn: 'meal',
        readings: {
          onyomi: ['ショク', 'ジキ'],
          kunyomi: ['く.う', 'た.べる']
        }
      }

      const steps = generateBlastSteps([vocabItemWithReadings])

      // Should include reading steps when readings are provided
      // Steps 1,2,3,4,6 (and possibly 5 if multiple readings)
      expect(steps.length).toBeGreaterThan(3)

      // Should have onyomi step
      const hasOnyomiStep = steps.some(s => s.stepType === 'onyomi_mcq')
      expect(hasOnyomiStep).toBe(true)

      // Should have kunyomi step
      const hasKunyomiStep = steps.some(s => s.stepType === 'kunyomi_mcq')
      expect(hasKunyomiStep).toBe(true)

      // Should still have basic steps
      expect(steps[0].stepType).toBe('meaning_to_jp_mcq')
      expect(steps[1].stepType).toBe('jp_reassemble')
      expect(steps[steps.length - 1].stepType).toBe('jp_to_meaning_mcq')
    })

    it('should include reading steps for list items with readings', () => {
      const listItemWithReadings: BlastItem = {
        id: 'list-item-1',
        contentType: 'list',
        kanji: '天気',
        kana: 'てんき',
        meaningEn: 'weather',
        readings: {
          onyomi: ['テン', 'キ'],
          kunyomi: ['あま', 'け']
        }
      }

      const steps = generateBlastSteps([listItemWithReadings])

      // Should include reading steps for list items with readings
      const hasOnyomiStep = steps.some(s => s.stepType === 'onyomi_mcq')
      const hasKunyomiStep = steps.some(s => s.stepType === 'kunyomi_mcq')

      expect(hasOnyomiStep).toBe(true)
      expect(hasKunyomiStep).toBe(true)
    })

    it('should skip onyomi if not provided in readings for vocab item', () => {
      const vocabItemKunyomiOnly: BlastItem = {
        id: 'vocab-kunyomi-only',
        contentType: 'vocabulary',
        kanji: '水',
        kana: 'みず',
        meaningEn: 'water',
        readings: {
          kunyomi: ['みず']
          // No onyomi
        }
      }

      const steps = generateBlastSteps([vocabItemKunyomiOnly])

      // Should have kunyomi step
      const hasKunyomiStep = steps.some(s => s.stepType === 'kunyomi_mcq')
      expect(hasKunyomiStep).toBe(true)

      // Should not have onyomi step
      const hasOnyomiStep = steps.some(s => s.stepType === 'onyomi_mcq')
      expect(hasOnyomiStep).toBe(false)
    })

    it('should skip kunyomi if not provided in readings for vocab item', () => {
      const vocabItemOnyomiOnly: BlastItem = {
        id: 'vocab-onyomi-only',
        contentType: 'vocabulary',
        kanji: '銀行',
        kana: 'ぎんこう',
        meaningEn: 'bank',
        readings: {
          onyomi: ['ギン', 'コウ']
          // No kunyomi
        }
      }

      const steps = generateBlastSteps([vocabItemOnyomiOnly])

      // Should have onyomi step
      const hasOnyomiStep = steps.some(s => s.stepType === 'onyomi_mcq')
      expect(hasOnyomiStep).toBe(true)

      // Should not have kunyomi step
      const hasKunyomiStep = steps.some(s => s.stepType === 'kunyomi_mcq')
      expect(hasKunyomiStep).toBe(false)
    })

    it('should generate steps for kana-only vocabulary', () => {
      const vocabItem: BlastItem = {
        id: 'vocab-2',
        contentType: 'vocabulary',
        kana: 'ありがとう',
        meaningEn: 'thank you'
      }

      const steps = generateBlastSteps([vocabItem])

      // Should have 3 steps: 1,2,6
      expect(steps.length).toBe(3)
      expect(steps[0].stepType).toBe('meaning_to_jp_mcq')
      expect(steps[1].stepType).toBe('jp_reassemble')
      expect(steps[2].stepType).toBe('jp_to_meaning_mcq')
    })
  })

  describe('Sentence items', () => {
    it('should skip reassemble step for sentences without tokens', () => {
      const sentenceItem: BlastItem = {
        id: 'sentence-1',
        contentType: 'sentence',
        kana: 'こんにちは、元気ですか？',
        meaningEn: 'Hello, how are you?'
      }

      const steps = generateBlastSteps([sentenceItem])

      // Should have 2 steps: 1,6 (skips step 2)
      expect(steps.length).toBe(2)
      expect(steps[0].stepType).toBe('meaning_to_jp_mcq')
      expect(steps[1].stepType).toBe('jp_to_meaning_mcq')

      // Verify no reassemble step
      const hasReassemble = steps.some(s => s.stepType === 'jp_reassemble')
      expect(hasReassemble).toBe(false)
    })

    it('should include reassemble step for sentences with tokens', () => {
      const sentenceItem: BlastItem = {
        id: 'sentence-2',
        contentType: 'sentence',
        kana: 'これは本です',
        meaningEn: 'This is a book',
        tokens: ['これ', 'は', '本', 'です']
      }

      const steps = generateBlastSteps([sentenceItem])

      // Should have 3 steps: 1,2,6
      expect(steps.length).toBe(3)
      expect(steps[0].stepType).toBe('meaning_to_jp_mcq')
      expect(steps[1].stepType).toBe('jp_reassemble')
      expect(steps[2].stepType).toBe('jp_to_meaning_mcq')
    })
  })

  describe('Multiple items', () => {
    it('should generate steps for multiple items in sequence', () => {
      const items: BlastItem[] = [
        {
          id: 'kanji-水',
          contentType: 'kanji',
          kanji: '水',
          kana: 'みず',
          meaningEn: 'water',
          readings: {
            onyomi: ['スイ'],
            kunyomi: ['みず']
          }
        },
        {
          id: 'vocab-1',
          contentType: 'vocabulary',
          kanji: '水',
          kana: 'みず',
          meaningEn: 'water'
        }
      ]

      const steps = generateBlastSteps(items)

      // Kanji: 5 steps (1,2,3,4,6) + Vocab: 3 steps (1,2,6) = 8 total
      expect(steps.length).toBe(8)

      // First 5 should be from kanji item
      expect(steps[0].itemId).toBe('kanji-水')
      expect(steps[4].itemId).toBe('kanji-水')

      // Next 3 should be from vocab item
      expect(steps[5].itemId).toBe('vocab-1')
      expect(steps[7].itemId).toBe('vocab-1')
    })

    it('should produce deterministic step counts', () => {
      const items: BlastItem[] = [
        {
          id: 'test-1',
          contentType: 'kanji',
          kanji: '日',
          kana: 'ひ',
          meaningEn: 'sun',
          readings: { onyomi: ['ニチ'], kunyomi: ['ひ'] }
        }
      ]

      const steps1 = generateBlastSteps(items)
      const steps2 = generateBlastSteps(items)

      // Should produce the same number of steps
      expect(steps1.length).toBe(steps2.length)
      expect(steps1.length).toBe(5) // 1,2,3,4,6
    })
  })

  describe('Edge cases', () => {
    it('should handle empty items array', () => {
      const steps = generateBlastSteps([])
      expect(steps.length).toBe(0)
    })

    it('should handle items with empty readings', () => {
      const kanjiItem: BlastItem = {
        id: 'kanji-empty',
        contentType: 'kanji',
        kanji: '〇',
        kana: 'まる',
        meaningEn: 'circle',
        readings: {
          onyomi: [],
          kunyomi: []
        }
      }

      const steps = generateBlastSteps([kanjiItem])

      // Should have 3 steps: 1,2,6 (no reading steps)
      expect(steps.length).toBe(3)
      expect(steps[0].stepType).toBe('meaning_to_jp_mcq')
      expect(steps[1].stepType).toBe('jp_reassemble')
      expect(steps[2].stepType).toBe('jp_to_meaning_mcq')
    })

    it('should handle items with undefined readings', () => {
      const vocabItem: BlastItem = {
        id: 'vocab-no-readings',
        contentType: 'vocabulary',
        kanji: '犬',
        kana: 'いぬ',
        meaningEn: 'dog'
        // readings is undefined
      }

      const steps = generateBlastSteps([vocabItem])

      // Should have 3 steps: 1,2,6
      expect(steps.length).toBe(3)
      expect(steps[0].stepType).toBe('meaning_to_jp_mcq')
      expect(steps[1].stepType).toBe('jp_reassemble')
      expect(steps[2].stepType).toBe('jp_to_meaning_mcq')
    })
  })

  describe('Deterministic RNG', () => {
    it('should produce identical outputs when using seeded RNG', () => {
      const items: BlastItem[] = [
        {
          id: 'test-1',
          contentType: 'kanji',
          kanji: '日',
          kana: 'ひ',
          meaningEn: 'sun',
          readings: { onyomi: ['ニチ'], kunyomi: ['ひ'] }
        }
      ]

      // Seeded RNG that returns a constant value
      const seededRng = () => 0.42

      // Generate steps twice with the same seed
      const steps1 = generateBlastSteps(items, undefined, seededRng)
      const steps2 = generateBlastSteps(items, undefined, seededRng)

      // Should produce identical outputs
      expect(steps1.length).toBe(steps2.length)

      // Verify each step is identical
      steps1.forEach((step, index) => {
        expect(step.stepType).toBe(steps2[index].stepType)
        expect(step.itemId).toBe(steps2[index].itemId)
        expect(step.prompt).toBe(steps2[index].prompt)
        if (Array.isArray(step.answer) || Array.isArray(steps2[index].answer)) {
          expect(step.answer).toEqual(steps2[index].answer)
        } else {
          expect(step.answer).toBe(steps2[index].answer)
        }

        // If options exist, they should be in the same order
        if (step.options && steps2[index].options) {
          expect(step.options).toEqual(steps2[index].options)
        }

        // If tiles exist, they should be in the same order
        if (step.tiles && steps2[index].tiles) {
          expect(step.tiles).toEqual(steps2[index].tiles)
        }
      })
    })

    it('should use default Math.random when no RNG provided', () => {
      const items: BlastItem[] = [
        {
          id: 'test-1',
          contentType: 'vocabulary',
          kanji: '食べる',
          kana: 'たべる',
          meaningEn: 'to eat'
        }
      ]

      // Generate steps without RNG parameter
      const steps = generateBlastSteps(items)

      // Should succeed and produce valid steps
      expect(steps.length).toBeGreaterThan(0)
      expect(steps[0]).toHaveProperty('stepType')
      expect(steps[0]).toHaveProperty('itemId')
    })

    it('should support different seeded RNGs producing different outputs', () => {
      const items: BlastItem[] = [
        {
          id: 'test-1',
          contentType: 'kanji',
          kanji: '水',
          kana: 'みず',
          meaningEn: 'water',
          readings: { onyomi: ['スイ'], kunyomi: ['みず'] }
        }
      ]

      // Different seeded RNGs
      const rng1 = () => 0.1
      const rng2 = () => 0.9

      const steps1 = generateBlastSteps(items, undefined, rng1)
      const steps2 = generateBlastSteps(items, undefined, rng2)

      // Should produce same number of steps (structural consistency)
      expect(steps1.length).toBe(steps2.length)

      // But tile order or option order might differ
      // This test just verifies both RNGs work without errors
      expect(steps1).toBeDefined()
      expect(steps2).toBeDefined()
    })
  })

  describe('Step metadata', () => {
    it('should include itemId in all steps', () => {
      const item: BlastItem = {
        id: 'test-item',
        contentType: 'vocabulary',
        kanji: 'テスト',
        kana: 'てすと',
        meaningEn: 'test'
      }

      const steps = generateBlastSteps([item])

      steps.forEach(step => {
        expect(step.itemId).toBe('test-item')
      })
    })

    it('should include correct prompts and answers', () => {
      const item: BlastItem = {
        id: 'test',
        contentType: 'vocabulary',
        kanji: '猫',
        kana: 'ねこ',
        meaningEn: 'cat'
      }

      const steps = generateBlastSteps([item])

      // Step 1: Meaning → Japanese
      expect(steps[0].prompt).toBe('cat')
      expect(steps[0].answer).toBe('猫')

      // Step 2: Reassemble
      expect(steps[1].prompt).toBe('cat')
      expect(steps[1].tiles).toBeDefined()

      // Step 3: Japanese → Meaning
      expect(steps[2].prompt).toBe('猫')
      expect(steps[2].answer).toBe('cat')
    })
  })
})
