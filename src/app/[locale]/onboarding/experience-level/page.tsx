'use client'

import React, { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { useTranslation } from '@/hooks/useTranslation'
import type { ExperienceLevel, LearningGoal } from '../config'

const levelIds: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced']

function ExperienceLevelContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()
  const [selectedLevel, setSelectedLevel] = useState<ExperienceLevel | null>(null)

  // Get the goal from URL params
  const goal = searchParams.get('goal') as LearningGoal | null

  const handleSelectLevel = (levelId: ExperienceLevel) => {
    setSelectedLevel(levelId)
  }

  const handleNext = () => {
    // Forward all params to the feature showcase for personalization
    const params = new URLSearchParams()
    if (goal) params.set('goal', goal)
    if (selectedLevel) params.set('level', selectedLevel)
    router.push(`/onboarding/feature-showcase?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{t('onboarding.experienceLevel.title')}</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
          {t('onboarding.experienceLevel.subtitle')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {levelIds.map(levelId => (
            <div
              key={levelId}
              onClick={() => handleSelectLevel(levelId)}
              className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                selectedLevel === levelId
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-indigo-500'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg">{t(`onboarding.experienceLevel.levels.${levelId}.title`)}</h3>
                {selectedLevel === levelId && (
                  <CheckCircleIcon className="w-6 h-6 text-indigo-600" />
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-left text-sm">
                {t(`onboarding.experienceLevel.levels.${levelId}.description`)}
              </p>
            </div>
          ))}
        </div>

        <Button
          onClick={handleNext}
          disabled={!selectedLevel}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl py-4 px-8 rounded-lg shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {t('onboarding.experienceLevel.next')}
          <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
        </Button>
      </div>
    </div>
  )
}

export default function ExperienceLevelPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent" />
      </div>
    }>
      <ExperienceLevelContent />
    </Suspense>
  )
}
