'use client'

import React, { useMemo } from 'react'
import type { FlashcardDeck } from '@/types/flashcards'
import { useI18n } from '@/i18n/I18nContext'
import { ArrowRight, Zap, CheckCircle } from 'lucide-react'

interface MomentumCoachProps {
  decks: FlashcardDeck[]
  onSelectDeck: (deck: FlashcardDeck) => void
}

const getDeckDueCount = (deck: FlashcardDeck) => {
  const now = Date.now()
  const newCardsPerDay = deck.settings?.newCardsPerDay ?? 20
  const reviewsPerDay = deck.settings?.reviewsPerDay ?? 100

  const newCards = deck.cards.filter(card => !card.metadata?.status || card.metadata.status === 'new')
  const reviewCards = deck.cards.filter(
    card =>
      card.metadata?.status &&
      card.metadata.status !== 'new' &&
      card.metadata.nextReview &&
      card.metadata.nextReview <= now
  )

  return Math.min(newCards.length, newCardsPerDay) + Math.min(reviewCards.length, reviewsPerDay)
}

export function MomentumCoach({ decks, onSelectDeck }: MomentumCoachProps) {
  const { t } = useI18n()

  const summary = useMemo(() => {
    if (decks.length === 0) {
      return { totalDue: 0, suggestedDeck: null as FlashcardDeck | null }
    }

    let totalDue = 0
    let suggestedDeck: FlashcardDeck | null = null
    let maxDue = 0

    for (const deck of decks) {
      const dueCount = getDeckDueCount(deck)
      totalDue += dueCount
      if (dueCount > maxDue) {
        maxDue = dueCount
        suggestedDeck = deck
      }
    }

    return { totalDue, suggestedDeck }
  }, [decks])

  const suggestedCount = Math.min(10, summary.totalDue)

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-gray-100 dark:border-dark-700 p-5 flex flex-col justify-between h-full">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <Zap className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t('flashcards.momentum.title') || 'Momentum Coach'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('flashcards.momentum.subtitle') || 'A quick win to keep your rhythm'}
          </p>
        </div>
      </div>

      {summary.totalDue === 0 || !summary.suggestedDeck ? (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <span>{t('flashcards.momentum.caughtUp') || 'You are all caught up today.'}</span>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            {t('flashcards.momentum.recommendation', {
              count: suggestedCount,
              deck: summary.suggestedDeck.name,
            }) ||
              `Try ${suggestedCount} cards from ${summary.suggestedDeck.name} to keep your streak.`}
          </div>
          <button
            type="button"
            onClick={() => onSelectDeck(summary.suggestedDeck!)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors"
          >
            {t('flashcards.momentum.start') || 'Start quick session'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
