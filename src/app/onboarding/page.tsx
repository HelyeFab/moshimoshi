'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import Logo from '@/components/ui/Logo'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@heroicons/react/24/outline'

const OnboardingWelcomePage = () => {
  const router = useRouter()

  const handleNext = () => {
    router.push('/onboarding/learning-goal')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center justify-center p-6">
      <div className="text-center max-w-lg">
        <Logo className="mx-auto h-16 w-auto mb-8" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
          Welcome to Moshimoshi!
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
          The ultimate platform to master the Japanese language. Let&apos;s get you started on your
          learning journey.
        </p>
        <Button
          onClick={handleNext}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl py-6 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all"
        >
          Get Started
          <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
        </Button>
      </div>
    </div>
  )
}

export default OnboardingWelcomePage
