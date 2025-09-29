'use client'

import { motion } from 'framer-motion'

interface ContextDisplayProps {
  context: string
  contextType: 'word' | 'sentence'
  kanjiChar: string
}

export default function ContextDisplay({ context, contextType, kanjiChar }: ContextDisplayProps) {
  // Highlight the kanji in the context
  const parts = context.split(kanjiChar)

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="text-center"
    >
      {/* Context type indicator */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <motion.div
          className={`px-3 py-1 rounded-full text-xs font-medium ${
            contextType === 'word'
              ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
              : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
          }`}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          {contextType === 'word' ? '📚 Compound Word' : '📝 Full Sentence'}
        </motion.div>
      </div>

      {/* Main context display */}
      <div className="relative">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary-500/5 via-transparent to-secondary-500/5 rounded-2xl blur-xl" />

        <motion.div
          className="relative bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm border-2 border-gray-200 dark:border-gray-700 rounded-2xl px-6 py-8 md:px-12 md:py-10 shadow-xl"
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300 }}
        >
          <p className={`font-bold ${
            contextType === 'sentence'
              ? 'text-2xl md:text-3xl lg:text-4xl'
              : 'text-3xl md:text-4xl lg:text-5xl'
          }`}>
            {parts.map((part, index) => (
              <span key={index}>
                {part}
                {index < parts.length - 1 && (
                  <motion.span
                    className="inline-block mx-1 text-primary-500"
                    initial={{ scale: 1 }}
                    animate={{
                      scale: [1, 1.2, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <span className="relative">
                      {kanjiChar}
                      {/* Glow effect for kanji */}
                      <span
                        className="absolute inset-0 blur-md text-primary-500 opacity-50"
                        aria-hidden="true"
                      >
                        {kanjiChar}
                      </span>
                    </span>
                  </motion.span>
                )}
              </span>
            ))}
          </p>

          {/* Context hint */}
          <motion.div
            className="mt-4 text-sm text-gray-600 dark:text-gray-400"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            Choose the correct reading for <span className="text-primary-500 font-semibold">{kanjiChar}</span> in this context
          </motion.div>
        </motion.div>

        {/* Decorative elements */}
        <motion.div
          className="absolute -top-4 -left-4 w-8 h-8 border-2 border-primary-500/30 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute -bottom-4 -right-4 w-6 h-6 border-2 border-secondary-500/30 rounded-full"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.5
          }}
        />
      </div>
    </motion.div>
  )
}