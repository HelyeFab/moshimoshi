'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DoshiMascot } from '@/components/ui/DoshiMascot'
import { useI18n } from '@/i18n/I18nContext'

interface TTSLoadingOverlayProps {
  /** Whether the overlay is visible */
  isLoading: boolean
  /** Minimum delay before showing (ms) - prevents flicker for fast loads */
  minDelay?: number
}

// Fun Japanese phrases for loading (hiragana only) - will be shown with translations
const LOADING_PHRASES = [
  { ja: 'ちょっとまってね', en: 'Just a moment...' },
  { ja: 'こえをじゅんびちゅう', en: 'Preparing voice...' },
  { ja: 'おんせいをつくってるよ', en: 'Creating audio...' },
  { ja: 'もうすぐだよ', en: 'Almost ready!' },
  { ja: 'がんばってるよ', en: 'Working hard!' },
  { ja: 'しょうしょうおまちを', en: 'Please wait...' },
  { ja: 'ドシがよんでるよ', en: 'Doshi is reading...' },
  { ja: 'まほうをかけてるよ', en: 'Casting magic...' },
]

export function TTSLoadingOverlay({ isLoading, minDelay = 300 }: TTSLoadingOverlayProps) {
  const { t } = useI18n()
  const [shouldShow, setShouldShow] = useState(false)
  const [phraseIndex, setPhraseIndex] = useState(0)

  // Pick a random starting phrase
  const shuffledPhrases = useMemo(() => {
    const shuffled = [...LOADING_PHRASES]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }, [])

  // Handle delayed show
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    if (isLoading) {
      timeoutId = setTimeout(() => {
        setShouldShow(true)
      }, minDelay)
    } else {
      setShouldShow(false)
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [isLoading, minDelay])

  // Rotate phrases while showing
  useEffect(() => {
    if (!shouldShow) {
      setPhraseIndex(0)
      return
    }

    const intervalId = setInterval(() => {
      setPhraseIndex(prev => (prev + 1) % shuffledPhrases.length)
    }, 2000) // Change phrase every 2 seconds

    return () => clearInterval(intervalId)
  }, [shouldShow, shuffledPhrases.length])

  const currentPhrase = shuffledPhrases[phraseIndex]

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          role="status"
          aria-live="polite"
          aria-label={t('tts.loading.ariaLabel') || 'Loading audio'}
        >
          {/* Subtle backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/10 dark:bg-black/20 backdrop-blur-[2px]"
          />

          {/* Content container */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{
              type: 'spring',
              damping: 25,
              stiffness: 300,
            }}
            className="relative flex flex-col items-center gap-4 p-6 bg-white/95 dark:bg-dark-800/95 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-dark-600/50"
          >
            {/* Animated Doshi mascot */}
            <motion.div
              animate={{
                y: [0, -8, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <DoshiMascot size="large" variant="animated" mood="loading" />
            </motion.div>

            {/* Japanese phrase with animation */}
            <div className="text-center min-h-[60px] flex flex-col justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={phraseIndex}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center gap-1"
                >
                  {/* Japanese text - larger */}
                  <span className="text-xl font-medium text-gray-900 dark:text-gray-100">
                    {currentPhrase.ja}
                  </span>
                  {/* English translation - smaller, muted */}
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {currentPhrase.en}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Animated sound wave indicator */}
            <div className="flex items-end gap-1 h-6">
              {[0, 1, 2, 3, 4].map(i => (
                <motion.div
                  key={i}
                  className="w-1 bg-primary-500 rounded-full"
                  animate={{
                    height: ['8px', '24px', '8px'],
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Hook to manage TTS loading overlay state
 * Tracks whether we're fetching from API (not cache) with delay logic
 */
export function useTTSLoadingState() {
  const [isFetchingFromAPI, setIsFetchingFromAPI] = useState(false)

  return {
    isFetchingFromAPI,
    setIsFetchingFromAPI,
  }
}
