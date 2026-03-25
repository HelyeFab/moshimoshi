'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAdmin } from '@/hooks/useAdmin'

type ReadingInspectionResult = {
  reading: string
  normalizedReading: string
  readingType: 'onyomi' | 'kunyomi'
  isPrioritized: boolean
  curatedCandidates: Array<{
    word: string
    wordReading: string
    meaning: string
    confidence: 'high' | 'medium' | 'low'
    reason: string
  }>
  heuristicCandidates: Array<{
    word: string
    wordReading: string
    meaning: string
    score: number
    isCommon: boolean
    tags: string[]
    wordType?: string
    matchQuality: 'excellent' | 'good' | 'fair' | 'poor'
  }>
  selectedSource: 'curated' | 'jmdict' | 'none'
  selectedWord: string | null
  selectedWordReading: string | null
  selectedMeaning: string | null
}

type KanjiInspectionResponse = {
  mode: 'single-kanji'
  inspection: {
    kanji: {
      kanji: string
      jlpt: string
      meaning: string
      meanings: string[]
      onyomi: string[]
      kunyomi: string[]
    }
    prioritized: {
      onyomi: string[]
      kunyomi: string[]
      primaryReading: string | null
      source: 'jmdict' | 'fallback'
    }
    readings: ReadingInspectionResult[]
  }
}

type ProposalValidationResponse = {
  mode: 'proposal-validation'
  level: 'N3' | 'N2' | 'N1'
  validations: Array<{
    proposal: {
      level: 'N3' | 'N2' | 'N1'
      kanji: string
      reading: string
      readingType: 'onyomi' | 'kunyomi'
      proposedWord: string
      proposedWordReading: string
      proposedMeaning: string
      reason: string
    }
    topHeuristic: {
      word: string
      wordReading: string
      meaning: string
      score: number
      tags: string[]
      matchQuality: string
    } | null
    heuristicCandidates: Array<{
      word: string
      wordReading: string
      meaning: string
      score: number
      tags: string[]
      matchQuality: string
    }>
    heuristicMatchesProposal: boolean
    recommendedAction: 'keep-heuristic' | 'add-override'
  }>
}

type LexicalityReviewQueueResponse = {
  mode: 'lexicality-review-queue'
  items: Array<{
    jlpt: string
    kanji: string
    reading: string
    readingType: 'onyomi' | 'kunyomi'
    meaning: string
    source: 'curated' | 'jmdict' | 'unknown'
    reviewCategory: 'onyomi-bare' | 'low-level-kunyomi-suspicious'
    priority: 'high' | 'medium'
  }>
}

