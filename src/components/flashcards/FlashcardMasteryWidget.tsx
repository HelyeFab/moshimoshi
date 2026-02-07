'use client'

import React, { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { FlashcardDeck, FlashcardStreakSnapshot } from '@/types/flashcards'
import { useI18n } from '@/i18n/I18nContext'
import { cn } from '@/lib/utils'
import { getLastNDates } from '@/lib/flashcards/streakSnapshots'

interface FlashcardMasteryWidgetProps {
  decks: FlashcardDeck[]
  snapshots: FlashcardStreakSnapshot[]
}

const CHART_COLORS = {
  streak1: '#f97316', // orange-500
  streak2: '#22c55e', // green-500
  streak3plus: '#3b82f6', // blue-500
}

export function FlashcardMasteryWidget({ decks, snapshots }: FlashcardMasteryWidgetProps) {
  const { t, language } = useI18n()

  const summary = useMemo(() => {
    let mastered = 0
    let good = 0
    let toConfirm = 0
    let bad = 0

    for (const deck of decks) {
      for (const card of deck.cards) {
        const status = card.metadata?.status ?? 'new'
        const streak = card.metadata?.streak ?? 0
        const lapses = card.metadata?.lapses ?? 0

        if (status === 'mastered') {
          mastered += 1
          continue
        }

        if (lapses >= 2 || (status === 'review' && streak === 0)) {
          bad += 1
          continue
        }

        if (status === 'review' && streak >= 2) {
          good += 1
          continue
        }

        if (status === 'new' || status === 'learning' || (status === 'review' && streak === 1)) {
          toConfirm += 1
          continue
        }
      }
    }

    return { mastered, good, toConfirm, bad }
  }, [decks])

  const chartData = useMemo(() => {
    const snapshotMap = new Map(snapshots.map(snapshot => [snapshot.date, snapshot]))
    const last7Days = getLastNDates(7)

    const formatter = new Intl.DateTimeFormat(language, { weekday: 'short' })

    return last7Days.map(dateKey => {
      const snapshot = snapshotMap.get(dateKey)
      const date = new Date(`${dateKey}T00:00:00`)
      return {
        dateKey,
        label: formatter.format(date),
        streak1: snapshot?.streak1 ?? 0,
        streak2: snapshot?.streak2 ?? 0,
        streak3plus: snapshot?.streak3plus ?? 0,
        total: snapshot?.total ?? 0,
      }
    })
  }, [snapshots, language])

  const hasData = chartData.some(point => point.total > 0)

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-gray-100 dark:border-dark-700 p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {t('flashcards.mastery.title') || 'Flashcards mastery'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('flashcards.mastery.subtitle') || 'measured by its streak'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
        <div>
          <div className="text-blue-600 dark:text-blue-400 font-semibold">
            {t('flashcards.stats.mastered') || 'Mastered'}
          </div>
          <div className="text-gray-900 dark:text-gray-100 font-bold text-lg">{summary.mastered}</div>
        </div>
        <div>
          <div className="text-green-600 dark:text-green-400 font-semibold">
            {t('flashcards.mastery.good') || 'Good'}
          </div>
          <div className="text-gray-900 dark:text-gray-100 font-bold text-lg">{summary.good}</div>
        </div>
        <div>
          <div className="text-orange-600 dark:text-orange-400 font-semibold">
            {t('flashcards.mastery.toConfirm') || 'To confirm'}
          </div>
          <div className="text-gray-900 dark:text-gray-100 font-bold text-lg">{summary.toConfirm}</div>
        </div>
        <div>
          <div className="text-red-600 dark:text-red-400 font-semibold">
            {t('flashcards.mastery.bad') || 'Bad'}
          </div>
          <div className="text-gray-900 dark:text-gray-100 font-bold text-lg">{summary.bad}</div>
        </div>
      </div>

      <div className="text-center text-xl sm:text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
        {t('flashcards.mastery.last7Days') || 'Last 7 days'}
      </div>

      <div className="h-52 sm:h-64">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={30} />
              <Tooltip
                formatter={(value: number, name: string) => [
                  value,
                  name === 'streak3plus'
                    ? t('flashcards.mastery.streak3plus') || 'Streak 3+'
                    : name === 'streak2'
                      ? t('flashcards.mastery.streak2') || 'Streak 2'
                      : t('flashcards.mastery.streak1') || 'Streak 1',
                ]}
                labelFormatter={(label: string) => label}
                contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0' }}
              />
              <Area
                type="monotone"
                dataKey="streak3plus"
                stackId="1"
                stroke={CHART_COLORS.streak3plus}
                fill={CHART_COLORS.streak3plus}
                fillOpacity={0.25}
              />
              <Area
                type="monotone"
                dataKey="streak2"
                stackId="1"
                stroke={CHART_COLORS.streak2}
                fill={CHART_COLORS.streak2}
                fillOpacity={0.25}
              />
              <Area
                type="monotone"
                dataKey="streak1"
                stackId="1"
                stroke={CHART_COLORS.streak1}
                fill={CHART_COLORS.streak1}
                fillOpacity={0.25}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            {t('flashcards.mastery.empty') || 'No streak data yet.'}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-nowrap items-center justify-center gap-3 text-[11px] text-gray-600 dark:text-gray-400">
        {([
          { key: 'streak1', label: t('flashcards.mastery.streak1') || 'Streak 1' },
          { key: 'streak2', label: t('flashcards.mastery.streak2') || 'Streak 2' },
          { key: 'streak3plus', label: t('flashcards.mastery.streak3plus') || 'Streak 3+' },
        ] as const).map(item => (
          <div key={item.key} className="flex items-center gap-2">
            <span
              className={cn('h-2.5 w-2.5 rounded-full')}
              style={{ backgroundColor: CHART_COLORS[item.key] }}
            />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
