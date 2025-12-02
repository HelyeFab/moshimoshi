// Reading Routes Game Types
// Game-specific types that extend or complement the main MoodBoard types

// Import and re-export the main types from moshimoshi's moodboard types
import type { MoodBoard, KanjiItem, BoardProgress } from '@/types/moodboard'
export type { MoodBoard, KanjiItem, BoardProgress }

export interface ReadingOption {
  id: string
  reading: string
  romaji: string
  type: 'on' | 'kun'
}

export interface GameQuestion {
  kanji: KanjiItem
  context: string
  contextType: 'word' | 'sentence'
  correctReading: ReadingOption
  options: ReadingOption[]
  explanation?: string
}

export interface ReadingRoutesProgress {
  boardId: string
  kanjiProgress: Record<string, KanjiReadingProgress>
  lastPlayed: string
  totalGamesPlayed: number
  highScore: number
  averageAccuracy: number
}

export interface KanjiReadingProgress {
  char: string
  onYomiAttempts: number
  onYomiCorrect: number
  kunYomiAttempts: number
  kunYomiCorrect: number
  lastSeen: string
  masteryLevel: number // 0-100
}

export interface GameResult {
  boardId: string
  score: number
  totalQuestions: number
  correctAnswers: number
  timestamp: string
}