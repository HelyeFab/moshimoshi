'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'
import { GameKanji, StudySession, QuizQuestion, AttackType, BattleEvent, ATTACK_TYPES, KANJI_ATTACKS, KanjiQuestProps } from './types'
import { getRandomPokemon, getPokemonSpriteUrl } from '@/data/pokemonData'
import { getKanjiByJLPT, getCompletedKanjiIds, saveCompletedKanjiIds } from './utils/kanjiAdapter'
import { usePokemonCatch } from '@/hooks/usePokemonCatch'
import KanjiQuestTutorial from './KanjiQuestTutorial'

export default function KanjiQuest({
  jlptLevel,
  onBack,
  onPokemonCaught,
  customKanji
}: KanjiQuestProps) {
  const { t, strings } = useI18n()
  const { catchPokemon } = usePokemonCatch({ source: 'game' })
  const battleMusicRef = useRef<HTMLAudioElement | null>(null)
  const [isMuted, setIsMuted] = useState(false)

  // Game phases
  const [phase, setPhase] = useState<'kanji_selection' | 'encounter' | 'study' | 'battle' | 'quiz' | 'result'>('kanji_selection')
  const [session, setSession] = useState<StudySession | null>(null)
  const [studiedKanji, setStudiedKanji] = useState<Set<string>>(new Set())
  const [currentKanjiIndex, setCurrentKanjiIndex] = useState(0)
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState<number[]>([])
  const [showQuizFeedback, setShowQuizFeedback] = useState(false)
  const [animating, setAnimating] = useState(false)
  const [showFurigana, setShowFurigana] = useState(true)
  const [gameLoading, setGameLoading] = useState(true)

  // Battle system state
  const [kanjiHP, setKanjiHP] = useState(100)
  const [trainerHP, setTrainerHP] = useState(100)
  const [maxKanjiHP, setMaxKanjiHP] = useState(100)
  const [maxTrainerHP, setMaxTrainerHP] = useState(100)
  const [battleGradient, setBattleGradient] = useState('')
  const [battleLog, setBattleLog] = useState<BattleEvent[]>([])
  const [isAttacking, setIsAttacking] = useState(false)
  const [showDamageEffect, setShowDamageEffect] = useState(false)
  const [currentAttackType, setCurrentAttackType] = useState<AttackType>('meaning')
  const [showKanjiDefeat, setShowKanjiDefeat] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [isProcessingAnswer, setIsProcessingAnswer] = useState(false)
  const [showWrongAnswerModal, setShowWrongAnswerModal] = useState(false)
  const [lastWrongQuestion, setLastWrongQuestion] = useState<QuizQuestion | null>(null)

  // Kanji selection state
  const [availableKanji, setAvailableKanji] = useState<GameKanji[]>([])
  const [selectedKanji, setSelectedKanji] = useState<Set<string>>(new Set())
  const [completedKanjiIds, setCompletedKanjiIds] = useState<Set<string>>(new Set())
  const [showKanjiSelection, setShowKanjiSelection] = useState(false)

  // Question tracking state
  const [askedQuestions, setAskedQuestions] = useState<Map<string, Set<'onyomi' | 'kunyomi' | 'meaning'>>>(new Map())

  // Random icons for answer buttons
  const [answerIcons, setAnswerIcons] = useState<string[]>([])

  // Pokeball animation state
  const [showPokeballAnimation, setShowPokeballAnimation] = useState(false)

  // Battle announcements
  const [showKanjiAppearance, setShowKanjiAppearance] = useState(false)
  const [showKanjiEscape, setShowKanjiEscape] = useState(false)
  const [currentKanjiId, setCurrentKanjiId] = useState<string | null>(null)
  const [previousKanjiId, setPreviousKanjiId] = useState<string | null>(null)
  const [escapedKanji, setEscapedKanji] = useState<GameKanji | null>(null)
  const [appearanceMessage, setAppearanceMessage] = useState<{ kanji: string; attackType: string } | null>(null)
  const [showTrainerDefeat, setShowTrainerDefeat] = useState(false)

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false)
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false)

  // Exit confirmation modal
  const [showExitConfirmation, setShowExitConfirmation] = useState(false)

  // Initialize battle music
  useEffect(() => {
    if (typeof window !== 'undefined') {
      battleMusicRef.current = new Audio('/sounds/pokemon-battle.mp3')
      battleMusicRef.current.loop = true
      battleMusicRef.current.volume = 0.3

      // Check if user has seen tutorial
      const tutorialSeen = localStorage.getItem('kanji_quest_tutorial_seen')
      setHasSeenTutorial(!!tutorialSeen)
    }

    return () => {
      if (battleMusicRef.current) {
        battleMusicRef.current.pause()
        battleMusicRef.current = null
      }
    }
  }, [])

  // Handle battle music based on phase
  useEffect(() => {
    if (!battleMusicRef.current || isMuted) return

    if (phase === 'battle') {
      battleMusicRef.current.play().catch(error => {
        console.error('Error playing battle music:', error)
      })
    } else {
      battleMusicRef.current.pause()
      battleMusicRef.current.currentTime = 0
    }
  }, [phase, isMuted])

  // Initialize session
  useEffect(() => {
    const initializeGame = async () => {
      // Load completed kanji
      const completed = getCompletedKanjiIds()
      setCompletedKanjiIds(completed)

      // Show tutorial if first time
      if (!hasSeenTutorial) {
        setShowTutorial(true)
        setGameLoading(false)
        return
      }

      startNewSession()
    }

    initializeGame()
  }, [jlptLevel, hasSeenTutorial])

  const startNewSession = async () => {
    try {
      setGameLoading(true)

      // Load available kanji for selection
      if (!customKanji) {
        const allKanji = await getKanjiByJLPT(jlptLevel)
        const availableKanjiForLevel = allKanji.filter(k => !completedKanjiIds.has(k.id))
        setAvailableKanji(availableKanjiForLevel)
        setShowKanjiSelection(true)
        setGameLoading(false)
        return
      }

      // Get available kanji for the level
      let selectedKanjiList: GameKanji[]

      if (customKanji && customKanji.length > 0) {
        // Use custom kanji selection
        selectedKanjiList = customKanji
      } else {
        // Use random selection from JLPT level
        const allKanji = await getKanjiByJLPT(jlptLevel)

        // Filter out completed kanji
        const available = allKanji.filter(k => !completedKanjiIds.has(k.id))

        if (available.length < 5) {
          alert(strings.games?.kanjiQuest?.notEnoughKanji || 'Not enough kanji available!')
          onBack()
          return
        }

        // Select 5-8 random kanji
        selectedKanjiList = []
        const tempAvailable = [...available]
        const numToSelect = Math.min(3 + Math.floor(Math.random() * 3), tempAvailable.length)

        for (let i = 0; i < numToSelect && tempAvailable.length > 0; i++) {
          const randomIndex = Math.floor(Math.random() * tempAvailable.length)
          selectedKanjiList.push(tempAvailable.splice(randomIndex, 1)[0])
        }
      }

      // Create new session
      const newSession: StudySession = {
        kanji: selectedKanjiList,
        pokemonId: getRandomPokemon(),
        status: 'studying',
        startTime: new Date().toISOString(),
        quizScore: null
      }

      setSession(newSession)
      setPhase('encounter')
      setStudiedKanji(new Set())
      setCurrentKanjiIndex(0)
      setQuizQuestions([])
      setCurrentQuestionIndex(0)
      setUserAnswers([])

      // Initialize battle state based on JLPT level
      const baseHP = getKanjiHP(jlptLevel)
      setKanjiHP(baseHP)
      setMaxKanjiHP(baseHP)
      setTrainerHP(100)
      setMaxTrainerHP(100)
      setBattleLog([])

      // Generate random gradient for this encounter
      const gradients = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
        'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
        'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
      ]
      setBattleGradient(gradients[Math.floor(Math.random() * gradients.length)])
    } catch (error) {
      console.error('Failed to load kanji data:', error)
      onBack()
    } finally {
      setGameLoading(false)
    }
  }

  // Get random icons for answer buttons
  const getRandomIcons = (): string[] => {
    const iconPools = [
      // Pokemon icons
      [
        '/flat-icons/1752632-pokemon/png/017-gaming.png',
        '/flat-icons/1752632-pokemon/png/019-gaming.png',
        '/flat-icons/1752632-pokemon/png/025-gaming.png',
        '/flat-icons/1752632-pokemon/png/028-gaming.png'
      ]
    ]

    const allIcons = iconPools.flat()
    const shuffled = [...allIcons].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 4)
  }

  // Battle mechanics functions
  const getKanjiHP = (jlptLevel: number): number => {
    switch (jlptLevel) {
      case 5: return 60 + Math.floor(Math.random() * 20)
      case 4: return 80 + Math.floor(Math.random() * 20)
      case 3: return 100 + Math.floor(Math.random() * 20)
      case 2: return 120 + Math.floor(Math.random() * 20)
      case 1: return 140 + Math.floor(Math.random() * 20)
      default: return 100
    }
  }

  const handleStartTutorial = () => {
    localStorage.setItem('kanji_quest_tutorial_seen', 'true')
    setHasSeenTutorial(true)
    setShowTutorial(false)
    startNewSession()
  }

  const handleSelectKanji = () => {
    if (selectedKanji.size < 3 || selectedKanji.size > 8) {
      alert(strings.games?.kanjiQuest?.selectKanjiPrompt || 'Please select 3-8 kanji')
      return
    }

    const kanjiList = availableKanji.filter(k => selectedKanji.has(k.id))

    const newSession: StudySession = {
      kanji: kanjiList,
      pokemonId: getRandomPokemon(),
      status: 'studying',
      startTime: new Date().toISOString(),
      quizScore: null
    }

    setSession(newSession)
    setPhase('encounter')
    setShowKanjiSelection(false)

    // Initialize battle state
    const baseHP = getKanjiHP(jlptLevel)
    setKanjiHP(baseHP)
    setMaxKanjiHP(baseHP)
    setTrainerHP(100)
    setMaxTrainerHP(100)
    setBattleLog([])

    // Generate random gradient
    const gradients = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
    ]
    setBattleGradient(gradients[Math.floor(Math.random() * gradients.length)])
  }

  // Simplified render for now - will expand with full battle UI
  if (showTutorial) {
    return (
      <KanjiQuestTutorial
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
        onStart={handleStartTutorial}
      />
    )
  }

  if (gameLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">{strings.common?.loading || 'Loading...'}</p>
        </div>
      </div>
    )
  }

  if (showKanjiSelection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 dark:from-dark-900 dark:to-dark-850 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
              {strings.games?.kanjiQuest?.selectOpponents || 'Select Your Kanji Opponents!'}
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              {strings.games?.kanjiQuest?.selectInstructions || 'Choose 3-8 kanji to battle'}
            </p>
          </div>

          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 mb-8">
            {availableKanji.map(kanji => (
              <button
                key={kanji.id}
                onClick={() => {
                  const newSelection = new Set(selectedKanji)
                  if (newSelection.has(kanji.id)) {
                    newSelection.delete(kanji.id)
                  } else {
                    newSelection.add(kanji.id)
                  }
                  setSelectedKanji(newSelection)
                }}
                className={`
                  p-4 rounded-lg border-2 transition-all
                  ${selectedKanji.has(kanji.id)
                    ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/30'
                    : 'border-gray-300 dark:border-gray-600 hover:border-primary-300'
                  }
                `}
              >
                <div className="text-2xl font-bold text-gray-800 dark:text-white mb-1">
                  {kanji.character}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {kanji.meanings[0]}
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-center gap-4">
            <button
              onClick={onBack}
              className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {strings.common?.back || 'Back'}
            </button>
            <button
              onClick={handleSelectKanji}
              disabled={selectedKanji.size < 3 || selectedKanji.size > 8}
              className={`
                px-6 py-3 rounded-lg transition-colors
                ${selectedKanji.size >= 3 && selectedKanji.size <= 8
                  ? 'bg-primary-500 hover:bg-primary-600 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }
              `}
            >
              {strings.games?.kanjiQuest?.startBattle || 'Start Battle'} ({selectedKanji.size}/3-8)
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Placeholder for main game UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 dark:from-dark-900 dark:to-dark-850">
      <div className="text-center py-12">
        <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">
          Kanji Quest Battle System
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-8">
          Full battle implementation coming soon...
        </p>
        <button
          onClick={onBack}
          className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors"
        >
          {strings.common?.back || 'Back'}
        </button>
      </div>
    </div>
  )
}