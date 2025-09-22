import { JapaneseWord, WordType, JLPTLevel } from '@/types/vocabulary'

interface JMDictGloss {
  lang: string
  text: string
}

interface JMDictSense {
  gloss?: JMDictGloss[]
  partOfSpeech?: string[]
}

interface JMDictKanji {
  text?: string
  tags?: string[]
  common?: boolean
}

interface JMDictKana {
  text?: string
  tags?: string[]
  common?: boolean
  appliesToKanji?: string[]
}

interface JMDictWord {
  id: string
  kanji?: JMDictKanji[]
  kana?: JMDictKana[]
  sense?: JMDictSense[]
}

interface JMDictData {
  words: JMDictWord[]
}

let jmdictData: JMDictData | null = null
let loadPromise: Promise<void> | null = null

// Cache for conjugatable words
let conjugatableWordsCache: {
  all: JapaneseWord[] | null
  verbs: JapaneseWord[] | null
  adjectives: JapaneseWord[] | null
  lastUpdated: number
} = {
  all: null,
  verbs: null,
  adjectives: null,
  lastUpdated: 0
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache

// Load JMDict data
export async function loadJMdictData(): Promise<void> {
  if (jmdictData) return
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    try {
      const response = await fetch('/data/dictionary/jmdict-eng-common.json')
      const data = await response.json()
      jmdictData = data
      console.log(`Loaded ${jmdictData.words.length} JMDict entries`)
    } catch (error) {
      console.error('Failed to load JMDict:', error)
      jmdictData = { words: [] }
    }
  })()

  return loadPromise
}

// Priority tags indicating common usage - higher weight for more common tags
const PRIORITY_SCORES: Record<string, number> = {
  'news1': 500,
  'ichi1': 400,
  'spec1': 300,
  'gai1': 200,
  'news2': 150,
  'ichi2': 120,
  'spec2': 100,
  'gai2': 80,
  'nf01': 70, 'nf02': 65, 'nf03': 60, 'nf04': 55, 'nf05': 50,
  'nf06': 45, 'nf07': 40, 'nf08': 35, 'nf09': 30, 'nf10': 25
}

// Common parts of speech with scores
const POS_SCORES: Record<string, number> = {
  'noun': 50,
  'verb': 40,
  'adjective': 35,
  'adverb': 30,
  'expression': 25,
  'pronoun': 20,
  'conjunction': 15,
  'interjection': 10,
  'compound': -20, // Penalty for compounds
  'technical': -30, // Penalty for technical terms
  'obscure': -40 // Penalty for obscure terms
}

