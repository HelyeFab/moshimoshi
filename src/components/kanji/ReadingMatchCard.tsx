'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import type { ReadingMatchCard as ReadingMatchCardType } from '@/types/kanji-study'

interface ReadingMatchCardProps {
  card: ReadingMatchCardType
  onStarted?: (payload: { pairCount: number }) => void
  onMismatch?: (payload: { word: string; selectedReading: string }) => void
  onCompleted?: (stats: { mismatchCount: number; durationMs: number }) => void
}

type MatchStatus = 'idle' | 'correct' | 'incorrect'

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function ReadingMatchCard({
  card,
  onStarted,
  onMismatch,
  onCompleted,
}: ReadingMatchCardProps) {
  const { strings } = useI18n()
  const readingMatchStrings = strings.vocabularyFirstStudy?.readingMatchCard
  const vocabularyCardStrings = strings.vocabularyFirstStudy?.vocabularyCard
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [selectedReading, setSelectedReading] = useState<string | null>(null)
  const [matchedWords, setMatchedWords] = useState<string[]>([])
  const [shuffledReadings, setShuffledReadings] = useState<string[]>([])
  const [mismatchCount, setMismatchCount] = useState(0)
  const [matchStatus, setMatchStatus] = useState<MatchStatus>('idle')
  const startedAtRef = useRef(Date.now())
  const hasReportedCompletionRef = useRef(false)

  useEffect(() => {
    setSelectedWord(null)
    setSelectedReading(null)
    setMatchedWords([])
    setShuffledReadings(shuffle(card.pairs.map(pair => pair.reading)))
    setMismatchCount(0)
    setMatchStatus('idle')
    startedAtRef.current = Date.now()
    hasReportedCompletionRef.current = false
  }, [card.id, card.pairs])

  useEffect(() => {
    onStarted?.({ pairCount: card.pairs.length })
  }, [card.id, card.pairs.length, onStarted])

  useEffect(() => {
    if (!selectedWord || !selectedReading) return

    const matchedPair = card.pairs.find(pair => pair.word === selectedWord)
    const isCorrect = matchedPair?.reading === selectedReading

    if (isCorrect) {
      setMatchedWords(prev => (prev.includes(selectedWord) ? prev : [...prev, selectedWord]))
      setMatchStatus('correct')
    } else {
      setMismatchCount(prev => prev + 1)
      setMatchStatus('incorrect')
      onMismatch?.({
        word: selectedWord,
        selectedReading,
      })
    }

    const timer = window.setTimeout(() => {
      setSelectedWord(null)
      setSelectedReading(null)
      setMatchStatus('idle')
    }, isCorrect ? 250 : 450)

    return () => window.clearTimeout(timer)
  }, [selectedWord, selectedReading, card.pairs])

  useEffect(() => {
    if (matchedWords.length !== card.pairs.length || hasReportedCompletionRef.current) return
    hasReportedCompletionRef.current = true
    onCompleted?.({
      mismatchCount,
      durationMs: Date.now() - startedAtRef.current,
    })
  }, [matchedWords, card.pairs.length, mismatchCount, onCompleted])

  const readingToWord = new Map(card.pairs.map(pair => [pair.reading, pair.word]))
  const allMatched = matchedWords.length === card.pairs.length
  const onyomiReadings = shuffledReadings.filter(reading =>
    card.pairs.some(pair => pair.reading === reading && pair.readingType === 'onyomi')
  )
  const kunyomiReadings = shuffledReadings.filter(reading =>
    card.pairs.some(pair => pair.reading === reading && pair.readingType === 'kunyomi')
  )

  const renderReadingButton = (reading: string) => {
    const matchedWord = readingToWord.get(reading)
    const isMatched = matchedWord ? matchedWords.includes(matchedWord) : false
    const isSelected = selectedReading === reading

    return (
      <button
        key={reading}
        type="button"
        disabled={isMatched}
        onClick={() => setSelectedReading(reading)}
        className={`block w-full rounded-xl border px-3 py-2.5 sm:py-3 text-center text-base sm:text-xl font-bold transition-all ${
          isMatched
            ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300'
            : isSelected
              ? 'border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-500 dark:bg-violet-900/20 dark:text-violet-300'
              : 'border-gray-200 bg-gray-50 text-gray-900 hover:border-violet-300 hover:bg-violet-50 dark:border-dark-600 dark:bg-dark-700 dark:text-gray-100 dark:hover:border-violet-700 dark:hover:bg-dark-600'
        } ${isMatched ? 'cursor-default' : ''}`}
      >
        {reading}
      </button>
    )
  }

  return (
    <div
      className="w-full h-full overflow-y-auto scrollbar-hide bg-white dark:bg-dark-800 rounded-2xl shadow-2xl border-2 border-teal-300 dark:border-teal-600 p-3 sm:p-5 md:p-6 flex flex-col"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div className="text-center mb-3 sm:mb-4">
        <div className="text-xs sm:text-sm font-bold uppercase tracking-[0.18em] text-teal-500 dark:text-teal-300">
          {readingMatchStrings?.title || 'Match Words to Readings'}
        </div>
        <p className="mt-2 text-xs sm:text-base text-gray-600 dark:text-gray-400">
          {readingMatchStrings?.subtitle || 'Pair each word with the reading you just learned'}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {readingMatchStrings?.words || 'Words'}
          </div>
          {card.pairs.map(pair => {
            const isMatched = matchedWords.includes(pair.word)
            const isSelected = selectedWord === pair.word

            return (
              <button
                key={pair.word}
                type="button"
                disabled={isMatched}
                onClick={() => setSelectedWord(pair.word)}
                className={`block w-full rounded-xl border px-3 py-2.5 sm:py-3 text-left transition-all ${
                  isMatched
                    ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-300'
                    : isSelected
                      ? 'border-teal-400 bg-teal-50 text-teal-700 dark:border-teal-500 dark:bg-teal-900/20 dark:text-teal-300'
                      : 'border-gray-200 bg-gray-50 text-gray-900 hover:border-teal-300 hover:bg-teal-50 dark:border-dark-600 dark:bg-dark-700 dark:text-gray-100 dark:hover:border-teal-700 dark:hover:bg-dark-600'
                } ${isMatched ? 'cursor-default' : ''}`}
              >
                <div
                  className="text-xl sm:text-3xl font-bold leading-none"
                  style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}
                >
                  {pair.word}
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {readingMatchStrings?.readings || 'Readings'}
          </div>
          {onyomiReadings.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-blue-200/70 bg-blue-50/70 px-3 py-3 dark:border-blue-900/40 dark:bg-blue-950/20">
              <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                {vocabularyCardStrings?.onyomi || "On'yomi"}
              </div>
              {onyomiReadings.map(renderReadingButton)}
            </div>
          )}
          {kunyomiReadings.length > 0 && (
            <div className="space-y-2 rounded-2xl border border-violet-200/70 bg-violet-50/70 px-3 py-3 dark:border-violet-900/40 dark:bg-violet-950/20">
              <div className="text-[11px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-300">
                {vocabularyCardStrings?.kunyomi || "Kun'yomi"}
              </div>
              {kunyomiReadings.map(renderReadingButton)}
            </div>
          )}
        </div>
      </div>

      <div
        className={`mt-3 sm:mt-4 min-h-[2.75rem] rounded-xl border px-3 py-2 text-center text-xs sm:text-sm transition-all ${
          matchStatus === 'incorrect'
            ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20'
            : matchStatus === 'correct'
              ? 'border-green-300 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-950/20'
              : 'border-dashed border-gray-200 dark:border-dark-600'
        }`}
      >
        {allMatched ? (
          <span className="font-semibold text-green-600 dark:text-green-300">
            {readingMatchStrings?.completed || 'All pairs matched'}
          </span>
        ) : matchStatus === 'incorrect' ? (
          <span className="text-red-600 dark:text-red-300">
            Not quite. Try a different pairing.
          </span>
        ) : matchStatus === 'correct' ? (
          <span className="text-green-600 dark:text-green-300">
            Correct.
          </span>
        ) : (
          <span className="text-gray-500 dark:text-gray-400">
            {readingMatchStrings?.instructions || 'Tap a word, then tap its reading'}
          </span>
        )}
      </div>
    </div>
  )
}
