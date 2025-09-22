'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoadingOverlay } from '@/components/ui/Loading'
import { motion } from 'framer-motion'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { Trophy, RefreshCw, Home, Target } from 'lucide-react'
import Link from 'next/link'

function CompletionContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const size = searchParams.get('size') || '10'
  const mode = searchParams.get('mode') || 'mixed'
  const level = searchParams.get('level') || 'N5'
  const phases = searchParams.get('phases')?.split(',') || ['exposure', 'practice', 'production']

  const restartSession = () => {
    router.push(`/learn/word-learning/session?${searchParams.toString()}`)
  }

  const newSession = () => {
    router.push('/learn/word-learning')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl p-8 max-w-lg w-full"
      >
        {/* Trophy Animation */}
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: "spring" }}
          className="flex justify-center mb-6"
        >
          <div className="relative">
            <motion.div
              animate={{ rotate: [0, -5, 5, -5, 0] }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="p-6 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full"
            >
              <Trophy className="w-16 h-16 text-white" />
            </motion.div>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8, type: "spring" }}
              className="absolute -top-2 -right-2"
            >
              <div className="bg-green-500 text-white rounded-full w-8 h-8 flex items-center justify-center">
                <span className="text-lg">✓</span>
              </div>
            </motion.div>
          </div>
        </motion.div>

        {/* Congratulations Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mb-6"
        >
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Session Complete!
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Great job! You've completed your word learning session.
          </p>
        </motion.div>

        {/* Session Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-gray-50 dark:bg-dark-700 rounded-lg p-4 mb-6"
        >
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Session Summary
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Words Studied:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{size}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Word Type:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100 capitalize">{mode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">JLPT Level:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{level}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Phases Completed:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">{phases.length}</span>
            </div>
          </div>
        </motion.div>

        {/* Doshi Mascot */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8, type: "spring" }}
          className="flex justify-center mb-6"
        >
          <DoshiMascot size="medium" mood="happy" />
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="space-y-3"
        >
          <button
            onClick={restartSession}
            className="w-full py-3 px-6 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Restart Same Session
          </button>
          
          <button
            onClick={newSession}
            className="w-full py-3 px-6 bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors flex items-center justify-center gap-2"
          >
            <Target className="w-5 h-5" />
            New Session
          </button>
          
          <Link
            href="/dashboard"
            className="w-full py-3 px-6 border border-gray-300 dark:border-dark-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}

export default function WordLearningCompletePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <LoadingOverlay isLoading={true} message="Loading results..." showDoshi={true} />
      </div>
    }>
      <CompletionContent />
    </Suspense>
  )
}