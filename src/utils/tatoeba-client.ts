export interface TatoebaSentence {
  japanese: string
  english: string
  id?: string
  furigana?: string // We'll add furigana on the client side
}

/**
 * Fetch Tatoeba sentences containing a specific kanji
 */
export async function fetchTatoebaSentences(kanji: string, limit: number = 2): Promise<TatoebaSentence[]> {
  try {
    const response = await fetch(`/api/tatoeba/search?kanji=${encodeURIComponent(kanji)}&limit=${limit}`)

    if (!response.ok) {
      console.error('Failed to fetch Tatoeba sentences:', response.statusText)
      return []
    }

    const data = await response.json()
    return data.sentences || []
  } catch (error) {
    console.error('Error fetching Tatoeba sentences:', error)
    return []
  }
}

/**
 * Fetch random Tatoeba sentences (for distractors)
 */
export async function fetchRandomTatoebaSentences(limit: number = 20): Promise<TatoebaSentence[]> {
  try {
    const response = await fetch(`/api/tatoeba/random?limit=${limit}`)

    if (!response.ok) {
      console.error('Failed to fetch random Tatoeba sentences:', response.statusText)
      return []
    }

    const data = await response.json()
    return data.sentences || []
  } catch (error) {
    console.error('Error fetching random Tatoeba sentences:', error)
    return []
  }
}

/**
 * Fetch Tatoeba sentences by English meaning/keyword
 */
export async function fetchTatoebaSentencesByMeaning(meaning: string, limit: number = 5): Promise<TatoebaSentence[]> {
  try {
    const response = await fetch(`/api/tatoeba/meaning?meaning=${encodeURIComponent(meaning)}&limit=${limit}`)

    if (!response.ok) {
      console.error('Failed to fetch Tatoeba sentences by meaning:', response.statusText)
      return []
    }

    const data = await response.json()
    return data.sentences || []
  } catch (error) {
    console.error('Error fetching Tatoeba sentences by meaning:', error)
    return []
  }
}

/**
 * Build a distractor pool from Tatoeba for sentence-type lists
 * Fetches sentences related to user content plus random variety
 */
export async function buildTatoebaDistractorPool(
  userSentences: Array<{ content: string; meaning?: string }>,
  targetPoolSize: number = 50
): Promise<TatoebaSentence[]> {
  const pool: TatoebaSentence[] = []
  const usedIds = new Set<string>()

  try {
    // 1. Extract kanji from user sentences and fetch related sentences
    const allKanji = new Set<string>()
    for (const sentence of userSentences) {
      const kanjiMatches = sentence.content.match(/[\u4e00-\u9faf]/g) || []
      kanjiMatches.forEach(k => allKanji.add(k))
    }

    // Fetch sentences for up to 5 unique kanji (to avoid too many requests)
    const kanjiArray = Array.from(allKanji).slice(0, 5)
    for (const kanji of kanjiArray) {
      const sentences = await fetchTatoebaSentences(kanji, 5)
      for (const s of sentences) {
        if (s.id && !usedIds.has(s.id)) {
          usedIds.add(s.id)
          pool.push(s)
        }
      }
      if (pool.length >= targetPoolSize) break
    }

    // 2. Fetch by meaning keywords (first 3 sentences with meanings)
    const sentencesWithMeaning = userSentences.filter(s => s.meaning).slice(0, 3)
    for (const sentence of sentencesWithMeaning) {
      if (sentence.meaning) {
        // Extract first significant word from meaning
        const keyword = sentence.meaning.split(/\s+/).find(w => w.length > 3)
        if (keyword) {
          const sentences = await fetchTatoebaSentencesByMeaning(keyword, 3)
          for (const s of sentences) {
            if (s.id && !usedIds.has(s.id)) {
              usedIds.add(s.id)
              pool.push(s)
            }
          }
        }
      }
      if (pool.length >= targetPoolSize) break
    }

    // 3. Fill remaining with random sentences
    if (pool.length < targetPoolSize) {
      const remaining = targetPoolSize - pool.length
      const randomSentences = await fetchRandomTatoebaSentences(remaining)
      for (const s of randomSentences) {
        if (s.id && !usedIds.has(s.id)) {
          usedIds.add(s.id)
          pool.push(s)
        }
      }
    }

    console.log(`[Tatoeba] Built distractor pool with ${pool.length} sentences`)
    return pool
  } catch (error) {
    console.error('Error building Tatoeba distractor pool:', error)
    // Return whatever we have so far
    return pool
  }
}