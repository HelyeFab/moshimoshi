/**
 * Kanji Sentence Cache Service
 * Loads pre-cached Tatoeba sentences for kanji from static JSON files
 *
 * This replaces runtime Tatoeba searches with pre-built cache files,
 * improving performance and enabling offline support.
 */

export interface CachedSentence {
  id: string
  japanese: string
  english: string | null
}

export interface KanjiSentenceCache {
  kanji: string
  sentences: CachedSentence[]
  generatedAt: string
  count: number
}

interface CacheManifest {
  generatedAt: string
  totalKanji: number
  sentencesPerKanji: number
  kanji: Record<string, {
    file: string
    count: number
  }>
}

class KanjiSentenceCacheService {
  private manifest: CacheManifest | null = null
  private cache: Map<string, KanjiSentenceCache> = new Map()
  private loadingPromises: Map<string, Promise<KanjiSentenceCache>> = new Map()

  /**
   * Initialize the service by loading the manifest
   */
  async initialize(): Promise<void> {
    if (this.manifest) return

    try {
      const response = await fetch('/data/kanji-sentences/manifest.json')
      if (!response.ok) {
        throw new Error(`Failed to load manifest: ${response.status}`)
      }
      this.manifest = await response.json()
    } catch (error) {
      console.warn('Kanji sentence cache not available, falling back to runtime search:', error)
      // Don't throw - gracefully degrade to runtime search
    }
  }

  /**
   * Get sentences for a specific kanji
   */
  async getSentences(kanji: string, limit: number = 5): Promise<CachedSentence[]> {
    // Check in-memory cache first
    if (this.cache.has(kanji)) {
      const cached = this.cache.get(kanji)!
      return cached.sentences.slice(0, limit)
    }

    // Check if already loading
    if (this.loadingPromises.has(kanji)) {
      const result = await this.loadingPromises.get(kanji)!
      return result.sentences.slice(0, limit)
    }

    // Initialize if needed
    await this.initialize()

    // If manifest not loaded, return empty array (will trigger fallback)
    if (!this.manifest) {
      return []
    }

    // Check if kanji exists in manifest
    if (!this.manifest.kanji[kanji]) {
      // Cache empty result to avoid repeated lookups
      this.cache.set(kanji, {
        kanji,
        sentences: [],
        generatedAt: new Date().toISOString(),
        count: 0
      })
      return []
    }

    // Load the cache file
    const loadPromise = this.loadCacheFile(kanji)
    this.loadingPromises.set(kanji, loadPromise)

    try {
      const result = await loadPromise
      this.cache.set(kanji, result)
      this.loadingPromises.delete(kanji)
      return result.sentences.slice(0, limit)
    } catch (error) {
      this.loadingPromises.delete(kanji)
      console.error(`Failed to load sentences for ${kanji}:`, error)
      return []
    }
  }

  /**
   * Load cache file for a specific kanji
   */
  private async loadCacheFile(kanji: string): Promise<KanjiSentenceCache> {
    // Get filename from manifest
    const manifestEntry = this.manifest?.kanji[kanji]
    if (!manifestEntry || !manifestEntry.file) {
      throw new Error(`No cache entry found for ${kanji}`)
    }

    const fileName = manifestEntry.file
    const response = await fetch(`/data/kanji-sentences/${fileName}`)

    if (!response.ok) {
      throw new Error(`Failed to load cache for ${kanji}: ${response.status}`)
    }

    return await response.json()
  }

  /**
   * Batch load sentences for multiple kanji
   * More efficient than loading one by one
   */
  async batchGetSentences(
    kanjiList: string[],
    limitPerKanji: number = 3
  ): Promise<Map<string, CachedSentence[]>> {
    await this.initialize()

    const results = new Map<string, CachedSentence[]>()

    // Load all in parallel
    await Promise.all(
      kanjiList.map(async (kanji) => {
        try {
          const sentences = await this.getSentences(kanji, limitPerKanji)
          results.set(kanji, sentences)
        } catch (error) {
          console.error(`Failed to load sentences for ${kanji}:`, error)
          results.set(kanji, [])
        }
      })
    )

    return results
  }

  /**
   * Check if cache is available for a kanji
   */
  async hasCachedSentences(kanji: string): Promise<boolean> {
    await this.initialize()
    return (this.manifest?.kanji?.[kanji]?.count ?? 0) > 0
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalKanji: number
    cachedInMemory: number
    generatedAt: string | null
  }> {
    await this.initialize()

    return {
      totalKanji: this.manifest?.totalKanji || 0,
      cachedInMemory: this.cache.size,
      generatedAt: this.manifest?.generatedAt || null
    }
  }

  /**
   * Clear in-memory cache to free memory
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Preload sentences for a list of kanji
   * Useful for preloading a session's kanji in the background
   */
  async preloadSentences(kanjiList: string[]): Promise<void> {
    await this.initialize()

    // Load all in parallel but don't wait for results
    kanjiList.forEach(kanji => {
      this.getSentences(kanji, 5).catch(err => {
        console.debug(`Failed to preload ${kanji}:`, err)
      })
    })
  }
}

// Export singleton instance
export const kanjiSentenceCache = new KanjiSentenceCacheService()

// Convenience functions
export async function getKanjiSentences(
  kanji: string,
  limit?: number
): Promise<CachedSentence[]> {
  return kanjiSentenceCache.getSentences(kanji, limit)
}

export async function batchGetKanjiSentences(
  kanjiList: string[],
  limitPerKanji?: number
): Promise<Map<string, CachedSentence[]>> {
  return kanjiSentenceCache.batchGetSentences(kanjiList, limitPerKanji)
}