// Common words that should be prioritized
const COMMON_WORDS: Record<string, string[]> = {
  // Animals
  'pig': ['豚', 'ぶた'],
  'cat': ['猫', 'ねこ'],
  'dog': ['犬', 'いぬ'],
  'bird': ['鳥', 'とり'],
  'fish': ['魚', 'さかな'],
  'horse': ['馬', 'うま'],
  'cow': ['牛', 'うし'],
  'chicken': ['鶏', 'にわとり'],
  'mouse': ['鼠', 'ねずみ'],
  'rat': ['鼠', 'ねずみ'],
  'rabbit': ['兎', 'うさぎ'],
  'tiger': ['虎', 'とら'],
  'lion': ['獅子', 'しし'],
  'bear': ['熊', 'くま'],
  'elephant': ['象', 'ぞう'],
  // Transportation
  'car': ['車', 'くるま'],
  'train': ['電車', 'でんしゃ'],
  'bus': ['バス', 'ばす'],
  'bicycle': ['自転車', 'じてんしゃ'],
  'airplane': ['飛行機', 'ひこうき'],
  'ship': ['船', 'ふね'],
  'taxi': ['タクシー', 'たくしー'],
  // Common verbs
  'eat': ['食べる', 'たべる'],
  'drink': ['飲む', 'のむ'],
  'sleep': ['寝る', 'ねる'],
  'wake': ['起きる', 'おきる'],
  'go': ['行く', 'いく'],
  'come': ['来る', 'くる'],
  'see': ['見る', 'みる'],
  'hear': ['聞く', 'きく'],
  'speak': ['話す', 'はなす'],
  'read': ['読む', 'よむ'],
  'write': ['書く', 'かく'],
  'study': ['勉強', 'べんきょう'],
  'work': ['働く', 'はたらく'],
  'play': ['遊ぶ', 'あそぶ'],
  'buy': ['買う', 'かう'],
  'sell': ['売る', 'うる'],
  'walk': ['歩く', 'あるく'],
  'run': ['走る', 'はしる'],
  'stop': ['止まる', 'とまる'],
  'start': ['始まる', 'はじまる'],
  'end': ['終わる', 'おわる'],
  'open': ['開く', 'あく', '開ける', 'あける'],
  'close': ['閉じる', 'とじる', '閉める', 'しめる'],
  'sit': ['座る', 'すわる'],
  'stand': ['立つ', 'たつ'],
  'give': ['あげる', 'くれる', '与える', 'あたえる'],
  'take': ['取る', 'とる'],
  'make': ['作る', 'つくる'],
  'think': ['思う', 'おもう', '考える', 'かんがえる'],
  'know': ['知る', 'しる'],
  'want': ['欲しい', 'ほしい'],
  'need': ['必要', 'ひつよう', 'いる'],
  'like': ['好き', 'すき'],
  'love': ['愛', 'あい', '愛する', 'あいする'],
  'hate': ['嫌い', 'きらい'],
  // Common objects/school items
  'pen': ['ペン', 'ぺん'],
  'pencil': ['鉛筆', 'えんぴつ'],
  'book': ['本', 'ほん'],
  'notebook': ['ノート', 'のーと'],
  'paper': ['紙', 'かみ'],
  'desk': ['机', 'つくえ'],
  'chair': ['椅子', 'いす'],
  'table': ['テーブル', 'てーぶる', '卓', 'たく'],
  'door': ['ドア', 'どあ', '戸', 'と'],
  'window': ['窓', 'まど'],
  'room': ['部屋', 'へや'],
  'house': ['家', 'いえ', 'うち'],
  'school': ['学校', 'がっこう'],
  'classroom': ['教室', 'きょうしつ'],
  'teacher': ['先生', 'せんせい'],
  'student': ['学生', 'がくせい', '生徒', 'せいと'],
  'friend': ['友達', 'ともだち', '友', 'とも'],
  'bag': ['鞄', 'かばん', 'バッグ', 'ばっぐ'],
  'computer': ['コンピューター', 'こんぴゅーたー', 'パソコン', 'ぱそこん'],
  'phone': ['電話', 'でんわ'],
  'television': ['テレビ', 'てれび'],
  'watch': ['時計', 'とけい'],
  'clock': ['時計', 'とけい'],
  'key': ['鍵', 'かぎ'],
  'money': ['お金', 'おかね', '金', 'かね'],
  'wallet': ['財布', 'さいふ'],
  // Food items
  'food': ['食べ物', 'たべもの'],
  'rice': ['ご飯', 'ごはん', '米', 'こめ'],
  'bread': ['パン', 'ぱん'],
  'water': ['水', 'みず'],
  'tea': ['お茶', 'おちゃ', '茶', 'ちゃ'],
  'coffee': ['コーヒー', 'こーひー'],
  'milk': ['牛乳', 'ぎゅうにゅう', 'ミルク', 'みるく'],
  'meat': ['肉', 'にく'],
  'vegetable': ['野菜', 'やさい'],
  'fruit': ['果物', 'くだもの'],
  'apple': ['りんご', 'リンゴ'],
  'orange': ['オレンジ', 'おれんじ', 'みかん'],
  'banana': ['バナナ', 'ばなな'],
  // Time
  'time': ['時間', 'じかん', '時', 'とき'],
  'day': ['日', 'ひ', 'にち'],
  'week': ['週', 'しゅう', '週間', 'しゅうかん'],
  'month': ['月', 'つき', 'げつ'],
  'year': ['年', 'ねん', 'とし'],
  'today': ['今日', 'きょう'],
  'tomorrow': ['明日', 'あした', 'あす'],
  'yesterday': ['昨日', 'きのう'],
  'morning': ['朝', 'あさ'],
  'afternoon': ['午後', 'ごご'],
  'evening': ['夕方', 'ゆうがた'],
  'night': ['夜', 'よる'],
  // People & family
  'person': ['人', 'ひと'],
  'man': ['男', 'おとこ'],
  'woman': ['女', 'おんな'],
  'child': ['子供', 'こども', '子', 'こ'],
  'mother': ['母', 'はは', 'お母さん', 'おかあさん'],
  'father': ['父', 'ちち', 'お父さん', 'おとうさん'],
  'parent': ['親', 'おや'],
  'baby': ['赤ちゃん', 'あかちゃん'],
  // Body parts
  'hand': ['手', 'て'],
  'foot': ['足', 'あし'],
  'head': ['頭', 'あたま'],
  'eye': ['目', 'め'],
  'ear': ['耳', 'みみ'],
  'mouth': ['口', 'くち'],
  'nose': ['鼻', 'はな'],
  // Colors
  'color': ['色', 'いろ'],
  'red': ['赤', 'あか', '赤い', 'あかい'],
  'blue': ['青', 'あお', '青い', 'あおい'],
  'green': ['緑', 'みどり', '緑の', 'みどりの'],
  'yellow': ['黄色', 'きいろ', '黄色い', 'きいろい'],
  'black': ['黒', 'くろ', '黒い', 'くろい'],
  'white': ['白', 'しろ', '白い', 'しろい'],
  // Numbers & basic concepts
  'one': ['一', 'いち', 'ひとつ'],
  'two': ['二', 'に', 'ふたつ'],
  'three': ['三', 'さん', 'みっつ'],
  'big': ['大きい', 'おおきい'],
  'small': ['小さい', 'ちいさい'],
  'hot': ['暑い', 'あつい', '熱い'],
  'cold': ['寒い', 'さむい', '冷たい', 'つめたい'],
  'new': ['新しい', 'あたらしい'],
  'old': ['古い', 'ふるい'],
  'good': ['良い', 'よい', 'いい'],
  'bad': ['悪い', 'わるい']
}

