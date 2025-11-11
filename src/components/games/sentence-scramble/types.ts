// Sentence Scramble Game Types - Clean version without auth/tracking

export interface Sentence {
  id: string
  text: string
  furigana?: string
  translation?: string
  difficulty?: 'easy' | 'medium' | 'hard'
}

export interface WordBlock {
  id: string
  text: string
  originalIndex: number
  currentIndex: number
  isCorrectPosition: boolean
  color: string
  isDistractor?: boolean
  distractorEmoji?: string // Use emojis instead of image paths
}

export interface ScrambledSentence {
  id: string
  originalSentence: Sentence
  wordBlocks: WordBlock[]
  userOrder: WordBlock[]
  attempts: number
  isCompleted: boolean
  isCorrect: boolean
}

export interface GameState {
  phase: 'sentence-selection' | 'instructions' | 'sentence-flash' | 'countdown' | 'scramble' | 'game-over'
  sentences: Sentence[]
  currentSentenceIndex: number
  currentSentence: ScrambledSentence | null
  totalScore: number
  totalAttempts: number
  gameStartTime: number
  timeRemaining: number
  showDistractors: boolean
}

export interface GameStats {
  totalSentences: number
  completedSentences: number
  totalAttempts: number
  accuracy: number
  averageTime: number
  totalTime: number
}

// Pastel colors for word blocks - matching theme palette
export const WORD_BLOCK_COLORS = [
  '#FFB3BA', // Light Pink
  '#FFDFBA', // Light Peach
  '#FFFFBA', // Light Yellow
  '#BAFFBA', // Light Green
  '#BAE1FF', // Light Blue
  '#E6BAFF', // Light Purple
  '#FFBAE6', // Light Magenta
  '#FFE4BA', // Light Orange
  '#D4BAFF', // Light Lavender
  '#BAFFDF', // Light Mint
  '#FFC9BA', // Light Coral
  '#E1BAFF', // Light Violet
]

// Game configuration constants
export const GAME_CONSTANTS = {
  MAX_SENTENCES_PER_GAME: 10,
  MIN_SENTENCES_PER_GAME: 3,
  MAX_ATTEMPTS_PER_SENTENCE: 3,
  SENTENCE_FLASH_DURATION: 15000, // 15 seconds
  COUNTDOWN_DURATION: 3, // 3-2-1
  SCRAMBLE_TIME_LIMIT: 20000, // 20 seconds
  POINTS_PER_CORRECT: 10,
  POINTS_PER_ATTEMPT_DEDUCTION: 2,
}

// Distractor emojis for visual variety
export const DISTRACTOR_EMOJIS = [
  '🌸', '🗾', '🍣', '🎌', '⛩️', '🏮', '🎋', '🎏',
  '🌊', '🗻', '🍱', '🥢', '🍵', '🎴', '👘', '🥋',
  '🏯', '🌺', '🎎', '🍡', '🍜', '🍙', '🎐', '⛩️',
]

// Sample sentences for demo mode
export const SAMPLE_SENTENCES: Sentence[] = [
  {
    id: 'sample-1',
    text: '日本語を勉強しています',
    furigana: 'にほんご を べんきょう しています',
    translation: 'I am studying Japanese',
    difficulty: 'easy'
  },
  {
    id: 'sample-2',
    text: '昨日友達と映画を見ました',
    furigana: 'きのう ともだち と えいが を みました',
    translation: 'I watched a movie with a friend yesterday',
    difficulty: 'medium'
  },
  {
    id: 'sample-3',
    text: '明日は学校に行きます',
    furigana: 'あした は がっこう に いきます',
    translation: 'I will go to school tomorrow',
    difficulty: 'easy'
  },
  {
    id: 'sample-4',
    text: '毎朝コーヒーを飲みます',
    furigana: 'まいあさ コーヒー を のみます',
    translation: 'I drink coffee every morning',
    difficulty: 'easy'
  },
  {
    id: 'sample-5',
    text: '日本の文化はとても面白いです',
    furigana: 'にほん の ぶんか は とても おもしろい です',
    translation: 'Japanese culture is very interesting',
    difficulty: 'medium'
  },
  {
    id: 'sample-6',
    text: '今日は天気がいいですね',
    furigana: 'きょう は てんき が いい です ね',
    translation: 'The weather is nice today, isn\'t it?',
    difficulty: 'easy'
  },
  {
    id: 'sample-7',
    text: '週末に買い物に行きたいです',
    furigana: 'しゅうまつ に かいもの に いきたい です',
    translation: 'I want to go shopping on the weekend',
    difficulty: 'medium'
  },
  {
    id: 'sample-8',
    text: '新しいレストランで食べました',
    furigana: 'あたらしい レストラン で たべました',
    translation: 'I ate at a new restaurant',
    difficulty: 'medium'
  },
  {
    id: 'sample-9',
    text: '電車で会社に通っています',
    furigana: 'でんしゃ で かいしゃ に かよって います',
    translation: 'I commute to work by train',
    difficulty: 'hard'
  },
  {
    id: 'sample-10',
    text: '来年日本に行く予定です',
    furigana: 'らいねん にほん に いく よてい です',
    translation: 'I plan to go to Japan next year',
    difficulty: 'medium'
  }
]