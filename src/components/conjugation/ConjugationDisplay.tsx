'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { ChevronDown, ChevronRight, Volume2, AlertCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ExtendedConjugationEngine } from '@/lib/conjugation/engine'
import { getConjugationStructure } from '@/lib/conjugation/display-structure'
import { EnhancedJapaneseWord, enhanceWordWithType } from '@/utils/enhancedWordTypeDetection'
import { JapaneseWord } from '@/types/vocabulary'
import { ExtendedConjugationForms } from '@/types/conjugation'
import { useI18n } from '@/i18n/I18nContext'
import { useTTS } from '@/hooks/useTTS'

interface ConjugationDisplayProps {
  word: JapaneseWord
  showFurigana?: boolean
  className?: string
  expandedGroups?: Set<string>
  onToggleGroup?: (groupId: string) => void
}

export function ConjugationDisplay({
  word,
  showFurigana = false,
  className = '',
  expandedGroups: externalExpandedGroups,
  onToggleGroup: externalToggleGroup
}: ConjugationDisplayProps) {
  const { t, strings } = useI18n()
  const { play, playing } = useTTS({ cacheFirst: true })
  const [internalExpandedGroups, setInternalExpandedGroups] = useState<Set<string>>(new Set())
  const [playingForm, setPlayingForm] = useState<string | null>(null)

  // Use external control if provided, otherwise use internal state
  const expandedGroups = externalExpandedGroups ?? internalExpandedGroups
  const setExpandedGroups = externalToggleGroup ? () => {} : setInternalExpandedGroups

  // Enhance word with conjugation type
  const enhancedWord = useMemo(() => {
    return enhanceWordWithType(word)
  }, [word])

  // Get conjugations
  const conjugations = useMemo(() => {
    if (!enhancedWord.isConjugatable) {
      return null
    }
    return ExtendedConjugationEngine.conjugate(enhancedWord)
  }, [enhancedWord])

  // Get the appropriate structure based on word type
  const structure = useMemo(() => {
    if (!enhancedWord.conjugationType) return []
    return getConjugationStructure(enhancedWord.conjugationType)
  }, [enhancedWord.conjugationType])

  // Initialize expanded groups based on defaultExpanded (only for internal state)
  useEffect(() => {
    if (!externalExpandedGroups) {
      const defaultExpanded = new Set<string>()
      structure.forEach((group, index) => {
        if (group.defaultExpanded) {
          defaultExpanded.add(`${group.title}-${index}`)
        }
      })
      setInternalExpandedGroups(defaultExpanded)
    }
  }, [structure, externalExpandedGroups])

  const toggleGroup = (groupId: string) => {
    if (externalToggleGroup) {
      externalToggleGroup(groupId)
    } else {
      setInternalExpandedGroups(prev => {
        const newSet = new Set(prev)
        if (newSet.has(groupId)) {
          newSet.delete(groupId)
        } else {
          newSet.add(groupId)
        }
        return newSet
      })
    }
  }

  // These functions are no longer used directly but kept for potential future use
  const expandAll = () => {
    const allGroups = new Set<string>()
    structure.forEach((group, index) => {
      allGroups.add(`${group.title}-${index}`)
    })
    if (!externalToggleGroup) {
      setInternalExpandedGroups(allGroups)
    }
  }

  const collapseAll = () => {
    if (!externalToggleGroup) {
      setInternalExpandedGroups(new Set())
    }
  }

  const handlePlayConjugation = async (form: string, formKey: string) => {
    if (!form || form.trim() === '') return

    setPlayingForm(formKey)
    try {
      await play(form, {
        voice: 'ja-JP',
        rate: 0.9
      })
    } catch (error) {
      console.error('TTS failed for conjugation:', error)
    } finally {
      setPlayingForm(null)
    }
  }

  // If word is not conjugatable, show message
  if (!enhancedWord.isConjugatable || !conjugations) {
    return (
      <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700">
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <AlertCircle className="w-5 h-5" />
          <span>{t('conjugation.messages.notConjugatable')}</span>
        </div>
      </div>
    )
  }

  // Show confidence warning for low confidence detection
  const showConfidenceWarning = enhancedWord.typeConfidence === 'low'

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header with word info */}
      <div className="bg-white dark:bg-dark-850 p-4 rounded-lg border border-gray-200 dark:border-dark-700">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {t('conjugation.title')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {word.kanji || word.kana} - {word.meaning}
            </p>
            {enhancedWord.conjugationType && (
              <span className="inline-block mt-2 px-3 py-1 text-xs font-medium rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                {t(`conjugation.wordTypes.${enhancedWord.conjugationType.toLowerCase().replace('-', '')}`) || enhancedWord.conjugationType}
              </span>
            )}
          </div>
          {/* Expand/Collapse buttons removed - now controlled from parent Settings dropdown */}
        </div>

        {showConfidenceWarning && (
          <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {t('conjugation.messages.lowConfidence')}
            </p>
          </div>
        )}
      </div>

      {/* Conjugation groups */}
      <div className="space-y-2">
        {structure.map((group, groupIndex) => {
          const groupId = `${group.title}-${groupIndex}`
          const isExpanded = expandedGroups.has(groupId)

          return (
            <div
              key={groupId}
              className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 overflow-hidden"
            >
              {/* Group header */}
              <button
                onClick={() => toggleGroup(groupId)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors"
              >
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {t(`conjugation.groups.${group.title.toLowerCase().replace(/\s+/g, '')}`) || group.title}
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-gray-500" />
                )}
              </button>

              {/* Group forms */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="border-t border-gray-100 dark:border-dark-700"
                  >
                    <div className="p-4 space-y-3">
                      {group.forms.map((form) => {
                        const value = conjugations[form.key]
                        if (!value || value === '') return null

                        return (
                          <div
                            key={form.key}
                            className={`flex items-center justify-between p-3 rounded-lg ${
                              form.highlight
                                ? 'bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800'
                                : 'bg-white dark:bg-dark-850'
                            }`}
                          >
                            <div className="flex-1">
                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                                {t(`conjugation.forms.${form.key}`) || form.label}
                                {form.subLabel && (
                                  <span className="ml-2 text-xs text-gray-500">
                                    ({form.subLabel})
                                  </span>
                                )}
                              </div>
                              {form.explanation && (
                                <div className="text-xs text-gray-500 dark:text-gray-500 mb-2 italic">
                                  {form.explanation}
                                </div>
                              )}
                              <div className="flex items-center gap-3">
                                <span className="text-lg font-medium text-gray-900 dark:text-gray-100 japanese-text">
                                  {value}
                                </span>
                                {showFurigana && word.kana && (
                                  <span className="text-sm text-gray-500 dark:text-gray-400">
                                    {/* Here you could add furigana logic */}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => handlePlayConjugation(value, form.key)}
                              disabled={playing || playingForm === form.key}
                              className={`p-2 rounded-lg transition-colors ${
                                playingForm === form.key
                                  ? 'bg-primary-500 text-white'
                                  : 'hover:bg-primary-100/30 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              <Volume2 className="w-4 h-4" />
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
      </div>
    </div>
  )
}