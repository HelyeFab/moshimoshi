'use client'

import { motion } from 'framer-motion'
import type { KanjiItem } from '../types/reading-routes'

interface KanjiCenterProps {
  kanji: KanjiItem
  isAnimating: boolean
  theme?: string
}

export default function KanjiCenter({ kanji, isAnimating, theme }: KanjiCenterProps) {
  return (
    <motion.div
      className="relative"
      animate={isAnimating ? {
        scale: [1, 1.05, 1],
        rotate: [0, 3, -3, 0]
      } : {}}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: "easeInOut"
      }}
    >
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full blur-2xl opacity-50"
        style={{
          background: theme || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          transform: 'scale(1.2)'
        }}
      />

      {/* Main kanji display */}
      <motion.div
        className="relative w-32 h-32 md:w-40 md:h-40 bg-white dark:bg-dark-800 rounded-full flex items-center justify-center shadow-2xl border-4 border-primary-500/30"
        whileHover={{ scale: 1.1 }}
        transition={{ type: "spring", stiffness: 300 }}
      >
        <span className="text-6xl md:text-7xl font-bold text-gray-900 dark:text-white">
          {kanji.char}
        </span>

        {/* Decorative ring */}
        <div className="absolute inset-0 rounded-full border-2 border-primary-400/20 animate-pulse" />
      </motion.div>

      {/* Floating meaning */}
      <motion.div
        className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-white/90 dark:bg-dark-700/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-md"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {kanji.meaning}
        </p>
      </motion.div>
    </motion.div>
  )
}