'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { LoadingOverlay } from '@/components/ui/Loading'
import { motion } from 'framer-motion'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { ChevronLeft, BookOpen, Brain, Zap, Trophy } from 'lucide-react'
import Link from 'next/link'

function WordLearningContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  
  const [sessionConfig, setSessionConfig] = useState({
    size: 10,
    mode: 'mixed' as 'mixed' | 'verbs' | 'adjectives' | 'nouns',
    jlptLevel: 'N5' as 'N5' | 'N4' | 'N3' | 'N2' | 'N1',
    phases: ['exposure', 'practice', 'production'] as string[]
  })

  // Check if coming from Learning Village
  const returnTo = searchParams.get('returnTo') || '/dashboard'

  const startSession = () => {
    const params = new URLSearchParams({
      size: sessionConfig.size.toString(),
      mode: sessionConfig.mode,
      level: sessionConfig.jlptLevel,
      phases: sessionConfig.phases.join(',')
    })
    
    router.push(`/learn/word-learning/session?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      {/* Header */}
      <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm border-b border-primary-200 dark:border-dark-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={returnTo}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Word Learning Session
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Master vocabulary through multimodal learning phases
                </p>
              </div>
            </div>
            <DoshiMascot size="small" mood="happy" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Learning Phases Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Exposure Phase</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              See words in context with meanings, readings, and example sentences
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Brain className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Practice Phase</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Interactive exercises with multiple choice and matching activities
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Production Phase</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Type answers and produce language actively for deeper retention
            </p>
          </motion.div>
        </div>

        {/* Configuration */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-dark-800 rounded-lg shadow-lg border border-gray-200 dark:border-dark-700 p-8"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
            Configure Your Session
          </h2>

          {/* Session Size */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Words per Session
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[5, 10, 15, 20].map(size => (
                <button
                  key={size}
                  onClick={() => setSessionConfig(prev => ({ ...prev, size }))}
                  className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                    sessionConfig.size === size
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  }`}
                >
                  {size} words
                </button>
              ))}
            </div>
          </div>

          {/* Word Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Word Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { value: 'mixed', label: 'Mixed' },
                { value: 'verbs', label: 'Verbs' },
                { value: 'adjectives', label: 'Adjectives' },
                { value: 'nouns', label: 'Nouns' }
              ].map(mode => (
                <button
                  key={mode.value}
                  onClick={() => setSessionConfig(prev => ({ ...prev, mode: mode.value as any }))}
                  className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                    sessionConfig.mode === mode.value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* JLPT Level */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              JLPT Level
            </label>
            <div className="grid grid-cols-5 gap-2">
              {['N5', 'N4', 'N3', 'N2', 'N1'].map(level => (
                <button
                  key={level}
                  onClick={() => setSessionConfig(prev => ({ ...prev, jlptLevel: level as any }))}
                  className={`py-2 px-4 rounded-lg font-medium transition-colors ${
                    sessionConfig.jlptLevel === level
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Learning Phases */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Learning Phases
            </label>
            <div className="space-y-2">
              {[
                { value: 'exposure', label: 'Exposure - See words with meanings', icon: BookOpen },
                { value: 'practice', label: 'Practice - Interactive exercises', icon: Brain },
                { value: 'production', label: 'Production - Type answers', icon: Zap }
              ].map(phase => (
                <label
                  key={phase.value}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={sessionConfig.phases.includes(phase.value)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSessionConfig(prev => ({
                          ...prev,
                          phases: [...prev.phases, phase.value]
                        }))
                      } else {
                        setSessionConfig(prev => ({
                          ...prev,
                          phases: prev.phases.filter(p => p !== phase.value)
                        }))
                      }
                    }}
                    className="w-4 h-4 text-primary-600 bg-white border-gray-300 rounded focus:ring-primary-500"
                  />
                  <phase.icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{phase.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <button
            onClick={startSession}
            disabled={sessionConfig.phases.length === 0}
            className="w-full py-3 px-6 bg-primary-500 text-white font-semibold rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            <Trophy className="w-5 h-5" />
            Start Learning Session
          </button>
        </motion.div>

        {/* Stats Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-6 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-dark-800 dark:to-dark-700 rounded-lg p-6 border border-primary-200 dark:border-dark-600"
        >
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Session Overview
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Words:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{sessionConfig.size}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Type:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100 capitalize">{sessionConfig.mode}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Level:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{sessionConfig.jlptLevel}</span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Phases:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">{sessionConfig.phases.length}</span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default function WordLearningPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <LoadingOverlay isLoading={true} message="Loading word learning..." showDoshi={true} />
      </div>
    }>
      <WordLearningContent />
    </Suspense>
  )
}