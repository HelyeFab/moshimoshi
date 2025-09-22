import axios from 'axios'
import { JapaneseWord, WordType, JLPTLevel } from '@/types/vocabulary'

// WaniKani imports - primary dictionary source
import {
  setWanikaniApiToken,
  searchWanikaniVocabulary,
  getCommonVerbsFromWanikani,
  getCommonWordsFromWanikani,
  getWordsByJLPTLevelFromWanikani
} from './wanikaniApi'

// WaniKani API initialization - primary source
const initWanikaniApi = () => {
  const token = process.env.NEXT_PUBLIC_WANIKANI_API_TOKEN || ''

  setWanikaniApiToken(token)

  if (typeof window !== 'undefined') {
    console.log('[WaniKani] API initialized')
  }
}

// Export initialization function
export { initWanikaniApi }

// Main search function that uses WaniKani API
export async function searchWords(query: string, limit = 30): Promise<JapaneseWord[]> {
  try {
    // Use WaniKani API for search
    const results = await searchWanikaniVocabulary(query, limit)
    return results
  } catch (error: any) {
    console.error('WaniKani search error:', error)
    // Re-throw the error so the caller can handle it properly
    throw error
  }
}

// Export other WaniKani functions for use
export {
  getCommonVerbsFromWanikani,
  getCommonWordsFromWanikani,
  getWordsByJLPTLevelFromWanikani
}

// Helper function to determine word type from parts of speech
export function determineWordType(partsOfSpeech: string[], word?: string): WordType {
  const pos = partsOfSpeech.join(' ').toLowerCase()

  // Check for irregular verbs FIRST (especially する verbs)
  if (pos.includes('irregular') || pos.includes('suru verb') || pos.includes('kuru verb') ||
      pos.includes('vs-i') || pos.includes('vs-s') || pos.includes('vs') || pos.includes('vk')) {
    return 'Irregular'
  }

  // Also check if the word ends with する
  if (word && word.endsWith('する')) {
    return 'Irregular'
  }

  // Then check for other verb types
  if (pos.includes('ichidan') || pos.includes('ru verb') || pos.includes('る verb')) {
    return 'Ichidan'
  } else if (pos.includes('godan') || pos.includes('u verb') || pos.includes('う verb')) {
    return 'Godan'
  }

  // Check for TRUE i-adjectives only
  else if (
    (pos.includes('い adjective') || pos.includes('i adjective') || pos.includes('i-adjective')) &&
    !pos.includes('noun')
  ) {
    return 'i-adjective'
  }

  // Check for TRUE na-adjectives only
  else if (
    (pos.includes('な adjective') || pos.includes('na adjective') || pos.includes('na-adjective')) &&
    !pos.includes('noun')
  ) {
    return 'na-adjective'
  }

  // Check for nouns
  else if (pos.includes('noun') || pos.includes('counter') || pos.includes('suffix') || pos.includes('prefix')) {
    return 'noun'
  }

  // Check for adverbs
  else if (pos.includes('adverb')) {
    return 'adverb'
  }

  // Check for particles
  else if (pos.includes('particle')) {
    return 'particle'
  }

  // Check for conjunctions
  else if (pos.includes('conjunction')) {
    return 'conjunction'
  }

  // Default to other
  return 'other'
}

// Helper function to determine JLPT level
export function determineJLPTLevel(jlptArray?: string[]): JLPTLevel | undefined {
  if (!jlptArray || jlptArray.length === 0) return undefined

  // Find the highest (easiest) JLPT level
  if (jlptArray.includes('jlpt-n5')) return 'N5'
  if (jlptArray.includes('jlpt-n4')) return 'N4'
  if (jlptArray.includes('jlpt-n3')) return 'N3'
  if (jlptArray.includes('jlpt-n2')) return 'N2'
  if (jlptArray.includes('jlpt-n1')) return 'N1'

  return undefined
}

// Helper function to generate romaji (simplified)
export function generateRomaji(kana: string): string {
  // This is a very simplified version - in production you'd use a proper library
  const romajiMap: { [key: string]: string } = {
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
    'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
    'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
    'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
    'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
    'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
    'わ': 'wa', 'を': 'wo', 'ん': 'n',
    // Add katakana mappings too
    'ア': 'a', 'イ': 'i', 'ウ': 'u', 'エ': 'e', 'オ': 'o',
    'カ': 'ka', 'キ': 'ki', 'ク': 'ku', 'ケ': 'ke', 'コ': 'ko',
    'ガ': 'ga', 'ギ': 'gi', 'グ': 'gu', 'ゲ': 'ge', 'ゴ': 'go',
    // ... (add more as needed)
  }

  return kana.split('').map(char => romajiMap[char] || char).join('')
}