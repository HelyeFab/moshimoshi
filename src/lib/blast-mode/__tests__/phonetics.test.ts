/**
 * Tests for Phonetics Utility
 * Agent C - Distractor & Tile Logic
 */

import {
  countMora,
  getPhoneticNeighbor,
  generatePhoneticNeighbors,
  arePhoneticallySimilar,
  normalizeReading,
  filterByMoraCount
} from '../phonetics'

describe('Phonetics Utility', () => {
  describe('countMora', () => {
    it('should count mora correctly for simple hiragana', () => {
      expect(countMora('さくら')).toBe(3) // sa-ku-ra
      expect(countMora('はな')).toBe(2)   // ha-na
      expect(countMora('こうこう')).toBe(4) // ko-u-ko-u
    })

    it('should count mora correctly with small tsu', () => {
      expect(countMora('がっこう')).toBe(4) // ga-Q-ko-u (small tsu counts as mora)
      expect(countMora('きって')).toBe(3)   // ki-Q-te (small tsu counts as mora)
    })

    it('should count mora correctly with small ya/yu/yo', () => {
      expect(countMora('きょう')).toBe(2)   // kyo-u
      expect(countMora('しゃしん')).toBe(3) // sha-shi-n
      expect(countMora('りゅう')).toBe(2)   // ryu-u
    })

    it('should handle katakana', () => {
      expect(countMora('コーヒー')).toBe(4)   // ko-o-hi-i
      expect(countMora('カメラ')).toBe(3)     // ka-me-ra
      expect(countMora('パソコン')).toBe(4)   // pa-so-ko-n
    })

    it('should handle long vowel markers', () => {
      expect(countMora('らーめん')).toBe(4)   // ra-a-me-n
      expect(countMora('コーヒー')).toBe(4)   // ko-o-hi-i
    })

    it('should handle empty string', () => {
      expect(countMora('')).toBe(0)
    })
  })

  describe('getPhoneticNeighbor', () => {
    it('should find phonetic neighbor with same vowel', () => {
      const neighbor = getPhoneticNeighbor('か') // ka
      expect(neighbor).toBeTruthy()
      // Should be same vowel (a), different consonant
      expect(['あ', 'さ', 'た', 'な', 'は', 'ま', 'や', 'ら', 'わ', 'が', 'ざ', 'だ', 'ば', 'ぱ']).toContain(neighbor)
    })

    it('should find neighbor for hiragana', () => {
      const neighbor = getPhoneticNeighbor('し') // shi
      expect(neighbor).toBeTruthy()
      // Same vowel 'i'
      expect(['い', 'き', 'ち', 'に', 'ひ', 'み', 'り', 'ぎ', 'じ', 'び', 'ぴ']).toContain(neighbor)
    })

    it('should find neighbor for katakana', () => {
      const neighbor = getPhoneticNeighbor('カ') // ka
      expect(neighbor).toBeTruthy()
      expect(['ア', 'サ', 'タ', 'ナ', 'ハ', 'マ', 'ヤ', 'ラ', 'ワ', 'ガ', 'ザ', 'ダ', 'バ', 'パ']).toContain(neighbor)
    })

    it('should return null for invalid kana', () => {
      expect(getPhoneticNeighbor('a')).toBeNull()
      expect(getPhoneticNeighbor('あ')).toBeTruthy() // valid hiragana
    })
  })

  describe('generatePhoneticNeighbors', () => {
    it('should generate multiple phonetic neighbors', () => {
      const neighbors = generatePhoneticNeighbors('さくら', 3)
      expect(neighbors.length).toBeGreaterThan(0)
      expect(neighbors.length).toBeLessThanOrEqual(3)
      // Should not include the original
      expect(neighbors).not.toContain('さくら')
    })

    it('should generate neighbors for simple reading', () => {
      const neighbors = generatePhoneticNeighbors('こう', 3)
      expect(neighbors.length).toBeGreaterThan(0)
      expect(neighbors).not.toContain('こう')
    })

    it('should handle katakana', () => {
      const neighbors = generatePhoneticNeighbors('コウ', 3)
      expect(neighbors.length).toBeGreaterThan(0)
      expect(neighbors).not.toContain('コウ')
    })

    it('should return empty array for empty string', () => {
      expect(generatePhoneticNeighbors('', 3)).toEqual([])
    })

    it('should not exceed requested count', () => {
      const neighbors = generatePhoneticNeighbors('さくら', 5)
      expect(neighbors.length).toBeLessThanOrEqual(5)
    })
  })

  describe('arePhoneticallySimilar', () => {
    it('should detect identical readings', () => {
      expect(arePhoneticallySimilar('こう', 'こう')).toBe(true)
    })

    it('should detect substring similarity', () => {
      expect(arePhoneticallySimilar('がっこう', 'こう')).toBe(true)
      expect(arePhoneticallySimilar('こう', 'がっこう')).toBe(true)
    })

    it('should detect character overlap', () => {
      // さくら (sa-ku-ra) and さくり (sa-ku-ri) share さ and く
      // Unique chars: {さ, く, ら, り} = 4, common: {さ, く} = 2, similarity = 2/4 = 0.5
      expect(arePhoneticallySimilar('さくら', 'さくり', 0.5)).toBe(true)
      expect(arePhoneticallySimilar('さくら', 'さくり', 0.6)).toBe(false)
    })

    it('should not flag completely different readings', () => {
      expect(arePhoneticallySimilar('さくら', 'はな')).toBe(false)
      expect(arePhoneticallySimilar('こう', 'せい')).toBe(false)
    })

    it('should handle empty strings', () => {
      expect(arePhoneticallySimilar('', '')).toBe(false)
      expect(arePhoneticallySimilar('こう', '')).toBe(false)
    })

    it('should respect threshold parameter', () => {
      // さくら and さくり: similarity ~0.5
      expect(arePhoneticallySimilar('さくら', 'さくり', 0.9)).toBe(false)
      expect(arePhoneticallySimilar('さくら', 'さくり', 0.4)).toBe(true)
      // さくら and はな: very different, low similarity
      expect(arePhoneticallySimilar('さくら', 'はな', 0.5)).toBe(false)
    })
  })

  describe('normalizeReading', () => {
    it('should convert katakana to hiragana', () => {
      expect(normalizeReading('コウ')).toBe('こう')
      expect(normalizeReading('カメラ')).toBe('かめら')
    })

    it('should normalize long vowel markers', () => {
      // Long vowel markers are simplified to 'う' approximation
      expect(normalizeReading('コーヒー')).toBe('こうひう')
      expect(normalizeReading('らーめん')).toBe('らうめん')
    })

    it('should handle mixed scripts', () => {
      const normalized = normalizeReading('こうコウ')
      expect(normalized).toBe('こうこう')
    })

    it('should handle empty string', () => {
      expect(normalizeReading('')).toBe('')
    })

    it('should lowercase result', () => {
      const result = normalizeReading('コウ')
      expect(result).toBe(result.toLowerCase())
    })
  })

  describe('filterByMoraCount', () => {
    it('should filter readings by mora count', () => {
      const readings = ['こう', 'さくら', 'はな', 'がっこう', 'き']
      // こう = 2 mora (ko-u), はな = 2 mora (ha-na), き = 1 mora
      // さくら = 3 mora (sa-ku-ra), がっこう = 4 mora (ga-Q-ko-u)
      const filtered = filterByMoraCount(readings, 2)
      expect(filtered).toContain('こう')
      expect(filtered).toContain('はな')
      expect(filtered).not.toContain('き')
      expect(filtered).not.toContain('さくら')
      expect(filtered).not.toContain('がっこう')
    })

    it('should return empty array when no matches', () => {
      const readings = ['さくら', 'がっこう']
      const filtered = filterByMoraCount(readings, 1)
      expect(filtered).toEqual([])
    })

    it('should handle empty array', () => {
      expect(filterByMoraCount([], 2)).toEqual([])
    })

    it('should handle katakana readings', () => {
      const readings = ['コウ', 'カメラ', 'パソコン']
      // コウ = 2 mora (ko-u), カメラ = 3 mora (ka-me-ra), パソコン = 4 mora (pa-so-ko-n)
      const filtered = filterByMoraCount(readings, 2)
      expect(filtered).toContain('コウ')
      expect(filtered).not.toContain('カメラ')
      expect(filtered).not.toContain('パソコン')
    })
  })
})
