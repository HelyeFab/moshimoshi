'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'
import Navbar from '@/components/layout/Navbar'
import LearningPageHeader from '@/components/learn/LearningPageHeader'
import { useAuth } from '@/hooks/useAuth'
import { DoshiMascot } from '@/components/ui/DoshiMascot'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { TextbookSelector } from './components/TextbookSelector'
import { VocabularyDisplay } from './components/VocabularyDisplay'

export default function TextbookVocabularyPage() {
  const { user } = useAuth()
  const { strings } = useI18n()
  const [selectedTextbook, setSelectedTextbook] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'browse' | 'study' | 'review'>('browse')

  const handleTextbookSelect = (textbookId: string) => {
    setIsLoading(true)
    setSelectedTextbook(textbookId)
    // Simulate loading
    setTimeout(() => setIsLoading(false), 500)
  }

  const handleBack = () => {
    setSelectedTextbook(null)
  }

  const handleModeChange = (mode: 'browse' | 'study' | 'review') => {
    setViewMode(mode)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sakura-50 to-white dark:from-gray-900 dark:to-gray-800">
      <Navbar user={user} showUserMenu={true} />

      <LearningPageHeader
        title={strings.common?.textbookVocabulary || 'Textbook Vocabulary'}
        description={strings.common?.textbookVocabularyDesc || 'Study vocabulary from popular Japanese textbooks'}
        mode={viewMode}
        onModeChange={handleModeChange}
      />

      <div className="container mx-auto px-4 py-6 max-w-6xl">

        <AnimatePresence mode="wait">
          {isLoading && <LoadingOverlay />}

          {!selectedTextbook ? (
            <TextbookSelector onSelectTextbook={handleTextbookSelect} />
          ) : (
            <VocabularyDisplay
              textbookId={selectedTextbook}
              onBack={handleBack}
            />
          )}
        </AnimatePresence>

        {/* Doshi Mascot */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 20 }}
          className="fixed bottom-4 right-4 z-10"
        >
          <DoshiMascot
            mood={selectedTextbook ? "happy" : "thinking"}
            size="small"
          />
        </motion.div>
      </div>
    </div>
  )
}