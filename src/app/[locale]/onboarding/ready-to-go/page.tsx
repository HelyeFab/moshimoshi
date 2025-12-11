'use client'

import React, { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { useTranslation } from '@/hooks/useTranslation'
import type { LearningGoal, ExperienceLevel } from '../config'

function ReadyToGoContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t, language } = useTranslation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get params from URL
  const goal = searchParams.get('goal') as LearningGoal | null
  const level = searchParams.get('level') as ExperienceLevel | null

  const handleGoToDashboard = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Save onboarding data to the server
      const response = await fetch('/api/user/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          learningGoal: goal || 'conversation', // Default if somehow missing
          experienceLevel: level || 'beginner', // Default if somehow missing
          language, // Track which language the user completed onboarding in
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to save onboarding')
      }

      // Success! Redirect to dashboard
      console.log('[ReadyToGo] Onboarding completed successfully')
      router.push('/dashboard')
    } catch (err) {
      console.error('[ReadyToGo] Error completing onboarding:', err)
      setError(err instanceof Error ? err.message : t('onboarding.readyToGo.error'))
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-lg">
        <CheckCircleIcon className="w-24 h-24 text-green-500 mx-auto mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4">{t('onboarding.readyToGo.title')}</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
          {t('onboarding.readyToGo.subtitle')}
        </p>

        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-lg">
            {error}
          </div>
        )}

        <Button
          onClick={handleGoToDashboard}
          disabled={isSubmitting}
          className="bg-green-600 hover:bg-green-700 text-white text-xl py-6 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <span className="animate-spin mr-2 h-5 w-5 border-2 border-white rounded-full border-t-transparent inline-block" />
              {t('onboarding.readyToGo.settingUp')}
            </>
          ) : (
            t('onboarding.readyToGo.goToDashboard')
          )}
        </Button>
      </div>
    </div>
  )
}

export default function ReadyToGoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-green-600 rounded-full border-t-transparent" />
        </div>
      }
    >
      <ReadyToGoContent />
    </Suspense>
  )
}
