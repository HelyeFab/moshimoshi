'use client'

import React, { useState, useEffect } from 'react'
import { Brain, Trophy, Star, Zap } from 'lucide-react'
import StrokeOrderGame from './components/StrokeOrderGame'
import { useI18n } from '@/i18n/I18nContext'
import Modal from '@/components/ui/Modal'
import Navbar from '@/components/layout/Navbar'

const PRACTICE_SETS = [
  {
    id: 'jlpt-n5',
    name: 'JLPT N5',
    description: 'Basic kanji for beginners',
    kanji: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '日', '月', '火', '水', '木', '金', '土'],
    color: 'from-green-400 to-green-600',
  },
  {
    id: 'jlpt-n4',
    name: 'JLPT N4',
    description: 'Elementary level kanji',
    kanji: ['山', '川', '田', '人', '口', '車', '門', '間', '話', '言', '読', '聞', '書', '見', '行', '来'],
    color: 'from-blue-400 to-blue-600',
  },
  {
    id: 'common-radicals',
    name: 'Common Radicals',
    description: 'Essential kanji components',
    kanji: ['人', '手', '心', '日', '月', '木', '水', '火', '土', '金', '言', '糸', '肉', '貝', '車', '門'],
    color: 'from-purple-400 to-purple-600',
  },
  {
    id: 'numbers',
    name: 'Numbers',
    description: 'Learn to write numbers',
    kanji: ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万', '円', '年', '月'],
    color: 'from-yellow-400 to-yellow-600',
  },
]

interface StrokeOrderProgress {
  highScores: { [setId: string]: number }
  kanjiMastery: { [kanji: string]: { attempts: number; successes: number; bestTime: number } }
  totalGamesPlayed: number
  totalKanjiPracticed: number
  lastPlayed: number
}

