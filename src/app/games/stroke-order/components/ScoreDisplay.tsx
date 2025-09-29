'use client'

import React from 'react'
import { Card } from '@/components/ui/card'
import { Flame, Trophy, Brain, Clock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'

interface Props {
  score: number
  combo: number
  completedKanji: number
  totalKanji: number
  elapsedTime: string
}

export default function ScoreDisplay({ score, combo, completedKanji, totalKanji, elapsedTime }: Props) {
  const progress = (completedKanji / totalKanji) * 100
  const { strings } = useI18n()

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">{strings.games?.strokeOrder?.score || 'Score'}</h3>
        <motion.div
          key={score}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className="text-2xl font-bold text-primary-500"
        >
          {score.toLocaleString()}
        </motion.div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-primary-500" />
            <span>{strings.games?.strokeOrder?.time || 'Time'}</span>
          </div>
          <span className="text-sm font-medium">{elapsedTime}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Flame className="h-4 w-4 text-orange-500" />
            <span>{strings.games?.strokeOrder?.combo || 'Combo'}</span>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={combo}
              initial={{ scale: combo > 0 ? 1.5 : 1 }}
              animate={{ scale: 1 }}
              className={`text-sm font-medium ${combo > 5 ? 'text-orange-500' : ''}`}
            >
              x{combo}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Brain className="h-4 w-4 text-purple-500" />
            <span>{strings.games?.strokeOrder?.progress || 'Progress'}</span>
          </div>
          <span className="text-sm font-medium">
            {completedKanji}/{totalKanji}
          </span>
        </div>

        <div className="mt-4">
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-400 to-primary-600"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}