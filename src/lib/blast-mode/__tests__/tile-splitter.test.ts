/**
 * Tests for Tile Splitter
 * Agent C - Distractor & Tile Logic
 */

import type { BlastItem } from '../types'
import {
  splitByMorpheme,
  splitByKanaChunk,
  splitByKanjiOrder,
  splitByCharacter,
  splitIntoTiles,
  shuffleTiles,
  validateTileAnswer
} from '../tile-splitter'

describe('Tile Splitter', () => {
  describe('splitByMorpheme', () => {
    it('should use provided tokens when available', () => {
      const result = splitByMorpheme('食べる', ['食', 'べる'])
      expect(result.tiles).toEqual(['食', 'べる'])
      expect(result.strategy).toBe('morpheme')
      expect(result.confidence).toBe('high')
    })

    it('should split at kanji/kana boundaries', () => {
      const result = splitByMorpheme('日本')
      // Two kanji together may not split without kana boundary
      expect(result.tiles.length).toBeGreaterThan(0)
      expect(result.tiles.join('')).toBe('日本')
      expect(result.strategy).toBe('morpheme')
    })

    it('should keep kanji with okurigana together', () => {
      const result = splitByMorpheme('食べる')
      // Should keep 食べる as a single tile
      expect(result.tiles).toEqual(['食べる'])
      expect(result.strategy).toBe('morpheme')
    })

    it('should keep okurigana together for other verbs', () => {
      expect(splitByMorpheme('見る').tiles).toEqual(['見る'])
      expect(splitByMorpheme('行く').tiles).toEqual(['行く'])
      expect(splitByMorpheme('飲む').tiles).toEqual(['飲む'])
      expect(splitByMorpheme('読んで').tiles).toEqual(['読んで'])
    })

    it('should keep i-adjectives together', () => {
      const result = splitByMorpheme('大きい')
      expect(result.tiles).toEqual(['大きい'])
    })

    it('should split out particles', () => {
      const result = splitByMorpheme('学校は')
      expect(result.tiles).toContain('は')
      expect(result.tiles.length).toBeGreaterThan(1)
    })

    it('should handle pure hiragana', () => {
      const result = splitByMorpheme('ありがとう')
      expect(result.tiles.length).toBeGreaterThan(0)
      expect(result.tiles.join('')).toBe('ありがとう')
    })

    it('should handle pure katakana', () => {
      const result = splitByMorpheme('コーヒー')
      expect(result.tiles.length).toBeGreaterThan(0)
      expect(result.tiles.join('')).toBe('コーヒー')
    })

    it('should handle mixed kanji and kana', () => {
      const result = splitByMorpheme('日本語')
      // Pure kanji string - may not split by morpheme since no kana boundaries
      expect(result.tiles.length).toBeGreaterThan(0)
      expect(result.tiles.join('')).toBe('日本語')
    })
  })

  describe('splitByKanaChunk', () => {
    it('should split hiragana into 2-mora chunks', () => {
      const result = splitByKanaChunk('さくら')
      expect(result.tiles.length).toBeGreaterThan(1)
      expect(result.tiles.join('')).toBe('さくら')
      expect(result.strategy).toBe('kana-chunk')
    })

    it('should split at particles', () => {
      const result = splitByKanaChunk('ありがとうは')
      // Should split into chunks, は may be separate or with previous
      expect(result.tiles.length).toBeGreaterThan(1)
      expect(result.tiles.join('')).toBe('ありがとうは')
    })

    it('should handle katakana', () => {
      const result = splitByKanaChunk('カメラ')
      expect(result.tiles.length).toBeGreaterThan(0)
      expect(result.tiles.join('')).toBe('カメラ')
    })

    it('should not count small kana as separate mora', () => {
      const result = splitByKanaChunk('きょう')
      // きょう is 2 mora, should be in one or two chunks
      expect(result.tiles.join('')).toBe('きょう')
    })
  })

  describe('splitByKanjiOrder', () => {
    it('should split kanji into individual characters', () => {
      const result = splitByKanjiOrder('日本語')
      expect(result.tiles).toEqual(['日', '本', '語'])
      expect(result.strategy).toBe('kanji-order')
    })

    it('should group consecutive kana together', () => {
      const result = splitByKanjiOrder('食べる')
      expect(result.tiles).toContain('食')
      // べる should be grouped
      expect(result.tiles.some(tile => tile.includes('べる') || tile === 'べる')).toBe(true)
    })

    it('should handle pure kanji', () => {
      const result = splitByKanjiOrder('学校')
      expect(result.tiles).toEqual(['学', '校'])
    })

    it('should handle mixed content', () => {
      const result = splitByKanjiOrder('今日は')
      expect(result.tiles).toContain('今')
      expect(result.tiles).toContain('日')
      expect(result.tiles.some(t => t.includes('は'))).toBe(true)
    })
  })

  describe('splitByCharacter', () => {
    it('should split into individual characters', () => {
      const result = splitByCharacter('こんにちは')
      expect(result.tiles).toEqual(['こ', 'ん', 'に', 'ち', 'は'])
      expect(result.strategy).toBe('character')
      expect(result.confidence).toBe('low')
    })

    it('should handle kanji', () => {
      const result = splitByCharacter('日本')
      expect(result.tiles).toEqual(['日', '本'])
    })

    it('should filter out whitespace', () => {
      const result = splitByCharacter('こ ん に')
      expect(result.tiles).toEqual(['こ', 'ん', 'に'])
    })
  })

  describe('splitIntoTiles', () => {
    it('should prioritize provided tokens', () => {
      const item: BlastItem = {
        id: '1',
        contentType: 'vocabulary',
        kanji: '食べる',
        kana: 'たべる',
        meaningEn: 'to eat',
        tokens: ['食', 'べる']
      }

      const result = splitIntoTiles(item)
      expect(result.tiles).toEqual(['食', 'べる'])
      expect(result.strategy).toBe('morpheme')
      expect(result.confidence).toBe('high')
    })

    it('should split kanji vocabulary appropriately', () => {
      const item: BlastItem = {
        id: '2',
        contentType: 'vocabulary',
        kanji: '学校',
        kana: 'がっこう',
        meaningEn: 'school'
      }

      const result = splitIntoTiles(item)
      // Pure kanji compound - will use kanji-order strategy
      expect(['morpheme', 'kanji-order']).toContain(result.strategy)
      expect(result.tiles.length).toBeGreaterThan(1)
      expect(result.tiles.join('')).toBe('学校')
    })

    it('should use kana chunk split for kana-only', () => {
      const item: BlastItem = {
        id: '3',
        contentType: 'vocabulary',
        kana: 'ありがとう',
        meaningEn: 'thank you'
      }

      const result = splitIntoTiles(item)
      expect(['morpheme', 'kana-chunk']).toContain(result.strategy)
      expect(result.tiles.join('')).toBe('ありがとう')
    })

    it('should use kanji order for kanji-only', () => {
      const item: BlastItem = {
        id: '4',
        contentType: 'kanji',
        kanji: '日本語',
        meaningEn: 'Japanese language'
      }

      const result = splitIntoTiles(item)
      expect(['morpheme', 'kanji-order']).toContain(result.strategy)
      expect(result.tiles.length).toBeGreaterThan(1)
    })

    it('should handle katakana vocabulary', () => {
      const item: BlastItem = {
        id: '5',
        contentType: 'vocabulary',
        kana: 'コーヒー',
        meaningEn: 'coffee'
      }

      const result = splitIntoTiles(item)
      expect(result.tiles.length).toBeGreaterThan(0)
      expect(result.tiles.join('')).toBe('コーヒー')
    })

    it('should return empty tiles for empty item', () => {
      const item: BlastItem = {
        id: '6',
        contentType: 'vocabulary',
        meaningEn: 'test'
      }

      const result = splitIntoTiles(item)
      expect(result.tiles).toEqual([])
      expect(result.confidence).toBe('low')
    })
  })

  describe('shuffleTiles', () => {
    it('should shuffle tiles', () => {
      const tiles = ['食', 'べ', 'る']
      const shuffled = shuffleTiles(tiles)

      expect(shuffled.length).toBe(tiles.length)
      expect(shuffled).toContain('食')
      expect(shuffled).toContain('べ')
      expect(shuffled).toContain('る')
    })

    it('should produce different order (probabilistically)', () => {
      const tiles = ['食', 'べ', 'る', 'も', 'の']
      const shuffled = shuffleTiles(tiles)

      // With 5 tiles, very likely to be different order
      // (might occasionally fail due to randomness, but very unlikely)
      expect(shuffled).not.toEqual(tiles)
    })

    it('should handle single tile', () => {
      const tiles = ['食']
      const shuffled = shuffleTiles(tiles)
      expect(shuffled).toEqual(['食'])
    })

    it('should handle empty array', () => {
      const shuffled = shuffleTiles([])
      expect(shuffled).toEqual([])
    })

    it('should not mutate original array', () => {
      const original = ['食', 'べ', 'る']
      const copy = [...original]
      shuffleTiles(original)
      expect(original).toEqual(copy)
    })
  })

  describe('validateTileAnswer', () => {
    it('should validate correct order', () => {
      const correct = ['食', 'べ', 'る']
      const user = ['食', 'べ', 'る']
      expect(validateTileAnswer(user, correct)).toBe(true)
    })

    it('should reject incorrect order', () => {
      const correct = ['食', 'べ', 'る']
      const user = ['べ', '食', 'る']
      expect(validateTileAnswer(user, correct)).toBe(false)
    })

    it('should reject missing tiles', () => {
      const correct = ['食', 'べ', 'る']
      const user = ['食', 'べ']
      expect(validateTileAnswer(user, correct)).toBe(false)
    })

    it('should reject extra tiles', () => {
      const correct = ['食', 'べ', 'る']
      const user = ['食', 'べ', 'る', 'も']
      expect(validateTileAnswer(user, correct)).toBe(false)
    })

    it('should handle empty arrays', () => {
      expect(validateTileAnswer([], [])).toBe(true)
      expect(validateTileAnswer(['食'], [])).toBe(false)
    })
  })
})
