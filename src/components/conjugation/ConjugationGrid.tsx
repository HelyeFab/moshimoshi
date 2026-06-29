'use client'

/**
 * Takoboto-style flat conjugation grid: a matrix of cards (Present/Future, Past,
 * Te-form, Progressive, Volitional, Imperative, Request, Provisional,
 * Conditional, Potential, Passive, Causative), each showing plain + polite
 * (and negatives) with furigana. Cells with no value are skipped, so adjectives
 * (which lack many verb forms) degrade gracefully.
 */

import { useEffect, useState } from 'react'
import { ExtendedConjugationEngine } from '@/lib/conjugation/engine'
import { enhanceWordWithType } from '@/utils/enhancedWordTypeDetection'
import FuriganaText from '@/components/grammar/FuriganaText'
import { useTTS } from '@/hooks/useTTS'
import type { JapaneseWord } from '@/types/vocabulary'
import type { ExtendedConjugationForms } from '@/types/conjugation'

type FormKey = keyof ExtendedConjugationForms

interface Row { label: string; key: FormKey }
interface Cell { title: string; rows: Row[] }

// Grid groups mirror Takoboto's layout. Negative rows sit under their affirmative.
const GRID: Cell[] = [
  { title: 'Present / Future', rows: [
    { label: 'Plain', key: 'present' }, { label: 'Polite', key: 'polite' },
    { label: 'Negative', key: 'negative' }, { label: 'Polite neg.', key: 'politeNegative' },
  ] },
  { title: 'Past', rows: [
    { label: 'Plain', key: 'past' }, { label: 'Polite', key: 'politePast' },
    { label: 'Negative', key: 'pastNegative' }, { label: 'Polite neg.', key: 'politePastNegative' },
  ] },
  { title: 'Te-form / Continuative', rows: [
    { label: 'Te-form', key: 'teForm' }, { label: 'Negative', key: 'negativeTeForm' },
  ] },
  { title: 'Progressive', rows: [
    { label: 'Plain', key: 'progressive' }, { label: 'Polite', key: 'progressivePolite' },
    { label: 'Negative', key: 'progressiveNegative' }, { label: 'Polite neg.', key: 'progressivePoliteNegative' },
  ] },
  { title: 'Volitional', rows: [
    { label: 'Plain', key: 'volitional' }, { label: 'Polite', key: 'politeVolitional' },
  ] },
  { title: 'Imperative', rows: [
    { label: 'Plain', key: 'imperativePlain' }, { label: 'Polite', key: 'imperativePolite' },
    { label: 'Negative', key: 'imperativeNegative' },
  ] },
  { title: 'Request', rows: [
    { label: 'Please', key: 'request' }, { label: 'Negative', key: 'requestNegative' },
  ] },
  { title: 'Provisional (〜ば)', rows: [
    { label: 'If', key: 'provisional' }, { label: 'Negative', key: 'provisionalNegative' },
  ] },
  { title: 'Conditional (〜たら)', rows: [
    { label: 'If/when', key: 'conditional' }, { label: 'Negative', key: 'conditionalNegative' },
  ] },
  { title: 'Potential', rows: [
    { label: 'Plain', key: 'potential' }, { label: 'Polite', key: 'potentialPolite' },
    { label: 'Negative', key: 'potentialNegative' }, { label: 'Polite neg.', key: 'potentialPoliteNegative' },
  ] },
  { title: 'Passive / Respectful', rows: [
    { label: 'Plain', key: 'passive' }, { label: 'Polite', key: 'passivePolite' },
    { label: 'Negative', key: 'passiveNegative' }, { label: 'Polite neg.', key: 'passivePoliteNegative' },
  ] },
  { title: 'Causative', rows: [
    { label: 'Plain', key: 'causative' }, { label: 'Polite', key: 'causativePolite' },
    { label: 'Negative', key: 'causativeNegative' }, { label: 'Polite neg.', key: 'causativePoliteNegative' },
  ] },
]

export default function ConjugationGrid({ word, showFurigana = true }: { word: JapaneseWord; showFurigana?: boolean }) {
  const [forms, setForms] = useState<ExtendedConjugationForms | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { play } = useTTS({ cacheFirst: true })

  useEffect(() => {
    let active = true
    setLoading(true); setError(false)
    ;(async () => {
      try {
        const enhanced = enhanceWordWithType(word)
        const result = await ExtendedConjugationEngine.conjugate(enhanced)
        if (active) setForms(result)
      } catch (e) {
        console.error('Conjugation failed:', e)
        if (active) setError(true)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [word])

  const speak = (text: string) => {
    play(text, { voice: '23', speed: 0.85 }).catch(() => {
      if ('speechSynthesis' in window) {
        const u = new SpeechSynthesisUtterance(text); u.lang = 'ja-JP'; u.rate = 0.9
        window.speechSynthesis.speak(u)
      }
    })
  }

  if (loading) {
    return <div className="text-sm text-gray-500 dark:text-gray-400 py-6">Generating conjugations…</div>
  }
  if (error || !forms) {
    return <div className="text-sm text-gray-500 dark:text-gray-400 py-6">Conjugations unavailable for this word.</div>
  }

  // Only render cells that have at least one populated form.
  const cells = GRID
    .map(cell => ({ ...cell, rows: cell.rows.filter(r => !!(forms as unknown as Record<string, string>)[r.key]) }))
    .filter(cell => cell.rows.length > 0)

  if (cells.length === 0) {
    return <div className="text-sm text-gray-500 dark:text-gray-400 py-6">Conjugations unavailable for this word.</div>
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {cells.map(cell => (
        <div key={cell.title} className="rounded-lg border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-800/60 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400 mb-2">{cell.title}</div>
          <div className="space-y-1.5">
            {cell.rows.map(row => {
              const value = (forms as unknown as Record<string, string>)[row.key]
              return (
                <div key={row.key} className="flex items-baseline justify-between gap-2">
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 shrink-0 w-16">{row.label}</span>
                  <button
                    onClick={() => speak(value)}
                    title="Play"
                    className="text-right flex-1 text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                    style={{ fontFamily: '"Noto Sans JP","Hiragino Sans","Yu Gothic","Meiryo",sans-serif' }}
                  >
                    {showFurigana ? <FuriganaText text={value} showFurigana as="span" /> : value}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
