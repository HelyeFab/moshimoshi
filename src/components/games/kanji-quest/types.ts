// Types for Kanji Quest Game

// Extended Kanji interface for the game
export interface GameKanji {
  id: string
  character: string
  meanings: string[]
  on_readings: string[]
  kun_readings: string[]
  jlpt: number
  vocabulary: Array<{
    word: string
    reading: string
    meaning: string
  }>
}

// Study session types
export interface StudySession {
  kanji: GameKanji[]
  pokemonId: number
  status: 'studying' | 'quiz' | 'battle' | 'completed' | 'failed'
  startTime: string
  quizScore: number | null
}

// Quiz question types
export interface QuizQuestion {
  type: 'reading' | 'meaning' | 'kanji' | 'vocab'
  question: string
  options: string[]
  correctIndex: number
  kanjiRef: GameKanji
}

// Battle system types
export type AttackType = 'reading' | 'meaning' | 'kanji' | 'vocabulary'

export interface Attack {
  type: AttackType
  baseDamage: number
  accuracy: number
  criticalChance: number
  effectDescription: string
}

export interface BattleEvent {
  type: 'player_attack' | 'kanji_attack' | 'status_effect' | 'victory' | 'defeat'
  damage?: number
  isEffective?: 'super' | 'normal' | 'not_very'
  message: string
  timestamp: Date
}

// Attack type definitions
export const ATTACK_TYPES: Record<AttackType, Attack> = {
  reading: {
    type: 'reading',
    baseDamage: 30,
    accuracy: 0.85,
    criticalChance: 0.15,
    effectDescription: 'Sound Wave Attack - Tests pronunciation knowledge'
  },
  meaning: {
    type: 'meaning',
    baseDamage: 35,
    accuracy: 0.90,
    criticalChance: 0.10,
    effectDescription: 'Mind Strike - Tests conceptual understanding'
  },
  kanji: {
    type: 'kanji',
    baseDamage: 40,
    accuracy: 0.80,
    criticalChance: 0.20,
    effectDescription: 'Symbol Slash - Tests character recognition'
  },
  vocabulary: {
    type: 'vocabulary',
    baseDamage: 45,
    accuracy: 0.75,
    criticalChance: 0.25,
    effectDescription: 'Context Combo - Tests practical usage'
  }
}

// Kanji counter-attacks
export const KANJI_ATTACKS = [
  {
    name: 'Confusion Ray',
    damage: 20,
    effect: 'confused',
    message: '{kanji} used Confusion Ray! You feel bewildered!'
  },
  {
    name: 'Memory Drain',
    damage: 25,
    effect: 'weakened',
    message: '{kanji} drained your knowledge! Your attacks are weakened!'
  },
  {
    name: 'Character Overwhelm',
    damage: 30,
    effect: null,
    message: '{kanji} overwhelmed you with complexity!'
  }
]

// Component props
export interface KanjiQuestProps {
  jlptLevel: number
  onBack: () => void
  onPokemonCaught?: (pokemonId: number, kanjiIds: string[]) => void
  customKanji?: GameKanji[]
}