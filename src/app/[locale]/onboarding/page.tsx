'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { useTranslation } from '@/hooks/useTranslation'
import DoshiMascot from '@/components/ui/DoshiMascot'

const OnboardingWelcomePage = () => {
  const router = useRouter()
  const { t } = useTranslation()

  const handleNext = () => {
    router.push('/onboarding/learning-goal')
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center justify-center p-6 pb-24">
      <div className="text-center max-w-lg flex flex-col items-center">
        {/* Logo: Hiragana on top, romaji below */}
        <div className="flex flex-col items-center mb-6">
          <span
            className="font-bold text-primary-500 dark:text-primary-400"
            style={{
              fontFamily: 'var(--font-family-logo-japanese)',
              fontSize: '4rem',
              lineHeight: 1,
              letterSpacing: '0.05em',
            }}
          >
            もしもし
          </span>
          <span
            className="font-medium text-gray-500 dark:text-gray-400 opacity-70 mt-2"
            style={{
              fontSize: '1.25rem',
              lineHeight: 1,
              letterSpacing: '0.15em',
              textTransform: 'lowercase',
            }}
          >
            moshimoshi
          </span>
        </div>
        <DoshiMascot size="xlarge" variant="animated" mood="excited" className="mb-6" />
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
          {t('onboarding.welcome.title')}
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
          {t('onboarding.welcome.subtitle')}
        </p>
        <Button
          onClick={handleNext}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl py-6 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all"
        >
          {t('onboarding.welcome.getStarted')}
          <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
        </Button>
      </div>
    </div>
  )
}

export default OnboardingWelcomePage
