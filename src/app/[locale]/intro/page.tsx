'use client'

import React, { useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/hooks/useTranslation'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { Suspense } from 'react'
import { useAnimationControl } from '@/components/ui/AnimationControl'
import Image from 'next/image'

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
  { id: 1, doshiMood: 'sleepy', hasAppIcons: true }, // Why Moshimoshi - scattered app icons
  { id: 2, doshiMood: 'thinking' }, // A Small, Human Project
  { id: 3, doshiMood: 'curious' }, // A Learner's Toolbox
  { id: 4, doshiMood: 'studying' }, // Immersion First
  { id: 5, doshiMood: 'thinking' }, // How to Use Moshimoshi
  { id: 6, doshiMood: 'excited' }, // YouTube Shadowing
  { id: 7, doshiMood: 'happy' }, // Closing
]

// Floating lantern component
function FloatingLantern({ delay = 0, color = '#ef4444' }) {
  const animationsEnabled = useAnimationControl()
  const [leftPosition, setLeftPosition] = useState(50)

  React.useEffect(() => {
    setLeftPosition(Math.random() * 100)
  }, [])

  return (
    <motion.div
      className="absolute pointer-events-none floating-element"
      initial={{ y: '120vh', opacity: 0 }}
      animate={
        animationsEnabled
          ? {
              y: '-20vh',
              opacity: [0, 1, 1, 0],
            }
          : { y: '120vh', opacity: 0 }
      }
      transition={{
        duration: animationsEnabled ? 20 : 0,
        delay: animationsEnabled ? delay : 0,
        repeat: animationsEnabled ? Infinity : 0,
        ease: 'linear',
      }}
      style={{
        left: `${leftPosition}%`,
        filter: `drop-shadow(0 0 20px ${color})`,
      }}
    >
      <div
        className="w-8 h-10 rounded-lg"
        style={{
          background: `linear-gradient(135deg, ${color}40, ${color}80)`,
          boxShadow: `inset 0 0 20px ${color}60`,
        }}
      />
    </motion.div>
  )
}

// Chinese lantern emoji component
function ChineseLantern({
  delay = 0,
  size = 'medium',
}: {
  delay?: number
  size?: 'small' | 'medium' | 'large' | 'xlarge'
}) {
  const animationsEnabled = useAnimationControl()
  const [leftPosition, setLeftPosition] = useState(50)
  const [horizontalDrift, setHorizontalDrift] = useState(0)
  const [duration, setDuration] = useState(25)

  React.useEffect(() => {
    setLeftPosition(Math.random() * 100)
    setHorizontalDrift(Math.random() * 30 - 15)
    setDuration(25 + Math.random() * 10)
  }, [])

  const sizes = {
    small: 'text-2xl',
    medium: 'text-4xl',
    large: 'text-6xl',
    xlarge: 'text-8xl',
  } as const

  const startY = '120vh'
  const endY = '-20vh'

  return (
    <motion.div
      className={`absolute pointer-events-none lantern-float ${sizes[size]}`}
      initial={{
        y: startY,
        x: 0,
        opacity: 0,
        rotate: -10,
      }}
      animate={
        animationsEnabled
          ? {
              y: endY,
              x: horizontalDrift,
              opacity: [0, 1, 1, 1, 0],
              rotate: 10,
            }
          : {
              y: startY,
              x: 0,
              opacity: 0,
              rotate: -10,
            }
      }
      transition={{
        duration: animationsEnabled ? duration : 0,
        delay: animationsEnabled ? delay : 0,
        repeat: animationsEnabled ? Infinity : 0,
        ease: 'easeInOut',
      }}
      style={{
        left: `${leftPosition}%`,
        filter: 'drop-shadow(0 0 15px rgba(239, 68, 68, 0.5))',
      }}
    >
      🏮
    </motion.div>
  )
}

function IntroTutorialContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const [[page, direction], setPage] = useState([0, 0])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Drag-to-scroll state for desktop
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startY, setStartY] = useState(0)
  const [scrollTop, setScrollTop] = useState(0)

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

  // Drag-to-scroll handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return
    setIsDragging(true)
    setStartY(e.pageY - scrollRef.current.offsetTop)
    setScrollTop(scrollRef.current.scrollTop)
    // Add cursor style
    if (scrollRef.current) {
      scrollRef.current.style.cursor = 'grabbing'
      scrollRef.current.style.userSelect = 'none'
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return
    e.preventDefault()
    const y = e.pageY - scrollRef.current.offsetTop
    const walk = (y - startY) * 1.5 // Scroll speed multiplier
    scrollRef.current.scrollTop = scrollTop - walk
  }

  const handleMouseUp = () => {
    setIsDragging(false)
    if (scrollRef.current) {
      scrollRef.current.style.cursor = 'grab'
      scrollRef.current.style.userSelect = 'auto'
    }
  }

  const handleMouseLeave = () => {
    if (isDragging) {
      setIsDragging(false)
      if (scrollRef.current) {
        scrollRef.current.style.cursor = 'grab'
        scrollRef.current.style.userSelect = 'auto'
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900 flex flex-col items-center justify-center p-6 pb-24 overflow-x-hidden relative">
      {/* Floating lanterns background */}
      <div className="absolute inset-0 h-full overflow-hidden pointer-events-none z-0">
        <FloatingLantern delay={0} color="#ef4444" />
        <FloatingLantern delay={4} color="#f97316" />
        <FloatingLantern delay={8} color="#8b5cf6" />
        <FloatingLantern delay={12} color="#06b6d4" />
        <FloatingLantern delay={16} color="#10b981" />

        {/* Chinese lantern emojis of different sizes */}
        <ChineseLantern delay={0} size="small" />
        <ChineseLantern delay={3} size="large" />
        <ChineseLantern delay={6} size="medium" />
        <ChineseLantern delay={9} size="xlarge" />
        <ChineseLantern delay={12} size="small" />
        <ChineseLantern delay={15} size="medium" />
        <ChineseLantern delay={18} size="large" />
        <ChineseLantern delay={21} size="small" />
        <ChineseLantern delay={24} size="medium" />
        <ChineseLantern delay={27} size="xlarge" />
      </div>

      <div className="w-full max-w-2xl relative z-10">
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
              {/* Panel Content - Scrollable with hidden scrollbar */}
              <div
                ref={scrollRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                className="w-full flex-1 min-h-0 bg-white/80 dark:bg-dark-800/80 backdrop-blur-lg rounded-3xl shadow-2xl p-6 md:p-12 border border-gray-200 dark:border-gray-700 overflow-y-auto overflow-x-hidden scrollbar-hide cursor-grab"
              >
                <style jsx>{`
                  .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                  }
                  .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                  }
                `}</style>
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
                          <div className="flex items-center justify-center gap-2 flex-wrap opacity-50">
                            <motion.div
                              className="w-10 h-10 relative rounded-lg overflow-hidden bg-white shadow-md"
                              animate={{
                                rotate: [0, 4, -4, 0],
                                scale: [1, 1.02, 1.02, 1],
                                y: [0, -2, -2, 0]
                              }}
                              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                            >
                              <Image src="/intro-icons/wanikani.png" alt="WaniKani" fill className="object-cover" />
                            </motion.div>
                            <motion.div
                              className="w-10 h-10 relative rounded-lg overflow-hidden bg-white shadow-md"
                              animate={{
                                rotate: [0, -4, 4, 0],
                                scale: [1, 1.02, 1.02, 1],
                                y: [0, -2, -2, 0]
                              }}
                              transition={{ duration: 3.7, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                            >
                              <Image src="/intro-icons/anki.png" alt="Anki" fill className="object-contain p-1" />
                            </motion.div>
                            <motion.div
                              className="w-10 h-10 relative rounded-lg overflow-hidden bg-white shadow-md"
                              animate={{
                                rotate: [0, 4, -4, 0],
                                scale: [1, 1.02, 1.02, 1],
                                y: [0, -2, -2, 0]
                              }}
                              transition={{ duration: 3.3, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
                            >
                              <Image src="/intro-icons/duolingo.webp" alt="Duolingo" fill className="object-contain p-1" />
                            </motion.div>
                            <motion.div
                              className="w-10 h-10 relative rounded-lg overflow-hidden bg-white shadow-md"
                              animate={{
                                rotate: [0, -4, 4, 0],
                                scale: [1, 1.02, 1.02, 1],
                                y: [0, -2, -2, 0]
                              }}
                              transition={{ duration: 3.9, repeat: Infinity, ease: 'easeInOut', delay: 0.9 }}
                            >
                              <Image src="/intro-icons/hiragana.webp" alt="Hiragana Quest" fill className="object-contain p-1" />
                            </motion.div>
                            <motion.div
                              className="w-10 h-10 relative rounded-lg overflow-hidden bg-white shadow-md"
                              animate={{
                                rotate: [0, 4, -4, 0],
                                scale: [1, 1.02, 1.02, 1],
                                y: [0, -2, -2, 0]
                              }}
                              transition={{ duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay: 1.2 }}
                            >
                              <Image src="/intro-icons/lingodeer.jpeg" alt="LingoDeer" fill className="object-contain p-1" />
                            </motion.div>
                            <motion.div
                              className="w-10 h-10 relative rounded-lg overflow-hidden bg-white shadow-md"
                              animate={{
                                rotate: [0, -4, 4, 0],
                                scale: [1, 1.02, 1.02, 1],
                                y: [0, -2, -2, 0]
                              }}
                              transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
                            >
                              <Image src="/intro-icons/study-happy.webp" alt="Study App" fill className="object-contain p-1" />
                            </motion.div>
                            <motion.div
                              className="w-10 h-10 relative rounded-lg overflow-hidden bg-white shadow-md"
                              animate={{
                                rotate: [0, 4, -4, 0],
                                scale: [1, 1.02, 1.02, 1],
                                y: [0, -2, -2, 0]
                              }}
                              transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut', delay: 1.8 }}
                            >
                              <Image src="/intro-icons/bunpro.png" alt="Bunpro" fill className="object-contain p-1" />
                            </motion.div>
                            <motion.div
                              className="w-10 h-10 relative rounded-lg overflow-hidden bg-white shadow-md"
                              animate={{
                                rotate: [0, -4, 4, 0],
                                scale: [1, 1.02, 1.02, 1],
                                y: [0, -2, -2, 0]
                              }}
                              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 2.1 }}
                            >
                              <Image src="/intro-icons/app2.png" alt="Learning App" fill className="object-contain p-1" />
                            </motion.div>
                            <motion.div
                              className="w-10 h-10 relative rounded-lg overflow-hidden bg-white shadow-md"
                              animate={{
                                rotate: [0, 4, -4, 0],
                                scale: [1, 1.02, 1.02, 1],
                                y: [0, -2, -2, 0]
                              }}
                              transition={{ duration: 4.0, repeat: Infinity, ease: 'easeInOut', delay: 2.4 }}
                            >
                              <Image src="/intro-icons/memrise.png" alt="Memrise" fill className="object-cover" />
                            </motion.div>
                            <motion.div
                              className="w-10 h-10 relative rounded-lg overflow-hidden bg-white shadow-md"
                              animate={{
                                rotate: [0, -4, 4, 0],
                                scale: [1, 1.02, 1.02, 1],
                                y: [0, -2, -2, 0]
                              }}
                              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 2.7 }}
                            >
                              <Image src="/intro-icons/hey.webp" alt="Hey App" fill className="object-contain p-1" />
                            </motion.div>
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

                {/* Panel 2: A Small, Human Project */}
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
                      <p className="text-lg leading-relaxed">
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

                {/* Panel 3: A Learner's Toolbox */}
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
                      <p className="text-lg leading-relaxed">
                        {t('intro.panel3.line3')}
                      </p>
                      <p className="text-lg leading-relaxed">
                        {t('intro.panel3.line4')}
                      </p>
                      <p className="text-xl md:text-2xl font-medium leading-relaxed mt-6">
                        {t('intro.panel3.line5')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Panel 4: Immersion First */}
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
                      <p className="text-lg leading-relaxed">
                        {t('intro.panel4.line3')}
                      </p>
                      <p className="text-xl md:text-2xl font-medium leading-relaxed mt-6">
                        {t('intro.panel4.line4')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Panel 5: How to Use Moshimoshi */}
                {currentPanel.id === 5 && (
                  <div className="text-center space-y-6">
                    <h2 className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium">
                      {t('intro.panel5.eyebrow')}
                    </h2>
                    <div className="space-y-4 text-gray-700 dark:text-gray-200">
                      <p className="text-xl md:text-2xl font-medium leading-relaxed">
                        {t('intro.panel5.line1')}
                      </p>
                      <p className="text-lg leading-relaxed">
                        {t('intro.panel5.line2')}
                      </p>
                      <p className="text-lg leading-relaxed">
                        {t('intro.panel5.line3')}
                      </p>
                      <p className="text-xl md:text-2xl font-medium leading-relaxed mt-6">
                        {t('intro.panel5.line4')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Panel 6: YouTube Shadowing */}
                {currentPanel.id === 6 && (
                  <div className="text-center space-y-6">
                    <h2 className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400 font-medium">
                      {t('intro.panel6.eyebrow')}
                    </h2>
                    <div className="space-y-4 text-gray-700 dark:text-gray-200">
                      <p className="text-xl md:text-2xl font-medium leading-relaxed">
                        {t('intro.panel6.line1')}
                      </p>
                      <p className="text-lg leading-relaxed">
                        {t('intro.panel6.line2')}
                      </p>
                      <p className="text-lg leading-relaxed">
                        {t('intro.panel6.line3')}
                      </p>
                      <p className="text-lg leading-relaxed">
                        {t('intro.panel6.line4')}
                      </p>
                      <p className="text-xl md:text-2xl font-medium leading-relaxed mt-6">
                        {t('intro.panel6.line5')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Panel 7: Closing */}
                {currentPanel.id === 7 && (
                  <div className="text-center space-y-8 py-12">
                    <div className="space-y-6 text-gray-700 dark:text-gray-200">
                      <p className="text-3xl md:text-4xl font-medium leading-relaxed">
                        {t('intro.closing.line1')}
                      </p>
                      <p className="text-2xl md:text-3xl font-light leading-relaxed text-gray-600 dark:text-gray-300">
                        {t('intro.closing.line2')}
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
                            {t('intro.closing.loading')}
                          </>
                        ) : isReview ? (
                          t('intro.closing.backToSettings')
                        ) : (
                          t('intro.closing.getStarted')
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
