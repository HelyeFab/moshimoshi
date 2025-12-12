'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronRight, Volume2, AlertCircle, Loader2 } from 'lucide-react'
import { ExtendedConjugationEngine } from '@/lib/conjugation/engine'
import { ExtendedConjugationForms } from '@/types/conjugation'
import { EnhancedJapaneseWord, enhanceWordWithType } from '@/utils/enhancedWordTypeDetection'
import { useTTS } from '@/hooks/useTTS'
import type { WordExplanation } from '@/lib/ai/types'

interface CompactConjugationTableProps {
  /** WordExplanation from the word lookup */
  explanation: WordExplanation
  /** Optional className for styling */
  className?: string
}

interface ConjugationGroup {
  id: string
  title: string
  titleJa: string
  emoji: string
  forms: {
    key: keyof ExtendedConjugationForms
    label: string
    labelJa?: string
  }[]
  defaultExpanded?: boolean
}

// Compact structure - only essential forms organized logically
const COMPACT_GROUPS: ConjugationGroup[] = [
  {
    id: 'basic',
    title: 'Basic Forms',
    titleJa: '基本形',
    emoji: '📝',
    forms: [
      { key: 'present', label: 'Dictionary', labelJa: '辞書形' },
      { key: 'past', label: 'Past', labelJa: '過去形' },
      { key: 'negative', label: 'Negative', labelJa: '否定形' },
      { key: 'pastNegative', label: 'Past Negative', labelJa: '過去否定形' },
      { key: 'teForm', label: 'Te-form', labelJa: 'て形' },
    ],
    defaultExpanded: true,
  },
  {
    id: 'polite',
    title: 'Polite Forms',
    titleJa: '丁寧形',
    emoji: '🎩',
    forms: [
      { key: 'polite', label: 'Present', labelJa: 'ます形' },
      { key: 'politePast', label: 'Past', labelJa: 'ました形' },
      { key: 'politeNegative', label: 'Negative', labelJa: 'ません形' },
      { key: 'politePastNegative', label: 'Past Negative', labelJa: 'ませんでした形' },
    ],
    defaultExpanded: true,
  },
  {
    id: 'conditional',
    title: 'Conditional',
    titleJa: '条件形',
    emoji: '🔀',
    forms: [
      { key: 'conditional', label: 'If/When (-tara)', labelJa: 'たら形' },
      { key: 'provisional', label: 'If (-ba)', labelJa: 'ば形' },
      { key: 'conditionalNegative', label: 'If Not (-tara)', labelJa: 'なかったら形' },
      { key: 'provisionalNegative', label: 'If Not (-ba)', labelJa: 'なければ形' },
    ],
    defaultExpanded: false,
  },
  {
    id: 'volitional',
    title: 'Volitional & Imperative',
    titleJa: '意志形・命令形',
    emoji: '💪',
    forms: [
      { key: 'volitional', label: "Let's / I'll", labelJa: '意志形' },
      { key: 'politeVolitional', label: "Shall we?", labelJa: 'ましょう形' },
      { key: 'imperativePlain', label: 'Command (plain)', labelJa: '命令形' },
      { key: 'imperativePolite', label: 'Command (polite)', labelJa: 'なさい形' },
    ],
    defaultExpanded: false,
  },
  {
    id: 'potential',
    title: 'Potential (Can do)',
    titleJa: '可能形',
    emoji: '✨',
    forms: [
      { key: 'potential', label: 'Can do', labelJa: '可能形' },
      { key: 'potentialNegative', label: "Can't do", labelJa: '可能否定形' },
      { key: 'potentialPast', label: 'Could do', labelJa: '可能過去形' },
      { key: 'potentialPolite', label: 'Can do (polite)', labelJa: '可能丁寧形' },
    ],
    defaultExpanded: false,
  },
  {
    id: 'passive',
    title: 'Passive',
    titleJa: '受身形',
    emoji: '🎭',
    forms: [
      { key: 'passive', label: 'Passive', labelJa: '受身形' },
      { key: 'passiveNegative', label: 'Passive Negative', labelJa: '受身否定形' },
      { key: 'passivePast', label: 'Passive Past', labelJa: '受身過去形' },
      { key: 'passivePolite', label: 'Passive Polite', labelJa: '受身丁寧形' },
    ],
    defaultExpanded: false,
  },
  {
    id: 'causative',
    title: 'Causative (Make/Let)',
    titleJa: '使役形',
    emoji: '👆',
    forms: [
      { key: 'causative', label: 'Make/Let do', labelJa: '使役形' },
      { key: 'causativeNegative', label: 'Not make do', labelJa: '使役否定形' },
      { key: 'causativePassive', label: 'Made to do', labelJa: '使役受身形' },
      { key: 'causativePolite', label: 'Make do (polite)', labelJa: '使役丁寧形' },
    ],
    defaultExpanded: false,
  },
  {
    id: 'tai',
    title: 'Want to (-tai)',
    titleJa: 'たい形',
    emoji: '💖',
    forms: [
      { key: 'taiForm', label: 'Want to', labelJa: 'たい形' },
      { key: 'taiFormNegative', label: "Don't want to", labelJa: 'たくない形' },
      { key: 'taiFormPast', label: 'Wanted to', labelJa: 'たかった形' },
      { key: 'taiFormPastNegative', label: "Didn't want to", labelJa: 'たくなかった形' },
    ],
    defaultExpanded: false,
  },
  {
    id: 'progressive',
    title: 'Progressive (-teiru)',
    titleJa: 'ている形',
    emoji: '🔄',
    forms: [
      { key: 'progressive', label: 'Is doing', labelJa: 'ている形' },
      { key: 'progressiveNegative', label: 'Is not doing', labelJa: 'ていない形' },
      { key: 'progressivePast', label: 'Was doing', labelJa: 'ていた形' },
      { key: 'progressivePolite', label: 'Is doing (polite)', labelJa: 'ています形' },
    ],
    defaultExpanded: false,
  },
]