// Helper function to get priority score from tags
function getPriorityScore(tags: string[]): number {
  let maxScore = 0
  for (const tag of tags) {
    if (PRIORITY_SCORES[tag]) {
      maxScore = Math.max(maxScore, PRIORITY_SCORES[tag])
    }
  }
  return maxScore
}

// Helper function to get part of speech score
function getPosScore(pos: string[]): number {
  let score = 0
  for (const p of pos) {
    for (const [posType, posScore] of Object.entries(POS_SCORES)) {
      if (p.toLowerCase().includes(posType)) {
        score += posScore
      }
    }
  }
  return score
}

// Helper function to get word length score (prefer simpler words)
function getWordLengthScore(word: JMDictWord): number {
  const kanjiLength = word.kanji?.[0]?.text?.length || 0
  const kanaLength = word.kana?.[0]?.text?.length || 0

  if (kanjiLength <= 2 || kanaLength <= 3) {
    return 50 // Boost for very simple words
  } else if (kanjiLength <= 4 || kanaLength <= 5) {
    return 20 // Small boost for simple words
  } else if (kanjiLength >= 8 || kanaLength >= 10) {
    return -30 // Penalty for complex words
  }
  return 0
}

// Helper function to check if word is compound
function isCompoundWord(word: JMDictWord): boolean {
  const kanjiText = word.kanji?.[0]?.text || ''
  const senseText = word.sense?.[0]?.gloss?.map((g) => g.text).join(' ') || ''

  // Check for compound markers in the sense
  if (senseText.includes('compound') || senseText.includes('combination')) {
    return true
  }

  // Check for multiple distinct kanji (rough heuristic)
  // Most single-concept words have 1-3 kanji
  if (kanjiText.length > 4) {
    return true
  }

  return false
}

