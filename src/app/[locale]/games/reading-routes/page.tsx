'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
// Navigation is now global via NavigationWrapper in root layout
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import ReadingRoutesGame from './components/ReadingRoutesGame'
import type { MoodBoard } from '@/types/moodboard'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

// Demo mood board data for the game
const demoMoodBoard: MoodBoard = {
  id: 'demo-board',
  title: 'Demo Kanji Board',
  emoji: '🛣️',
  jlpt: 'N5',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  description: 'Practice kanji readings with this demo board',
  kanji: [
    {
      char: '水',
      meaning: 'Water',
      readings: {
        on: ['スイ'],
        kun: ['みず']
      },
      examples: ['水曜日', '水泳', '水'],
    },
    {
      char: '火',
      meaning: 'Fire',
      readings: {
        on: ['カ'],
        kun: ['ひ']
      },
      examples: ['火曜日', '火事', '火'],
    },
    {
      char: '木',
      meaning: 'Tree, Wood',
      readings: {
        on: ['モク', 'ボク'],
        kun: ['き']
      },
      examples: ['木曜日', '木材', '木'],
    },
    {
      char: '金',
      meaning: 'Gold, Money',
      readings: {
        on: ['キン', 'コン'],
        kun: ['かね', 'かな']
      },
      examples: ['金曜日', '金額', '金'],
    },
    {
      char: '土',
      meaning: 'Earth, Soil',
      readings: {
        on: ['ド', 'ト'],
        kun: ['つち']
      },
      examples: ['土曜日', '土地', '土'],
    },
    {
      char: '日',
      meaning: 'Sun, Day',
      readings: {
        on: ['ニチ', 'ジツ'],
        kun: ['ひ', 'か']
      },
      examples: ['日曜日', '日本', '今日', '日'],
    },
    {
      char: '月',
      meaning: 'Moon, Month',
      readings: {
        on: ['ゲツ', 'ガツ'],
        kun: ['つき']
      },
      examples: ['月曜日', '今月', '月'],
    },
    {
      char: '山',
      meaning: 'Mountain',
      readings: {
        on: ['サン', 'セン'],
        kun: ['やま']
      },
      examples: ['富士山', '山道', '山'],
    },
    {
      char: '川',
      meaning: 'River',
      readings: {
        on: ['セン'],
        kun: ['かわ']
      },
      examples: ['河川', '川岸', '川'],
    },
    {
      char: '人',
      meaning: 'Person',
      readings: {
        on: ['ジン', 'ニン'],
        kun: ['ひと']
      },
      examples: ['日本人', '人間', '一人', '人'],
    }
  ],
  createdAt: new Date(),
  isActive: true
}

export default function ReadingRoutesPage() {
  const router = useRouter()
  const { strings, t } = useI18n()
  const { user } = useAuth()
  const [gameStarted, setGameStarted] = useState(false)

  const handleStartGame = () => {
    setGameStarted(true)
  }

  const handleGameComplete = () => {
    setGameStarted(false)
  }

  const handleBack = () => {
    router.push('/games')
  }

  if (gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-background-light to-accent-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      {/* Navigation is now global - rendered in root layout */}
      <MobileNavSpacer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-background-light to-accent-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      {/* Navigation is now global - rendered in root layout */}

      <div className="container mx-auto px-4 py-8 max-w-4xl">

        {/* Game Preview */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm border-2 border-gray-200 dark:border-gray-700 rounded-3xl p-8 mb-8 shadow-xl"
        >
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold mb-4 text-foreground">
                {strings.games?.readingRoutes?.howToPlay || 'How to Play'}
              </h3>
              <ul className="space-y-3 text-gray-600 dark:text-gray-400">
                <li className="flex items-start gap-3">
                  <span className="bg-primary-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">1</span>
                  <span>Read the context (word or sentence) containing a highlighted kanji</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-primary-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">2</span>
                  <span>Choose the correct reading from the four options around the kanji</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-primary-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">3</span>
                  <span>Learn whether to use on'yomi or kun'yomi based on context</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="bg-primary-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold mt-0.5">4</span>
                  <span>Complete all questions to finish the route!</span>
                </li>
              </ul>
            </div>

            <div className="relative">
              <div className="bg-gradient-to-br from-primary-100 to-secondary-100 dark:from-primary-900/20 dark:to-secondary-900/20 rounded-2xl p-6 border-2 border-gray-200 dark:border-gray-700">
                <div className="text-center mb-4">
                  <div className="text-3xl font-bold mb-2">水曜日</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Wednesday</div>
                </div>

                <div className="relative h-48 flex items-center justify-center">
                  {/* Center kanji */}
                  <div className="relative z-10 w-20 h-20 bg-white dark:bg-dark-700 border-2 border-gray-300 dark:border-gray-600 rounded-full flex items-center justify-center shadow-lg">
                    <span className="text-3xl font-bold">水</span>
                  </div>

                  {/* Option examples */}
                  <div className="absolute top-2 left-2 px-3 py-2 bg-purple-500 text-white rounded-lg text-sm">
                    スイ
                  </div>
                  <div className="absolute top-2 right-2 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm">
                    みず
                  </div>
                  <div className="absolute bottom-2 left-2 px-3 py-2 bg-purple-500/50 text-white rounded-lg text-sm">
                    シン
                  </div>
                  <div className="absolute bottom-2 right-2 px-3 py-2 bg-blue-500/50 text-white rounded-lg text-sm">
                    かわ
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Start button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <button
            onClick={handleStartGame}
            className="px-8 py-4 bg-primary-500 text-white rounded-xl text-lg font-semibold hover:bg-primary-600 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            {strings.games?.startGame || 'Start Reading Routes'}
          </button>
        </motion.div>
        <MobileNavSpacer />
      </div>
    </div>
  )
}