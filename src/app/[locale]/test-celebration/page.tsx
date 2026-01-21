'use client'

import { useState } from 'react'
import ContentCelebration from '@/components/shared/ContentCelebration'

export default function TestCelebrationPage() {
  const [showCelebration, setShowCelebration] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Celebration Screen Preview
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Click the button to preview the celebration screen exactly as shown after a session completes.
          It auto-closes after a few seconds.
        </p>
        <button
          onClick={() => setShowCelebration(true)}
          className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          Show Celebration
        </button>
      </div>

      {showCelebration && (
        <ContentCelebration
          contentTitle="Kanji Mastery Session"
          contentType="flashcard"
          xpEarned={35}
          readingTimeMs={6 * 60 * 1000 + 24 * 1000}
          difficulty="N5"
          vocabularyCount={12}
          onClose={() => setShowCelebration(false)}
        />
      )}
    </div>
  )
}
