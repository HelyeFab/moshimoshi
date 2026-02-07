'use client'

import React, { useMemo, useState } from 'react'
import type { FlashcardDeck, FlashcardContent } from '@/types/flashcards'
import { useI18n } from '@/i18n/I18nContext'
import { Flame, ArrowRight } from 'lucide-react'

export interface HeatFocusGroup {
  deck: FlashcardDeck
  cards: FlashcardContent[]
}

interface HeatFocusWidgetProps {
  decks: FlashcardDeck[]
  onReviewGroups: (groups: HeatFocusGroup[]) => void
}

interface HeatCard {
  deck: FlashcardDeck
  card: FlashcardContent
  score: number
}

const stripHtmlTags = (value: string) => value.replace(/<[^>]*>/g, '')

const getCardLabel = (card: FlashcardContent): string => {
  const front = typeof card.front === 'string' ? card.front : card.front.text
  const sanitized = stripHtmlTags(front).replace(/\s+/g, ' ').trim()
  return sanitized.length > 80 ? `${sanitized.slice(0, 77)}...` : sanitized
}

const getHeatScore = (card: FlashcardContent) => {
  const now = Date.now()
  const lapses = card.metadata?.lapses ?? 0
  const reviewCount = card.metadata?.reviewCount ?? 0
  const correctCount = card.metadata?.correctCount ?? 0
  const accuracy = reviewCount > 0 ? correctCount / reviewCount : 1
  const nextReview = card.metadata?.nextReview ?? now
  const overdueDays = nextReview < now ? (now - nextReview) / (24 * 60 * 60 * 1000) : 0

  return lapses * 4 + (1 - accuracy) * 3 + Math.min(10, overdueDays)
}

export function HeatFocusWidget({ decks, onReviewGroups }: HeatFocusWidgetProps) {
  const { t } = useI18n()
  const [showAll, setShowAll] = useState(false)

  const heatCards = useMemo(() => {
    const entries: HeatCard[] = []
    for (const deck of decks) {
      for (const card of deck.cards) {
        if (!card.metadata) continue
        const score = getHeatScore(card)
        if (score <= 0) continue
        entries.push({ deck, card, score })
      }
    }
    return entries.sort((a, b) => b.score - a.score).slice(0, 10)
  }, [decks])

  const heatBuckets = useMemo(() => {
    const hot: HeatCard[] = []
    const warm: HeatCard[] = []
    const cool: HeatCard[] = []

    for (const entry of heatCards) {
      if (entry.score >= 8) {
        hot.push(entry)
      } else if (entry.score >= 4) {
        warm.push(entry)
      } else {
        cool.push(entry)
      }
    }

    return { hot, warm, cool }
  }, [heatCards])

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-gray-100 dark:border-dark-700 p-5 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <Flame className="w-5 h-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {t('flashcards.heat.title') || 'Heat Focus'}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {t('flashcards.heat.subtitle') || 'Most fragile cards right now'}
          </p>
        </div>
      </div>

      {heatCards.length === 0 ? (
        <div className="text-sm text-gray-600 dark:text-gray-300">
          {t('flashcards.heat.empty') || 'No fragile cards detected yet.'}
        </div>
      ) : (
        <div className="space-y-3 flex-1 overflow-y-auto pr-1 scrollbar-hide">
          {([
            { key: 'hot', label: t('flashcards.heat.hot') || 'Hot', color: 'text-red-600 dark:text-red-400' },
            { key: 'warm', label: t('flashcards.heat.warm') || 'Warm', color: 'text-orange-600 dark:text-orange-400' },
            { key: 'cool', label: t('flashcards.heat.cool') || 'Cool', color: 'text-blue-600 dark:text-blue-400' },
          ] as const).map(group => {
            const entries = heatBuckets[group.key]
            if (!entries.length) return null
            const visibleEntries = showAll
              ? entries
              : group.key === 'hot'
                ? entries
                : entries.slice(0, 2)
            return (
              <div key={group.key} className="space-y-2">
                <div className={`text-xs font-semibold uppercase tracking-widest ${group.color}`}>
                  {group.label}
                </div>
                <div
                  className={
                    group.key === 'hot' && !showAll
                      ? 'flex flex-wrap gap-2 max-h-10 overflow-y-auto pr-1 scrollbar-hide'
                      : 'flex flex-wrap gap-2'
                  }
                >
                  {visibleEntries.map(entry => (
                    <button
                      key={`${entry.deck.id}-${entry.card.id}`}
                      type="button"
                      onClick={() => {
                        const groupMap = new Map<string, HeatFocusGroup>()
                        for (const item of entries) {
                          const existing = groupMap.get(item.deck.id)
                          if (existing) {
                            existing.cards.push(item.card)
                          } else {
                            groupMap.set(item.deck.id, { deck: item.deck, cards: [item.card] })
                          }
                        }
                        onReviewGroups(Array.from(groupMap.values()))
                      }}
                      className="group flex items-center gap-2 max-w-full rounded-full bg-gray-50 dark:bg-dark-700 px-3 py-2 text-left text-xs font-semibold text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
                      title={getCardLabel(entry.card) || t('flashcards.heat.untitled') || 'Untitled card'}
                    >
                      <span className="truncate max-w-[140px] sm:max-w-[200px]">
                        {getCardLabel(entry.card) || t('flashcards.heat.untitled') || 'Untitled card'}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {entry.deck.name}
                      </span>
                      <ArrowRight className="w-3 h-3 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {!showAll && heatCards.length > 3 && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 self-start"
            >
              {t('flashcards.heat.viewAll') || 'View all'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
