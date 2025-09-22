import axios from 'axios'
import { JapaneseWord, WordType, JLPTLevel } from '@/types/vocabulary'

// WaniKani API configuration
const WANIKANI_API_BASE = 'https://api.wanikani.com/v2'

// Determine if we should use proxy based on environment
const isClientSide = typeof window !== 'undefined'
const useProxy = isClientSide // Always use proxy on client side to avoid CORS

// Use proxy endpoint for browser requests, direct API for server-side
const API_BASE = useProxy ? '/api/wanikani/proxy' : WANIKANI_API_BASE

// Cache for vocabulary data
let vocabularyCache: JapaneseWord[] | null = null
let cacheTimestamp: number | null = null
const CACHE_DURATION = 30 * 60 * 1000 // 30 minutes in milliseconds

// Create a custom axios instance for WaniKani API
const wanikaniAxios = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  }
})

// Set the API token when available
export function setWanikaniApiToken(token: string) {
  // Use provided token only - no fallback
  const validToken = token

  // Only set headers if not using proxy (proxy handles auth server-side)
  if (!useProxy) {
    wanikaniAxios.defaults.headers.common['Authorization'] = `Bearer ${validToken}`
    wanikaniAxios.defaults.headers.common['Wanikani-Revision'] = '20170710'
  }

  if (typeof window !== 'undefined') {
    console.log('[WaniKani] Using:', useProxy ? 'Proxy API' : 'Direct API', 'Token:', validToken.substring(0, 8) + '...')
  }
}

// Interface for WaniKani API responses
interface WanikaniApiResponse<T> {
  object: string
  url: string
  pages: {
    per_page: number
    next_url: string | null
    previous_url: string | null
  }
  total_count: number
  data_updated_at: string
  data: T[]
}

// Interface for WaniKani Subject data
interface WanikaniSubject {
  id: number
  object: string
  url: string
  data_updated_at: string
  data: {
    created_at: string
    level: number
    slug: string
    hidden_at: string | null
    document_url: string
    characters: string
    meanings: {
      meaning: string
      primary: boolean
      accepted_answer: boolean
    }[]
    readings?: {
      type: string
      primary: boolean
      accepted_answer: boolean
      reading: string
    }[]
    parts_of_speech?: string[]
    component_subject_ids?: number[]
    amalgamation_subject_ids?: number[]
    meaning_mnemonic?: string
    reading_mnemonic?: string
  }
}

// Function to determine JLPT level based on WaniKani level
function determineJLPTLevel(level: number): JLPTLevel {
  if (level <= 3) return 'N5'
  if (level <= 10) return 'N4'
  if (level <= 20) return 'N3'
  if (level <= 40) return 'N2'
  return 'N1'
}

// Function to determine word type based on parts of speech
function determineWordType(partsOfSpeech: string[] | undefined, word?: { characters?: string }): WordType {
  if (!partsOfSpeech || partsOfSpeech.length === 0) {
    // Check if it's a する verb by looking at the word itself
    if (word?.characters && word.characters.endsWith('する')) {
      return 'Irregular'
    }
    return 'other'
  }

  const posArray = partsOfSpeech.map(p => p.toLowerCase())
  const pos = posArray.join(' ')

  // Check for irregular verbs FIRST (highest priority - especially する verbs)
  if (pos.includes('irregular') || pos.includes('suru verb') || pos.includes('kuru verb') ||
      pos.includes('する verb') || pos.includes('来る verb') || pos.includes('vs-i') ||
      pos.includes('vs-s') || pos.includes('vs') || pos.includes('vk')) {
    return 'Irregular'
  }

  // Also check if the word ends with する (compound suru verbs)
  if (word?.characters && word.characters.endsWith('する')) {
    return 'Irregular'
  }

  // Then check for other verb types
  else if (pos.includes('ichidan') || pos.includes('ru verb') || pos.includes('る verb')) {
    return 'Ichidan'
  } else if (pos.includes('godan') || pos.includes('u verb') || pos.includes('う verb')) {
    return 'Godan'
  }

  // Check for TRUE i-adjectives only
  else if (
    (posArray.includes('i adjective') || posArray.includes('い adjective')) &&
    !pos.includes('noun')
  ) {
    return 'i-adjective'
  }

  // Check for TRUE na-adjectives only
  else if (
    (posArray.includes('な adjective') || posArray.includes('na adjective')) &&
    !pos.includes('noun')
  ) {
    return 'na-adjective'
  }

  // Check for nouns
  else if (pos.includes('noun') || pos.includes('counter') || pos.includes('suffix') || pos.includes('prefix')) {
    return 'noun'
  }

  // Check for other types
  else if (pos.includes('adverb')) {
    return 'adverb'
  } else if (pos.includes('particle')) {
    return 'particle'
  } else if (pos.includes('conjunction')) {
    return 'conjunction'
  }

  return 'other'
}

