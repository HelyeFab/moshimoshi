import { JapaneseWord } from '@/types/vocabulary'

export interface Tile {
  id: string
  position: number
  word?: JapaneseWord
  displayText: string
  matchingText: string
  isFlipped: boolean
  isMatched: boolean
  backIcon: string
}

export interface GameState {
  tiles: Tile[]
  selectedTiles: string[]
  matchedPairs: number
  totalPairs: number
  moves: number
  isGameOver: boolean
  startTime: number
  endTime?: number
}

export interface GameStats {
  totalMoves: number
  timeTaken: number
  perfectGame: boolean
}

export const GAME_CONFIG = {
  GRID_COLS: 6,
  GRID_ROWS: 5,
  TOTAL_TILES: 30,
  MIN_WORDS: 5,
  MIN_PAIRS: 10,
  MAX_PAIRS: 15,
  FLIP_DURATION: 600,
  MATCH_DELAY: 800,
  MISMATCH_DELAY: 1200,
  VICTORY_DELAY: 500,
  MAX_SELECTED: 2,
}

export type MatchType = 'exact' | 'reading' | 'meaning'

export interface MatchPair {
  type: MatchType
  tile1: Tile
  tile2: Tile
}