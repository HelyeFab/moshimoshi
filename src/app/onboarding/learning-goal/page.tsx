'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { ArrowRightIcon } from '@heroicons/react/24/outline'

const learningGoals = [
  {
    id: 'jlpt',
    title: 'Prepare for the JLPT',
    description: 'Focus on vocabulary, grammar, and kanji for a specific JLPT level.',
  },
  {
    id: 'travel',
    title: 'Learn for Travel',
    description: 'Master essential phrases and vocabulary for your trip to Japan.',
  },
  {
    id: 'anime',
    title: 'Understand Anime/Manga',
    description: 'Dive deep into the language of your favorite Japanese media.',
  },
  {
    id: 'conversation',
    title: 'Improve Conversation Skills',
    description: 'Practice speaking and listening with real-world scenarios.',
  },
]

const LearningGoalPage = () => {
  const router = useRouter()
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null)

  const handleSelectGoal = (goalId: string) => {
    setSelectedGoal(goalId)
  }

  const handleNext = () => {
    // We will save the goal later
    router.push('/onboarding/experience-level')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">What&apos;s your main goal?</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
          This will help us personalize your learning experience.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {learningGoals.map(goal => (
            <div
              key={goal.id}
              onClick={() => handleSelectGoal(goal.id)}
              className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                selectedGoal === goal.id
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-indigo-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-lg">{goal.title}</h3>
                {selectedGoal === goal.id && (
                  <CheckCircleIcon className="w-6 h-6 text-indigo-600" />
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-left mt-2">{goal.description}</p>
            </div>
          ))}
        </div>

        <Button
          onClick={handleNext}
          disabled={!selectedGoal}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl py-4 px-8 rounded-lg shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Next
          <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
        </Button>
      </div>
    </div>
  )
}

export default LearningGoalPage
