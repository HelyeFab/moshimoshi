'use client'

import { motion } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'

interface KanjiQuestTutorialProps {
  isOpen: boolean
  onClose: () => void
  onStart: () => void
}

export default function KanjiQuestTutorial({ isOpen, onClose, onStart }: KanjiQuestTutorialProps) {
  const { strings } = useI18n()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-dark-850 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto scrollbar-hide"
      >
        <div className="p-6">
          {/* Header with Pokemon */}
          <div className="text-center mb-6">
            <motion.div
              animate={{ rotate: [0, -5, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="inline-block"
            >
              <div className="text-6xl mb-4">🎮</div>
            </motion.div>
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
              {strings.games?.kanjiQuest?.tutorial?.title || 'Welcome to Kanji Quest!'}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-200">
              {strings.games?.kanjiQuest?.tutorial?.subtitle || "Catch 'em all... but with Kanji!"}
            </p>
          </div>

          {/* Game Rules */}
          <div className="space-y-6 mb-8">
            {/* Step 1 */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex items-start gap-4 bg-soft-white dark:bg-gray-800/70 rounded-xl p-4"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  📚
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-1">
                  {strings.games?.kanjiQuest?.tutorial?.step1?.title || 'Select Your Kanji Opponents!'}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {strings.games?.kanjiQuest?.tutorial?.step1?.description ||
                   'Choose 3-8 kanji to battle against. Each kanji will be encountered multiple times until you defeat them by mastering all their readings and meanings!'}
                </p>
              </div>
            </motion.div>

            {/* Step 2 */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-start gap-4 bg-soft-white dark:bg-gray-800/70 rounded-xl p-4"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  ⚡
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-1">
                  {strings.games?.kanjiQuest?.tutorial?.step2?.title || 'Wild Encounters!'}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {strings.games?.kanjiQuest?.tutorial?.step2?.description ||
                   'Kanji appear randomly like wild Pokémon! Each kanji needs to be defeated by answering questions about their readings and meanings.'}
                </p>
                <ul className="mt-2 space-y-1 ml-4">
                  <li className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span className="text-blue-500">●</span>
                    {strings.games?.kanjiQuest?.tutorial?.step2?.onyomi || "On'yomi reading (if it has one)"}
                  </li>
                  <li className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span className="text-green-500">●</span>
                    {strings.games?.kanjiQuest?.tutorial?.step2?.kunyomi || "Kun'yomi reading (if it has one)"}
                  </li>
                  <li className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                    <span className="text-purple-500">●</span>
                    {strings.games?.kanjiQuest?.tutorial?.step2?.meaning || 'Meaning (all kanji have this!)'}
                  </li>
                </ul>
              </div>
            </motion.div>

            {/* Step 3 */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex items-start gap-4 bg-soft-white dark:bg-gray-800/70 rounded-xl p-4"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  💪
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-1">
                  {strings.games?.kanjiQuest?.tutorial?.step3?.title || 'Battle & Learn!'}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {strings.games?.kanjiQuest?.tutorial?.step3?.description ||
                   'Answer questions correctly to defeat the kanji! Wrong answers mean the kanji fights back and damages your HP. Master all aspects of every kanji to win!'}
                </p>
              </div>
            </motion.div>

            {/* Step 4 */}
            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex items-start gap-4 bg-soft-white dark:bg-gray-800/70 rounded-xl p-4"
            >
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                  🏆
                </div>
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-800 dark:text-white mb-1">
                  {strings.games?.kanjiQuest?.tutorial?.step4?.title || 'Catch Pokémon!'}
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {strings.games?.kanjiQuest?.tutorial?.step4?.description ||
                   'Defeat all kanji to catch a Pokémon! Build your collection as you master more kanji. Can you catch them all?'}
                </p>
              </div>
            </motion.div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors"
            >
              {strings.common?.close || 'Close'}
            </button>
            <button
              onClick={onStart}
              className="px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-bold"
            >
              {strings.games?.kanjiQuest?.tutorial?.startButton || "Let's Play!"}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}