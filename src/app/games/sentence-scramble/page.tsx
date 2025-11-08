'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
// Navigation is now global via NavigationWrapper in root layout
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import SentenceScrambleGame from '@/components/games/sentence-scramble/SentenceScrambleGame'
import { useI18n } from '@/i18n/I18nContext'
import { useTheme } from '@/lib/theme/ThemeContext'
import { useAuth } from '@/hooks/useAuth'
import { SAMPLE_SENTENCES } from '@/components/games/sentence-scramble/types'

export default function SentenceScramblePage() {
  const { t, strings } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user } = useAuth()
  const router = useRouter()
  const [showGame, setShowGame] = useState(true)

  const handleClose = () => {
    router.push('/games')
  }

  const handleComplete = (score: number, accuracy: number) => {
    // Could save stats or show achievements here
    console.log('Game completed with score:', score, 'accuracy:', accuracy)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-background-light to-accent-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      {/* Navigation is now global - rendered in root layout */}

      <div className="container mx-auto px-4 py-8">

        {/* Game Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center"
        >
          {showGame && (
            <SentenceScrambleGame
              sentences={SAMPLE_SENTENCES}
              onClose={handleClose}
              onComplete={handleComplete}
            />
          )}
        </motion.div>
      </div>
    </div>
  )
}