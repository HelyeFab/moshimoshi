'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
// Navigation is now global via NavigationWrapper in root layout
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import { useI18n } from '@/i18n/I18nContext'
import { useTheme } from '@/lib/theme/ThemeContext'
import { useAuth } from '@/hooks/useAuth'
import MatchingGame from '@/components/games/MatchingGame'
import WordAssemblyGame from '@/components/games/WordAssembly/WordAssemblyGame'
import KanjiQuest from '@/components/games/kanji-quest/KanjiQuest'
import { JapaneseWord } from '@/types/vocabulary'

// Features are DISABLED by default unless explicitly set to 'true'
const isGamesEnabled = process.env.NEXT_PUBLIC_FEATURE_GAMES === 'true'

export default function GamesPage() {
  const { t, strings } = useI18n()
  const { resolvedTheme } = useTheme()
  const { user, loading } = useAuth()
  const router = useRouter()
  const [selectedGame, setSelectedGame] = useState<string | null>(null)
  const [gameWords, setGameWords] = useState<JapaneseWord[]>([])

  // Redirect if games feature is disabled
  useEffect(() => {
    if (!isGamesEnabled) {
      router.replace('/dashboard')
    }
  }, [router])

  // Don't render if feature is disabled (prevents flash before redirect)
  if (!isGamesEnabled) {
    return null
  }

  // Sample words for testing - in production, these would come from user's lists
  const sampleWords: JapaneseWord[] = [
    { id: '1', kanji: '食べる', kana: 'たべる', meaning: 'to eat', type: 'verb' },
    { id: '2', kanji: '飲む', kana: 'のむ', meaning: 'to drink', type: 'verb' },
    { id: '3', kanji: '見る', kana: 'みる', meaning: 'to see', type: 'verb' },
    { id: '4', kanji: '聞く', kana: 'きく', meaning: 'to listen', type: 'verb' },
    { id: '5', kanji: '話す', kana: 'はなす', meaning: 'to speak', type: 'verb' },
    { id: '6', kanji: '読む', kana: 'よむ', meaning: 'to read', type: 'verb' },
    { id: '7', kanji: '書く', kana: 'かく', meaning: 'to write', type: 'verb' },
    { id: '8', kanji: '行く', kana: 'いく', meaning: 'to go', type: 'verb' },
    { id: '9', kanji: '来る', kana: 'くる', meaning: 'to come', type: 'verb' },
    { id: '10', kanji: '帰る', kana: 'かえる', meaning: 'to return', type: 'verb' },
  ]

  const games = [
    // Kana Games (Beginner)
    {
      id: 'kana-drop',
      title: (strings.games as any)?.kanaDrop?.title || 'Kana Drop',
      description: (strings.games as any)?.kanaDrop?.description || 'Catch falling kana characters to score points!',
      icon: '🎯',
      color: 'from-cyan-400 to-teal-600',
      available: true,
    },
    {
      id: 'word-assembly',
      title: strings.games?.wordAssembly?.title || 'Word Assembly',
      description: strings.games?.wordAssembly?.description || 'Build kana readings from audio',
      icon: '🔤',
      color: 'from-purple-400 to-violet-600',
      available: true,
    },
    // Kanji Games (Intermediate)
    {
      id: 'stroke-order',
      title: strings.games?.strokeOrder?.title || 'Stroke Order Practice',
      description: strings.games?.strokeOrder?.description || 'Learn to write kanji with correct stroke order',
      icon: '✍️',
      color: 'from-amber-400 to-orange-600',
      available: true,
    },
    {
      id: 'reading-routes',
      title: strings.games?.readingRoutes?.title || 'Reading Routes',
      description: strings.games?.readingRoutes?.description || 'Navigate kanji readings in context!',
      icon: '🛣️',
      color: 'from-indigo-400 to-purple-600',
      available: true,
    },
    {
      id: 'kanji-simon',
      title: strings.games?.kanjiSimon?.title || 'Kanji Simon',
      description: strings.games?.kanjiSimon?.description || 'Test your memory with kanji readings',
      icon: '🧠',
      color: 'from-purple-500 to-pink-500',
      available: true,
    },
    {
      id: 'kanji-quest',
      title: strings.games?.kanjiQuest?.title || 'Kanji Quest',
      description: strings.games?.kanjiQuest?.description || 'Battle and catch Pokémon by mastering kanji!',
      icon: '🎮',
      color: 'from-red-400 to-red-600',
      available: true,
    },
    // Vocabulary & Grammar Games (Advanced)
    {
      id: 'matching',
      title: strings.games?.matching?.title || 'Matching Game',
      description: strings.games?.matching?.description || 'Match Japanese words with their meanings',
      icon: '🃏',
      color: 'from-blue-400 to-indigo-600',
      available: true,
    },
    {
      id: 'sentence-scramble',
      title: strings.games?.sentenceScramble?.title || 'Sentence Scramble',
      description: strings.games?.sentenceScramble?.description || 'Unscramble Japanese sentences to test your grammar!',
      icon: '🧩',
      color: 'from-pink-400 to-rose-600',
      available: true,
    },
  ]

  const handlePlayGame = (gameId: string) => {
    if (gameId === 'sentence-scramble') {
      router.push('/games/sentence-scramble')
    } else if (gameId === 'kana-drop') {
      router.push('/games/kana-drop')
    } else if (gameId === 'reading-routes') {
      router.push('/games/reading-routes')
    } else if (gameId === 'matching') {
      setGameWords(sampleWords)
      setSelectedGame(gameId)
    } else if (gameId === 'word-assembly') {
      setSelectedGame(gameId)
    } else if (gameId === 'kanji-simon') {
      router.push('/games/kanji-simon')
    } else if (gameId === 'kanji-quest') {
      setSelectedGame(gameId)
    } else if (gameId === 'stroke-order') {
      router.push('/games/stroke-order')
    }
  }

  const handleCloseGame = () => {
    setSelectedGame(null)
    setGameWords([])
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-background-light to-accent-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      {/* Navigation is now global - rendered in root layout */}

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">

        {/* Games Grid */}
        {!selectedGame && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {games.map((game, index) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                className="relative"
              >
                <div
                  className={`
                    rounded-2xl overflow-hidden cursor-pointer
                    bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm
                    border-2 border-transparent hover:border-primary-400
                    shadow-xl hover:shadow-2xl transition-all duration-300
                    ${!game.available ? 'opacity-60' : ''}
                  `}
                  onClick={() => game.available && handlePlayGame(game.id)}
                >
                  {/* Game Card Header */}
                  <div
                    className={`
                      h-32 bg-gradient-to-br ${game.color}
                      flex items-center justify-center text-6xl
                      relative overflow-hidden
                    `}
                  >
                    <div className="absolute inset-0 bg-black/10" />
                    <span className="relative z-10">{game.icon}</span>
                    {(game as any).comingSoon && (
                      <div className="absolute top-2 right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                        {strings.games?.comingSoon || 'Coming Soon'}
                      </div>
                    )}
                  </div>

                  {/* Game Card Body */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      {game.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {game.description}
                    </p>

                    {game.available && (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        className="mt-4 w-full py-2 px-4 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors"
                      >
                        {strings.games?.play || 'Play'}
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Game Modal */}
      {selectedGame === 'matching' && (
        <MatchingGame
          isOpen={true}
          onClose={handleCloseGame}
          words={gameWords}
          onPlayAgain={() => {
            // Reset and play again
            setSelectedGame(null)
            setTimeout(() => {
              handlePlayGame('matching')
            }, 100)
          }}
        />
      )}

      {/* Word Assembly Game */}
      {selectedGame === 'word-assembly' && (
        <WordAssemblyGame onBack={handleCloseGame} />
      )}

      {/* Kanji Quest Game */}
      {selectedGame === 'kanji-quest' && (
        <KanjiQuest
          jlptLevel={5}
          onBack={handleCloseGame}
        />
      )}
    </div>
  )
}