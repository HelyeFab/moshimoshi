'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Confetti from 'react-confetti'
import { useWindowSize } from 'react-use'

interface CelebrationScreenProps {
  isOpen: boolean
  onClose: () => void
  userName?: string
  xpGained: number
  accuracy?: number
  duration?: number
  itemsCompleted?: number
}

const encouragingMessages = [
  "You're one step closer to mastery",
  "Your dedication is inspiring",
  "Every session makes you stronger",
  "You're making amazing progress",
  "Your skills are growing daily",
  "Consistency is the path to excellence",
  "You're becoming fluent, one kanji at a time",
  "Your journey to mastery continues",
  "Great effort leads to great results",
  "You're building something incredible",
  "Your perseverance is remarkable",
  "Each day brings you closer to your goal",
  "Your hard work is paying off",
  "You're on the path to greatness",
  "Your commitment to learning shines through"
]

export default function CelebrationScreen({
  isOpen,
  onClose,
  userName = 'Student',
  xpGained,
  accuracy,
  duration,
  itemsCompleted
}: CelebrationScreenProps) {
  const { width, height } = useWindowSize()
  const [showConfetti, setShowConfetti] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setShowConfetti(false)
      return
    }

    setShowConfetti(true)
    // Pick a random encouraging message
    const randomMessage = encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)]
    setMessage(randomMessage)

    // Auto-close after 4 seconds
    const confettiTimer = setTimeout(() => {
      setShowConfetti(false)
    }, 4000)

    const closeTimer = setTimeout(() => {
      onClose()
    }, 4500) // Wait 500ms after confetti stops

    // Cleanup both timers
    return () => {
      clearTimeout(confettiTimer)
      clearTimeout(closeTimer)
    }
  }, [isOpen, onClose])

  const formatDuration = (ms?: number) => {
    if (!ms) return ''
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return minutes > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${seconds}s`
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Confetti */}
          {showConfetti && (
            <div className="fixed inset-0 pointer-events-none z-[9999]">
              <Confetti
                width={width}
                height={height}
                recycle={false}
                numberOfPieces={500}
                gravity={0.3}
                colors={['#FFD700', '#FF6B9D', '#4ECDC4', '#95E1D3', '#F38181', '#AA96DA']}
              />
            </div>
          )}

          {/* Celebration Modal */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="relative bg-white dark:bg-dark-800 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Success Icon */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                className="flex justify-center mb-6"
              >
                <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center shadow-lg">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-3xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2"
              >
                よくできました！
              </motion.h2>

              {/* Subtitle */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-lg text-center text-gray-600 dark:text-gray-400 mb-6"
              >
                Well done!
              </motion.p>

              {/* XP Badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl p-4 mb-6 shadow-lg"
              >
                <div className="text-center">
                  <div className="text-4xl font-bold text-white mb-1">
                    +{xpGained} XP
                  </div>
                  <div className="text-sm text-white/90">
                    Experience Points Earned
                  </div>
                </div>
              </motion.div>

              {/* Session Stats */}
              {(accuracy !== undefined || duration !== undefined || itemsCompleted !== undefined) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="grid grid-cols-3 gap-3 mb-6"
                >
                  {itemsCompleted !== undefined && (
                    <div className="bg-gray-100 dark:bg-dark-700 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                        {itemsCompleted}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Completed
                      </div>
                    </div>
                  )}
                  {accuracy !== undefined && (
                    <div className="bg-gray-100 dark:bg-dark-700 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {Math.round(accuracy)}%
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Accuracy
                      </div>
                    </div>
                  )}
                  {duration !== undefined && (
                    <div className="bg-gray-100 dark:bg-dark-700 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {formatDuration(duration)}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Duration
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Encouraging Message */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-center mb-6"
              >
                <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
                  {userName}-san, {message}! 🌸
                </p>
              </motion.div>

              {/* Close Button */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                onClick={onClose}
                className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white font-semibold rounded-xl transition-all transform hover:scale-105 active:scale-95 shadow-lg"
              >
                Continue Learning
              </motion.button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
