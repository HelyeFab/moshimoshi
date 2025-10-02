'use client'

import { motion } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'
import textbookIndex from '@/data/textbooks/index.json'

interface TextbookSelectorProps {
  onSelectTextbook: (textbookId: string) => void
}

const textbookInfo = {
  'genki-1': {
    icon: '🌸',
    color: 'from-pink-400 to-purple-500',
    shadowColor: 'shadow-purple-200 dark:shadow-purple-500/50',
    hoverShadow: 'hover:shadow-purple-300 dark:hover:shadow-purple-400/60',
    level: 'N5',
    description: 'Elementary Japanese',
    lessons: 12
  },
  'genki-2': {
    icon: '🌺',
    color: 'from-purple-400 to-indigo-500',
    shadowColor: 'shadow-indigo-200 dark:shadow-indigo-500/50',
    hoverShadow: 'hover:shadow-indigo-300 dark:hover:shadow-indigo-400/60',
    level: 'N4-N5',
    description: 'Elementary Japanese II',
    lessons: 11
  },
  'genki-2-new': {
    icon: '🌷',
    color: 'from-indigo-400 to-blue-500',
    shadowColor: 'shadow-blue-200 dark:shadow-blue-500/50',
    hoverShadow: 'hover:shadow-blue-300 dark:hover:shadow-blue-400/60',
    level: 'N4',
    description: 'Elementary Japanese II (3rd Ed.)',
    lessons: 11
  },
  'minna-1': {
    icon: '🌿',
    color: 'from-green-400 to-teal-500',
    shadowColor: 'shadow-teal-200 dark:shadow-teal-500/50',
    hoverShadow: 'hover:shadow-teal-300 dark:hover:shadow-teal-400/60',
    level: 'N5',
    description: 'Japanese for Everyone',
    lessons: 25
  },
  'minna-2': {
    icon: '🌊',
    color: 'from-teal-400 to-blue-500',
    shadowColor: 'shadow-blue-200 dark:shadow-blue-500/50',
    hoverShadow: 'hover:shadow-blue-300 dark:hover:shadow-blue-400/60',
    level: 'N4',
    description: 'Japanese for Everyone II',
    lessons: 25
  },
  'kaishi-15k': {
    icon: '🔥',
    color: 'from-orange-400 to-red-500',
    shadowColor: 'shadow-red-200 dark:shadow-red-500/50',
    hoverShadow: 'hover:shadow-red-300 dark:hover:shadow-red-400/60',
    level: 'N5-N1',
    description: 'Core 1.5k Vocabulary',
    lessons: 0
  },
  'kanji-in-context': {
    icon: '📚',
    color: 'from-blue-400 to-cyan-500',
    shadowColor: 'shadow-cyan-200 dark:shadow-cyan-500/50',
    hoverShadow: 'hover:shadow-cyan-300 dark:hover:shadow-cyan-400/60',
    level: 'N4-N1',
    description: 'Comprehensive Kanji Study',
    lessons: 50
  }
}

export function TextbookSelector({ onSelectTextbook }: TextbookSelectorProps) {
  const { strings } = useI18n()

  // Calculate total words
  const totalWords = Object.values(textbookIndex.textbooks || {}).reduce((sum, textbook) => sum + textbook.cardCount, 0) +
    Object.values(textbookIndex.vocabularySources || {}).reduce((sum, source) => sum + source.cardCount, 0)

  const allTextbooks = {
    ...textbookIndex.textbooks,
    ...textbookIndex.vocabularySources
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      {/* Stats Banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-r from-primary-400 to-primary-600 dark:from-primary-500 dark:to-primary-700 rounded-2xl p-6 text-white shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">
              {strings.common?.totalVocabulary || 'Total Collection'}
            </h2>
            <p className="text-lg opacity-90">
              {totalWords.toLocaleString()} {strings.common?.words || 'words'}
            </p>
          </div>
          <div className="text-5xl">📖</div>
        </div>
      </motion.div>

      {/* Textbook Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(allTextbooks).map(([id, textbook], index) => {
          const info = textbookInfo[id as keyof typeof textbookInfo]
          if (!info) return null

          return (
            <motion.button
              key={id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 + 0.2 }}
              onClick={() => onSelectTextbook(id)}
              className={`group relative bg-white dark:bg-dark-800 rounded-2xl p-6 shadow-md ${info.shadowColor} ${info.hoverShadow} hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 border border-gray-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-600`}
            >
              {/* Background Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${info.color} opacity-5 dark:opacity-10 rounded-2xl`} />

              {/* Content */}
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className="text-left">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                      {textbook.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {info.description}
                    </p>
                  </div>
                  <div className="text-3xl">{info.icon}</div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  {info.lessons > 0 && (
                    <div className="text-center bg-gray-100 dark:bg-dark-700 rounded-lg p-2">
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {strings.common?.lessons || 'Lessons'}
                      </div>
                      <div className="font-bold text-gray-900 dark:text-gray-100">
                        {info.lessons}
                      </div>
                    </div>
                  )}
                  <div className="text-center bg-gray-100 dark:bg-dark-700 rounded-lg p-2">
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {strings.common?.words || 'Words'}
                    </div>
                    <div className="font-bold text-gray-900 dark:text-gray-100">
                      {textbook.cardCount.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-center bg-gray-100 dark:bg-dark-700 rounded-lg p-2">
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      {strings.common?.level || 'Level'}
                    </div>
                    <div className="font-bold text-gray-900 dark:text-gray-100">
                      {info.level}
                    </div>
                  </div>
                </div>

                {/* Progress Bar Preview */}
                <div className="mt-4">
                  <div className="relative h-2 bg-gray-100 dark:bg-dark-700 rounded-full overflow-hidden">
                    <motion.div
                      className={`absolute inset-y-0 left-0 bg-gradient-to-r ${info.color} rounded-full`}
                      initial={{ width: 0 }}
                      whileHover={{ width: '30%' }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center border border-gray-200 dark:border-dark-700">
          <div className="text-2xl mb-2">🎯</div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {strings.common?.srsReview || 'SRS Review'}
          </p>
        </div>
        <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center border border-gray-200 dark:border-dark-700">
          <div className="text-2xl mb-2">🎵</div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {strings.common?.audioSupport || 'Audio Support'}
          </p>
        </div>
        <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center border border-gray-200 dark:border-dark-700">
          <div className="text-2xl mb-2">📊</div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {strings.common?.progress || 'Progress Tracking'}
          </p>
        </div>
        <div className="bg-white dark:bg-dark-800 rounded-xl p-4 text-center border border-gray-200 dark:border-dark-700">
          <div className="text-2xl mb-2">💫</div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            {strings.common?.interactive || 'Interactive'}
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}