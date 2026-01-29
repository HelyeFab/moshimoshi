/**
 * Phonetics Utility for Blast Mode
 * Agent C - Distractor & Tile Logic
 *
 * Provides phonetic neighbor generation for reading distractors
 */

/**
 * Japanese phonetic data structures
 */
const HIRAGANA_ROWS: Record<string, string[]> = {
  a: ['あ', 'い', 'う', 'え', 'お'],
  k: ['か', 'き', 'く', 'け', 'こ'],
  s: ['さ', 'し', 'す', 'せ', 'そ'],
  t: ['た', 'ち', 'つ', 'て', 'と'],
  n: ['な', 'に', 'ぬ', 'ね', 'の'],
  h: ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  m: ['ま', 'み', 'む', 'め', 'も'],
  y: ['や', '', 'ゆ', '', 'よ'],
  r: ['ら', 'り', 'る', 'れ', 'ろ'],
  w: ['わ', '', '', '', 'を'],
  g: ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
  z: ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
  d: ['だ', 'ぢ', 'づ', 'で', 'ど'],
  b: ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
  p: ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
}

const KATAKANA_ROWS: Record<string, string[]> = {
  a: ['ア', 'イ', 'ウ', 'エ', 'オ'],
  k: ['カ', 'キ', 'ク', 'ケ', 'コ'],
  s: ['サ', 'シ', 'ス', 'セ', 'ソ'],
  t: ['タ', 'チ', 'ツ', 'テ', 'ト'],
  n: ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'],
  h: ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'],
  m: ['マ', 'ミ', 'ム', 'メ', 'モ'],
  y: ['ヤ', '', 'ユ', '', 'ヨ'],
  r: ['ラ', 'リ', 'ル', 'レ', 'ロ'],
  w: ['ワ', '', '', '', 'ヲ'],
  g: ['ガ', 'ギ', 'グ', 'ゲ', 'ゴ'],
  z: ['ザ', 'ジ', 'ズ', 'ゼ', 'ゾ'],
  d: ['ダ', 'ヂ', 'ヅ', 'デ', 'ド'],
  b: ['バ', 'ビ', 'ブ', 'ベ', 'ボ'],
  p: ['パ', 'ピ', 'プ', 'ペ', 'ポ'],
}

/**
 * Map kana to their row and column position
 */
const KANA_POSITIONS = new Map<string, { row: string; col: number; type: 'hiragana' | 'katakana' }>()

// Build position map
Object.entries(HIRAGANA_ROWS).forEach(([row, chars]) => {
  chars.forEach((char, col) => {
    if (char) KANA_POSITIONS.set(char, { row, col, type: 'hiragana' })
  })
})

Object.entries(KATAKANA_ROWS).forEach(([row, chars]) => {
  chars.forEach((char, col) => {
    if (char) KANA_POSITIONS.set(char, { row, col, type: 'katakana' })
  })
})

/**
 * Count mora in a reading string
 */
export function countMora(reading: string): number {
  if (!reading) return 0

  // Remove only non-mora characters (dots, spaces)
  const cleaned = reading.replace(/[・\s]/g, '')

  // Count mora: most kana are 1 mora each
  // Small ya/yu/yo (ゃゅょ) combine with previous character to form 1 mora
  // Small tsu (っ/ッ) represents a mora (glottal stop)
  // Long vowel marker (ー) represents a mora
  let count = 0
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i]
    // Only small ya, yu, yo don't count as separate mora (they combine with previous)
    if (!/[ゃゅょャュョ]/.test(char)) {
      count++
    }
  }

  return count
}

/**
 * Get phonetically similar kana character
 * Strategy: same column (vowel), different row (consonant)
 */
export function getPhoneticNeighbor(kana: string): string | null {
  const pos = KANA_POSITIONS.get(kana)
  if (!pos) return null

  const rows = pos.type === 'hiragana' ? HIRAGANA_ROWS : KATAKANA_ROWS
  const rowKeys = Object.keys(rows).filter(r => r !== pos.row)

  // Try to find a different row with the same vowel
  for (const rowKey of rowKeys) {
    const neighbor = rows[rowKey][pos.col]
    if (neighbor && neighbor !== kana) {
      return neighbor
    }
  }

  return null
}

/**
 * Generate phonetic neighbor readings
 * Returns array of similar-sounding readings
 */
export function generatePhoneticNeighbors(
  reading: string,
  count: number = 3
): string[] {
  if (!reading) return []

  const neighbors = new Set<string>()
  const chars = reading.split('')

  // Strategy 1: Replace one character with phonetic neighbor
  for (let i = 0; i < chars.length && neighbors.size < count * 2; i++) {
    const char = chars[i]
    const neighbor = getPhoneticNeighbor(char)
    if (neighbor) {
      const modified = [...chars]
      modified[i] = neighbor
      neighbors.add(modified.join(''))
    }
  }

  // Strategy 2: Swap adjacent characters (common reading mistakes)
  for (let i = 0; i < chars.length - 1 && neighbors.size < count * 2; i++) {
    const modified = [...chars]
    ;[modified[i], modified[i + 1]] = [modified[i + 1], modified[i]]
    const swapped = modified.join('')
    if (swapped !== reading) {
      neighbors.add(swapped)
    }
  }

  // Strategy 3: Change long vowel marker
  if (reading.includes('う') || reading.includes('ー')) {
    const withoutLong = reading.replace(/[うー]/g, '')
    if (withoutLong !== reading && withoutLong.length > 0) {
      neighbors.add(withoutLong)
    }
  }

  // Return requested count, filtering out the original
  return Array.from(neighbors)
    .filter(n => n !== reading)
    .slice(0, count)
}

/**
 * Check if two readings are phonetically similar
 * Used to avoid trivial overlap in distractors
 */
export function arePhoneticallySimilar(
  reading1: string,
  reading2: string,
  threshold: number = 0.7
): boolean {
  if (!reading1 || !reading2) return false
  if (reading1 === reading2) return true

  // Check if one is a substring of the other
  if (reading1.includes(reading2) || reading2.includes(reading1)) {
    return true
  }

  // Calculate character overlap ratio
  const chars1 = new Set(reading1.split(''))
  const chars2 = new Set(reading2.split(''))
  const intersection = new Set([...chars1].filter(c => chars2.has(c)))
  const union = new Set([...chars1, ...chars2])

  const similarity = intersection.size / union.size
  return similarity >= threshold
}

/**
 * Normalize reading for comparison
 * Handles katakana/hiragana, long vowels, etc.
 *
 * Note: Long vowel markers (ー) are simplified to 'う' for comparison purposes.
 * This is an approximation and not phonetically accurate for all cases
 * (e.g., ヒー should be ひい not ひう), but sufficient for similarity matching.
 */
export function normalizeReading(reading: string): string {
  if (!reading) return ''

  // Normalize long vowel markers to 'う' (simplification for comparison)
  // Note: This is not phonetically accurate but works for fuzzy matching
  let normalized = reading.replace(/ー/g, 'う')

  // Convert katakana to hiragana for comparison
  const hiragana = normalized.replace(/[\u30A1-\u30F6]/g, (char) => {
    return String.fromCharCode(char.charCodeAt(0) - 0x60)
  })

  return hiragana.toLowerCase()
}

/**
 * Get readings with the same mora count
 * Useful for filtering distractor candidates
 */
export function filterByMoraCount(
  readings: string[],
  targetMora: number
): string[] {
  return readings.filter(r => countMora(r) === targetMora)
}