export default function StrokeOrderPracticePage() {
  const [selectedSet, setSelectedSet] = useState<any>(null)
  const [showGame, setShowGame] = useState(false)
  const [progress, setProgress] = useState<StrokeOrderProgress | null>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const { t, strings } = useI18n()

  useEffect(() => {
    loadProgress()
  }, [])

  const loadProgress = async () => {
    try {
      const savedProgressStr = localStorage.getItem('strokeOrderProgress')
      if (savedProgressStr) {
        const savedProgress = JSON.parse(savedProgressStr) as StrokeOrderProgress
        setProgress(savedProgress)
      }
    } catch (error) {
      console.error('Failed to load progress:', error)
    }
  }

  const handleSelectSet = (setId: string) => {
    const practiceSet = PRACTICE_SETS.find(set => set.id === setId)
    setSelectedSet(practiceSet)
    setShowGame(true)
  }

  const handleBackToSets = () => {
    setShowGame(false)
    setSelectedSet(null)
    loadProgress() // Reload progress after game
  }

  if (showGame && selectedSet) {
    return (
      <StrokeOrderGame
        practiceSet={selectedSet}
        onBack={handleBackToSets}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-background-light to-accent-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      <Navbar showUserMenu={true} />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <main className="max-w-7xl mx-auto mb-32 md:mb-8 pb-safe">

          {/* Hero Section */}
          <div className="mb-12">
            <div className="text-center max-w-3xl mx-auto">
              <div className="relative inline-block mb-6">
                <div className="text-7xl animate-pulse">✍️</div>
                <div className="absolute -inset-4 bg-gradient-to-r from-primary-500/20 via-primary-600/20 to-primary-700/20 blur-2xl rounded-full opacity-60"></div>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent mb-6">
                {strings.games?.strokeOrder?.title || 'Master Kanji Stroke Order'}
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed mb-6 max-w-2xl mx-auto">
                {strings.games?.strokeOrder?.description || 'Learn to write kanji correctly by practicing stroke order. Click strokes in the right sequence to build muscle memory.'}
              </p>

              {progress && progress.totalGamesPlayed > 0 && (
                <div className="flex gap-4 justify-center">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-500" />
                    <span className="text-sm text-muted-foreground">
                      {progress.totalGamesPlayed} {strings.games?.strokeOrder?.gamesPlayed || 'games played'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-primary-500" />
                    <span className="text-sm text-muted-foreground">
                      {progress.totalKanjiPracticed} {strings.games?.strokeOrder?.kanjiPracticed || 'kanji practiced'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Instructions Button */}
          <div className="mb-8 text-center">
            <button
              onClick={() => setShowInstructions(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 hover:bg-primary-100 dark:bg-primary-500/10 dark:hover:bg-primary-500/20 text-primary-600 dark:text-primary-400 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{strings.games?.strokeOrder?.howToPlay || 'How to Play'}</span>
            </button>
          </div>

          {/* Practice Sets */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-foreground mb-6 text-center">
              {strings.games?.strokeOrder?.practiceSets || 'Practice Sets'}
            </h3>
            <div className="grid gap-6 md:grid-cols-2">
              {PRACTICE_SETS.map((set) => {
                return (
                  <button
                    key={set.id}
                    className="group relative overflow-hidden rounded-2xl bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
                    onClick={() => handleSelectSet(set.id)}
                  >
                    {/* Background with subtle gradient */}
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${set.color} opacity-5 group-hover:opacity-10 transition-opacity duration-300`}
                    />

                    <div className="relative p-6">
                      {/* Title and Description */}
                      <div className="text-left mb-4">
                        <h4 className="text-xl font-bold text-foreground mb-1">{set.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {set.description}
                        </p>
                      </div>

                      {/* Kanji count and high score */}
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
                        <div className="flex items-center gap-1.5">
                          <Brain className="h-4 w-4" />
                          <span className="font-medium">{set.kanji.length} kanji</span>
                        </div>
                        {progress && progress.highScores[set.id] && (
                          <>
                            <span className="text-muted-foreground">•</span>
                            <div className="flex items-center gap-1.5">
                              <Zap className="h-4 w-4 text-yellow-500" />
                              <span className="font-medium">High: {progress.highScores[set.id].toLocaleString()}</span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Kanji preview */}
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {set.kanji.slice(0, 8).map((kanji, idx) => (
                          <span
                            key={idx}
                            className="text-2xl font-bold text-foreground/80 group-hover:text-foreground transition-colors japanese-text font-ja"
                          >
                            {kanji}
                          </span>
                        ))}
                        {set.kanji.length > 8 && (
                          <span className="text-sm text-muted-foreground font-medium ml-1">
                            +{set.kanji.length - 8} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Hover border effect */}
                    <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-primary-400/30 transition-colors duration-300" />
                  </button>
                )
              })}
            </div>
          </div>
        </main>
      </div>

      {/* Instructions Modal */}
      <Modal
        isOpen={showInstructions}
        onClose={() => setShowInstructions(false)}
        title={strings.games?.strokeOrder?.howToPlayTitle || "How to Play Stroke Order Practice"}
      >
        <div className="space-y-8">
          {/* Main Instructions */}
          <div className="text-center">
            <div className="text-6xl mb-4">✍️</div>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {strings.games?.strokeOrder?.instructions || "Master kanji by learning the correct stroke order. Click each stroke in the right sequence to build muscle memory and improve your writing skills."}
            </p>
          </div>

          {/* Step by Step Guide */}
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-lg">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground text-lg">{strings.games?.strokeOrder?.step1Title || "See the Kanji"}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {strings.games?.strokeOrder?.step1Desc || "A kanji appears with numbered stroke guides showing the correct order"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-lg">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground text-lg">{strings.games?.strokeOrder?.step2Title || "Click Strokes in Order"}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {strings.games?.strokeOrder?.step2Desc || "Click each stroke in the correct sequence. Start with stroke 1, then 2, and so on."}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-600 to-primary-800 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-lg">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground text-lg">{strings.games?.strokeOrder?.step3Title || "Get Instant Feedback"}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {strings.games?.strokeOrder?.step3Desc || "Correct strokes turn green and animate. Wrong strokes flash red - try again!"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-700 to-primary-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-lg">
                4
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-foreground text-lg">{strings.games?.strokeOrder?.step4Title || "Earn Points & Progress"}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {strings.games?.strokeOrder?.step4Desc || "Score points for speed and accuracy. Track your progress and beat your high scores!"}
                </p>
              </div>
            </div>
          </div>

          {/* Tips */}
          <div className="bg-primary-50 dark:bg-primary-500/10 rounded-lg p-4">
            <h4 className="font-semibold text-foreground mb-2">💡 {strings.games?.strokeOrder?.proTips || "Pro Tips"}</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {strings.games?.strokeOrder?.tip1 || "Take your time to memorize the stroke order before clicking"}</li>
              <li>• {strings.games?.strokeOrder?.tip2 || "Pay attention to stroke direction - it matters!"}</li>
              <li>• {strings.games?.strokeOrder?.tip3 || "Practice regularly to build muscle memory"}</li>
              <li>• {strings.games?.strokeOrder?.tip4 || "Try different difficulty levels as you improve"}</li>
            </ul>
          </div>

          {/* Start Button */}
          <div className="text-center pt-4">
            <button
              onClick={() => setShowInstructions(false)}
              className="px-8 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
            >
              {strings.games?.strokeOrder?.gotIt || "Got it, let's practice!"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}