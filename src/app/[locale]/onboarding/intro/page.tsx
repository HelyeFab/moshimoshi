'use client'

import React, { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/hooks/useTranslation'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { Suspense } from 'react'

// Swipe detection configuration
const swipeConfidenceThreshold = 10000
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity
}

// Animation variants for smooth transitions
const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 400 : -400,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 400 : -400,
    opacity: 0,
  }),
}

// Panel content types
interface PanelContent {
  id: number
  doshiMood: 'happy' | 'excited' | 'thinking' | 'curious' | 'sleepy' | 'sad' | 'celebrating' | 'studying' | 'loading'
  hasAppIcons?: boolean // Special visual for Panel 1
}

const panels: PanelContent[] = [
  { id: 1, doshiMood: 'sleepy', hasAppIcons: true }, // Why Moshimoshi - scattered app icons (tired → sleepy)
  { id: 2, doshiMood: 'thinking' }, // Premium Philosophy (thoughtful → thinking)
  { id: 3, doshiMood: 'curious' }, // How to Use (calm → curious)
  { id: 4, doshiMood: 'excited' }, // YouTube Shadowing
  { id: 5, doshiMood: 'happy' }, // Closing
]

function IntroTutorialContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const [[page, direction], setPage] = useState([0, 0])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Check if this is a review (from settings)
  const isReview = searchParams.get('review') === 'true'

  const currentIndex = ((page % panels.length) + panels.length) % panels.length
  const currentPanel = panels[currentIndex]
  const isLastPanel = currentIndex === panels.length - 1

  const paginate = useCallback(
    (newDirection: number) => {
      // Don't allow going back from first panel
      if (currentIndex === 0 && newDirection === -1) return
      // Don't allow swiping past last panel
      if (currentIndex === panels.length - 1 && newDirection === 1) return

      setPage([page + newDirection, newDirection])
    },
    [page, currentIndex]
  )

  const handleDragEnd = useCallback(
    (e: MouseEvent | TouchEvent | PointerEvent, { offset, velocity }: PanInfo) => {
      const swipe = swipePower(offset.x, velocity.x)

      if (swipe < -swipeConfidenceThreshold) {
        paginate(1)
      } else if (swipe > swipeConfidenceThreshold) {
        paginate(-1)
      }
    },
    [paginate]
  )

  const handleComplete = async () => {
    // If reviewing, just go back to settings
    if (isReview) {
      router.push('/settings')
      return
    }

    setIsSubmitting(true)

    try {
      // Mark intro as complete
      const response = await fetch('/api/user/intro-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to mark intro as complete')
      }

      // Redirect to dashboard
      console.log('[IntroTutorial] Intro completed successfully')
      router.push('/dashboard')
    } catch (err) {
      console.error('[IntroTutorial] Error completing intro:', err)
      setIsSubmitting(false)
      // Still redirect to dashboard even if marking fails
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900 flex flex-col items-center justify-center p-6 pb-24 overflow-hidden">
      <div className="w-full max-w-2xl">
        {/* Main Panel Area */}
        <div className="relative h-[600px] md:h-[650px] mb-8">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={page}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.3 },
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.2}
              onDragEnd={handleDragEnd}
              className="absolute inset-0 flex flex-col items-center justify-start cursor-grab active:cursor-grabbing"
            >
              {/* Panel Content */}
              <div className="w-full bg-white/80 dark:bg-dark-800/80 backdrop-blur-lg rounded-3xl shadow-2xl p-8 md:p-12 border border-gray-200 dark:border-gray-700">
                {/* Doshi Mascot */}
                <div className="flex justify-center mb-6">
                  <DoshiMascot size="large" mood={currentPanel.doshiMood} variant="animated" />
                </div>

                {/* Panel 1: Why Moshimoshi Exists */}
                {currentPanel.id === 1 && (
                  <div className="text-center space-y-6">
                    <h2 className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium">
                      {t('intro.panel1.eyebrow')}
                    </h2>
                    <div className="space-y-4 text-gray-700 dark:text-gray-200">
                      <p className="text-xl md:text-2xl font-medium leading-relaxed">
                        {t('intro.panel1.line1')}
                      </p>

                      {/* Scattered App Icons Visual */}
                      {currentPanel.hasAppIcons && (
                        <div className="relative h-24 my-6">
                          <div className="flex items-center justify-center gap-2 flex-wrap opacity-40">
                            <div className="w-10 h-10 bg-blue-500 rounded-lg rotate-12" />
                            <div className="w-10 h-10 bg-green-500 rounded-lg -rotate-6" />
                            <div className="w-10 h-10 bg-red-500 rounded-lg rotate-3" />
                            <div className="w-10 h-10 bg-yellow-500 rounded-lg -rotate-12" />
                            <div className="w-10 h-10 bg-purple-500 rounded-lg rotate-6" />
                            <div className="w-10 h-10 bg-pink-500 rounded-lg -rotate-3" />
                            <div className="w-10 h-10 bg-indigo-500 rounded-lg rotate-12" />
                            <div className="w-10 h-10 bg-orange-500 rounded-lg -rotate-6" />
                            <div className="w-10 h-10 bg-teal-500 rounded-lg rotate-3" />
                            <div className="w-10 h-10 bg-cyan-500 rounded-lg -rotate-12" />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-6xl">→</div>
                          </div>
                        </div>
                      )}

                      <p className="text-lg leading-relaxed">
                        {t('intro.panel1.line2')}
                      </p>
                      <p className="text-lg leading-relaxed">
                        {t('intro.panel1.line3')}
                      </p>
                      <p className="text-xl md:text-2xl font-medium leading-relaxed mt-6">
                        {t('intro.panel1.line4')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Panel 2: Premium Philosophy */}
                {currentPanel.id === 2 && (
                  <div className="text-center space-y-6">
                    <h2 className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium">
                      {t('intro.panel2.eyebrow')}
                    </h2>
                    <div className="space-y-4 text-gray-700 dark:text-gray-200">
                      <p className="text-xl md:text-2xl font-medium leading-relaxed">
                        {t('intro.panel2.line1')}
                      </p>
                      <p className="text-lg leading-relaxed">
                        {t('intro.panel2.line2')}
                      </p>
                      <ul className="text-left max-w-md mx-auto space-y-2 text-lg">
                        <li className="flex items-start gap-3">
                          <span className="text-primary-500 dark:text-primary-400">•</span>
                          <span>{t('intro.panel2.bullet1')}</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-primary-500 dark:text-primary-400">•</span>
                          <span>{t('intro.panel2.bullet2')}</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-primary-500 dark:text-primary-400">•</span>
                          <span>{t('intro.panel2.bullet3')}</span>
                        </li>
                      </ul>
                      <p className="text-lg leading-relaxed mt-6">
                        {t('intro.panel2.line3')}
                      </p>
                      <p className="text-lg leading-relaxed">
                        {t('intro.panel2.line4')}
                      </p>
                      <p className="text-xl md:text-2xl font-medium leading-relaxed mt-6">
                        {t('intro.panel2.line5')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Panel 3: How to Use */}
                {currentPanel.id === 3 && (
                  <div className="text-center space-y-6">
                    <h2 className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium">
                      {t('intro.panel3.eyebrow')}
                    </h2>
                    <div className="space-y-4 text-gray-700 dark:text-gray-200">
                      <p className="text-xl md:text-2xl font-medium leading-relaxed">
                        {t('intro.panel3.line1')}
                      </p>
                      <p className="text-lg leading-relaxed">
                        {t('intro.panel3.line2')}
                      </p>
                      <ul className="text-left max-w-md mx-auto space-y-2 text-lg">
                        <li className="flex items-start gap-3">
                          <span className="text-primary-500 dark:text-primary-400">•</span>
                          <span>{t('intro.panel3.bullet1')}</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-primary-500 dark:text-primary-400">•</span>
                          <span>{t('intro.panel3.bullet2')}</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-primary-500 dark:text-primary-400">•</span>
                          <span>{t('intro.panel3.bullet3')}</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-primary-500 dark:text-primary-400">•</span>
                          <span>{t('intro.panel3.bullet4')}</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-primary-500 dark:text-primary-400">•</span>
                          <span>{t('intro.panel3.bullet5')}</span>
                        </li>
                      </ul>
                      <p className="text-xl md:text-2xl font-medium leading-relaxed mt-6">
                        {t('intro.panel3.line3')}
                      </p>
                      <p className="text-lg leading-relaxed">
                        {t('intro.panel3.line4')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Panel 4: YouTube Shadowing */}
                {currentPanel.id === 4 && (
                  <div className="text-center space-y-6">
                    <h2 className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium">
                      {t('intro.panel4.eyebrow')}
                    </h2>
                    <div className="space-y-4 text-gray-700 dark:text-gray-200">
                      <p className="text-xl md:text-2xl font-medium leading-relaxed">
                        {t('intro.panel4.line1')}
                      </p>
                      <p className="text-lg leading-relaxed">
                        {t('intro.panel4.line2')}
                      </p>
                      <p className="text-lg leading-relaxed font-medium">
                        {t('intro.panel4.line3')}
                      </p>
                      <ul className="text-left max-w-md mx-auto space-y-2 text-lg">
                        <li className="flex items-start gap-3">
                          <span className="text-primary-500 dark:text-primary-400">•</span>
                          <span>{t('intro.panel4.bullet1')}</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-primary-500 dark:text-primary-400">•</span>
                          <span>{t('intro.panel4.bullet2')}</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-primary-500 dark:text-primary-400">•</span>
                          <span>{t('intro.panel4.bullet3')}</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <span className="text-primary-500 dark:text-primary-400">•</span>
                          <span>{t('intro.panel4.bullet4')}</span>
                        </li>
                      </ul>
                      <p className="text-xl md:text-2xl font-medium leading-relaxed mt-6">
                        {t('intro.panel4.line4')}
                      </p>
                      <p className="text-xl md:text-2xl font-medium leading-relaxed">
                        {t('intro.panel4.line5')}
                      </p>
                      <p className="text-xl md:text-2xl font-medium leading-relaxed">
                        {t('intro.panel4.line6')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Panel 5: Closing */}
                {currentPanel.id === 5 && (
                  <div className="text-center space-y-8 py-12">
                    <div className="space-y-6 text-gray-700 dark:text-gray-200">
                      <p className="text-3xl md:text-4xl font-medium leading-relaxed">
                        {t('intro.panel5.line1')}
                      </p>
                      <p className="text-2xl md:text-3xl font-light leading-relaxed text-gray-600 dark:text-gray-300">
                        {t('intro.panel5.line2')}
                      </p>
                    </div>

                    {/* CTA Button */}
                    <div className="mt-12">
                      <Button
                        onClick={handleComplete}
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white text-xl py-6 px-12 rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <span className="animate-spin mr-2 h-5 w-5 border-2 border-white rounded-full border-t-transparent inline-block" />
                            {t('intro.panel5.loading')}
                          </>
                        ) : isReview ? (
                          t('intro.panel5.backToSettings')
                        ) : (
                          t('intro.panel5.getStarted')
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Arrows */}
              {currentIndex > 0 && (
                <button
                  onClick={() => paginate(-1)}
                  className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-3 bg-white dark:bg-dark-700 hover:bg-gray-50 dark:hover:bg-dark-600 rounded-full shadow-lg transition-colors"
                  aria-label="Previous panel"
                >
                  <ChevronLeftIcon className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                </button>
              )}
              {!isLastPanel && (
                <button
                  onClick={() => paginate(1)}
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-3 bg-white dark:bg-dark-700 hover:bg-gray-50 dark:hover:bg-dark-600 rounded-full shadow-lg transition-colors"
                  aria-label="Next panel"
                >
                  <ChevronRightIcon className="w-6 h-6 text-gray-700 dark:text-gray-200" />
                </button>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress Dots */}
        <div className="flex justify-center gap-2 mb-3">
          {panels.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                // Only allow jumping to panels we've seen or current
                if (index <= currentIndex || index === 0) {
                  setPage([index, index > currentIndex ? 1 : -1])
                }
              }}
              disabled={index > currentIndex && index !== 0}
              className={`h-2.5 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'w-8 bg-primary-600 dark:bg-primary-400'
                  : index < currentIndex
                  ? 'w-2.5 bg-gray-400 dark:bg-gray-500 hover:bg-gray-500 dark:hover:bg-gray-400 cursor-pointer'
                  : 'w-2.5 bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
              }`}
              aria-label={`Panel ${index + 1}`}
            />
          ))}
        </div>

        {/* Progress Text */}
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          {currentIndex + 1} {t('intro.progressOf')} {panels.length}
        </p>

        {/* Swipe Hint (only on first panel) */}
        {currentIndex === 0 && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-4 animate-pulse">
            {t('intro.swipeHint')}
          </p>
        )}
      </div>
    </div>
  )
}

export default function IntroTutorialPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <IntroTutorialContent />
    </Suspense>
  )
}
