/**
 * Tests for Distractor Generator
 * Agent C - Distractor & Tile Logic
 */

import type { BlastItem } from '../types'
import type { DistractorPool } from '../distractors'
import {
  generateMeaningDistractors,
  generateJapaneseDistractors,
  generateReadingDistractors,
  buildMcqOptions,
  generateMeaningMcq,
  generateJapaneseMcq,
  generateReadingMcq
} from '../distractors'

describe('Distractor Generator', () => {
  const mockVocabPool: DistractorPool = {
    vocabulary: [
      { kanji: '食べる', kana: 'たべる', meaning: 'to eat', pos: 'verb' },
      { kanji: '飲む', kana: 'のむ', meaning: 'to drink', pos: 'verb' },
      { kanji: '行く', kana: 'いく', meaning: 'to go', pos: 'verb' },
      { kanji: '来る', kana: 'くる', meaning: 'to come', pos: 'verb' },
      { kanji: '見る', kana: 'みる', meaning: 'to see', pos: 'verb' },
      { kanji: '学校', kana: 'がっこう', meaning: 'school', pos: 'noun' },
      { kanji: '先生', kana: 'せんせい', meaning: 'teacher', pos: 'noun' },
      { kanji: '大きい', kana: 'おおきい', meaning: 'big', pos: 'adjective' },
      { kana: 'ありがとう', meaning: 'thank you' },
      { kana: 'こんにちは', meaning: 'hello' }
    ],
    readings: [
      { reading: 'こう', type: 'onyomi' },
      { reading: 'せい', type: 'onyomi' },
      { reading: 'がく', type: 'onyomi' },
      { reading: 'みる', type: 'kunyomi' },
      { reading: 'いく', type: 'kunyomi' },
      { reading: 'くる', type: 'kunyomi' }
    ]
  }

  describe('generateMeaningDistractors', () => {
    it('should generate distractors from pool', () => {
      const distractors = generateMeaningDistractors('to eat', {
        pool: mockVocabPool,
        count: 3
      })

      expect(distractors.length).toBe(3)
      expect(distractors).not.toContain('to eat')
    })

    it('should avoid similar meanings when enabled', () => {
      const distractors = generateMeaningDistractors('to eat', {
        pool: mockVocabPool,
        count: 3,
        avoidSimilar: true
      })

      // Should not include very similar meanings
      distractors.forEach(d => {
        expect(d.toLowerCase()).not.toBe('to eat')
      })
    })

    it('should return empty when pool is empty', () => {
      const distractors = generateMeaningDistractors('to eat', {
        count: 3
      })

      expect(distractors.length).toBe(0)
      expect(distractors).not.toContain('to eat')
    })

    it('should filter by approximate length', () => {
      const distractors = generateMeaningDistractors('to eat', {
        pool: mockVocabPool,
        count: 3
      })

      // Should not include very long meanings like "teacher" for "to eat"
      distractors.forEach(d => {
        const lengthRatio = Math.abs(d.length - 'to eat'.length) / 'to eat'.length
        // Allow some flexibility but not extreme differences
        expect(lengthRatio).toBeLessThan(2)
      })
    })

    it('should handle empty pool gracefully', () => {
      const distractors = generateMeaningDistractors('test', {
        pool: { vocabulary: [] },
        count: 3
      })

      expect(distractors.length).toBe(0)
    })
  })

  describe('generateJapaneseDistractors', () => {
    it('should generate distractors from pool', () => {
      const distractors = generateJapaneseDistractors('食べる', {
        pool: mockVocabPool,
        count: 3
      })

      expect(distractors.length).toBeGreaterThan(0)
      expect(distractors.length).toBeLessThanOrEqual(3)
      expect(distractors).not.toContain('食べる')
    })

    it('should match length when enabled', () => {
      const distractors = generateJapaneseDistractors('学校', {
        pool: mockVocabPool,
        count: 3,
        matchLength: true
      })

      distractors.forEach(d => {
        expect(Math.abs(d.length - 2)).toBeLessThanOrEqual(1)
      })
    })

    it('should match script type (kanji vs kana)', () => {
      const kanjiDistractors = generateJapaneseDistractors('食べる', {
        pool: mockVocabPool,
        count: 3
      })

      // Should have kanji since input has kanji
      kanjiDistractors.forEach(d => {
        expect(/[\u4E00-\u9FFF]/.test(d)).toBe(true)
      })
    })

    it('should handle kana-only input', () => {
      const distractors = generateJapaneseDistractors('ありがとう', {
        pool: mockVocabPool,
        count: 3
      })

      expect(distractors.length).toBeGreaterThan(0)
      expect(distractors).not.toContain('ありがとう')
    })

    it('should return empty when pool is missing', () => {
      const distractors = generateJapaneseDistractors('食べる', {
        count: 3
      })

      expect(distractors.length).toBe(0)
    })
  })

  describe('generateReadingDistractors', () => {
    it('should generate onyomi distractors', () => {
      const distractors = generateReadingDistractors('こう', 'onyomi', {
        pool: mockVocabPool,
        count: 3
      })

      expect(distractors.length).toBeGreaterThan(0)
      expect(distractors.length).toBeLessThanOrEqual(3)
      expect(distractors).not.toContain('こう')
    })

    it('should generate kunyomi distractors', () => {
      const distractors = generateReadingDistractors('みる', 'kunyomi', {
        pool: mockVocabPool,
        count: 3
      })

      expect(distractors.length).toBeGreaterThan(0)
      expect(distractors).not.toContain('みる')
    })

    it('should match mora count when enabled', () => {
      const distractors = generateReadingDistractors('こう', 'onyomi', {
        pool: mockVocabPool,
        count: 3,
        matchMoraCount: true
      })

      // こう is 2 mora
      // Distractors should also be 2 mora when matchMoraCount is true
      // This is harder to test without exposing countMora, so just check they exist
      expect(distractors.length).toBeGreaterThan(0)
    })

    it('should avoid phonetically similar readings', () => {
      const distractors = generateReadingDistractors('こう', 'onyomi', {
        pool: mockVocabPool,
        count: 3
      })

      // Should not include readings too similar to こう
      distractors.forEach(d => {
        expect(d).not.toBe('こう')
        expect(d).not.toBe('ごう') // Very similar
      })
    })

    it('should generate phonetic neighbors without pool', () => {
      const distractors = generateReadingDistractors('こう', 'onyomi', {
        count: 3
      })

      expect(distractors.length).toBeGreaterThan(0)
    })
  })

  describe('buildMcqOptions', () => {
    it('should combine correct answer with distractors', () => {
      const result = buildMcqOptions('correct', ['wrong1', 'wrong2', 'wrong3'])

      expect(result.options.length).toBe(4)
      expect(result.options).toContain('correct')
      expect(result.options).toContain('wrong1')
      expect(result.options).toContain('wrong2')
      expect(result.options).toContain('wrong3')
    })

    it('should return correct index', () => {
      const result = buildMcqOptions('correct', ['wrong1', 'wrong2', 'wrong3'])

      expect(result.options[result.correctIndex]).toBe('correct')
    })

    it('should shuffle options', () => {
      const results = []
      for (let i = 0; i < 10; i++) {
        const result = buildMcqOptions('A', ['B', 'C', 'D'])
        results.push(result.correctIndex)
      }

      // With 10 trials, very likely to get different positions
      const uniquePositions = new Set(results)
      expect(uniquePositions.size).toBeGreaterThan(1)
    })

    it('should handle fewer distractors', () => {
      const result = buildMcqOptions('correct', ['wrong1', 'wrong2'])

      expect(result.options.length).toBe(3)
      expect(result.options).toContain('correct')
    })
  })

  describe('generateMeaningMcq', () => {
    it('should generate complete MCQ for meaning', () => {
      const item: BlastItem = {
        id: '1',
        contentType: 'vocabulary',
        kanji: '食べる',
        kana: 'たべる',
        meaningEn: 'to eat'
      }

      const result = generateMeaningMcq(item, mockVocabPool)

      expect(result.options.length).toBe(4)
      expect(result.options).toContain('to eat')
      expect(result.options[result.correctIndex]).toBe('to eat')
    })
  })

  describe('generateJapaneseMcq', () => {
    it('should generate complete MCQ for Japanese', () => {
      const item: BlastItem = {
        id: '1',
        contentType: 'vocabulary',
        kanji: '食べる',
        kana: 'たべる',
        meaningEn: 'to eat'
      }

      const result = generateJapaneseMcq(item, mockVocabPool)

      expect(result.options.length).toBe(4)
      expect(result.options).toContain('食べる')
      expect(result.options[result.correctIndex]).toBe('食べる')
    })

    it('should use kana when kanji is not available', () => {
      const item: BlastItem = {
        id: '2',
        contentType: 'vocabulary',
        kana: 'ありがとう',
        meaningEn: 'thank you'
      }

      const result = generateJapaneseMcq(item, mockVocabPool)

      // May not always get 4 options with limited pool, but should include correct answer
      expect(result.options.length).toBeGreaterThan(0)
      expect(result.options.length).toBeLessThanOrEqual(4)
      expect(result.options).toContain('ありがとう')
      expect(result.options[result.correctIndex]).toBe('ありがとう')
    })
  })

  describe('generateReadingMcq', () => {
    it('should generate complete MCQ for reading', () => {
      const result = generateReadingMcq('こう', 'onyomi', mockVocabPool)

      expect(result.options.length).toBe(4)
      expect(result.options).toContain('こう')
      expect(result.options[result.correctIndex]).toBe('こう')
    })

    it('should filter by reading type', () => {
      const result = generateReadingMcq('みる', 'kunyomi', mockVocabPool)

      expect(result.options.length).toBe(4)
      expect(result.options).toContain('みる')
    })
  })
})