// Helper to determine word type from parts of speech
function determineWordType(pos: string[] | undefined): WordType {
  if (!pos || pos.length === 0) return 'other'

  const posStr = pos.join(' ').toLowerCase()

  // Check for irregular verbs
  if (posStr.includes('irregular') || posStr.includes('suru') || posStr.includes('kuru') ||
      posStr.includes('vs-i') || posStr.includes('vs-s') || posStr.includes('vs') || posStr.includes('vk')) {
    return 'Irregular'
  }

  // Check for other verb types
  if (posStr.includes('v1') || posStr.includes('ichidan')) {
    return 'Ichidan'
  }
  if (posStr.includes('v5') || posStr.includes('godan')) {
    return 'Godan'
  }

  // Check for i-adjectives
  if (posStr.includes('adj-i') || (posStr.includes('adj') && !posStr.includes('adj-na'))) {
    return 'i-adjective'
  }

  // Check for na-adjectives
  if (posStr.includes('adj-na')) {
    return 'na-adjective'
  }

  // Check for nouns
  if (posStr.includes('n')) {
    return 'noun'
  }

  return 'other'
}

// Convert JMDict entry to our word format
function convertJMDictToWord(entry: JMDictWord): JapaneseWord {
  const kanji = entry.kanji?.[0]?.text || ''
  const kana = entry.kana?.[0]?.text || ''

  // Get all English meanings
  const meanings: string[] = []
  if (entry.sense) {
    for (const sense of entry.sense) {
      if (sense.gloss) {
        for (const gloss of sense.gloss) {
          if (gloss.lang === 'eng' || !gloss.lang) {
            meanings.push(gloss.text)
          }
        }
      }
    }
  }

  // Get word type from first sense
  const wordType = determineWordType(entry.sense?.[0]?.partOfSpeech)

  // Check if common
  const isCommon = entry.kanji?.[0]?.common || entry.kana?.[0]?.common || false

  // Get tags for priority scoring
  const tags = [
    ...(entry.kanji?.flatMap(k => k.tags || []) || []),
    ...(entry.kana?.flatMap(k => k.tags || []) || [])
  ]

  return {
    id: `jmdict-${entry.id}`,
    kanji: kanji,
    kana: kana,
    romaji: '', // Not provided by JMDict
    meaning: meanings.join(', '),
    type: wordType,
    jlpt: 'N5' as JLPTLevel, // Would need separate mapping
    tags: tags,
    isCommon: isCommon
  }
}

