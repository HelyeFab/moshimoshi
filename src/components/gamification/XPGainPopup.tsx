'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'

interface XPGainPopupProps {
  xpGained: number
  position?: { x: number; y: number }
  onComplete?: () => void
  delay?: number
  showBonus?: boolean
  bonusText?: string
}

/**
 * XP Gain Popup Component
 * Shows floating "+X XP" animation when user gains experience points
 * Follows theme system and i18n requirements from FEATURE_IMPLEMENTATION.md
 */
export function XPGainPopup({
  xpGained,
  position,
  onComplete,
  delay = 0,
  showBonus = false,
  bonusText
}: XPGainPopupProps) {
  const { t } = useI18n()
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    // Auto-hide after 2 seconds
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(() => {
        onComplete?.()
      }, 300) // Wait for exit animation
    }, 2000 + delay)

    return () => clearTimeout(timer)
  }, [delay, onComplete])

  // Calculate position (center if not provided)
  const finalPosition = position || { x: window.innerWidth / 2, y: window.innerHeight / 2 }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          className="fixed pointer-events-none z-50"
          style={{
            left: finalPosition.x,
            top: finalPosition.y,
            transform: 'translate(-50%, -50%)'
          }}
          initial={{
            opacity: 0,
            y: 0,
            scale: 0.5
          }}
          animate={{
            opacity: 1,
            y: -30,
            scale: 1
          }}
          exit={{
            opacity: 0,
            y: -60,
            scale: 0.8
          }}
          transition={{
            duration: 0.5,
            ease: [0.43, 0.13, 0.23, 0.96],
            delay: delay / 1000
          }}
        >
          {/* Main XP text */}
          <div className="flex flex-col items-center">
            <motion.div
              className="text-2xl font-bold text-primary-600 dark:text-primary-400"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              transition={{
                duration: 0.4,
                times: [0, 0.6, 1],
                delay: delay / 1000 + 0.1
              }}
            >
              +{xpGained} XP
            </motion.div>

            {/* Bonus text if applicable */}
            {showBonus && bonusText && (
              <motion.div
                className="text-sm text-primary-500 dark:text-primary-300 mt-1"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: delay / 1000 + 0.3 }}
              >
                {bonusText}
              </motion.div>
            )}
          </div>

          {/* Sparkle particles */}
          {xpGained >= 50 && (
            <>
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-yellow-400 rounded-full"
                  style={{
                    left: '50%',
                    top: '50%',
                  }}
                  initial={{ x: 0, y: 0, opacity: 1 }}
                  animate={{
                    x: (Math.random() - 0.5) * 60,
                    y: (Math.random() - 0.5) * 60,
                    opacity: 0
                  }}
                  transition={{
                    duration: 1,
                    delay: delay / 1000 + Math.random() * 0.3,
                    ease: "easeOut"
                  }}
                />
              ))}
            </>
          )}

          {/* Glow effect for large XP gains */}
          {xpGained >= 100 && (
            <motion.div
              className="absolute inset-0 -z-10"
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 3, opacity: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <div className="w-16 h-16 bg-primary-400 rounded-full blur-xl" />
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * XP Gain Manager Component
 * Manages multiple XP gain popups to prevent overlapping
 */
interface XPGainEvent {
  id: string
  xpGained: number
  timestamp: number
  position?: { x: number; y: number }
  bonusText?: string
}

interface XPGainManagerProps {
  events: XPGainEvent[]
  onEventComplete: (id: string) => void
}

export function XPGainManager({ events, onEventComplete }: XPGainManagerProps) {
  const [activeEvents, setActiveEvents] = useState<XPGainEvent[]>([])

  useEffect(() => {
    // Process events with staggered delays
    const newEvents = events.filter(
      event => !activeEvents.find(active => active.id === event.id)
    )

    if (newEvents.length > 0) {
      setActiveEvents(prev => [...prev, ...newEvents])
    }
  }, [events])

  const handleComplete = (eventId: string) => {
    setActiveEvents(prev => prev.filter(e => e.id !== eventId))
    onEventComplete(eventId)
  }

  // Calculate staggered positions to prevent overlap
  const getPosition = (index: number) => {
    const baseY = window.innerHeight * 0.4
    const offsetY = index * 40
    return {
      x: window.innerWidth / 2,
      y: baseY - offsetY
    }
  }

  return (
    <>
      {activeEvents.map((event, index) => (
        <XPGainPopup
          key={event.id}
          xpGained={event.xpGained}
          position={event.position || getPosition(index)}
          delay={index * 200} // Stagger by 200ms
          onComplete={() => handleComplete(event.id)}
          showBonus={event.xpGained >= 50}
          bonusText={event.bonusText}
        />
      ))}
    </>
  )
}