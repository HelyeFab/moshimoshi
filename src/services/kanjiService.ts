import { Kanji, JLPTLevel, KanjiByLevel, KanjiExample } from '@/types/kanji'

interface RawKanji {
  kanji: string
  meaning: string
  onyomi: string[]
  kunyomi: string[]
}

class KanjiService {
  private kanjiCache: KanjiByLevel = {}
  private readonly KANJI_BASE_PATH = '/data/kanji'
  private examplesData: Map<string, KanjiExample[]> = new Map()
  private strokeCounts: Map<string, number> = new Map()
  private grades: Map<string, number> = new Map()
  private frequencies: Map<string, number> = new Map()

  constructor() {
    this.initializeEnrichmentData()
  }

  private initializeEnrichmentData() {
    // Initialize common N5 kanji with grade and frequency data
    const commonData: [string, number, number, number][] = [
      ['人', 2, 1, 5],
      ['一', 1, 1, 2],
      ['日', 4, 1, 1],
      ['年', 6, 1, 3],
      ['大', 3, 1, 7],
      ['月', 4, 1, 4],
      ['水', 4, 1, 78],
      ['火', 4, 1, 574],
      ['木', 4, 1, 464],
      ['金', 8, 1, 53],
      ['土', 3, 1, 363],
      ['子', 3, 1, 72],
      ['女', 3, 1, 151],
      ['男', 7, 1, 240],
      ['中', 4, 1, 11],
      ['小', 3, 1, 114],
      ['上', 3, 1, 35],
      ['下', 3, 1, 97],
      ['左', 5, 1, 630],
      ['右', 5, 1, 602],
      ['本', 5, 1, 10],
      ['今', 4, 2, 49],
      ['何', 7, 2, 340],
      ['時', 10, 2, 16],
      ['分', 4, 2, 26],
      ['前', 9, 2, 27],
      ['後', 9, 2, 29],
      ['週', 11, 2, 146],
      ['来', 7, 2, 89],
      ['見', 7, 1, 22],
    ]

    commonData.forEach(([kanji, strokes, grade, freq]) => {
      this.strokeCounts.set(kanji, strokes)
      this.grades.set(kanji, grade)
      this.frequencies.set(kanji, freq)
    })

    // Initialize example sentences
    this.initializeExamples()
  }

  private initializeExamples() {
    const examples: [string, KanjiExample[]][] = [
      ['人', [
        { word: '日本人', reading: 'にほんじん', meaning: 'Japanese person' },
        { word: '人々', reading: 'ひとびと', meaning: 'people' },
        { word: '外国人', reading: 'がいこくじん', meaning: 'foreigner' }
      ]],
      ['一', [
        { word: '一つ', reading: 'ひとつ', meaning: 'one (thing)' },
        { word: '一人', reading: 'ひとり', meaning: 'one person' },
        { word: '一月', reading: 'いちがつ', meaning: 'January' }
      ]],
      ['日', [
        { word: '日本', reading: 'にほん', meaning: 'Japan' },
        { word: '日曜日', reading: 'にちようび', meaning: 'Sunday' },
        { word: '今日', reading: 'きょう', meaning: 'today' }
      ]],
      ['年', [
        { word: '今年', reading: 'ことし', meaning: 'this year' },
        { word: '来年', reading: 'らいねん', meaning: 'next year' },
        { word: '一年', reading: 'いちねん', meaning: 'one year' }
      ]],
      ['大', [
        { word: '大きい', reading: 'おおきい', meaning: 'big' },
        { word: '大学', reading: 'だいがく', meaning: 'university' },
        { word: '大人', reading: 'おとな', meaning: 'adult' }
      ]],
      ['月', [
        { word: '月曜日', reading: 'げつようび', meaning: 'Monday' },
        { word: '今月', reading: 'こんげつ', meaning: 'this month' },
        { word: '一月', reading: 'いちがつ', meaning: 'January' }
      ]],
      ['水', [
        { word: '水曜日', reading: 'すいようび', meaning: 'Wednesday' },
        { word: '水', reading: 'みず', meaning: 'water' },
        { word: '水泳', reading: 'すいえい', meaning: 'swimming' }
      ]],
      ['火', [
        { word: '火曜日', reading: 'かようび', meaning: 'Tuesday' },
        { word: '火', reading: 'ひ', meaning: 'fire' },
        { word: '花火', reading: 'はなび', meaning: 'fireworks' }
      ]],
      ['木', [
        { word: '木曜日', reading: 'もくようび', meaning: 'Thursday' },
        { word: '木', reading: 'き', meaning: 'tree' },
        { word: '木村', reading: 'きむら', meaning: 'Kimura (surname)' }
      ]],
      ['金', [
        { word: '金曜日', reading: 'きんようび', meaning: 'Friday' },
        { word: 'お金', reading: 'おかね', meaning: 'money' },
        { word: '金魚', reading: 'きんぎょ', meaning: 'goldfish' }
      ]],
      ['土', [
        { word: '土曜日', reading: 'どようび', meaning: 'Saturday' },
        { word: '土', reading: 'つち', meaning: 'earth, soil' },
        { word: '土地', reading: 'とち', meaning: 'land' }
      ]],
    ]

    examples.forEach(([kanji, exampleList]) => {
      this.examplesData.set(kanji, exampleList)
    })
  }