// Adjective-specific compact groups
const ADJECTIVE_COMPACT_GROUPS: ConjugationGroup[] = [
  {
    id: 'basic',
    title: 'Basic Forms',
    titleJa: '基本形',
    emoji: '📝',
    forms: [
      { key: 'present', label: 'Present', labelJa: '現在形' },
      { key: 'negative', label: 'Negative', labelJa: '否定形' },
      { key: 'past', label: 'Past', labelJa: '過去形' },
      { key: 'pastNegative', label: 'Past Negative', labelJa: '過去否定形' },
      { key: 'teForm', label: 'Te-form', labelJa: 'て形' },
    ],
    defaultExpanded: true,
  },
  {
    id: 'polite',
    title: 'Polite Forms',
    titleJa: '丁寧形',
    emoji: '🎩',
    forms: [
      { key: 'polite', label: 'Present (polite)', labelJa: 'です形' },
      { key: 'politeNegative', label: 'Negative (polite)', labelJa: 'ないです形' },
      { key: 'politePast', label: 'Past (polite)', labelJa: 'でした形' },
      { key: 'politePastNegative', label: 'Past Neg. (polite)', labelJa: 'なかったです形' },
    ],
    defaultExpanded: true,
  },
  {
    id: 'conditional',
    title: 'Conditional',
    titleJa: '条件形',
    emoji: '🔀',
    forms: [
      { key: 'conditional', label: 'If (-tara)', labelJa: 'たら形' },
      { key: 'provisional', label: 'If (-ba)', labelJa: 'ば形' },
      { key: 'conditionalNegative', label: 'If Not', labelJa: 'なかったら形' },
    ],
    defaultExpanded: false,
  },
  {
    id: 'presumptive',
    title: 'Presumptive',
    titleJa: '推量形',
    emoji: '🤔',
    forms: [
      { key: 'presumptive', label: 'Probably', labelJa: 'だろう形' },
      { key: 'presumptiveNegative', label: 'Probably not', labelJa: 'ないだろう形' },
      { key: 'presumptivePolite', label: 'Probably (polite)', labelJa: 'でしょう形' },
    ],
    defaultExpanded: false,
  },
]

/**
 * Convert WordExplanation to JapaneseWord format for the conjugation engine
 */
