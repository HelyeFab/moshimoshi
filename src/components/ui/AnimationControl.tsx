'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Pause, Play, Sparkles } from 'lucide-react'
import { useToast } from '@/components/ui/Toast/ToastContext'

interface AnimationControlProps {
  onToggle?: (enabled: boolean) => void
  className?: string
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  variant?: 'default' | 'glassmorphism'
}

export default function AnimationControl({
  onToggle,
  className = '',
  position = 'bottom-right',
  variant = 'default'
}: AnimationControlProps) {
  const [animationsEnabled, setAnimationsEnabled] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    // Check system preference on mount
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)
    setAnimationsEnabled(!mediaQuery.matches)

    // Listen for changes to system preference
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
      setAnimationsEnabled(!e.matches)
      if (e.matches) {
        showToast('Animations disabled (system preference)', 'info')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [showToast])

  useEffect(() => {
    // Apply global CSS class for animation control
    if (animationsEnabled) {
      document.documentElement.classList.remove('reduce-motion')
      document.documentElement.style.setProperty('--animation-play-state', 'running')
    } else {
      document.documentElement.classList.add('reduce-motion')
      document.documentElement.style.setProperty('--animation-play-state', 'paused')
    }

    // Notify parent component
    onToggle?.(animationsEnabled)
  }, [animationsEnabled, onToggle])

  const handleToggle = () => {
    const newState = !animationsEnabled
    setAnimationsEnabled(newState)
    showToast(
      newState ? 'Animations enabled' : 'Animations paused',
      'success'
    )
  }

  const positionClasses = {
    'bottom-right': 'bottom-6 right-6',
    'bottom-left': 'bottom-6 left-6',
    'top-right': 'top-[100px] right-6',
    'top-left': 'top-[100px] left-6'
  }

  return (
    <>
      {/* Global styles for reduced motion */}
      <style jsx global>{`
        .reduce-motion * {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }

        .reduce-motion .floating-element,
        .reduce-motion .lantern-float,
        .reduce-motion .twinkling-light {
          animation: none !important;
          transition: none !important;
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }

          .floating-element,
          .lantern-float,
          .twinkling-light {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>

      {/* Animation Control Button */}
      <AnimatePresence>
        <motion.div
          className={`${variant === 'glassmorphism' ? 'relative' : `fixed ${positionClasses[position]} z-50`} ${className}`}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            onClick={handleToggle}
            className={
              variant === 'glassmorphism'
                ? `
                  group relative flex items-center justify-center rounded-full
                  w-12 h-12
                  bg-soft-white/20 dark:bg-dark-900/30
                  backdrop-blur-2xl backdrop-saturate-150
                  border border-gray-200/40 dark:border-gray-700/30
                  shadow-2xl shadow-japanese-sakura/20 dark:shadow-black/60
                  transition-all duration-200
                  ${animationsEnabled
                    ? 'hover:bg-soft-white/30 dark:hover:bg-dark-900/40'
                    : 'hover:bg-soft-white/30 dark:hover:bg-dark-900/40'
                  }
                `
                : `
                  group relative flex items-center gap-2 px-4 py-3 rounded-full
                  bg-white/90 dark:bg-dark-800/90 backdrop-blur-md
                  border border-gray-200 dark:border-dark-700
                  shadow-lg hover:shadow-xl
                  transition-all duration-200
                  ${animationsEnabled
                    ? 'hover:bg-primary-50 dark:hover:bg-primary-900/20'
                    : 'hover:bg-gray-100 dark:hover:bg-dark-700'
                  }
                `
            }
            whileHover={{ scale: animationsEnabled ? 1.1 : 1.05 }}
            whileTap={{ scale: animationsEnabled ? 0.95 : 1 }}
            aria-label={animationsEnabled ? 'Pause animations' : 'Play animations'}
            title={animationsEnabled ? 'Pause all animations' : 'Resume animations'}
          >
            {/* Icon with smooth transition */}
            <div className="relative w-5 h-5">
              <AnimatePresence mode="wait">
                {animationsEnabled ? (
                  <motion.div
                    key="pause"
                    initial={{ opacity: 0, rotate: -180 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 180 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0"
                  >
                    <Pause className={variant === 'glassmorphism' ? 'w-5 h-5 text-primary-600 dark:text-primary-400' : 'w-5 h-5 text-primary-600 dark:text-primary-400'} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="play"
                    initial={{ opacity: 0, rotate: -180 }}
                    animate={{ opacity: 1, rotate: 0 }}
                    exit={{ opacity: 0, rotate: 180 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0"
                  >
                    <Play className={variant === 'glassmorphism' ? 'w-5 h-5 text-primary-600 dark:text-primary-400' : 'w-5 h-5 text-primary-600 dark:text-primary-400'} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Label text (hidden in glassmorphism variant) */}
            {variant !== 'glassmorphism' && (
              <span className={`
                text-sm font-medium hidden sm:inline-block
                ${animationsEnabled
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-gray-600 dark:text-gray-400'
                }
              `}>
                {animationsEnabled ? 'Animations On' : 'Animations Off'}
              </span>
            )}

            {/* Sparkle indicator when enabled (hidden in glassmorphism variant) */}
            {animationsEnabled && variant !== 'glassmorphism' && (
              <motion.div
                className="absolute -top-1 -right-1"
                initial={{ scale: 0 }}
                animate={{
                  scale: [0, 1.2, 1],
                  rotate: [0, 10, -10, 0]
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                  repeatDelay: 3
                }}
              >
                <Sparkles className="w-3 h-3 text-yellow-500" />
              </motion.div>
            )}

            {/* System preference indicator */}
            {prefersReducedMotion && (
              <div
                className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700"
              >
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                  SYSTEM PREF
                </span>
              </div>
            )}
          </motion.button>

          {/* Tooltip on hover */}
          <AnimatePresence>
            {animationsEnabled && (
              <motion.div
                className="absolute bottom-full mb-2 left-1/2 transform -translate-x-1/2 px-3 py-2 rounded-lg pointer-events-none bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 0, y: 0 }}
                transition={{ duration: 0.2 }}
              >
                Press to pause floating lanterns & animations
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900 dark:border-t-gray-100" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>
    </>
  )
}

// Export a hook for other components to check animation state
export function useAnimationControl() {
  const [animationsEnabled, setAnimationsEnabled] = useState(true)

  useEffect(() => {
    const checkAnimationState = () => {
      const isReduced = document.documentElement.classList.contains('reduce-motion')
      setAnimationsEnabled(!isReduced)
    }

    // Initial check
    checkAnimationState()

    // Listen for changes
    const observer = new MutationObserver(checkAnimationState)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  return animationsEnabled
}