  private enrichKanji(rawKanji: RawKanji, level: JLPTLevel): Kanji {
    // Create meanings array from the single meaning
    const meanings = [rawKanji.meaning]
    if (rawKanji.meaning.includes(';')) {
      meanings.push(...rawKanji.meaning.split(';').map(m => m.trim()).filter(m => m))
    }

    // Clean up readings (remove dots and hyphens from kunyomi)
    const cleanedKunyomi = rawKanji.kunyomi.map(reading =>
      reading.replace(/[\.\-]/g, '')
    )

    const enrichedKanji: Kanji = {
      kanji: rawKanji.kanji,
      meaning: rawKanji.meaning,
      meanings: [...new Set(meanings)],
      onyomi: rawKanji.onyomi,
      kunyomi: cleanedKunyomi,
      jlpt: level,
      strokeCount: this.strokeCounts.get(rawKanji.kanji) || 10,
      examples: this.examplesData.get(rawKanji.kanji) || [],
      ...(this.grades.has(rawKanji.kanji) && { grade: this.grades.get(rawKanji.kanji) }),
      ...(this.frequencies.has(rawKanji.kanji) && { frequency: this.frequencies.get(rawKanji.kanji) })
    }

    return enrichedKanji
  }

  async loadKanjiByLevel(level: JLPTLevel): Promise<Kanji[]> {
    // Check cache first
    if (this.kanjiCache[level]) {
      return this.kanjiCache[level]!
    }

    try {
      // Map level to filename
      const levelNumber = level.replace('N', '')
      const response = await fetch(`${this.KANJI_BASE_PATH}/jlpt_${levelNumber}.json`)

      if (!response.ok) {
        throw new Error(`Failed to load ${level} kanji`)
      }

      const rawData: RawKanji[] = await response.json()

      // Enrich each kanji with additional data
      const kanjiWithLevel = rawData.map(raw => this.enrichKanji(raw, level))

      // Cache the result
      this.kanjiCache[level] = kanjiWithLevel

      return kanjiWithLevel
    } catch (error) {
      console.error(`Error loading ${level} kanji:`, error)
      return []
    }
  }

  async loadAllKanji(): Promise<KanjiByLevel> {
    const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
    const kanjiByLevel: KanjiByLevel = {}

    await Promise.all(
      levels.map(async (level) => {
        kanjiByLevel[level] = await this.loadKanjiByLevel(level)
      })
    )

    return kanjiByLevel
  }

  async searchKanji(query: string, levels?: JLPTLevel[]): Promise<Kanji[]> {
    const searchLevels = levels || ['N5', 'N4', 'N3', 'N2', 'N1']
    const results: Kanji[] = []
    const normalizedQuery = query.toLowerCase()

    for (const level of searchLevels) {
      const levelKanji = await this.loadKanjiByLevel(level)
      const matches = levelKanji.filter(kanji =>
        kanji.kanji.includes(query) ||
        kanji.meaning.toLowerCase().includes(normalizedQuery) ||
        kanji.meanings.some(m => m.toLowerCase().includes(normalizedQuery)) ||
        kanji.onyomi.some(reading => reading.toLowerCase().includes(normalizedQuery)) ||
        kanji.kunyomi.some(reading => reading.toLowerCase().includes(normalizedQuery)) ||
        kanji.examples.some(ex =>
          ex.word.includes(query) ||
          ex.reading.toLowerCase().includes(normalizedQuery) ||
          ex.meaning.toLowerCase().includes(normalizedQuery)
        )
      )
      results.push(...matches)
    }

    return results
  }

  async getKanjiDetails(character: string): Promise<Kanji | null> {
    const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

    for (const level of levels) {
      const levelKanji = await this.loadKanjiByLevel(level)
      const found = levelKanji.find(k => k.kanji === character)
      if (found) {
        return found
      }
    }

    return null
  }

  async getStrokeOrderSVG(character: string): Promise<string | null> {
    try {
      // Get Unicode code point
      const codePoint = character.charCodeAt(0).toString(16).padStart(5, '0')

      // Fetch SVG from KanjiVG data
      const response = await fetch(`/data/kanjivg/${codePoint}.svg`)

      if (!response.ok) {
        return null
      }

      return await response.text()
    } catch (error) {
      console.error('Error fetching stroke order:', error)
      return null
    }
  }

  getStrokeCount(svgText: string): number {
    try {
      const parser = new DOMParser()
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml')

      // Count stroke paths
      const strokePaths = svgDoc.querySelectorAll('path[id*="kvg:"]')
      return strokePaths.length
    } catch (error) {
      console.error('Error counting strokes:', error)
      return 0
    }
  }
}

export const kanjiService = new KanjiService()