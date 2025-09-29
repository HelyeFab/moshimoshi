'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Trophy, Clock, Target, Flame, RefreshCw, ArrowLeft, Star, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Modal from '@/components/ui/Modal'
import { useI18n } from '@/i18n/I18nContext'

interface Props {
  isOpen: boolean
  onClose: () => void
  score: number
  time: string
  accuracy: number
  maxCombo: number
  onRestart: () => void
  onBack: () => void
}

interface Achievement {
  id: string
  name: string
  description: string
  icon: React.ReactNode
}

export default function GameOverModal({
  isOpen,
  onClose,
  score,
  time,
  accuracy,
  maxCombo,
  onRestart,
  onBack,
}: Props) {
  const [newAchievements, setNewAchievements] = useState<Achievement[]>([])
  const { strings } = useI18n()

  useEffect(() => {
    if (isOpen) {
      checkAchievements()
    }
  }, [isOpen, score, accuracy, maxCombo])

  const checkAchievements = () => {
    const achievements: Achievement[] = []

    // Score achievements
    if (score >= 1000) {
      achievements.push({
        id: 'score-1000',
        name: strings.games?.strokeOrder?.achievements?.thousandPoints || 'Thousand Points!',
        description: strings.games?.strokeOrder?.achievements?.thousandPointsDesc || 'Scored over 1000 points',
        icon: <Trophy className="h-5 w-5 text-yellow-500" />,
      })
    }

    if (score >= 5000) {
      achievements.push({
        id: 'score-5000',
        name: strings.games?.strokeOrder?.achievements?.masterScorer || 'Master Scorer!',
        description: strings.games?.strokeOrder?.achievements?.masterScorerDesc || 'Scored over 5000 points',
        icon: <Star className="h-5 w-5 text-yellow-500" />,
      })
    }

    // Accuracy achievements
    if (accuracy >= 95) {
      achievements.push({
        id: 'accuracy-95',
        name: strings.games?.strokeOrder?.achievements?.perfectAccuracy || 'Perfect Precision!',
        description: strings.games?.strokeOrder?.achievements?.perfectAccuracyDesc || '95% or higher accuracy',
        icon: <Target className="h-5 w-5 text-green-500" />,
      })
    }

    // Combo achievements
    if (maxCombo >= 10) {
      achievements.push({
        id: 'combo-10',
        name: strings.games?.strokeOrder?.achievements?.comboMaster || 'Combo Master!',
        description: strings.games?.strokeOrder?.achievements?.comboMasterDesc || '10+ combo streak',
        icon: <Flame className="h-5 w-5 text-orange-500" />,
      })
    }

    setNewAchievements(achievements)
  }

  const getRank = () => {
    if (score >= 5000 && accuracy >= 95) return 'S'
    if (score >= 3000 && accuracy >= 90) return 'A'
    if (score >= 2000 && accuracy >= 80) return 'B'
    if (score >= 1000 && accuracy >= 70) return 'C'
    return 'D'
  }

  const rank = getRank()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={strings.games?.strokeOrder?.gameOver || "Game Complete!"}
    >
      <div className="space-y-6">
        {/* Rank Display */}
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="inline-block"
          >
            <div className="relative">
              <div className={`text-8xl font-bold ${
                rank === 'S' ? 'text-yellow-500' :
                rank === 'A' ? 'text-green-500' :
                rank === 'B' ? 'text-blue-500' :
                rank === 'C' ? 'text-purple-500' :
                'text-gray-500'
              }`}>
                {rank}
              </div>
              {rank === 'S' && (
                <Sparkles className="absolute -top-4 -right-4 h-8 w-8 text-yellow-500 animate-pulse" />
              )}
            </div>
          </motion.div>
          <p className="mt-2 text-lg font-semibold text-foreground">
            {rank === 'S' ? strings.games?.strokeOrder?.ranks?.perfect || 'Perfect!' :
             rank === 'A' ? strings.games?.strokeOrder?.ranks?.excellent || 'Excellent!' :
             rank === 'B' ? strings.games?.strokeOrder?.ranks?.good || 'Good Job!' :
             rank === 'C' ? strings.games?.strokeOrder?.ranks?.nice || 'Nice Try!' :
             strings.games?.strokeOrder?.ranks?.keepPracticing || 'Keep Practicing!'}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Trophy className="h-4 w-4" />
              <span>{strings.games?.strokeOrder?.finalScore || 'Final Score'}</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{score.toLocaleString()}</div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span>{strings.games?.strokeOrder?.timeTaken || 'Time'}</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{time}</div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Target className="h-4 w-4" />
              <span>{strings.games?.strokeOrder?.accuracy || 'Accuracy'}</span>
            </div>
            <div className="text-2xl font-bold text-foreground">{accuracy}%</div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Flame className="h-4 w-4" />
              <span>{strings.games?.strokeOrder?.maxCombo || 'Max Combo'}</span>
            </div>
            <div className="text-2xl font-bold text-foreground">x{maxCombo}</div>
          </div>
        </div>

        {/* Achievements */}
        {newAchievements.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-foreground">
              {strings.games?.strokeOrder?.newAchievements || 'New Achievements!'}
            </h4>
            <AnimatePresence>
              {newAchievements.map((achievement, index) => (
                <motion.div
                  key={achievement.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-center gap-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
                >
                  {achievement.icon}
                  <div className="flex-1">
                    <div className="font-medium text-sm text-foreground">{achievement.name}</div>
                    <div className="text-xs text-muted-foreground">{achievement.description}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center">
          <Button
            variant="outline"
            onClick={onBack}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{strings.games?.strokeOrder?.backToSets || 'Back to Sets'}</span>
          </Button>
          <Button
            variant="default"
            onClick={onRestart}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            <span>{strings.games?.strokeOrder?.playAgain || 'Play Again'}</span>
          </Button>
        </div>
      </div>
    </Modal>
  )
}