// Convert WaniKani subject to our JapaneseWord format
function convertWanikaniToWord(subject: WanikaniSubject): JapaneseWord {
  const data = subject.data

  // Get primary meaning
  const primaryMeaning = data.meanings.find(m => m.primary)?.meaning ||
                         data.meanings[0]?.meaning ||
                         'No meaning'

  // Get all meanings
  const allMeanings = data.meanings.map(m => m.meaning).join(', ')

  // Get primary reading
  let primaryReading = ''
  if (data.readings && data.readings.length > 0) {
    const reading = data.readings.find(r => r.primary) || data.readings[0]
    primaryReading = reading.reading
  }

  // Determine word type
  const wordType = determineWordType(data.parts_of_speech, { characters: data.characters })

  // Determine JLPT level
  const jlptLevel = determineJLPTLevel(data.level)

  return {
    id: `wanikani-${subject.id}`,
    kanji: data.characters,
    kana: primaryReading,
    romaji: '', // Will be generated later if needed
    meaning: allMeanings,
    type: wordType,
    jlpt: jlptLevel,
    tags: [],
    wanikaniLevel: data.level,
    slug: data.slug
  }
}

// Fetch all vocabulary from WaniKani and cache it
async function fetchAllVocabulary(): Promise<JapaneseWord[]> {
  try {
    console.log('[WaniKani] Fetching all vocabulary levels 1-60...')
    const allVocabulary: JapaneseWord[] = []

    // Fetch vocabulary in chunks to avoid overwhelming the API
    // WaniKani has 60 levels, we'll fetch them in groups
    const levelChunks = []
    for (let i = 1; i <= 60; i += 10) {
      const end = Math.min(i + 9, 60)
      const levels = []
      for (let j = i; j <= end; j++) {
        levels.push(j)
      }
      levelChunks.push(levels.join(','))
    }

    for (const levels of levelChunks) {
      const endpoint = useProxy ? '' : '/subjects'
      const params = useProxy
        ? {
            endpoint: 'subjects',
            types: 'vocabulary',
            levels,
          }
        : {
            types: 'vocabulary',
            levels,
          }

      const response = await wanikaniAxios.get<WanikaniApiResponse<WanikaniSubject>>(
        endpoint,
        { params }
      )

      const words = response.data.data.map(convertWanikaniToWord)
      allVocabulary.push(...words)

      console.log(`[WaniKani] Fetched levels ${levels}: ${words.length} words`)
    }

    console.log(`[WaniKani] Total vocabulary fetched: ${allVocabulary.length} words`)
    return allVocabulary
  } catch (error) {
    console.error('[WaniKani] Error fetching all vocabulary:', error)
    throw error
  }
}

// Get cached vocabulary or fetch if needed
async function getCachedVocabulary(): Promise<JapaneseWord[]> {
  const now = Date.now()

  // Check if cache is valid
  if (vocabularyCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('[WaniKani] Using cached vocabulary')
    return vocabularyCache
  }

  // Fetch and cache new data
  console.log('[WaniKani] Cache expired or empty, fetching new data...')
  vocabularyCache = await fetchAllVocabulary()
  cacheTimestamp = now

  return vocabularyCache
}

// Clear the cache (useful for testing or force refresh)
export function clearWanikaniCache() {
  vocabularyCache = null
  cacheTimestamp = null
  console.log('[WaniKani] Cache cleared')
}

