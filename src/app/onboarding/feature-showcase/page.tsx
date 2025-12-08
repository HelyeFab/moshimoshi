'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  PlayIcon,
  SparklesIcon,
  CloudArrowUpIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

const features = [
  {
    icon: <PlayIcon className="w-12 h-12 text-blue-500" />,
    title: 'YouTube Shadowing',
    description: 'Learn from native speakers by shadowing real YouTube videos.',
  },
  {
    icon: <SparklesIcon className="w-12 h-12 text-purple-500" />,
    title: 'Kanji Connection',
    description: 'Master kanji visually by understanding their connections and patterns.',
  },
  {
    icon: <CloudArrowUpIcon className="w-12 h-12 text-green-500" />,
    title: 'Anki Import',
    description: 'Bring your existing Anki decks and study them with our powerful SRS.',
  },
]

const FeatureShowcasePage = () => {
  const router = useRouter()

  const handleNext = () => {
    router.push('/onboarding/ready-to-go')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          Discover what makes Moshimoshi special
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-12">
          Here are a few of the powerful features that will accelerate your learning.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {features.map((feature, index) => (
            <div key={index} className="p-6 rounded-lg bg-gray-50 dark:bg-gray-800">
              <div className="flex justify-center mb-4">{feature.icon}</div>
              <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
            </div>
          ))}
        </div>

        <Button
          onClick={handleNext}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl py-4 px-8 rounded-lg shadow-lg"
        >
          Continue
          <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
        </Button>
      </div>
    </div>
  )
}

export default FeatureShowcasePage
