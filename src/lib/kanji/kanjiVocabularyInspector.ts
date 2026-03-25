import type { VocabularyMatch } from '@/types/kanji-study'
import type { Kanji } from '@/types/kanji'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { getAdminDb } from '@/lib/firebase/admin'
import {
  getCuratedVocabularyCandidates,
  type CuratedVocabularyCandidate,
  type OverrideReadingType,
} from '@/data/kanjiVocabularyOverrides'
import {
  getProposalValidationsForLevel,
  type ProposedVocabularyValidation,
} from '@/data/kanjiVocabularyProposalChecks'
import { findWordsForKanjiReading, normalizeKana } from '@/utils/kanjiVocabularyLookup'
import { getPrioritizedKanjiReadings } from '@/utils/kanjiReadingPriority'

export interface ReadingInspectionResult {
  reading: string
  normalizedReading: string
  readingType: OverrideReadingType
  isPrioritized: boolean
  curatedCandidates: CuratedVocabularyCandidate[]
  heuristicCandidates: VocabularyMatch[]
  selectedSource: 'curated' | 'jmdict' | 'none'
  selectedWord: string | null
  selectedWordReading: string | null
  selectedMeaning: string | null
}

export interface KanjiVocabularyInspection {
  kanji: Pick<Kanji, 'kanji' | 'jlpt' | 'meaning' | 'meanings' | 'onyomi' | 'kunyomi'>
  prioritized: Awaited<ReturnType<typeof getPrioritizedKanjiReadings>>
  readings: ReadingInspectionResult[]
}

export interface ProposalValidationResult {
  proposal: ProposedVocabularyValidation
  topHeuristic: VocabularyMatch | null
  heuristicCandidates: VocabularyMatch[]
  curatedCandidates: CuratedVocabularyCandidate[]
  heuristicMatchesProposal: boolean
  selectedSourceToday: 'curated' | 'jmdict' | 'none'
  recommendedAction: 'keep-heuristic' | 'add-override'
}

export interface LexicalityAuditRow {
  jlpt: string
  kanji: string
  reading: string
  readingType: OverrideReadingType
  meaning: string
  source: 'curated' | 'jmdict' | 'unknown'
}

export interface LexicalityReviewItem extends LexicalityAuditRow {
  reviewCategory: 'onyomi-bare' | 'low-level-kunyomi-suspicious'
  priority: 'high' | 'medium'
}

export interface KanjiStudyOutcomesSummary {
  days: number
  totalEvents: number
  totalStarted: number
  totalCompleted: number
  totalExited: number
  totalResumed: number
  totalRestoredToDashboard: number
  completionRate: number
  averageCompletedCardsOnExit: number | null
  exitsBeforeHalfway: number
  topExitCards: Array<{
    kanji: string | null
    word: string | null
    reading: string | null
    cardType: string | null
    exits: number
  }>
}

async function inspectReading(
  kanjiChar: string,
  reading: string,
  readingType: OverrideReadingType,
  prioritizedReadings: Set<string>,
  jlptLevel?: Kanji['jlpt']
): Promise<ReadingInspectionResult> {
  const normalizedReading = normalizeKana(reading)
  const curatedCandidates = getCuratedVocabularyCandidates(kanjiChar, reading, readingType)
  const result = await findWordsForKanjiReading(kanjiChar, reading, readingType, undefined, jlptLevel)
  const heuristicCandidates = result.words
  const topHeuristic = heuristicCandidates[0] || null

  const selected = curatedCandidates[0]
    ? {
        source: 'curated' as const,
        word: curatedCandidates[0].word,
        wordReading: curatedCandidates[0].wordReading,
        meaning: curatedCandidates[0].meaning,
      }
    : topHeuristic
      ? {
          source: 'jmdict' as const,
          word: topHeuristic.word,
          wordReading: topHeuristic.wordReading,
          meaning: topHeuristic.meaning,
        }
      : {
          source: 'none' as const,
          word: null,
          wordReading: null,
          meaning: null,
        }

  return {
    reading,
    normalizedReading,
    readingType,
    isPrioritized: prioritizedReadings.has(`${readingType}:${normalizedReading}`),
    curatedCandidates,
    heuristicCandidates,
    selectedSource: selected.source,
    selectedWord: selected.word,
    selectedWordReading: selected.wordReading,
    selectedMeaning: selected.meaning,
  }
}

