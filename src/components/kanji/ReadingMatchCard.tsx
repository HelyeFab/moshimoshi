'use client'

import { useEffect, useRef, useState } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import type { ReadingMatchCard as ReadingMatchCardType } from '@/types/kanji-study'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

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
    const pair = card.pairs.find(p => p.reading === reading)
    const isOnyomi = pair?.readingType === 'onyomi'

    return (
      <button
        key={reading}
        type="button"
        disabled={isMatched}
        onClick={() => setSelectedReading(reading)}
        className={`block w-full rounded-xl border-2 px-4 py-3 text-center text-xl sm:text-2xl font-bold transition-all transform hover:scale-105 active:scale-95 ${
          isMatched
            ? 'border-green-400 bg-white dark:bg-dark-800 text-green-700 dark:text-green-300 shadow-lg cursor-default'
            : isSelected
              ? `${isOnyomi
                  ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                  : 'border-purple-500 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                } shadow-xl scale-105`
              : `border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 ${
                  isOnyomi
                    ? 'hover:border-blue-400 dark:hover:border-blue-600'
                    : 'hover:border-purple-400 dark:hover:border-purple-600'
                } hover:shadow-lg`
        }`}
        style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif' }}
      >
        {reading}
        {isMatched && (
          <div className="mt-1 text-sm text-green-600 dark:text-green-400 font-semibold">✓</div>
        )}
      </button>
    )
  }

  return (
    <div
      className="w-full overflow-y-auto scrollbar-hide py-8 px-4 sm:px-8 flex flex-col"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-100 dark:bg-teal-900/30 mb-3">
          <div className="w-2 h-2 rounded-full bg-teal-500 dark:bg-teal-400 animate-pulse"></div>
          <span className="text-xs font-bold text-teal-700 dark:text-teal-300 uppercase tracking-wider">
            {readingMatchStrings?.title || 'Match Words to Readings'}
          </span>
        </div>
        <p className="text-lg text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
          {readingMatchStrings?.subtitle || 'Pair each word with the reading you just learned'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 max-w-5xl mx-auto w-full">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1 w-6 bg-gradient-to-r from-teal-500 to-teal-400 rounded-full"></div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300">
              {readingMatchStrings?.words || 'Words'}
            </h3>
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
                className={`block w-full rounded-2xl border-2 px-4 py-4 text-center transition-all transform hover:scale-105 active:scale-95 ${
                  isMatched
                    ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 text-green-700 dark:text-green-300 shadow-lg cursor-default'
                    : isSelected
                      ? 'border-teal-500 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/30 dark:to-cyan-900/30 text-teal-700 dark:text-teal-300 shadow-xl scale-105'
                      : 'border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 hover:border-teal-400 dark:hover:border-teal-600 hover:shadow-lg'
                }`}
              >
                <div
                  className="text-3xl sm:text-4xl font-bold leading-none"
                  style={{ fontFamily: '"Noto Sans JP", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "Noto Sans CJK JP", sans-serif' }}
                >
                  {pair.word}
                </div>
                {isMatched && (
                  <div className="mt-2 text-sm text-green-600 dark:text-green-400 font-semibold">✓</div>
                )}
              </button>
            )
          })}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-1 w-6 bg-gradient-to-r from-purple-500 to-purple-400 rounded-full"></div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
              {readingMatchStrings?.readings || 'Readings'}
            </h3>
          </div>
          {onyomiReadings.length > 0 && (
            <div className="space-y-3 rounded-2xl border-2 border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 px-4 py-4 shadow-md">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-blue-500 rounded-full"></div>
                <div className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                  {vocabularyCardStrings?.onyomi || "On'yomi"}
                </div>
              </div>
              <div className="space-y-2">
                {onyomiReadings.map(renderReadingButton)}
              </div>
            </div>
          )}
          {kunyomiReadings.length > 0 && (
            <div className="space-y-3 rounded-2xl border-2 border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 px-4 py-4 shadow-md">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-purple-500 rounded-full"></div>
                <div className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                  {vocabularyCardStrings?.kunyomi || "Kun'yomi"}
                </div>
              </div>
              <div className="space-y-2">
                {kunyomiReadings.map(renderReadingButton)}
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className={`mt-6 min-h-[3.5rem] rounded-2xl border-2 px-6 py-3 text-center text-base transition-all flex items-center justify-center ${
          matchStatus === 'incorrect'
            ? 'border-red-400 bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 text-red-700 dark:text-red-300 shadow-lg'
            : matchStatus === 'correct'
              ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 text-green-700 dark:text-green-300 shadow-lg'
              : 'border-dashed border-gray-300 dark:border-dark-600 bg-gray-50/50 dark:bg-dark-800/50'
        }`}
      >
        {allMatched ? (
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-bold text-green-700 dark:text-green-300">
              {readingMatchStrings?.completed || 'All pairs matched'}
            </span>
          </div>
        ) : matchStatus === 'incorrect' ? (
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="font-semibold text-red-700 dark:text-red-300">
              Not quite. Try a different pairing.
            </span>
          </div>
        ) : matchStatus === 'correct' ? (
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-semibold text-green-700 dark:text-green-300">
              Correct
            </span>
          </div>
        ) : (
          <span className="text-gray-600 dark:text-gray-400 font-medium">
            {readingMatchStrings?.instructions || 'Tap a word, then tap its reading'}
          </span>
        )}
      </div>

      {/* Mobile Navigation Spacer */}
      <MobileNavSpacer />
    </div>
  )
}
