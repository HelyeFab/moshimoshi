'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles, TrendingUp, Star, Zap } from 'lucide-react'
import { useI18n } from '@/i18n/I18nContext'

export type BadgeType = 'new' | 'updated' | 'popular' | 'featured'

interface StallBadgeProps {
  type: BadgeType
  className?: string
}

/**
 * Beautiful badge component for Learning Village stalls
 *
 * Features:
 * - Gradient design with subtle glow
 * - Bounce animation on mount
 * - i18n support for 6 languages
 * - Multiple badge types (new, updated, popular, featured)
 *
 * Usage:
 * <StallBadge type="new" />
 */
export default function StallBadge({ type, className = '' }: StallBadgeProps) {
  const { strings } = useI18n()

  const badgeConfig = {
    new: {
      label: strings?.dashboard?.learningVillage?.badges?.new || 'New Content',
      gradient: 'from-orange-400 via-pink-500 to-red-500',
      icon: Sparkles,
      glow: 'shadow-orange-500/50',
    },
    updated: {
      label: strings?.dashboard?.learningVillage?.badges?.updated || 'Updated',
      gradient: 'from-blue-400 via-cyan-500 to-teal-500',
      icon: Zap,
      glow: 'shadow-blue-500/50',
    },
    popular: {
      label: strings?.dashboard?.learningVillage?.badges?.popular || 'Popular',
      gradient: 'from-purple-400 via-pink-500 to-rose-500',
      icon: TrendingUp,
      glow: 'shadow-purple-500/50',
    },
    featured: {
      label: strings?.dashboard?.learningVillage?.badges?.featured || 'Featured',
      gradient: 'from-yellow-400 via-orange-500 to-amber-600',
      icon: Star,
      glow: 'shadow-yellow-500/50',
    },
  }

  const config = badgeConfig[type]
  const Icon = config.icon

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0, y: -10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 15,
        duration: 0.4,
      }}
      className={`absolute -top-2 -right-2 z-10 ${className}`}
    >
      {/* Glow effect */}
      <motion.div
        animate={{
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className={`absolute inset-0 blur-md ${config.glow} rounded-full`}
      />

      {/* Badge pill */}
      <div
        className={`
          relative flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-3 sm:py-1.5
          rounded-full text-white text-[10px] sm:text-xs font-bold
          bg-gradient-to-r ${config.gradient}
          shadow-lg
          backdrop-blur-sm
          border border-white/20
          overflow-hidden
        `}
      >
        <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5 relative z-10" strokeWidth={2.5} />
        <span className="whitespace-nowrap relative z-10">{config.label}</span>

        {/* Shimmer effect */}
        <motion.div
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
            repeatDelay: 2,
          }}
          className="absolute inset-0 overflow-hidden rounded-full"
        >
          <div
            className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent"
            style={{ transform: 'skewX(-20deg)' }}
          />
        </motion.div>
      </div>
    </motion.div>
  )
}
