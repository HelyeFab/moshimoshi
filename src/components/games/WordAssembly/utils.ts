import { ListItem } from '@/types/userLists'

export interface AssemblyQuestion {
  word: string
  kana: string
  meaning: string
  correctKanaSegments: string[]
  distractors: string[]
  allOptions: string[]
}

export interface AssemblyStats {
  totalGames: number
  correctAnswers: number
  gamesToday: number
  lastPlayedDate: string
  wordStats: Record<string, {
    attempts: number
    correct: number
    lastSeen: string
  }>
}

/**
 * Break down kana string into segments for gameplay
 * Handles special two-character combinations
 */
export function breakDownKana(kana: string): string[] {
  const segments: string[] = []
  let i = 0

  // Two-character combinations
  const twoCharCombos = [
    'きゃ', 'きゅ', 'きょ', 'しゃ', 'しゅ', 'しょ', 'ちゃ', 'ちゅ', 'ちょ',
    'にゃ', 'にゅ', 'にょ', 'ひゃ', 'ひゅ', 'ひょ', 'みゃ', 'みゅ', 'みょ',
    'りゃ', 'りゅ', 'りょ', 'ぎゃ', 'ぎゅ', 'ぎょ', 'じゃ', 'じゅ', 'じょ',
    'びゃ', 'びゅ', 'びょ', 'ぴゃ', 'ぴゅ', 'ぴょ', 'ファ', 'フィ', 'フェ',
    'フォ', 'ウィ', 'ウェ', 'ウォ', 'ヴァ', 'ヴィ', 'ヴェ', 'ヴォ', 'ツァ',
    'ツィ', 'ツェ', 'ツォ', 'チェ', 'シェ', 'ジェ', 'ティ', 'ディ', 'デュ',
    'トゥ', 'ドゥ'
  ]

  while (i < kana.length) {
    // Check for two-character combinations
    if (i < kana.length - 1) {
      const twoChar = kana.substring(i, i + 2)
      if (twoCharCombos.includes(twoChar)) {
        segments.push(twoChar)
        i += 2
        continue
      }
    }

    // Single character
    segments.push(kana[i])
    i++
  }

  return segments
}

/**
 * Generate distractor kana segments for the game
 */
export function generateKanaDistractors(
  correctSegments: string[],
  wordPool: ListItem[],
  count: number = 3
): string[] {
  const distractors: string[] = []

  // Common kana for distractors
  const commonKana = [
    'あ', 'い', 'う', 'え', 'お', 'か', 'き', 'く', 'け', 'こ',
    'が', 'ぎ', 'ぐ', 'げ', 'ご', 'さ', 'し', 'す', 'せ', 'そ',
    'ざ', 'じ', 'ず', 'ぜ', 'ぞ', 'た', 'ち', 'つ', 'て', 'と',
    'だ', 'ぢ', 'づ', 'で', 'ど', 'な', 'に', 'ぬ', 'ね', 'の',
    'は', 'ひ', 'ふ', 'へ', 'ほ', 'ば', 'び', 'ぶ', 'べ', 'ぼ',
    'ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ', 'ま', 'み', 'む', 'め', 'も',
    'や', 'ゆ', 'よ', 'ら', 'り', 'る', 'れ', 'ろ', 'わ', 'を', 'ん',
    // Katakana
    'ア', 'イ', 'ウ', 'エ', 'オ', 'カ', 'キ', 'ク', 'ケ', 'コ',
    'サ', 'シ', 'ス', 'セ', 'ソ', 'タ', 'チ', 'ツ', 'テ', 'ト',
    'ナ', 'ニ', 'ヌ', 'ネ', 'ノ', 'ハ', 'ヒ', 'フ', 'ヘ', 'ホ',
    'マ', 'ミ', 'ム', 'メ', 'モ', 'ヤ', 'ユ', 'ヨ', 'ラ', 'リ',
    'ル', 'レ', 'ロ', 'ワ', 'ヲ', 'ン'
  ]

  // Extract kana from other words in the pool for better distractors
  const poolKana: string[] = []
  wordPool.forEach(item => {
    const reading = item.metadata?.reading || ''
    if (reading) {
      const segments = breakDownKana(reading)
      poolKana.push(...segments)
    }
  })

  // Combine pool kana with common kana
  const candidateKana = [...new Set([...poolKana, ...commonKana])]

  // Filter out correct segments and select random distractors
  const availableDistractors = candidateKana.filter(
    kana => !correctSegments.includes(kana)
  )

  // Randomly select distractors
  while (distractors.length < count && availableDistractors.length > 0) {
    const index = Math.floor(Math.random() * availableDistractors.length)
    const selected = availableDistractors.splice(index, 1)[0]
    if (!distractors.includes(selected)) {
      distractors.push(selected)
    }
  }

  return distractors
}

/**
 * Generate a Word Assembly question from a word
 */
export function generateAssemblyQuestion(
  word: ListItem,
  wordPool: ListItem[]
): AssemblyQuestion | null {
  // Need both kanji/content and reading for the game
  const kanji = word.content
  const kana = word.metadata?.reading
  const meaning = word.metadata?.meaning || ''

  if (!kanji || !kana) {
    return null
  }

  const correctSegments = breakDownKana(kana)
  const distractors = generateKanaDistractors(correctSegments, wordPool)

  // Combine and shuffle all options
  const allOptions = [...correctSegments, ...distractors]
  shuffleArray(allOptions)

  return {
    word: kanji,
    kana,
    meaning,
    correctKanaSegments: correctSegments,
    distractors,
    allOptions
  }
}

/**
 * Shuffle array in place
 */
export function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]
  }
}

/**
 * Load stats from localStorage
 */
export function loadAssemblyStats(): AssemblyStats {
  try {
    const saved = localStorage.getItem('word_assembly_stats')
    if (saved) {
      const stats = JSON.parse(saved)
      const today = new Date().toDateString()

      // Reset daily count if it's a new day
      if (stats.lastPlayedDate !== today) {
        stats.gamesToday = 0
        stats.lastPlayedDate = today
      }

      return stats
    }
  } catch (error) {
    console.error('Failed to load assembly stats:', error)
  }

  // Return default stats
  return {
    totalGames: 0,
    correctAnswers: 0,
    gamesToday: 0,
    lastPlayedDate: new Date().toDateString(),
    wordStats: {}
  }
}

/**
 * Save stats to localStorage
 */
export function saveAssemblyStats(stats: AssemblyStats): void {
  try {
    localStorage.setItem('word_assembly_stats', JSON.stringify(stats))
  } catch (error) {
    console.error('Failed to save assembly stats:', error)
  }
}