function convertToJapaneseWord(explanation: WordExplanation): EnhancedJapaneseWord | null {
  // Map partOfSpeech to word type
  const pos = explanation.partOfSpeech?.toLowerCase() || ''

  let type: string | undefined
  let conjugationType: string | undefined

  // Detect verb types
  if (pos.includes('ichidan') || pos.includes('ru-verb') || pos.includes('一段')) {
    type = 'verb'
    conjugationType = 'Ichidan'
  } else if (pos.includes('godan') || pos.includes('u-verb') || pos.includes('五段')) {
    type = 'verb'
    conjugationType = 'Godan'
  } else if (pos.includes('suru') || pos.includes('する') || pos.includes('irregular')) {
    type = 'verb'
    conjugationType = 'Irregular'
  } else if (pos.includes('verb')) {
    // Generic verb - try to detect type from word
    type = 'verb'
    // Will be detected by enhanceWordWithType
  }
  // Detect adjective types
  else if (pos.includes('i-adj') || pos.includes('い-adj') || pos.includes('形容詞')) {
    type = 'i-adjective'
    conjugationType = 'i-adjective'
  } else if (pos.includes('na-adj') || pos.includes('な-adj') || pos.includes('形容動詞')) {
    type = 'na-adjective'
    conjugationType = 'na-adjective'
  }

  // If we couldn't determine a conjugatable type, return null
  if (!type && !conjugationType) {
    return null
  }

  const baseWord = {
    id: `word-${explanation.word}`,
    kanji: explanation.word,
    kana: explanation.reading,
    romaji: explanation.romaji,
    meaning: explanation.meaning,
    type: conjugationType || type,
    jlpt: explanation.jlptLevel ? (explanation.jlptLevel as 'N5' | 'N4' | 'N3' | 'N2' | 'N1') : undefined,
  }

  // Use enhanceWordWithType to get accurate conjugation type
  return enhanceWordWithType(baseWord)
}