export async function inspectKanjiVocabulary(kanji: Kanji): Promise<KanjiVocabularyInspection> {
  const prioritized = await getPrioritizedKanjiReadings(kanji.kanji, kanji.onyomi, kanji.kunyomi)
  const prioritizedReadings = new Set<string>([
    ...prioritized.kunyomi.map(reading => `kunyomi:${normalizeKana(reading)}`),
    ...prioritized.onyomi.map(reading => `onyomi:${normalizeKana(reading)}`),
  ])

  const readingInspections = await Promise.all([
    ...kanji.kunyomi.map(reading =>
      inspectReading(kanji.kanji, reading, 'kunyomi', prioritizedReadings, kanji.jlpt)
    ),
    ...kanji.onyomi.map(reading =>
      inspectReading(kanji.kanji, reading, 'onyomi', prioritizedReadings, kanji.jlpt)
    ),
  ])

  return {
    kanji: {
      kanji: kanji.kanji,
      jlpt: kanji.jlpt,
      meaning: kanji.meaning,
      meanings: kanji.meanings,
      onyomi: kanji.onyomi,
      kunyomi: kanji.kunyomi,
    },
    prioritized,
    readings: readingInspections.sort((a, b) => {
      if (a.readingType !== b.readingType) {
        return a.readingType === 'kunyomi' ? -1 : 1
      }
      return a.normalizedReading.localeCompare(b.normalizedReading)
    }),
  }
}

export async function validateProposalLevel(level: 'N3' | 'N2' | 'N1'): Promise<ProposalValidationResult[]> {
  const proposals = getProposalValidationsForLevel(level)

  return Promise.all(
    proposals.map(async proposal => {
      const curatedCandidates = getCuratedVocabularyCandidates(
        proposal.kanji,
        proposal.reading,
        proposal.readingType
      )
      const result = await findWordsForKanjiReading(
        proposal.kanji,
        proposal.reading,
        proposal.readingType,
        undefined,
        level
      )
      const topHeuristic = result.words[0] || null
      const heuristicMatchesProposal =
        Boolean(topHeuristic) &&
        topHeuristic.word === proposal.proposedWord &&
        normalizeKana(topHeuristic.wordReading) === normalizeKana(proposal.proposedWordReading)

      return {
        proposal,
        topHeuristic,
        heuristicCandidates: result.words,
        curatedCandidates,
        heuristicMatchesProposal,
        selectedSourceToday: curatedCandidates.length > 0 ? 'curated' : topHeuristic ? 'jmdict' : 'none',
        recommendedAction: heuristicMatchesProposal ? 'keep-heuristic' : 'add-override',
      }
    })
  )
}

async function loadLexicalityAuditRows(): Promise<LexicalityAuditRow[]> {
  const filePath = path.join(
    process.cwd(),
    'docs',
    'vocabulary-first-kanji-agents',
    'LEXICALITY_AUDIT.json'
  )
  const raw = await fs.readFile(filePath, 'utf8')
  const parsed = JSON.parse(raw) as { rows?: LexicalityAuditRow[] }
  return Array.isArray(parsed.rows) ? parsed.rows : []
}

const SUSPICIOUS_LOW_LEVEL_KUNYOMI = new Set([
  'N5:下:もと',
  'N4:公:おおやけ',
  'N4:字:あざ',
  'N4:文:ふみ',
  'N4:病:やまい',
])

