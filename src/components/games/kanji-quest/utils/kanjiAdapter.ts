import { Kanji, JLPTLevel } from '@/types/kanji'
import { GameKanji } from '../types'
import kanjiService from '@/services/kanjiService'

// Convert Kanji to GameKanji format
function convertToGameKanji(kanji: Kanji, index: number): GameKanji {
  // Parse meanings - the API returns a single string that may contain multiple meanings separated by commas
  const meanings = kanji.meaning.split(',').map(m => m.trim())

  // Get vocabulary examples if available
  const vocabulary = kanji.examples || []

  // If no vocabulary found, create basic examples
  if (vocabulary.length === 0 && kanji.kunyomi && kanji.kunyomi.length > 0) {
    vocabulary.push({
      word: kanji.kanji,
      reading: kanji.kunyomi[0],
      meaning: meanings[0]
    })
  }

  return {
    id: `${kanji.jlpt}-${index}-${kanji.kanji}`,
    character: kanji.kanji,
    meanings: meanings,
    on_readings: kanji.onyomi || [],
    kun_readings: kanji.kunyomi || [],
    jlpt: parseInt(kanji.jlpt.replace('N', '')),
    vocabulary: vocabulary.slice(0, 3).map(v => ({
      word: v.word,
      reading: v.reading,
      meaning: v.meaning
    }))
  }
}

// Get all kanji by JLPT level
export async function getKanjiByJLPT(level: number): Promise<GameKanji[]> {
  const jlptLevel = `N${level}` as JLPTLevel

  try {
    // Load kanji from moshimoshi's KanjiService
    const kanjiData = await kanjiService.loadKanjiByLevel(jlptLevel)

    // Convert to GameKanji format
    const gameKanjiList = kanjiData.map((kanji, index) =>
      convertToGameKanji(kanji, index)
    )

    return gameKanjiList
  } catch (error) {
    console.error(`Error loading kanji for JLPT ${jlptLevel}:`, error)
    return []
  }
}

// Progress management using localStorage
export function getKanjiStorageKey(): string {
  return 'kanji_quest_progress'
}

// Get completed kanji IDs
export function getCompletedKanjiIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()

  const key = getKanjiStorageKey()
  const stored = localStorage.getItem(key)

  if (stored) {
    try {
      const data = JSON.parse(stored)
      return new Set(data.completedKanjiIds || [])
    } catch {
      return new Set()
    }
  }

  return new Set()
}

// Save completed kanji IDs
export function saveCompletedKanjiIds(kanjiIds: string[]): void {
  if (typeof window === 'undefined') return

  const key = getKanjiStorageKey()
  const existingIds = getCompletedKanjiIds()

  kanjiIds.forEach(id => existingIds.add(id))

  const data = {
    completedKanjiIds: Array.from(existingIds),
    lastUpdated: new Date().toISOString()
  }

  localStorage.setItem(key, JSON.stringify(data))
}

// Get caught Pokemon
export function getCaughtPokemon(): number[] {
  if (typeof window === 'undefined') return []

  const stored = localStorage.getItem('kanji_quest_pokemon')

  if (stored) {
    try {
      const data = JSON.parse(stored)
      return data.caughtPokemon || []
    } catch {
      return []
    }
  }

  return []
}

// Save caught Pokemon
export function saveCaughtPokemon(pokemonId: number): void {
  if (typeof window === 'undefined') return

  const caught = getCaughtPokemon()
  if (!caught.includes(pokemonId)) {
    caught.push(pokemonId)

    const data = {
      caughtPokemon: caught,
      lastUpdated: new Date().toISOString()
    }

    localStorage.setItem('kanji_quest_pokemon', JSON.stringify(data))
  }
}