export function CompactConjugationTable({
  explanation,
  className = '',
}: CompactConjugationTableProps) {
  const { play, playing } = useTTS({ cacheFirst: true })
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['basic', 'polite']))
  const [playingForm, setPlayingForm] = useState<string | null>(null)
  const [conjugations, setConjugations] = useState<ExtendedConjugationForms | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Convert explanation to JapaneseWord
  const enhancedWord = useMemo(() => {
    return convertToJapaneseWord(explanation)
  }, [explanation])

  // Determine which groups to show based on word type
  const groups = useMemo(() => {
    // Prefer precomputed conjugationType, fall back to enhanced word detection
    const wordType = explanation.fullConjugations?.conjugationType
      || enhancedWord?.conjugationType
      || enhancedWord?.type

    if (!wordType && !enhancedWord) return []

    if (wordType === 'i-adjective' || wordType === 'na-adjective') {
      return ADJECTIVE_COMPACT_GROUPS
    }
    return COMPACT_GROUPS
  }, [enhancedWord, explanation.fullConjugations?.conjugationType])

  // Initialize expanded groups from defaults
  useEffect(() => {
    const defaultExpanded = new Set<string>()
    groups.forEach(group => {
      if (group.defaultExpanded) {
        defaultExpanded.add(group.id)
      }
    })
    setExpandedGroups(defaultExpanded)
  }, [groups])

  // Load conjugations - prefer precomputed, fall back to engine
  useEffect(() => {
    let cancelled = false

    async function loadConjugations() {
      // Check for precomputed conjugations first (instant!)
      if (explanation.fullConjugations?.forms) {
        console.log(
          '%c[CompactConjugationTable] SOURCE: PRECOMPUTED (instant)',
          'color: #00ff00; font-weight: bold',
          { word: explanation.word, formCount: Object.keys(explanation.fullConjugations.forms).length }
        )
        if (!cancelled) {
          // Cast Record<string, string> to ExtendedConjugationForms
          // Safe because precompute generates the same structure as the engine
          setConjugations(explanation.fullConjugations.forms as unknown as ExtendedConjugationForms)
          setLoading(false)
        }
        return
      }

      // Fall back to engine generation
      if (!enhancedWord || !enhancedWord.isConjugatable) {
        setLoading(false)
        setError('This word does not conjugate')
        return
      }

      setLoading(true)
      setError(null)

      try {
        console.log(
          '%c[CompactConjugationTable] SOURCE: ENGINE (generating)',
          'color: #ff9900; font-weight: bold',
          { word: explanation.word }
        )
        const result = await ExtendedConjugationEngine.conjugate(enhancedWord)
        if (!cancelled) {
          setConjugations(result)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError('Failed to generate conjugations')
          setLoading(false)
        }
      }
    }

    loadConjugations()
    return () => { cancelled = true }
  }, [enhancedWord, explanation.fullConjugations, explanation.word])

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }, [])

  const handlePlayForm = useCallback(async (form: string, formKey: string) => {
    if (!form || form.trim() === '') return

    setPlayingForm(formKey)
    try {
      await play(form, { voice: 'ja-JP', rate: 0.9 })
    } catch (err) {
      console.error('TTS failed:', err)
    } finally {
      setPlayingForm(null)
    }
  }, [play])

  // Not conjugatable - but skip this check if we have precomputed conjugations
  const hasPrecomputed = !!explanation.fullConjugations?.forms
  if (!hasPrecomputed && (!enhancedWord || !enhancedWord.isConjugatable)) {
    return (
      <div className={`p-6 bg-gray-50 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 ${className}`}>
        <div className="flex items-center gap-3 text-gray-600 dark:text-gray-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">This word doesn't conjugate</p>
            <p className="text-sm mt-1 text-gray-600 dark:text-gray-400">
              Only verbs and adjectives have conjugation forms.
              {explanation.partOfSpeech && (
                <span className="text-gray-500 dark:text-gray-500"> ({explanation.partOfSpeech})</span>
              )}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading) {
    return (
      <div className={`p-8 flex items-center justify-center ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        <span className="ml-3 text-gray-600 dark:text-gray-300">Generating conjugations...</span>
      </div>
    )
  }

  // Error state
  if (error || !conjugations) {
    return (
      <div className={`p-6 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 ${className}`}>
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>{error || 'Failed to load conjugations'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header with word type badge */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 japanese-text">
            {explanation.word}
          </span>
          <span className="text-lg text-gray-500 dark:text-gray-400 japanese-text">
            {explanation.reading}
          </span>
        </div>
        <span className="px-3 py-1 text-xs font-medium rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
          {explanation.fullConjugations?.conjugationType || enhancedWord?.conjugationType || enhancedWord?.type}
        </span>
      </div>

      {/* Conjugation Groups */}
      {groups.map(group => {
        const isExpanded = expandedGroups.has(group.id)

        // Check if group has any valid forms
        const validForms = group.forms.filter(form => {
          const value = conjugations[form.key]
          return value && value.trim() !== ''
        })

        if (validForms.length === 0) return null

        return (
          <div
            key={group.id}
            className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden"
          >
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 dark:bg-dark-850 hover:bg-gray-100 dark:hover:bg-dark-750 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{group.emoji}</span>
                <div className="text-left">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {group.title}
                  </span>
                  <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                    {group.titleJa}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {validForms.length} forms
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                )}
              </div>
            </button>

            {/* Group Content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-t border-gray-200 dark:border-dark-700"
                >
                  <div className="p-3 space-y-2 bg-white dark:bg-dark-800">
                    {validForms.map(form => {
                      const value = conjugations[form.key]
                      const isPlaying = playingForm === form.key

                      return (
                        <div
                          key={form.key}
                          className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-dark-850 hover:bg-gray-100 dark:hover:bg-dark-750 transition-colors border border-gray-100 dark:border-dark-700"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                              {form.label}
                              {form.labelJa && (
                                <span className="ml-1.5 text-gray-400 dark:text-gray-500">
                                  ({form.labelJa})
                                </span>
                              )}
                            </div>
                            <div className="text-lg font-medium text-gray-900 dark:text-gray-100 japanese-text">
                              {value}
                            </div>
                          </div>
                          <button
                            onClick={() => handlePlayForm(value!, form.key)}
                            disabled={playing || isPlaying}
                            className={`ml-3 p-2 rounded-lg transition-colors flex-shrink-0 ${
                              isPlaying
                                ? 'bg-primary-500 text-white'
                                : 'hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-500 dark:text-gray-400'
                            }`}
                            aria-label={`Play ${form.label}`}
                          >
                            <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-pulse' : ''}`} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      {/* Expand/Collapse All */}
      <div className="flex justify-center gap-4 pt-2">
        <button
          onClick={() => setExpandedGroups(new Set(groups.map(g => g.id)))}
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          Expand all
        </button>
        <span className="text-gray-300 dark:text-gray-600">|</span>
        <button
          onClick={() => setExpandedGroups(new Set(['basic', 'polite']))}
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          Collapse all
        </button>
      </div>
    </div>
  )
}

export default CompactConjugationTable
