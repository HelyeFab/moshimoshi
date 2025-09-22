import { detectWordType, detectWordTypeWithContext } from '../wordTypeDetector'

describe('Word Type Detector', () => {
  describe('JMDict POS tag detection', () => {
    test('detects Ichidan verbs from v1 tag', () => {
      const result = detectWordType('食べる', 'たべる', ['v1'])
      expect(result.conjugationType).toBe('Ichidan')
      expect(result.confidence).toBe('high')
      expect(result.isConjugatable).toBe(true)
    })

    test('detects Godan verbs from v5 tags', () => {
      const testCases = [
        { word: '買う', reading: 'かう', pos: ['v5u'], expected: 'Godan' },
        { word: '書く', reading: 'かく', pos: ['v5k'], expected: 'Godan' },
        { word: '泳ぐ', reading: 'およぐ', pos: ['v5g'], expected: 'Godan' },
        { word: '話す', reading: 'はなす', pos: ['v5s'], expected: 'Godan' },
        { word: '待つ', reading: 'まつ', pos: ['v5t'], expected: 'Godan' },
        { word: '死ぬ', reading: 'しぬ', pos: ['v5n'], expected: 'Godan' },
        { word: '遊ぶ', reading: 'あそぶ', pos: ['v5b'], expected: 'Godan' },
        { word: '飲む', reading: 'のむ', pos: ['v5m'], expected: 'Godan' },
        { word: '帰る', reading: 'かえる', pos: ['v5r'], expected: 'Godan' },
      ]

      testCases.forEach(({ word, reading, pos, expected }) => {
        const result = detectWordType(word, reading, pos)
        expect(result.conjugationType).toBe(expected)
        expect(result.confidence).toBe('high')
        expect(result.details?.verbEnding).toBe(word.slice(-1))
      })
    })

    test('detects irregular verbs', () => {
      const testCases = [
        { word: 'する', pos: ['vs-i'], isSuru: true },
        { word: '勉強する', pos: ['vs'], isSuru: true },
        { word: '来る', reading: 'くる', pos: ['vk'], isKuru: true },
      ]

      testCases.forEach(({ word, reading, pos, isSuru, isKuru }) => {
        const result = detectWordType(word, reading, pos)
        expect(result.conjugationType).toBe('Irregular')
        expect(result.confidence).toBe('high')
        expect(result.details?.isSuruVerb).toBe(isSuru || false)
        expect(result.details?.isKuruVerb).toBe(isKuru || false)
      })
    })

    test('detects adjectives', () => {
      const iAdj = detectWordType('高い', 'たかい', ['adj-i'])
      expect(iAdj.conjugationType).toBe('i-adjective')
      expect(iAdj.confidence).toBe('high')

      const naAdj = detectWordType('綺麗', 'きれい', ['adj-na'])
      expect(naAdj.conjugationType).toBe('na-adjective')
      expect(naAdj.confidence).toBe('high')
    })
  })

  describe('Pattern-based detection', () => {
    test('detects する verbs by ending', () => {
      const result = detectWordType('勉強する', '勉強する')
      expect(result.conjugationType).toBe('Irregular')
      expect(result.confidence).toBe('high')
      expect(result.details?.isSuruVerb).toBe(true)
    })

    test('detects common Ichidan patterns', () => {
      const testCases = [
        '食べる', // ta-be-ru
        '見る',   // mi-ru
        '起きる', // o-ki-ru
        '寝る',   // ne-ru
        '出る',   // de-ru
      ]

      testCases.forEach(word => {
        const result = detectWordType(word, word)
        expect(result.conjugationType).toBe('Ichidan')
        expect(result.confidence).toBe('high')
      })
    })

    test('correctly identifies Godan る exceptions', () => {
      const godanRuVerbs = [
        '帰る',   // kaeru - to return
        '切る',   // kiru - to cut
        '知る',   // shiru - to know
        '入る',   // hairu - to enter
        '走る',   // hashiru - to run
      ]

      godanRuVerbs.forEach(word => {
        const result = detectWordType(word, word)
        expect(result.conjugationType).toBe('Godan')
        expect(result.confidence).toBe('high')
      })
    })

    test('detects i-adjectives by ending', () => {
      const adjectives = [
        '高い',    // takai
        '美しい',  // utsukushii
        '新しい',  // atarashii
        '楽しい',  // tanoshii
      ]

      adjectives.forEach(word => {
        const result = detectWordType(word, word)
        expect(result.conjugationType).toBe('i-adjective')
        expect(result.isConjugatable).toBe(true)
      })
    })

    test('handles 行く special case', () => {
      const result = detectWordType('行く', 'いく')
      expect(result.conjugationType).toBe('Godan')
      expect(result.confidence).toBe('high')
    })
  })

  describe('Context-based detection', () => {
    test('uses meaning to refine low confidence results', () => {
      // Without meaning - low confidence
      const withoutMeaning = detectWordType('見る')

      // With meaning - should improve confidence
      const withMeaning = detectWordTypeWithContext('見る', 'みる', [], 'to see')
      expect(withMeaning.conjugationType).toBe('Ichidan')
      expect(withMeaning.confidence).toBe('medium')
    })
  })

  describe('Non-conjugatable types', () => {
    test('correctly identifies non-conjugatable words', () => {
      const noun = detectWordType('本', 'ほん', ['n'])
      expect(noun.baseType).toBe('noun')
      expect(noun.isConjugatable).toBe(false)

      const particle = detectWordType('は', 'は', ['particle'])
      expect(particle.baseType).toBe('particle')
      expect(particle.isConjugatable).toBe(false)

      const adverb = detectWordType('とても', 'とても', ['adv'])
      expect(adverb.baseType).toBe('adverb')
      expect(adverb.isConjugatable).toBe(false)
    })
  })

  describe('Edge cases', () => {
    test('handles missing or empty POS tags', () => {
      const result = detectWordType('食べる', 'たべる', [])
      expect(result.conjugationType).toBe('Ichidan')
      expect(result.confidence).not.toBe('high') // Should be medium or low
    })

    test('handles words ending in ない (not i-adjectives)', () => {
      const result = detectWordType('しない', 'しない')
      expect(result.conjugationType).not.toBe('i-adjective')
    })

    test('handles compound verbs correctly', () => {
      const result = detectWordType('勉強する', 'べんきょうする')
      expect(result.conjugationType).toBe('Irregular')
      expect(result.details?.isCompound).toBe(true)
      expect(result.details?.isSuruVerb).toBe(true)
    })
  })
})