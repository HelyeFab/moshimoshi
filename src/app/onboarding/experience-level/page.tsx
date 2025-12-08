'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { CheckCircleIcon } from '@heroicons/react/24/solid'
import { ArrowRightIcon } from '@heroicons/react/24/outline'

const experienceLevels = [
  {
    id: 'beginner',
    title: 'Beginner',
    description: "I'm just starting out, or know a few words and phrases.",
  },
  {
    id: 'intermediate',
    title: 'Intermediate',
    description: 'I can have basic conversations and understand some grammar.',
  },
  {
    id: 'advanced',
    title: 'Advanced',
    description: 'I can understand and express complex ideas in Japanese.',
  },
]

const ExperienceLevelPage = () => {
  const router = useRouter()
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null)

  const handleSelectLevel = (levelId: string) => {
    setSelectedLevel(levelId)
  }

  const handleNext = () => {
    // We will save the level later
    router.push('/onboarding/feature-showcase')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-2xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">What&apos;s your Japanese level?</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
          This helps us recommend the right content for you.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {experienceLevels.map(level => (
            <div
              key={level.id}
              onClick={() => handleSelectLevel(level.id)}
              className={`p-6 rounded-lg border-2 cursor-pointer transition-all ${
                selectedLevel === level.id
                  ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30'
                  : 'border-gray-200 dark:border-gray-700 hover:border-indigo-500'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-lg">{level.title}</h3>
                {selectedLevel === level.id && (
                  <CheckCircleIcon className="w-6 h-6 text-indigo-600" />
                )}
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-left text-sm">
                {level.description}
              </p>
            </div>
          ))}
        </div>

        <Button
          onClick={handleNext}
          disabled={!selectedLevel}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl py-4 px-8 rounded-lg shadow-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Next
          <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
        </Button>
      </div>
    </div>
  )
}

export default ExperienceLevelPage
