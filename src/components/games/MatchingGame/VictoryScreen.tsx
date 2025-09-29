'use client'

import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { GameStats } from './types'
import { getPerformanceMessage } from './gameUtils'
import { useI18n } from '@/i18n/I18nContext'

interface VictoryScreenProps {
  stats: GameStats
  onPlayAgain: () => void
  onClose: () => void
}

export default function VictoryScreen({ stats, onPlayAgain, onClose }: VictoryScreenProps) {
  const { strings } = useI18n()
  const [showParticles, setShowParticles] = useState(true)

  useEffect(() => {
    // Hide particles after animation
    const timer = setTimeout(() => setShowParticles(false), 3000)
    return () => clearTimeout(timer)
  }, [])

  const formatTime = (milliseconds: number): string => {
    if (!milliseconds || milliseconds < 0) return '0:00'
    const totalSeconds = Math.floor(milliseconds / 1000)
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      {/* Celebration Particles */}
      {showParticles && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className={`absolute w-3 h-3 rounded-full ${
                ['bg-primary-400', 'bg-primary-500', 'bg-primary-600', 'bg-accent-400', 'bg-accent-500'][i % 5]
              }`}
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
                y: -200,
              }}
              transition={{
                duration: 2,
                delay: Math.random() * 0.5,
                repeat: Infinity,
                repeatDelay: Math.random() * 2,
              }}
            />
          ))}
        </div>
      )}

      <motion.div
        initial={{ y: 50 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="bg-soft-white dark:bg-dark-800 rounded-lg shadow-2xl p-8 max-w-md w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Celebration animation */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [0, 1.2, 1] }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-6xl mb-4"
        >
          🎉
        </motion.div>

        <h2 className="text-3xl font-bold text-foreground mb-4">
          {strings.games?.victory?.title || 'Congratulations!'}
        </h2>

        <p className="text-lg text-muted-foreground mb-6">
          {getPerformanceMessage(stats.totalMoves, Math.floor(stats.totalMoves / 2))}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-dark-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {stats.totalMoves}
            </div>
            <div className="text-sm text-muted-foreground">
              {strings.games?.victory?.moves || 'Moves'}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-dark-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {formatTime(stats.timeTaken)}
            </div>
            <div className="text-sm text-muted-foreground">
              {strings.games?.victory?.time || 'Time'}
            </div>
          </div>
        </div>

        {stats.perfectGame && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 rounded-lg p-3 mb-6"
          >
            <span className="text-2xl mr-2">⭐</span>
            {strings.games?.victory?.perfect || 'Perfect Game! No mistakes!'}
          </motion.div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-100 dark:bg-dark-700 text-foreground rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors font-medium"
          >
            {strings.games?.victory?.back || 'Back to Games'}
          </button>
          <button
            onClick={onPlayAgain}
            className="flex-1 px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
          >
            {strings.games?.victory?.playAgain || 'Play Again'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}