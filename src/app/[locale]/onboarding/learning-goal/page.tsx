'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { useTranslation } from '@/hooks/useTranslation'
import type { LearningGoal } from '../config'

const goalIds: LearningGoal[] = ['jlpt', 'travel', 'anime', 'conversation']

const LearningGoalPage = () => {
  const router = useRouter()
  const { t } = useTranslation()
  const [selectedGoal, setSelectedGoal] = useState<LearningGoal | null>(null)

  const handleSelectGoal = (goalId: LearningGoal) => {
    setSelectedGoal(goalId)
  }

  const handleNext = () => {
    // Pass the selected goal via URL params for personalized feature showcase
    const params = new URLSearchParams()
    if (selectedGoal) {
      params.set('goal', selectedGoal)
    }
    router.push(`/onboarding/experience-level?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center justify-center p-6 pb-24">
      <div className="text-center max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{t('onboarding.learningGoal.title')}</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
          {t('onboarding.learningGoal.subtitle')}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {goalIds.map(goalId => (
            <div
              key={goalId}
              onClick={() => handleSelectGoal(goalId)}
              className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                selectedGoal === goalId
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-indigo-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">{t(`onboarding.learningGoal.goals.${goalId}.title`)}</h3>
                {selectedGoal === goalId && (
                  <CheckCircleIcon className="w-6 h-6 text-indigo-600" />
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-left mt-2">
                {t(`onboarding.learningGoal.goals.${goalId}.description`)}
              </p>
            </div>
          ))}
        </div>

        <Button
          onClick={handleNext}
          disabled={!selectedGoal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl py-4 px-8 rounded-lg shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {t('onboarding.learningGoal.next')}
          <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
        </Button>
      </div>
    </div>
  )
}

export default LearningGoalPage
