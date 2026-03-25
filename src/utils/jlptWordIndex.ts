import type { JLPTLevel } from '@/types/kanji'
import rawIndex from '@/data/external/jlpt-word-list/generated/jlpt-word-index.json'

export interface JLPTWordEntry {
  expression: string
  reading: string
  meaning: string
  tags: string[]
  jlpt: JLPTLevel
  sourceRow: number
}

interface JLPTWordIndexData {
  generatedAt: string
  source: string
  levels: Record<JLPTLevel, JLPTWordEntry[]>
  byExpression: Record<string, JLPTWordEntry[]>
  counts: Record<JLPTLevel, number>
}

export const JLPT_LEVEL_ASCENDING: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']

const jlptWordIndex = rawIndex as JLPTWordIndexData

export function getJLPTWordIndex(): JLPTWordIndexData {
  return jlptWordIndex
}

export function getJLPTEntriesForExpression(expression: string): JLPTWordEntry[] {
  return jlptWordIndex.byExpression[expression] || []
}

export function getJLPTEntriesForLevel(level: JLPTLevel): JLPTWordEntry[] {
  return jlptWordIndex.levels[level] || []
}

export function getJLPTSearchLadder(startLevel: JLPTLevel): JLPTLevel[] {
  const startIndex = JLPT_LEVEL_ASCENDING.indexOf(startLevel)
  if (startIndex === -1) return JLPT_LEVEL_ASCENDING
  return JLPT_LEVEL_ASCENDING.slice(startIndex)
}