type OutcomesSummaryResponse = {
  mode: 'outcomes-summary'
  summary: {
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
}

const sampleKanji = ['子', '生', '上', '度', '試', '術', '乳']

export default function KanjiVocabularyInspectorPage() {
  const { isAdmin, isLoading: adminLoading } = useAdmin()
  const [kanjiQuery, setKanjiQuery] = useState('子')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inspection, setInspection] = useState<KanjiInspectionResponse['inspection'] | null>(null)
  const [validationLevel, setValidationLevel] = useState<'N3' | 'N2' | 'N1' | null>(null)
  const [validations, setValidations] = useState<ProposalValidationResponse['validations']>([])
  const [reviewQueue, setReviewQueue] = useState<LexicalityReviewQueueResponse['items']>([])
  const [outcomesSummary, setOutcomesSummary] = useState<OutcomesSummaryResponse['summary'] | null>(null)

  const readingGroups = useMemo(() => {
    if (!inspection) return { kunyomi: [], onyomi: [] } as Record<'kunyomi' | 'onyomi', ReadingInspectionResult[]>

    return {
      kunyomi: inspection.readings.filter(reading => reading.readingType === 'kunyomi'),
      onyomi: inspection.readings.filter(reading => reading.readingType === 'onyomi'),
    }
  }, [inspection])

  async function inspectKanji(character: string) {
    setLoading(true)
    setError(null)
    setValidationLevel(null)

    try {
      const response = await fetch(`/api/admin/kanji-vocabulary-inspector?kanji=${encodeURIComponent(character)}`, {
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to inspect kanji')
      }

      setInspection((data as KanjiInspectionResponse).inspection)
      setValidations([])
      setReviewQueue([])
      setOutcomesSummary(null)
      setKanjiQuery(character)
    } catch (fetchError) {
      setInspection(null)
      setValidations([])
      setReviewQueue([])
      setOutcomesSummary(null)
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to inspect kanji')
    } finally {
      setLoading(false)
    }
  }

  async function validateLevel(level: 'N3' | 'N2' | 'N1') {
    setLoading(true)
    setError(null)
    setInspection(null)
    setValidationLevel(level)
    setReviewQueue([])
    setOutcomesSummary(null)

    try {
      const response = await fetch(`/api/admin/kanji-vocabulary-inspector?proposalLevel=${level}`, {
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to validate proposal level')
      }

      setValidations((data as ProposalValidationResponse).validations)
    } catch (fetchError) {
      setValidations([])
      setReviewQueue([])
      setOutcomesSummary(null)
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to validate proposal level')
    } finally {
      setLoading(false)
    }
  }

  async function loadLexicalityQueue() {
    setLoading(true)
    setError(null)
    setInspection(null)
    setValidations([])
    setValidationLevel(null)
    setOutcomesSummary(null)

    try {
      const response = await fetch('/api/admin/kanji-vocabulary-inspector?queue=lexicality', {
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load lexicality review queue')
      }

      setReviewQueue((data as LexicalityReviewQueueResponse).items)
    } catch (fetchError) {
      setReviewQueue([])
      setOutcomesSummary(null)
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load lexicality review queue')
    } finally {
      setLoading(false)
    }
  }

  async function loadOutcomesSummary() {
    setLoading(true)
    setError(null)
    setInspection(null)
    setValidations([])
    setValidationLevel(null)
    setReviewQueue([])

    try {
      const response = await fetch('/api/admin/kanji-vocabulary-inspector?report=outcomes&days=14', {
        credentials: 'include',
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to load outcomes summary')
      }

      setOutcomesSummary((data as OutcomesSummaryResponse).summary)
    } catch (fetchError) {
      setOutcomesSummary(null)
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load outcomes summary')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      inspectKanji('子')
    }
  }, [isAdmin])

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-gray-600 dark:text-gray-400">
        Verifying admin access...
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[300px] text-gray-600 dark:text-gray-400">
        Admin access required.
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Kanji Vocabulary Inspector
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Compare curated overrides, heuristic candidates, and higher-level proposal checks before changing the teaching layer.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex gap-2">
            <input
              value={kanjiQuery}
              onChange={event => setKanjiQuery(event.target.value.slice(0, 1))}
              className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-center text-2xl dark:border-dark-600 dark:bg-dark-800 dark:text-gray-100"
              placeholder="子"
            />
            <button
              onClick={() => inspectKanji(kanjiQuery)}
              disabled={!kanjiQuery || loading}
              className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Inspect
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={loadLexicalityQueue}
              disabled={loading}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100 dark:hover:bg-amber-900/30"
            >
              Review Lexicality Queue
            </button>
            <button
              onClick={loadOutcomesSummary}
              disabled={loading}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100 dark:hover:bg-emerald-900/30"
            >
              Load Outcomes
            </button>
            {(['N3', 'N2', 'N1'] as const).map(level => (
              <button
                key={level}
                onClick={() => validateLevel(level)}
                disabled={loading}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-dark-600 dark:text-gray-200 dark:hover:bg-dark-800"
              >
                Validate {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-100">
        Use this to answer two questions quickly:
        <div className="mt-2 flex flex-wrap gap-2">
          {sampleKanji.map(character => (
            <button
              key={character}
              onClick={() => inspectKanji(character)}
              className="rounded-full bg-white px-3 py-1 font-medium shadow-sm dark:bg-dark-800"
            >
              {character}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-gray-600 shadow-sm dark:border-dark-700 dark:bg-dark-800 dark:text-gray-300">
          Loading inspector data...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {inspection && (
        <>
          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-dark-700 dark:bg-dark-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-5xl font-bold text-gray-900 dark:text-gray-100">
                    {inspection.kanji.kanji}
                  </div>
                  <div className="mt-2 text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {inspection.kanji.jlpt}
                  </div>
                </div>
                <div className="rounded-xl bg-gray-50 px-4 py-3 text-right dark:bg-dark-900">
                  <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Prioritization Source
                  </div>
                  <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {inspection.prioritized.source}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-lg text-gray-800 dark:text-gray-200">
                {inspection.kanji.meanings.join(', ')}
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-900/10">
                  <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                    Prioritized Kunyomi
                  </div>
                  <div className="mt-2 text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                    {inspection.prioritized.kunyomi.join(' ・ ') || 'None'}
                  </div>
                </div>
                <div className="rounded-xl bg-indigo-50 p-4 dark:bg-indigo-900/10">
                  <div className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
                    Prioritized Onyomi
                  </div>
                  <div className="mt-2 text-lg font-semibold text-indigo-900 dark:text-indigo-100">
                    {inspection.prioritized.onyomi.join(' ・ ') || 'None'}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-dark-700 dark:bg-dark-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Review Workflow
              </h2>
              <ol className="mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <li>1. Inspect the top heuristic candidate for each prioritized reading.</li>
                <li>2. Check whether a curated override already exists and why.</li>
                <li>3. For N3/N2/N1, run level validation and merge only proposal items that still misfire.</li>
                <li>4. Keep the override map sparse and let the heuristic win whenever it already picks the right word.</li>
              </ol>
            </div>
          </div>

          {(['kunyomi', 'onyomi'] as const).map(group => (
            <section key={group} className="space-y-4">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {group === 'kunyomi' ? "Kun'yomi" : "On'yomi"}
                </h2>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 dark:bg-dark-700 dark:text-gray-300">
                  {readingGroups[group].length} reading{readingGroups[group].length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {readingGroups[group].map(reading => (
                  <div
                    key={`${reading.readingType}-${reading.normalizedReading}`}
                    className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-dark-700 dark:bg-dark-800"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                          {reading.reading}
                        </div>
                        <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          normalized: {reading.normalizedReading}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 text-right">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${reading.isPrioritized ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-300'}`}>
                          {reading.isPrioritized ? 'Prioritized' : 'Non-priority'}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${reading.selectedSource === 'curated' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : reading.selectedSource === 'jmdict' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-gray-300'}`}>
                          Selected: {reading.selectedSource}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl bg-purple-50 p-4 dark:bg-purple-900/10">
                        <div className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                          Curated Override
                        </div>
                        {reading.curatedCandidates.length > 0 ? (
                          <div className="mt-2 space-y-2">
                            {reading.curatedCandidates.map(candidate => (
                              <div key={`${candidate.word}-${candidate.wordReading}`}>
                                <div className="text-lg font-semibold text-purple-900 dark:text-purple-100">
                                  {candidate.word}
                                </div>
                                <div className="text-sm text-purple-800 dark:text-purple-200">
                                  {candidate.wordReading} · {candidate.meaning}
                                </div>
                                <div className="mt-1 text-xs text-purple-700 dark:text-purple-300">
                                  {candidate.reason}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-purple-800/80 dark:text-purple-200/80">
                            No curated override for this reading.
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-900/10">
                        <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                          Top Heuristic
                        </div>
                        {reading.heuristicCandidates[0] ? (
                          <div className="mt-2">
                            <div className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                              {reading.heuristicCandidates[0].word}
                            </div>
                            <div className="text-sm text-blue-800 dark:text-blue-200">
                              {reading.heuristicCandidates[0].wordReading} · {reading.heuristicCandidates[0].meaning}
                            </div>
                            <div className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                              score {Math.round(reading.heuristicCandidates[0].score)} · {reading.heuristicCandidates[0].matchQuality}
                              {reading.heuristicCandidates[0].isCommon ? ' · common' : ''}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 text-sm text-blue-800/80 dark:text-blue-200/80">
                            No heuristic candidate found.
                          </div>
                        )}
                      </div>
                    </div>

                    {reading.heuristicCandidates.length > 1 && (
                      <div className="mt-4">
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Candidate stack
                        </div>
                        <div className="space-y-2">
                          {reading.heuristicCandidates.slice(0, 3).map(candidate => (
                            <div
                              key={`${candidate.word}-${candidate.wordReading}`}
                              className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-dark-700"
                            >
                              <div>
                                <div className="font-medium text-gray-900 dark:text-gray-100">
                                  {candidate.word} <span className="text-gray-500 dark:text-gray-400">({candidate.wordReading})</span>
                                </div>
                                <div className="text-sm text-gray-600 dark:text-gray-300">
                                  {candidate.meaning}
                                </div>
                              </div>
                              <div className="text-right text-xs text-gray-500 dark:text-gray-400">
                                <div>{Math.round(candidate.score)}</div>
                                <div>{candidate.matchQuality}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </>
      )}

      {reviewQueue.length > 0 && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm dark:border-amber-900/50 dark:bg-amber-900/10">
            <h2 className="text-xl font-semibold text-amber-950 dark:text-amber-100">
              Lexicality Review Queue
            </h2>
            <p className="mt-2 text-sm text-amber-900/90 dark:text-amber-100/80">
              These are the remaining suspicious bare-kanji vocabulary cards from the live audit. Start with high-priority bare onyomi items, then review the small low-level kunyomi edge-case set.
            </p>
          </div>

          <div className="grid gap-3">
            {reviewQueue.map(item => (
              <div
                key={`${item.jlpt}-${item.kanji}-${item.reading}-${item.reviewCategory}`}
                className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-800"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {item.kanji}
                      </span>
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-dark-700 dark:text-gray-200">
                        {item.jlpt}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        item.priority === 'high'
                          ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                      }`}>
                        {item.priority}
                      </span>
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                        {item.reviewCategory}
                      </span>
                    </div>
                    <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-semibold">{item.reading}</span> · {item.readingType} · {item.meaning}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Current source: {item.source}
                    </div>
                  </div>

                  <button
                    onClick={() => inspectKanji(item.kanji)}
                    className="rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-700"
                  >
                    Inspect {item.kanji}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {outcomesSummary && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-900/10">
            <h2 className="text-xl font-semibold text-emerald-950 dark:text-emerald-100">
              Real-User Validation
            </h2>
            <p className="mt-2 text-sm text-emerald-900/90 dark:text-emerald-100/80">
              Outcome summary from the last {outcomesSummary.days} days. Use this to answer whether learners are finishing sessions more often and where they still appear to bail out.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-800">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Sessions Started</div>
              <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{outcomesSummary.totalStarted}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-800">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Sessions Completed</div>
              <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{outcomesSummary.totalCompleted}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-800">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Completion Rate</div>
              <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{Math.round(outcomesSummary.completionRate * 100)}%</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-800">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Sessions Exited</div>
              <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{outcomesSummary.totalExited}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-800">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Exited Before Halfway</div>
              <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">{outcomesSummary.exitsBeforeHalfway}</div>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-dark-700 dark:bg-dark-800">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Avg Cards Completed On Exit</div>
              <div className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                {outcomesSummary.averageCompletedCardsOnExit === null
                  ? '—'
                  : outcomesSummary.averageCompletedCardsOnExit.toFixed(1)}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-dark-700 dark:bg-dark-800">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Top Exit Cards
              </h3>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                resume events: {outcomesSummary.totalResumed} · restored-to-dashboard: {outcomesSummary.totalRestoredToDashboard}
              </div>
            </div>

            {outcomesSummary.topExitCards.length === 0 ? (
              <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                No exit-card data yet. Once a few real sessions are recorded, this will show the cards people most often leave on.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {outcomesSummary.topExitCards.map((item, index) => (
                  <div
                    key={`${item.kanji}-${item.word}-${item.reading}-${index}`}
                    className="flex items-center justify-between rounded-xl border border-gray-200 px-4 py-3 dark:border-dark-700"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {item.word || item.kanji || 'Unknown'}{item.reading ? ` (${item.reading})` : ''}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-300">
                        {item.kanji ? `Kanji ${item.kanji}` : 'No kanji recorded'} · {item.cardType || 'unknown card'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">{item.exits}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">exits</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {validationLevel && validations.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                {validationLevel} Required Proposal Validation
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                This compares each approved proposal candidate against the current heuristic top pick.
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600 dark:bg-dark-700 dark:text-gray-300">
              {validations.length} checks
            </span>
          </div>

          <div className="grid gap-4">
            {validations.map(({ proposal, topHeuristic, heuristicCandidates, heuristicMatchesProposal, recommendedAction }) => (
              <div
                key={`${proposal.level}-${proposal.kanji}-${proposal.reading}`}
                className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-dark-700 dark:bg-dark-800"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                      {proposal.kanji}
                    </div>
                    <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {proposal.readingType} · {proposal.reading}
                    </div>
                    <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                      {proposal.reason}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${heuristicMatchesProposal ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'}`}>
                      {heuristicMatchesProposal ? 'Heuristic already correct' : 'Proposal still wins'}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${recommendedAction === 'keep-heuristic' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'}`}>
                      {recommendedAction}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-xl bg-purple-50 p-4 dark:bg-purple-900/10">
                    <div className="text-xs font-semibold uppercase tracking-wide text-purple-700 dark:text-purple-300">
                      Proposed Override
                    </div>
                    <div className="mt-2 text-lg font-semibold text-purple-900 dark:text-purple-100">
                      {proposal.proposedWord}
                    </div>
                    <div className="text-sm text-purple-800 dark:text-purple-200">
                      {proposal.proposedWordReading} · {proposal.proposedMeaning}
                    </div>
                  </div>

                  <div className="rounded-xl bg-blue-50 p-4 dark:bg-blue-900/10">
                    <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                      Current Top Heuristic
                    </div>
                    {topHeuristic ? (
                      <>
                        <div className="mt-2 text-lg font-semibold text-blue-900 dark:text-blue-100">
                          {topHeuristic.word}
                        </div>
                        <div className="text-sm text-blue-800 dark:text-blue-200">
                          {topHeuristic.wordReading} · {topHeuristic.meaning}
                        </div>
                        <div className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                          score {Math.round(topHeuristic.score)} · {topHeuristic.matchQuality}
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 text-sm text-blue-800/80 dark:text-blue-200/80">
                        No heuristic candidate found.
                      </div>
                    )}
                  </div>
                </div>

                {heuristicCandidates.length > 1 && (
                  <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                    Next candidates: {heuristicCandidates.slice(1, 3).map(item => `${item.word} (${item.wordReading})`).join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