// Search JMDict words
export async function searchJMdictWords(term: string, limit = 30): Promise<JapaneseWord[]> {
  await loadJMdictData()
  if (!jmdictData) return []

  const lowerTerm = term.toLowerCase().trim()
  const results: { word: JMDictWord; score: number }[] = []

  // For very short search terms, be more strict
  const isShortTerm = lowerTerm.length <= 3

  // Escape special regex characters
  const escapedTerm = lowerTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Check if this is a common word we know about
  const commonWord = COMMON_WORDS[lowerTerm]

  for (const word of jmdictData.words) {
    let score = 0

    // Check kanji and kana matches
    const kanjiText = word.kanji?.[0]?.text || ''
    const kanaText = word.kana?.[0]?.text || ''

    // Boost score for known common words
    if (commonWord) {
      if (commonWord.includes(kanjiText) || commonWord.includes(kanaText)) {
        score += 3000 // Huge boost for known common words
      }
    }

    // Exact match on Japanese text
    if (kanjiText === term || kanaText === term) {
      score += 1500
    } else if (kanjiText.includes(term) || kanaText.includes(term)) {
      score += 300
    }

    // English gloss match
    let glossMatch = false
    for (const sense of word.sense || []) {
      for (const gloss of sense.gloss || []) {
        if (gloss.lang === 'eng' || !gloss.lang) {
          const glossText = gloss.text.toLowerCase()

          // Check for exact match
          if (glossText === lowerTerm) {
            score += 1200
            // Bonus for single-word definitions (more common/basic)
            if (!glossText.includes(' ') && !glossText.includes(',')) {
              score += 300
            }
            glossMatch = true
            break
          }

          // Check if any part matches exactly (split by common delimiters)
          const parts = glossText.split(/[,;\/]/).map(p => p.trim())
          const exactPartMatch = parts.find(part => part === lowerTerm)
          if (exactPartMatch) {
            score += 1000
            // Bonus if the matching part is the first one (primary meaning)
            if (parts[0] === lowerTerm) {
              score += 200
            }
            // Bonus for single-word definitions
            if (!exactPartMatch.includes(' ')) {
              score += 150
            }
            glossMatch = true
            break
          }

          // Check for whole word match
          const wordBoundaryRegex = new RegExp(`\\b${escapedTerm}\\b`, 'i')
          if (wordBoundaryRegex.test(glossText)) {
            score += 600
            glossMatch = true
          } else if (glossText.includes(lowerTerm)) {
            // Substring match - lowest priority
            if (isShortTerm) {
              // For short terms, only allow if it starts a word
              const startsWordRegex = new RegExp(`\\b${escapedTerm}`, 'i')
              if (!startsWordRegex.test(glossText)) {
                continue
              }
            }
            score += 30
            glossMatch = true
          }
        }
      }
      if (glossMatch && score >= 900) break // Stop if we found a good match
    }

    // Add to results if we have any match
    if (score > 0) {
      // Get tags and part of speech for scoring
      const tags = [
        ...(word.kanji?.flatMap(k => k.tags || []) || []),
        ...(word.kana?.flatMap(k => k.tags || []) || [])
      ]
      const pos = word.sense?.flatMap((s) => s.partOfSpeech || []) || []

      // Extra boost for exact matches on short common words
      if (isShortTerm && score >= 900 && commonWord) {
        score += 800 // Additional boost to ensure common words appear first
      }

      // Additional boost for words in our common words dictionary regardless of search term
      // This helps prioritize "pen" over "pencil case", "book" over "bookshelf", etc.
      if (score >= 600) { // Only if we have a decent match
        // Check if this word matches any entry in COMMON_WORDS
        for (const [engWord, jpWords] of Object.entries(COMMON_WORDS)) {
          if (jpWords.includes(kanjiText) || jpWords.includes(kanaText)) {
            // Found in common words - give it a boost based on relevance
            if (engWord === lowerTerm) {
              score += 1000 // Exact English match to common word
            } else if (lowerTerm.includes(engWord) || engWord.includes(lowerTerm)) {
              score += 200 // Partial match to common word
            } else {
              score += 50 // It's a common word even if not directly searched
            }
            break
          }
        }
      }

      // Priority tag score
      score += getPriorityScore(tags)

      // Part of speech score
      score += getPosScore(pos)

      // Word length score (prefer simpler words)
      score += getWordLengthScore(word)

      // Penalty for compound words (higher penalty for short search terms)
      if (isCompoundWord(word)) {
        score -= isShortTerm ? 400 : 200
      }

      // Penalty for words with too many senses (likely less common)
      if (word.sense && word.sense.length > 5) {
        score -= 50 * (word.sense.length - 5)
      }

      // Boost common words
      if (word.kanji?.[0]?.common || word.kana?.[0]?.common) {
        score += 100
      }

      results.push({ word, score })
    }
  }

  // Sort by score and convert to our format
  results.sort((a, b) => b.score - a.score)

  return results
    .slice(0, limit)
    .map(r => convertJMDictToWord(r.word))
}

// Get common JMDict words
export async function getCommonJMdictWords(limit = 100): Promise<JapaneseWord[]> {
  await loadJMdictData()
  if (!jmdictData) return []

  const commonWords = jmdictData.words
    .filter(word => word.kanji?.[0]?.common || word.kana?.[0]?.common)
    .slice(0, limit)
    .map(convertJMDictToWord)

  return commonWords
}