// Search WaniKani vocabulary (using cached data)
export async function searchWanikaniVocabulary(query: string, limit = 30): Promise<JapaneseWord[]> {
  try {
    // Get cached vocabulary
    const allVocabulary = await getCachedVocabulary()

    // Normalize query for searching
    const queryLower = query.toLowerCase().trim()

    // Search through cached vocabulary
    const results: JapaneseWord[] = []

    for (const word of allVocabulary) {
      // Check if we've hit the limit
      if (results.length >= limit) break

      // Check kanji match
      if (word.kanji && word.kanji.toLowerCase().includes(queryLower)) {
        results.push(word)
        continue
      }

      // Check kana match
      if (word.kana && word.kana.toLowerCase().includes(queryLower)) {
        results.push(word)
        continue
      }

      // Check meaning match
      if (word.meaning && word.meaning.toLowerCase().includes(queryLower)) {
        results.push(word)
        continue
      }

      // Check slug match (for exact searches)
      if (word.slug && word.slug.toLowerCase().includes(queryLower.replace(/\s+/g, '-'))) {
        results.push(word)
        continue
      }
    }

    // Sort results by relevance (exact matches first, then partial matches)
    results.sort((a, b) => {
      // Exact kanji match gets highest priority
      const aExactKanji = a.kanji?.toLowerCase() === queryLower
      const bExactKanji = b.kanji?.toLowerCase() === queryLower
      if (aExactKanji && !bExactKanji) return -1
      if (!aExactKanji && bExactKanji) return 1

      // Exact kana match
      const aExactKana = a.kana?.toLowerCase() === queryLower
      const bExactKana = b.kana?.toLowerCase() === queryLower
      if (aExactKana && !bExactKana) return -1
      if (!aExactKana && bExactKana) return 1

      // Sort by WaniKani level (lower levels = more common words)
      const aLevel = a.wanikaniLevel || 999
      const bLevel = b.wanikaniLevel || 999
      return aLevel - bLevel
    })

    console.log(`[WaniKani] Found ${results.length} results for "${query}"`)
    return results.slice(0, limit)
  } catch (error) {
    console.error('WaniKani API error:', error)
    throw error
  }
}

// Get common verbs from WaniKani
export async function getCommonVerbsFromWanikani(limit = 100): Promise<JapaneseWord[]> {
  try {
    const endpoint = useProxy ? '' : '/subjects'
    const params = useProxy
      ? {
          endpoint: 'subjects',
          types: 'vocabulary',
          levels: '1,2,3,4,5,6,7,8,9,10', // First 10 levels for common words
        }
      : {
          types: 'vocabulary',
          levels: '1,2,3,4,5,6,7,8,9,10',
        }

    const response = await wanikaniAxios.get<WanikaniApiResponse<WanikaniSubject>>(
      endpoint,
      { params }
    )

    const verbs = response.data.data
      .map(convertWanikaniToWord)
      .filter(word =>
        word.type === 'Ichidan' ||
        word.type === 'Godan' ||
        word.type === 'Irregular'
      )
      .slice(0, limit)

    return verbs
  } catch (error) {
    console.error('WaniKani API error:', error)
    return []
  }
}

// Get common words from WaniKani
export async function getCommonWordsFromWanikani(limit = 100): Promise<JapaneseWord[]> {
  try {
    const endpoint = useProxy ? '' : '/subjects'
    const params = useProxy
      ? {
          endpoint: 'subjects',
          types: 'vocabulary',
          levels: '1,2,3,4,5', // First 5 levels for most common words
        }
      : {
          types: 'vocabulary',
          levels: '1,2,3,4,5',
        }

    const response = await wanikaniAxios.get<WanikaniApiResponse<WanikaniSubject>>(
      endpoint,
      { params }
    )

    const words = response.data.data
      .map(convertWanikaniToWord)
      .slice(0, limit)

    return words
  } catch (error) {
    console.error('WaniKani API error:', error)
    return []
  }
}

// Get words by JLPT level from WaniKani
export async function getWordsByJLPTLevelFromWanikani(jlptLevel: JLPTLevel): Promise<JapaneseWord[]> {
  try {
    // Map JLPT levels to WaniKani levels (approximate)
    let levels = ''
    switch (jlptLevel) {
      case 'N5':
        levels = '1,2,3'
        break
      case 'N4':
        levels = '4,5,6,7,8,9,10'
        break
      case 'N3':
        levels = '11,12,13,14,15,16,17,18,19,20'
        break
      case 'N2':
        levels = '21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40'
        break
      case 'N1':
        levels = '41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60'
        break
    }

    const endpoint = useProxy ? '' : '/subjects'
    const params = useProxy
      ? {
          endpoint: 'subjects',
          types: 'vocabulary',
          levels,
        }
      : {
          types: 'vocabulary',
          levels,
        }

    const response = await wanikaniAxios.get<WanikaniApiResponse<WanikaniSubject>>(
      endpoint,
      { params }
    )

    const words = response.data.data.map(convertWanikaniToWord)
    return words
  } catch (error) {
    console.error('WaniKani API error:', error)
    return []
  }
}