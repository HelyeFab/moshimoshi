/**
 * Service for searching Tatoeba example sentences
 * Provides real Japanese sentences with English translations
 */

import fs from 'fs/promises'
import path from 'path'

export interface TatoebaSentence {
  japanese: string
  english: string
  id?: string
}

class TatoebaSentenceService {
  private sentencesCache: Map<string, TatoebaSentence[]> = new Map()
  private allSentences: TatoebaSentence[] = []
  private loaded = false

  /**
   * Load all Tatoeba sentences into memory for fast searching
   * This is called once on first search
   */
  private async loadSentences() {
    if (this.loaded) return

    try {
      const dataDir = path.join(process.cwd(), 'src/data/sentences/tatoeba')

      // Read all example files
      const files = await fs.readdir(dataDir)
      const jsonFiles = files.filter(f => f.startsWith('examples-') && f.endsWith('.json'))

      for (const file of jsonFiles.slice(0, 50)) { // Limit to first 50 files for performance
        try {
          const filePath = path.join(dataDir, file)
          const content = await fs.readFile(filePath, 'utf8')
          const data = JSON.parse(content)

          if (Array.isArray(data)) {
            data.forEach(item => {
              if (item.japanese && item.english) {
                this.allSentences.push({
                  japanese: item.japanese,
                  english: item.english,
                  id: item.id
                })
              }
            })
          }
        } catch (err) {
          console.error(`Failed to load ${file}:`, err)
        }
      }

      this.loaded = true
      console.log(`Loaded ${this.allSentences.length} Tatoeba sentences`)
    } catch (error) {
      console.error('Failed to load Tatoeba sentences:', error)
      this.loaded = true // Prevent repeated attempts
    }
  }

  /**
   * Search for sentences containing a specific kanji or word
   */
  async searchByKanji(kanji: string, limit = 3): Promise<TatoebaSentence[]> {
    // Check cache first
    const cacheKey = `${kanji}-${limit}`
    if (this.sentencesCache.has(cacheKey)) {
      return this.sentencesCache.get(cacheKey)!
    }

    await this.loadSentences()

    // Find sentences containing the kanji
    const matches: TatoebaSentence[] = []

    for (const sentence of this.allSentences) {
      if (sentence.japanese.includes(kanji)) {
        matches.push(sentence)
        if (matches.length >= limit) break
      }
    }

    // If not enough direct matches, try to find sentences with the kanji's meaning
    if (matches.length < limit) {
      // This would require the meaning, which we'll get from the calling context
    }

    // Cache the results
    this.sentencesCache.set(cacheKey, matches)

    return matches
  }

  /**
   * Search by meaning (English keyword)
   */
  async searchByMeaning(meaning: string, limit = 2): Promise<TatoebaSentence[]> {
    await this.loadSentences()

    const meaningLower = meaning.toLowerCase()
    const matches: TatoebaSentence[] = []

    for (const sentence of this.allSentences) {
      if (sentence.english.toLowerCase().includes(meaningLower)) {
        matches.push(sentence)
        if (matches.length >= limit) break
      }
    }

    return matches
  }

  /**
   * Get random example sentences (for fallback)
   */
  async getRandomSentences(limit = 3): Promise<TatoebaSentence[]> {
    await this.loadSentences()

    const results: TatoebaSentence[] = []
    const usedIndices = new Set<number>()

    while (results.length < limit && usedIndices.size < this.allSentences.length) {
      const index = Math.floor(Math.random() * this.allSentences.length)
      if (!usedIndices.has(index)) {
        usedIndices.add(index)
        results.push(this.allSentences[index])
      }
    }

    return results
  }
}

// Export singleton instance
export const tatoebaSentenceService = new TatoebaSentenceService()