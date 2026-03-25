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
  private gradeCache: Map<number | 'S', Kanji[]> = new Map()

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

    const enrichedKanji: Kanji = {
      kanji: rawKanji.kanji,
      meaning: rawKanji.meaning,
      meanings: [...new Set(meanings)],
      onyomi: rawKanji.onyomi,
      // Preserve raw dictionary-style kunyomi notation (e.g. おお.きい, おお-)
      // so downstream reading-selection logic can distinguish standalone readings
      // from affix-like forms instead of flattening them prematurely.
      kunyomi: rawKanji.kunyomi,
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

  async loadKanjiByGrade(grade: number | 'S'): Promise<Kanji[]> {
    if (this.gradeCache.has(grade)) {
      return this.gradeCache.get(grade) || []
    }

    const all = await this.loadAllKanji()
    const combined = Object.values(all).flatMap(level => level || [])
    const filtered = combined.filter(kanji => kanji.grade === grade)

    this.gradeCache.set(grade, filtered)
    return filtered
  }

  async searchKanji(query: string, levels?: JLPTLevel[]): Promise<Kanji[]> {
    // Safety: empty query should return empty results, not all kanji
    if (!query || !query.trim()) {
      return []
    }

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

  // Batch get multiple kanji details efficiently
  async getMultipleKanjiDetails(characters: string[]): Promise<Map<string, Kanji>> {
    const result = new Map<string, Kanji>()

    // If no characters requested, return empty map
    if (!characters || characters.length === 0) {
      return result
    }

    const levels: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

    // Load all levels in parallel for better performance
    const allLevelData = await Promise.all(
      levels.map(level => this.loadKanjiByLevel(level))
    )

    // Flatten all kanji data and filter out undefined/null
    const allKanji = allLevelData.flat().filter(k => k && k.kanji)

    // Build the result map
    for (const character of characters) {
      const found = allKanji.find(k => k.kanji === character)
      if (found) {
        result.set(character, found)
      }
    }

    console.log(`[KanjiService] Found ${result.size} of ${characters.length} kanji`)
    return result
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

  /**
   * Get a mnemonic for a kanji character
   * Returns cached mnemonic if available, null otherwise
   * Use generateKanjiMnemonic to create one if not cached
   */
  async getKanjiMnemonic(kanji: string): Promise<KanjiMnemonic | null> {
    try {
      const response = await fetch(`/api/kanji/mnemonic?kanji=${encodeURIComponent(kanji)}`)
      if (!response.ok) return null

      const data = await response.json()
      if (!data.success) return null

      return data.mnemonic || null
    } catch (error) {
      console.error('[KanjiService] Error fetching mnemonic:', error)
      return null
    }
  }

  /**
   * Generate a mnemonic for a kanji character
   * Will create and cache a new mnemonic if one doesn't exist
   */
  async generateKanjiMnemonic(kanji: string, meaning?: string): Promise<KanjiMnemonic | null> {
    try {
      const response = await fetch('/api/kanji/mnemonic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kanji, meaning }),
      })

      if (!response.ok) return null

      const data = await response.json()
      if (!data.success) return null

      return data.mnemonic || null
    } catch (error) {
      console.error('[KanjiService] Error generating mnemonic:', error)
      return null
    }
  }
}

// Type for kanji mnemonic (used by client-side code)
export interface KanjiMnemonic {
  kanji: string
  meaning: string
  mnemonic: string
  components?: Array<{ part: string; meaning: string }>
  provider: 'ollama' | 'openai' | 'koohii' | 'manual'
  createdAt: Date
  author?: string   // For koohii attribution
  votes?: number    // Koohii community votes
}

// Type for user's custom mnemonic
export interface UserMnemonic {
  kanji: string
  mnemonic: string
  isPublic: boolean
  createdAt: string
  updatedAt: string
}

// Type for regeneration limit check result
export interface RegenerationLimit {
  allowed: boolean
  remaining: number
  resetAtUtc: string
}

// Type for regeneration result
export interface RegenerationResult {
  success: boolean
  mnemonic?: KanjiMnemonic
  remaining?: number
  resetAtUtc?: string
  error?: string
}

export const kanjiService = new KanjiService()

/**
 * Get user's custom mnemonic for a kanji
 */
export async function getUserMnemonic(kanji: string): Promise<UserMnemonic | null> {
  try {
    const response = await fetch(`/api/kanji/mnemonic/user?kanji=${encodeURIComponent(kanji)}`)
    if (!response.ok) return null

    const data = await response.json()
    if (!data.success || !data.mnemonic) return null

    return data.mnemonic
  } catch (error) {
    console.error('[kanjiService] Error fetching user mnemonic:', error)
    return null
  }
}

/**
 * Save user's custom mnemonic for a kanji
 */
export async function saveUserMnemonic(
  kanji: string,
  mnemonic: string,
  isPublic: boolean = false
): Promise<boolean> {
  try {
    const response = await fetch('/api/kanji/mnemonic/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kanji, mnemonic, isPublic }),
    })

    const data = await response.json()
    return data.success === true
  } catch (error) {
    console.error('[kanjiService] Error saving user mnemonic:', error)
    return false
  }
}

/**
 * Delete user's custom mnemonic for a kanji
 */
export async function deleteUserMnemonic(kanji: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/kanji/mnemonic/user?kanji=${encodeURIComponent(kanji)}`, {
      method: 'DELETE',
    })

    const data = await response.json()
    return data.success === true
  } catch (error) {
    console.error('[kanjiService] Error deleting user mnemonic:', error)
    return false
  }
}

/**
 * Check remaining regenerations for a kanji
 */
export async function checkRegenerationLimit(kanji: string): Promise<RegenerationLimit | null> {
  console.log('[kanjiService] checkRegenerationLimit called for:', kanji)
  try {
    const response = await fetch(`/api/kanji/mnemonic/regenerate?kanji=${encodeURIComponent(kanji)}`)
    console.log('[kanjiService] checkRegenerationLimit response status:', response.status)
    if (!response.ok) {
      console.log('[kanjiService] checkRegenerationLimit response not ok')
      return null
    }

    const data = await response.json()
    console.log('[kanjiService] checkRegenerationLimit data:', data)
    if (!data.success) return null

    return {
      allowed: data.allowed,
      remaining: data.remaining,
      resetAtUtc: data.resetAtUtc,
    }
  } catch (error) {
    console.error('[kanjiService] Error checking regeneration limit:', error)
    return null
  }
}

/**
 * Regenerate AI mnemonic for a kanji (rate limited)
 */
export async function regenerateKanjiMnemonic(
  kanji: string,
  meaning?: string
): Promise<RegenerationResult> {
  console.log('[kanjiService] regenerateKanjiMnemonic called', { kanji, meaning })
  try {
    console.log('[kanjiService] Fetching /api/kanji/mnemonic/regenerate...')
    const response = await fetch('/api/kanji/mnemonic/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kanji, meaning }),
    })

    console.log('[kanjiService] Response status:', response.status)
    const data = await response.json()
    console.log('[kanjiService] Response data:', data)

    if (response.status === 429) {
      return {
        success: false,
        remaining: data.remaining,
        resetAtUtc: data.resetAtUtc,
        error: 'RATE_LIMIT_EXCEEDED',
      }
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'UNKNOWN_ERROR',
      }
    }

    return {
      success: true,
      mnemonic: data.mnemonic,
      remaining: data.remaining,
      resetAtUtc: data.resetAtUtc,
    }
  } catch (error) {
    console.error('[kanjiService] Error regenerating mnemonic:', error)
    return {
      success: false,
      error: 'NETWORK_ERROR',
    }
  }
}
