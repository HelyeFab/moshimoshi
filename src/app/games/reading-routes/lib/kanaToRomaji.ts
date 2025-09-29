/**
 * Kana to Romaji conversion utility for Reading Routes game
 */

import { kanaData } from '@/data/kanaData'

// Build kana to romaji mappings from kanaData
const kanaToRomajiMap: { [key: string]: string } = {}

// Add all basic kana from kanaData
kanaData.forEach(kana => {
  kanaToRomajiMap[kana.hiragana] = kana.romaji
  kanaToRomajiMap[kana.katakana] = kana.romaji
})

// Add additional mappings not in kanaData
const additionalMappings: { [key: string]: string } = {
  // Hiragana combinations
  'きゃ': 'kya', 'きゅ': 'kyu', 'きょ': 'kyo',
  'しゃ': 'sha', 'しゅ': 'shu', 'しょ': 'sho',
  'ちゃ': 'cha', 'ちゅ': 'chu', 'ちょ': 'cho',
  'にゃ': 'nya', 'にゅ': 'nyu', 'にょ': 'nyo',
  'ひゃ': 'hya', 'ひゅ': 'hyu', 'ひょ': 'hyo',
  'みゃ': 'mya', 'みゅ': 'myu', 'みょ': 'myo',
  'りゃ': 'rya', 'りゅ': 'ryu', 'りょ': 'ryo',
  'ぎゃ': 'gya', 'ぎゅ': 'gyu', 'ぎょ': 'gyo',
  'じゃ': 'ja', 'じゅ': 'ju', 'じょ': 'jo',
  'びゃ': 'bya', 'びゅ': 'byu', 'びょ': 'byo',
  'ぴゃ': 'pya', 'ぴゅ': 'pyu', 'ぴょ': 'pyo',

  // Katakana combinations
  'キャ': 'kya', 'キュ': 'kyu', 'キョ': 'kyo',
  'シャ': 'sha', 'シュ': 'shu', 'ショ': 'sho',
  'チャ': 'cha', 'チュ': 'chu', 'チョ': 'cho',
  'ニャ': 'nya', 'ニュ': 'nyu', 'ニョ': 'nyo',
  'ヒャ': 'hya', 'ヒュ': 'hyu', 'ヒョ': 'hyo',
  'ミャ': 'mya', 'ミュ': 'myu', 'ミョ': 'myo',
  'リャ': 'rya', 'リュ': 'ryu', 'リョ': 'ryo',
  'ギャ': 'gya', 'ギュ': 'gyu', 'ギョ': 'gyo',
  'ジャ': 'ja', 'ジュ': 'ju', 'ジョ': 'jo',
  'ビャ': 'bya', 'ビュ': 'byu', 'ビョ': 'byo',
  'ピャ': 'pya', 'ピュ': 'pyu', 'ピョ': 'pyo',

  // Special characters
  'ー': '-', // Long vowel mark
  'っ': '', // Small tsu (handled specially below)
  'ッ': '', // Small tsu katakana
}

// Merge additional mappings
Object.assign(kanaToRomajiMap, additionalMappings)

/**
 * Convert kana string to romaji
 */
export function kanaToRomaji(kana: string): string {
  let result = ''

  for (let i = 0; i < kana.length; i++) {
    const char = kana[i]
    const nextChar = kana[i + 1]

    // Check for two-character combinations first
    if (nextChar) {
      const twoChar = char + nextChar
      if (kanaToRomajiMap[twoChar]) {
        result += kanaToRomajiMap[twoChar]
        i++ // Skip next character
        continue
      }
    }

    // Handle small tsu (doubles the next consonant)
    if ((char === 'っ' || char === 'ッ') && nextChar) {
      const nextRomaji = kanaToRomajiMap[nextChar]
      if (nextRomaji && nextRomaji.length > 0) {
        result += nextRomaji[0] // Double the first consonant
      }
      continue
    }

    // Single character conversion
    if (kanaToRomajiMap[char]) {
      result += kanaToRomajiMap[char]
    } else {
      // Keep unknown characters as-is
      result += char
    }
  }

  return result
}

/**
 * Simple romaji formatter for display (capitalizes first letter)
 */
export function formatRomaji(romaji: string): string {
  if (!romaji) return ''
  return romaji.charAt(0).toUpperCase() + romaji.slice(1).toLowerCase()
}