// Preload conjugatable words cache
export async function preloadConjugatableWords(): Promise<void> {
  await loadJMdictData()
  if (!jmdictData) return

  // Check if cache is still valid
  const now = Date.now()
  if (conjugatableWordsCache.lastUpdated && (now - conjugatableWordsCache.lastUpdated) < CACHE_DURATION) {
    return // Cache is still fresh
  }

  // Build cache for each type
  const allWords: { verbs: JapaneseWord[], adjectives: JapaneseWord[] } = {
    verbs: [],
    adjectives: []
  }

  // Process and score all conjugatable words
  for (const word of jmdictData.words) {
    const pos = word.sense?.[0]?.partOfSpeech || []
    const posStr = pos.join(' ').toLowerCase()

    const isVerb = posStr.includes('v1') || posStr.includes('v5') ||
                   posStr.includes('vs') || posStr.includes('vk') ||
                   posStr.includes('irregular')
    const isAdjective = posStr.includes('adj-i') || posStr.includes('adj-na')

    if (!isVerb && !isAdjective) continue

    // Calculate score
    let score = 0
    if (word.kanji?.[0]?.common || word.kana?.[0]?.common) {
      score += 1000
    }

    const tags = [
      ...(word.kanji?.flatMap(k => k.tags || []) || []),
      ...(word.kana?.flatMap(k => k.tags || []) || [])
    ]
    score += getPriorityScore(tags)

    const kanjiLength = word.kanji?.[0]?.text?.length || 0
    const kanaLength = word.kana?.[0]?.text?.length || 0
    if (kanjiLength <= 3 || kanaLength <= 4) {
      score += 200
    } else if (kanjiLength >= 6 || kanaLength >= 8) {
      score -= 100
    }

    const kanjiText = word.kanji?.[0]?.text || ''
    const kanaText = word.kana?.[0]?.text || ''
    for (const jpWords of Object.values(COMMON_WORDS)) {
      if (jpWords.includes(kanjiText) || jpWords.includes(kanaText)) {
        score += 500
        break
      }
    }

    const converted = convertJMDictToWord(word)
    converted.partsOfSpeech = pos
    // Store the score in a custom property for sorting
    ;(converted as any).score = score

    if (isVerb) {
      allWords.verbs.push(converted)
    }
    if (isAdjective) {
      allWords.adjectives.push(converted)
    }
  }

  // Sort by score
  allWords.verbs.sort((a, b) => ((b as any).score || 0) - ((a as any).score || 0))
  allWords.adjectives.sort((a, b) => ((b as any).score || 0) - ((a as any).score || 0))

  // Update cache
  conjugatableWordsCache.verbs = allWords.verbs
  conjugatableWordsCache.adjectives = allWords.adjectives
  conjugatableWordsCache.all = [...allWords.verbs, ...allWords.adjectives]
    .sort((a, b) => ((b as any).score || 0) - ((a as any).score || 0))
  conjugatableWordsCache.lastUpdated = now
}

// Get random conjugatable words for practice
export async function getRandomConjugatableWords(
  type: 'all' | 'verbs' | 'adjectives' = 'all',
  limit = 20
): Promise<JapaneseWord[]> {
  // Ensure cache is loaded
  await preloadConjugatableWords()

  // Get from cache
  let pool: JapaneseWord[]
  if (type === 'verbs') {
    pool = conjugatableWordsCache.verbs || []
  } else if (type === 'adjectives') {
    pool = conjugatableWordsCache.adjectives || []
  } else {
    pool = conjugatableWordsCache.all || []
  }

  if (pool.length === 0) {
    return [] // No data available
  }

  // Take top words and randomly select from them
  const topWords = pool.slice(0, Math.min(limit * 3, pool.length))
  const selected: JapaneseWord[] = []
  const usedIds = new Set<string>()

  // Weighted random selection - prefer higher scored words
  while (selected.length < limit && topWords.length > 0) {
    // Use weighted random - earlier indices (higher scores) more likely
    const weightedIndex = Math.floor(Math.random() * Math.random() * topWords.length)
    const candidate = topWords[weightedIndex]

    if (!usedIds.has(candidate.id)) {
      selected.push(candidate)
      usedIds.add(candidate.id)
    }

    // Safety check to avoid infinite loop
    if (usedIds.size >= topWords.length) break
  }

  return selected
}