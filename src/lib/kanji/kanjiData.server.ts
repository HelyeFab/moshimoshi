import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { JLPTLevel, Kanji } from '@/types/kanji'

interface RawKanji {
  kanji: string
  meaning: string
  onyomi: string[]
  kunyomi: string[]
  grade?: number | 'S'
}

const LEVELS: JLPTLevel[] = ['N5', 'N4', 'N3', 'N2', 'N1']
const kanjiCache = new Map<JLPTLevel, Kanji[]>()

function enrichKanji(rawKanji: RawKanji, level: JLPTLevel): Kanji {
  const meanings = rawKanji.meaning.includes(';')
    ? rawKanji.meaning.split(';').map(item => item.trim()).filter(Boolean)
    : [rawKanji.meaning]

  return {
    kanji: rawKanji.kanji,
    meaning: rawKanji.meaning,
    meanings: Array.from(new Set(meanings)),
    onyomi: rawKanji.onyomi || [],
    kunyomi: (rawKanji.kunyomi || []).map(reading => reading.replace(/[\.\-]/g, '')),
    jlpt: level,
    strokeCount: 0,
    grade: rawKanji.grade,
    examples: [],
  }
}

export async function loadKanjiByLevelFromDisk(level: JLPTLevel): Promise<Kanji[]> {
  const cached = kanjiCache.get(level)
  if (cached) return cached

  const levelNumber = level.replace('N', '')
  const filePath = path.join(process.cwd(), 'public', 'data', 'kanji', `jlpt_${levelNumber}.json`)
  const fileContents = await fs.readFile(filePath, 'utf8')
  const rawKanji = JSON.parse(fileContents) as RawKanji[]
  const enriched = rawKanji.map(item => enrichKanji(item, level))
  kanjiCache.set(level, enriched)
  return enriched
}

export async function findKanjiByCharacterFromDisk(character: string): Promise<Kanji | null> {
  for (const level of LEVELS) {
    const levelKanji = await loadKanjiByLevelFromDisk(level)
    const match = levelKanji.find(item => item.kanji === character)
    if (match) return match
  }

  return null
}

export async function loadAllKanjiFromDisk(): Promise<Kanji[]> {
  const allLevels = await Promise.all(LEVELS.map(level => loadKanjiByLevelFromDisk(level)))
  return allLevels.flat()
}