export async function getLexicalityReviewQueue(): Promise<LexicalityReviewItem[]> {
  const rows = await loadLexicalityAuditRows()
  const queue: LexicalityReviewItem[] = []

  for (const row of rows) {
    if (row.readingType === 'onyomi') {
      queue.push({
        ...row,
        reviewCategory: 'onyomi-bare',
        priority: 'high',
      })
      continue
    }

    const lowLevelKey = `${row.jlpt}:${row.kanji}:${normalizeKana(row.reading)}`
    if (SUSPICIOUS_LOW_LEVEL_KUNYOMI.has(lowLevelKey)) {
      queue.push({
        ...row,
        reviewCategory: 'low-level-kunyomi-suspicious',
        priority: 'medium',
      })
    }
  }

  return queue.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1 }
    const priorityDelta = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (priorityDelta !== 0) return priorityDelta
    const jlptDelta = String(a.jlpt).localeCompare(String(b.jlpt))
    if (jlptDelta !== 0) return jlptDelta
    return a.kanji.localeCompare(b.kanji) || normalizeKana(a.reading).localeCompare(normalizeKana(b.reading))
  })
}

export async function getKanjiStudyOutcomesSummary(days = 14): Promise<KanjiStudyOutcomesSummary> {
  const db = getAdminDb()
  const since = new Date()
  since.setDate(since.getDate() - days)

  const snapshot = await db
    .collection('kanji_study_analytics_events')
    .where('createdAt', '>=', since)
    .orderBy('createdAt', 'desc')
    .limit(1000)
    .get()

  let totalStarted = 0
  let totalCompleted = 0
  let totalExited = 0
  let totalResumed = 0
  let totalRestoredToDashboard = 0
  let exitsBeforeHalfway = 0
  let completedCardsOnExitSum = 0
  let completedCardsOnExitCount = 0
  const exitCardCounts = new Map<string, { kanji: string | null; word: string | null; reading: string | null; cardType: string | null; exits: number }>()

  for (const doc of snapshot.docs) {
    const data = doc.data() as {
      eventName?: string
      properties?: Record<string, unknown>
    }
    const eventName = data.eventName || ''
    const properties = data.properties || {}

    if (eventName === 'kanji_study_session_started') totalStarted += 1
    if (eventName === 'kanji_study_session_completed') totalCompleted += 1
    if (eventName === 'kanji_study_session_resumed') totalResumed += 1
    if (eventName === 'kanji_study_session_restored_to_dashboard') totalRestoredToDashboard += 1

    if (eventName === 'kanji_study_session_exited') {
      totalExited += 1

      const completedCards = Number(properties.completedCards)
      const totalCards = Number(properties.totalCards)
      if (Number.isFinite(completedCards)) {
        completedCardsOnExitSum += completedCards
        completedCardsOnExitCount += 1
      }
      if (
        Number.isFinite(completedCards) &&
        Number.isFinite(totalCards) &&
        totalCards > 0 &&
        completedCards / totalCards < 0.5
      ) {
        exitsBeforeHalfway += 1
      }

      const kanji = typeof properties.currentKanji === 'string' ? properties.currentKanji : null
      const word = typeof properties.currentWord === 'string' ? properties.currentWord : null
      const reading = typeof properties.currentReading === 'string' ? properties.currentReading : null
      const cardType = typeof properties.currentCardType === 'string' ? properties.currentCardType : null
      const key = [kanji || '-', word || '-', reading || '-', cardType || '-'].join('|')
      const existing = exitCardCounts.get(key)
      if (existing) {
        existing.exits += 1
      } else {
        exitCardCounts.set(key, { kanji, word, reading, cardType, exits: 1 })
      }
    }
  }

  return {
    days,
    totalEvents: snapshot.size,
    totalStarted,
    totalCompleted,
    totalExited,
    totalResumed,
    totalRestoredToDashboard,
    completionRate: totalStarted > 0 ? totalCompleted / totalStarted : 0,
    averageCompletedCardsOnExit:
      completedCardsOnExitCount > 0 ? completedCardsOnExitSum / completedCardsOnExitCount : null,
    exitsBeforeHalfway,
    topExitCards: Array.from(exitCardCounts.values())
      .sort((a, b) => b.exits - a.exits)
      .slice(0, 8),
  }
}
