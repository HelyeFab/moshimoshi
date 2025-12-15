'use client'

import React, { Suspense, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ArrowRightIcon } from '@heroicons/react/24/outline'
import { FeatureCarousel } from '../components/FeatureCarousel'
import { useTranslation } from '@/hooks/useTranslation'
import {
  getRecommendedFeatures,
  type LearningGoal,
  type ExperienceLevel,
} from '../config'

function FeatureShowcaseContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useTranslation()

  // Get params from URL
  const goal = searchParams.get('goal') as LearningGoal | null
  const level = searchParams.get('level') as ExperienceLevel | null

  // Get personalized features based on goal (show 4 features)
  const recommendedFeatures = getRecommendedFeatures(goal, 4)

  // Get the personalized headline based on goal using i18n
  const headline = useMemo(() => {
    if (goal) {
      return {
        title: t(`onboarding.featureShowcase.personalizedHeadlines.${goal}.title`),
        subtitle: t(`onboarding.featureShowcase.personalizedHeadlines.${goal}.subtitle`),
      }
    }
    return {
      title: t('onboarding.featureShowcase.defaultHeadline.title'),
      subtitle: t('onboarding.featureShowcase.defaultHeadline.subtitle'),
    }
  }, [goal, t])

  // Build feature strings from i18n
  const featureStrings = useMemo(() => {
    const featureIds = ['shadowing', 'kanjiConnection', 'kanjiBrowser', 'kanjiMoods', 'conjugation', 'news', 'stories', 'library', 'anki', 'textbooks', 'flashcards', 'drill']
    const strings: Record<string, { title: string; description: string; highlight?: string }> = {}

    featureIds.forEach(id => {
      strings[id] = {
        title: t(`onboarding.featureShowcase.features.${id}.title`),
        description: t(`onboarding.featureShowcase.features.${id}.description`),
        highlight: t(`onboarding.featureShowcase.features.${id}.highlight`),
      }
    })

    return strings
  }, [t])

  const handleNext = () => {
    // Forward all params to the final page
    const params = new URLSearchParams()
    if (goal) params.set('goal', goal)
    if (level) params.set('level', level)
    router.push(`/onboarding/ready-to-go?${params.toString()}`)
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white flex flex-col items-center justify-start pt-8 md:justify-center md:pt-0 p-6 pb-24 overflow-y-auto">
      <div className="text-center max-w-2xl w-full">
        {/* Personalized Header */}
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{headline.title}</h1>
        <p className="text-lg text-gray-600 dark:text-gray-300 mb-10">{headline.subtitle}</p>

        {/* Swipeable Feature Carousel */}
        <FeatureCarousel features={recommendedFeatures} featureStrings={featureStrings} />

        {/* Continue Button */}
        <div className="mt-10">
          <Button
            onClick={handleNext}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xl py-4 px-8 rounded-lg shadow-lg"
          >
            {t('onboarding.featureShowcase.continue')}
            <ArrowRightIcon className="w-5 h-5 ml-2 inline" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default function FeatureShowcasePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-indigo-600 rounded-full border-t-transparent" />
      </div>
    }>
      <FeatureShowcaseContent />
    </Suspense>
  )
}
