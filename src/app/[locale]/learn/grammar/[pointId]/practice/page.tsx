'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useI18n } from '@/i18n/I18nContext'
import type { Exercise, ExerciseFile } from '@/lib/grammar/types'
import type { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import type { SessionStatistics } from '@/lib/review-engine/core/session.types'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { LoadingOverlay } from '@/components/ui/Loading'

export default function PracticePage() {
  const { t } = useI18n()
  const { user } = useAuth()
  const { isPremium } = useSubscription()
  const router = useRouter()
  const params = useParams<{ locale: string; pointId: string }>()
  const locale = params?.locale ?? 'en'
  const pointId = params?.pointId
  const [exerciseData, setExerciseData] = useState<ExerciseFile | null>(null)
  const [exerciseLevel, setExerciseLevel] = useState<string | null>(null)
  const [liteReady, setLiteReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [shouldLoadSessionUI, setShouldLoadSessionUI] = useState(false)

  const ReviewSessionUI = useMemo(
    () =>
      shouldLoadSessionUI
        ? dynamic(() => import('@/components/review-engine/ReviewSessionUI'), {
            loading: () => <LoadingOverlay isLoading={true} />,
            ssr: false,
          })
        : null,
    [shouldLoadSessionUI]
  )

  useEffect(() => {
    let isMounted = true

    if (!pointId) {
      setError('Invalid grammar point')
      setLoading(false)
      return () => {
        isMounted = false
      }
    }

    setExerciseLevel(null)
    setLiteReady(false)

    const loadExercises = async () => {
      try {
        const levels = ['n5', 'n4', 'n3', 'n2', 'n1']
        let resolvedLevel: string | null = null
        let exerciseResponse: Response | null = null

        try {
          const indexResponse = await fetch('/data/grammar/points-index.json')
          if (indexResponse.ok) {
            const indexData = await indexResponse.json()
            const mappedLevel = indexData?.points?.[pointId]
            if (typeof mappedLevel === 'string') {
              resolvedLevel = mappedLevel
            }
          }
        } catch (err) {
          console.warn('[Grammar Practice] Failed to load points index map:', err)
        }

        const levelCandidates = resolvedLevel
          ? [resolvedLevel, ...levels.filter((level) => level !== resolvedLevel)]
          : levels

        for (const level of levelCandidates) {
          try {
            if (!liteReady) {
              const maybeLite = await fetch(
                `/data/grammar/exercises/${level}/${pointId}.lite.json`
              )
              if (maybeLite.ok && isMounted) {
                setLiteReady(true)
              }
            }
            const maybeExercise = await fetch(`/data/grammar/exercises/${level}/${pointId}.json`)
            if (maybeExercise.ok) {
              exerciseResponse = maybeExercise
              setExerciseLevel(level)
              break
            }
          } catch (err) {
            console.warn(`[Grammar Practice] Failed to load level ${level}:`, err)
          }
        }

        if (!exerciseResponse || !exerciseResponse.ok) {
          throw new Error('Exercises not found')
        }

        const data = await exerciseResponse.json()
        if (!isMounted) return
        setExerciseData(data)
        setLoading(false)
      } catch (err) {
        if (!isMounted) return
        const message = err instanceof Error ? err.message : 'Failed to load exercises'
        setError(message)
        setLoading(false)
      }
    }

    loadExercises()

    return () => {
      isMounted = false
    }
  }, [pointId])

  const reviewContent = useMemo<ReviewableContent[]>(() => {
    if (!exerciseData) return []

    const difficultyMap: Record<Exercise['difficulty'], number> = {
      easy: 0.25,
      medium: 0.55,
      hard: 0.8,
    }

    const buildTags = (exercise: Exercise, extraTags: string[] = []) => {
      const tags = ['grammar', `grammar:${exerciseData.grammarPointId}`, exercise.type, exercise.difficulty]
      return [...tags, ...extraTags]
    }

    const normalizeJapanese = (value: string) => value.replace(/[。！？]\s*$/u, '')

    const toReviewable = (exercise: Exercise): ReviewableContent[] => {
      if (exercise.type === 'sentence-matching') {
        return exercise.pairs.map((pair, index) => {
          const baseAnswer = pair.japanese
          const altAnswers = new Set<string>([baseAnswer, normalizeJapanese(baseAnswer)])
          return {
            id: `${exercise.id}-pair-${index + 1}`,
            contentType: 'grammar',
            primaryDisplay: `Translate to Japanese: ${pair.english}`,
            secondaryDisplay: pair.romaji ? `Romaji: ${pair.romaji}` : undefined,
            tertiaryDisplay: pair.romaji ? `Romaji: ${pair.romaji}` : undefined,
            primaryAnswer: baseAnswer,
            alternativeAnswers: Array.from(altAnswers),
            difficulty: difficultyMap[exercise.difficulty],
            tags: buildTags(exercise, ['sentence']),
            source: 'Grammar Stall',
            supportedModes: ['recall'],
            preferredMode: 'recall',
          }
        })
      }

      if (exercise.type === 'multiple-choice') {
        const correctOption = exercise.options.find(option => option.id === exercise.correctAnswer)
        const answerText = correctOption?.text ?? exercise.correctAnswer
        const optionsText = exercise.options.map(option => option.text).join(' / ')
        const tertiaryParts: string[] = []
        if (exercise.questionRomaji) {
          tertiaryParts.push(`Romaji: ${exercise.questionRomaji}`)
        }
        if (optionsText) {
          tertiaryParts.push(`Options: ${optionsText}`)
        }

        return [{
          id: exercise.id,
          contentType: 'grammar',
          primaryDisplay: exercise.question,
          secondaryDisplay: exercise.questionRomaji ? `Romaji: ${exercise.questionRomaji}` : undefined,
          tertiaryDisplay: tertiaryParts.length > 0 ? tertiaryParts.join('\n') : undefined,
          primaryAnswer: answerText,
          alternativeAnswers: [],
          difficulty: difficultyMap[exercise.difficulty],
          tags: buildTags(exercise),
          source: 'Grammar Stall',
          supportedModes: ['recall'],
          preferredMode: 'recall',
        }]
      }

      const baseAnswer = exercise.correctAnswer
      const altAnswers = new Set<string>(exercise.acceptedVariations || [])
      altAnswers.add(baseAnswer)
      altAnswers.add(normalizeJapanese(baseAnswer))

      const hintText = exercise.hints && exercise.hints.length > 0
        ? `Hints: ${exercise.hints.join(', ')}`
        : undefined

      return [{
        id: exercise.id,
        contentType: 'grammar',
        primaryDisplay: exercise.question,
        secondaryDisplay: exercise.questionRomaji ? `Romaji: ${exercise.questionRomaji}` : undefined,
        tertiaryDisplay: hintText,
        primaryAnswer: baseAnswer,
        alternativeAnswers: Array.from(altAnswers),
        difficulty: difficultyMap[exercise.difficulty],
        tags: buildTags(exercise),
        source: 'Grammar Stall',
        supportedModes: ['recall'],
        preferredMode: 'recall',
      }]
    }

    return exerciseData.exercises.flatMap(toReviewable)
  }, [exerciseData])

  useEffect(() => {
    if (!loading && !error && reviewContent.length > 0) {
      setShouldLoadSessionUI(true)
    }
  }, [loading, error, reviewContent.length])

  const handleReviewComplete = async (statistics: SessionStatistics) => {
    console.log('[Grammar Practice] Session complete:', statistics)

    if (!user?.uid || !exerciseData) return
    const levelTag = exerciseLevel ? exerciseLevel.toUpperCase() : undefined
    const exerciseIds = reviewContent.map(item => item.id)

    try {
      const { GrammarProgressManager } = await import(
        '@/lib/review-engine/progress/GrammarProgressManager'
      )
      const manager = GrammarProgressManager.getInstance()
      await manager.trackSessionFromStatistics(
        exerciseData.grammarPointId,
        statistics,
        user,
        isPremium ?? false,
        {
          mode: 'recall',
          jlptLevel: levelTag,
          exerciseIds,
        }
      )
    } catch (err) {
      console.error('[Grammar Practice] Failed to persist session:', err)
    }
  }

  const handleCancel = () => {
    if (pointId) {
      router.push(`/${locale}/learn/grammar/${pointId}`)
      return
    }
    router.push(`/${locale}/learn/grammar`)
  }

  if (loading && !liteReady) {
    return (
      <LoadingOverlay
        isLoading={true}
        message={t('grammarStall.practiceUi.loading')}
        showDoshi={true}
        fullScreen={true}
      />
    )
  }

  if (!loading && (error || !exerciseData)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">😕</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('grammarStall.practiceUi.notFoundTitle')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('grammarStall.practiceUi.notFoundBody')}
          </p>
          {pointId && (
            <Link
              href={`/${locale}/learn/grammar/${pointId}`}
              className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
            >
              {t('grammarStall.practiceUi.backToPoint')}
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (!loading && reviewContent.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">🧩</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {t('grammarStall.practiceUi.notFoundTitle')}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('grammarStall.practiceUi.notFoundBody')}
          </p>
          {pointId && (
            <Link
              href={`/${locale}/learn/grammar/${pointId}`}
              className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700"
            >
              {t('grammarStall.practiceUi.backToPoint')}
            </Link>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <PageHeader title={t('grammarStall.practice')} backHref={`/${locale}/learn/grammar`} />

      <div className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="relative min-h-[320px] rounded-2xl border border-gray-200 dark:border-dark-700 bg-white/70 dark:bg-dark-800/70">
            <LoadingOverlay
              isLoading={true}
              message={t('grammarStall.practiceUi.loading')}
              showDoshi={true}
              fullScreen={false}
            />
          </div>
        ) : ReviewSessionUI ? (
          <ReviewSessionUI
            content={reviewContent}
            userId={user?.uid || 'anonymous'}
            mode="recall"
            onComplete={handleReviewComplete}
            onCancel={handleCancel}
            shuffle={false}
          />
        ) : (
          <LoadingOverlay isLoading={true} fullScreen={false} />
        )}
      </div>

      <MobileNavSpacer />
    </div>
  )
}
