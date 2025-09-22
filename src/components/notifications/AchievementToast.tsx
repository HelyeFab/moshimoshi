'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAchievementStore, Achievement } from '@/stores/achievement-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface AchievementToastProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center'
  autoHideDuration?: number
  maxVisible?: number
}

interface ToastItemProps {
  achievement: Achievement
  onDismiss: () => void
  duration: number
  index: number
}

const ConfettiParticle = ({ delay = 0 }: { delay?: number }) => {
  const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7', '#a0e7e5']
  const color = colors[Math.floor(Math.random() * colors.length)]
  
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full"
      style={{ backgroundColor: color }}
      initial={{
        x: 0,
        y: 0,
        opacity: 1,
        scale: 0
      }}
      animate={{
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200,
        opacity: 0,
        scale: [0, 1, 0],
        rotate: Math.random() * 360
      }}
      transition={{
        duration: 2,
        delay: delay,
        ease: "easeOut"
      }}
    />
  )
}

const ToastItem = ({ achievement, onDismiss, duration, index }: ToastItemProps) => {
  const [timeLeft, setTimeLeft] = useState(duration)
  const [isPaused, setIsPaused] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  
  useEffect(() => {
    // Show confetti for epic and legendary achievements
    if (achievement.rarity === 'epic' || achievement.rarity === 'legendary') {
      setShowConfetti(true)
      const timer = setTimeout(() => setShowConfetti(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [achievement.rarity])
  
  useEffect(() => {
    if (isPaused || timeLeft <= 0) return
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 100) {
          onDismiss()
          return 0
        }
        return prev - 100
      })
    }, 100)
    
    return () => clearInterval(timer)
  }, [isPaused, timeLeft, onDismiss])
  
  const getRarityStyle = () => {
    switch (achievement.rarity) {
      case 'common':
        return {
          bg: 'bg-gradient-to-r from-gray-500 to-gray-600',
          border: 'border-gray-400',
          glow: 'shadow-lg'
        }
      case 'uncommon':
        return {
          bg: 'bg-gradient-to-r from-green-500 to-green-600',
          border: 'border-green-400',
          glow: 'shadow-lg shadow-green-200'
        }
      case 'rare':
        return {
          bg: 'bg-gradient-to-r from-blue-500 to-blue-600',
          border: 'border-blue-400',
          glow: 'shadow-lg shadow-blue-200'
        }
      case 'epic':
        return {
          bg: 'bg-gradient-to-r from-purple-500 to-purple-600',
          border: 'border-purple-400',
          glow: 'shadow-xl shadow-purple-300'
        }
      case 'legendary':
        return {
          bg: 'bg-gradient-to-r from-yellow-400 to-orange-500',
          border: 'border-yellow-300',
          glow: 'shadow-xl shadow-yellow-300'
        }
      default:
        return {
          bg: 'bg-gradient-to-r from-gray-500 to-gray-600',
          border: 'border-gray-400',
          glow: 'shadow-lg'
        }
    }
  }
  
  const style = getRarityStyle()
  const progressPercentage = (timeLeft / duration) * 100
  
  return (
    <motion.div
      className="relative"
      initial={{ 
        opacity: 0, 
        scale: 0.8, 
        x: 300,
        rotateY: 90
      }}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        x: 0,
        rotateY: 0
      }}
      exit={{ 
        opacity: 0, 
        scale: 0.8, 
        x: 300,
        rotateY: -90
      }}
      transition={{ 
        duration: 0.5,
        delay: index * 0.1,
        type: "spring",
        stiffness: 100
      }}
      style={{ zIndex: 1000 - index }}
    >
      {/* Confetti Effect */}
      <AnimatePresence>
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <ConfettiParticle key={i} delay={i * 0.1} />
            ))}
          </div>
        )}
      </AnimatePresence>
      
      <Card
        className={`
          relative overflow-hidden w-80 p-0 border-2 text-white
          ${style.bg} ${style.border} ${style.glow}
          transform transition-all duration-300 hover:scale-105
        `}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        {/* Progress Bar */}
        <motion.div
          className="absolute top-0 left-0 h-1 bg-white/30"
          initial={{ width: '100%' }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ duration: 0.1 }}
        />
        
        {/* Shimmer Effect for Legendary */}
        {achievement.rarity === 'legendary' && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{
              x: ['-100%', '100%']
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        )}
        
        <div className="p-4">
          <div className="flex items-start space-x-3">
            {/* Achievement Icon */}
            <motion.div
              className="text-4xl flex-shrink-0"
              animate={{
                scale: [1, 1.1, 1],
                rotate: achievement.rarity === 'legendary' ? [0, 5, -5, 0] : 0
              }}
              transition={{
                scale: {
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                },
                rotate: {
                  duration: 1,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}
            >
              {achievement.icon}
            </motion.div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <motion.div
                className="text-sm font-bold mb-1 uppercase tracking-wide"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                Achievement Unlocked!
              </motion.div>
              
              <motion.h4
                className="text-lg font-bold mb-1 text-white"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                {achievement.name}
              </motion.h4>
              
              <motion.p
                className="text-sm text-white/90 mb-2"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                {achievement.description}
              </motion.p>
              
              <motion.div
                className="flex items-center justify-between"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex items-center space-x-3 text-xs">
                  <span className="px-2 py-1 bg-white/20 rounded-full font-medium">
                    +{achievement.points} points
                  </span>
                  <span className="px-2 py-1 bg-white/20 rounded-full font-medium capitalize">
                    {achievement.rarity}
                  </span>
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                  className="text-white hover:bg-white/20 p-1"
                >
                  ✕
                </Button>
              </motion.div>
            </div>
          </div>
        </div>
        
        {/* Rarity Glow Effect */}
        <motion.div
          className={`absolute inset-0 ${style.bg} opacity-20 pointer-events-none`}
          animate={{
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </Card>
    </motion.div>
  )
}

export default function AchievementToast({
  position = 'top-right',
  autoHideDuration = 5000,
  maxVisible = 3
}: AchievementToastProps) {
  const { pendingToasts, dismissToast } = useAchievementStore()
  const [visibleToasts, setVisibleToasts] = useState<Achievement[]>([])
  
  // Manage visible toasts
  useEffect(() => {
    const toShow = pendingToasts.slice(0, maxVisible)
    setVisibleToasts(toShow)
  }, [pendingToasts, maxVisible])
  
  // Auto-dismiss toasts
  useEffect(() => {
    if (pendingToasts.length === 0) return
    
    const timers = pendingToasts.map((achievement, index) => {
      return setTimeout(() => {
        dismissToast(achievement.id)
      }, autoHideDuration + (index * 500)) // Stagger dismissal
    })
    
    return () => {
      timers.forEach(timer => clearTimeout(timer))
    }
  }, [pendingToasts, autoHideDuration, dismissToast])
  
  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4'
      case 'top-center':
        return 'top-4 left-1/2 transform -translate-x-1/2'
      case 'top-right':
        return 'top-4 right-4'
      case 'bottom-left':
        return 'bottom-4 left-4'
      case 'bottom-center':
        return 'bottom-4 left-1/2 transform -translate-x-1/2'
      case 'bottom-right':
        return 'bottom-4 right-4'
      default:
        return 'top-4 right-4'
    }
  }
  
  const isBottom = position.includes('bottom')
  
  return (
    <div className={`fixed z-50 pointer-events-none ${getPositionClasses()}`}>
      <div className={`flex flex-col space-y-3 ${isBottom ? 'flex-col-reverse' : ''}`}>
        <AnimatePresence mode="popLayout">
          {visibleToasts.map((achievement, index) => (
            <motion.div
              key={achievement.id}
              className="pointer-events-auto"
              layout
            >
              <ToastItem
                achievement={achievement}
                onDismiss={() => dismissToast(achievement.id)}
                duration={autoHideDuration}
                index={index}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}