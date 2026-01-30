'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useI18n, useLocalePath } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import BlastSession from './BlastSession'
import { BlastItem, BlastStep, BlastSessionStats, BlastLessonInfo, BlastContentType } from '@/lib/blast-mode/types'
import { loadBlastData, loadBlastLessonData } from '@/lib/blast-mode/loadBlastData'
import { useSubscription } from '@/hooks/useSubscription'
import { useFeature } from '@/hooks/useFeature'

function LearnContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading, isGuest } = useAuth()
  const { isPremium } = useSubscription()
  const { checkOnly, checkAndTrack } = useFeature('blast_mode')
  const { t } = useI18n()
  const { getLocalePath } = useLocalePath()
  const { showToast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<BlastItem[]>([])
  const [steps, setSteps] = useState<BlastStep[]>([])
  const [lessonInfo, setLessonInfo] = useState<BlastLessonInfo | null>(null)
  const [sessionId] = useState(`blast-${Date.now()}`)
  const entitlementCheckedRef = useRef(false)
  const completionTrackedRef = useRef(false)

  // Get session parameters
  const sessionSize = parseInt(searchParams.get('size') || '10')
  const mode = searchParams.get('mode') || 'session'
  const contentType: BlastContentType = (mode === 'lesson' ? 'kanji' : (searchParams.get('type') || 'kanji')) as BlastContentType
  const level = searchParams.get('level') || 'N5'
  const listId = searchParams.get('listId') || undefined
  const selectedKanji = searchParams.get('kanji')?.split(',').filter(Boolean)
  const lessonIndex = parseInt(searchParams.get('lesson') || '0', 10)

  useEffect(() => {
    if (authLoading) return

    if (!user && !isGuest) {
      router.push(getLocalePath('/auth/signin'))
      return
    }

    // Feature flag removed - Blast Mode is now always available

    entitlementCheckedRef.current = false
    completionTrackedRef.current = false
    void handleEntitlementAndLoad()
  }, [
    authLoading,
    user,
    isGuest,
    contentType,
    sessionSize,
    level,
    listId,
    selectedKanji?.join(','),
    mode,
    lessonIndex,
    isPremium,
    checkOnly
  ])

  const handleEntitlementAndLoad = async () => {
    if (entitlementCheckedRef.current) {
      await loadData()
      return
    }

    entitlementCheckedRef.current = true
    const decision = await checkOnly({ failOpen: false })
    if (!decision.allow) {
      const action = !isPremium
        ? { label: t('subscription.actions.upgrade'), onClick: () => router.push('/pricing') }
        : undefined
      showToast(t('entitlements.messages.limitReached'), 'warning', 5000, action)
      router.push(getLocalePath('/tools/blast-mode'))
      return
    }

    await loadData()
  }

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load blast mode data and generate steps
      if (mode === 'lesson') {
        const { items: loadedItems, steps: loadedSteps, lesson } = await loadBlastLessonData(
          level,
          lessonIndex,
          user?.uid || 'guest'
        )
        setLessonInfo(lesson)
        setItems(loadedItems)
        setSteps(loadedSteps)
      } else {
        setLessonInfo(null)
        const { items: loadedItems, steps: loadedSteps } = await loadBlastData(
          contentType,
          sessionSize,
          level,
          user?.uid || 'guest',
          isPremium ?? false,
          listId,
          selectedKanji
        )

        setItems(loadedItems)
        setSteps(loadedSteps)
      }
    } catch (err) {
      console.error('Failed to load blast mode data:', err)
      setError(t('blastMode.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSessionComplete = (stats: BlastSessionStats) => {
    console.log('Session completed:', stats)
    if (completionTrackedRef.current) return
    completionTrackedRef.current = true
    void checkAndTrack({ showUI: true })
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <LoadingOverlay isLoading={true} message={t('blastMode.loading.session')} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push(getLocalePath('/tools/blast-mode'))}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            {t('blastMode.buttons.backToSetup')}
          </button>
        </div>
      </div>
    )
  }

  if (!user && !isGuest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
        <LoadingOverlay isLoading={true} message={t('blastMode.loading.redirecting')} />
      </div>
    )
  }

  return (
    <BlastSession
      items={items}
      steps={steps}
      userId={user?.uid || 'guest'}
      sessionId={sessionId}
      contentType={contentType}
      level={level}
      listId={listId}
      selectedKanji={selectedKanji}
      isPremium={isPremium ?? false}
      mode={mode === 'lesson' ? 'lesson' : 'session'}
      lesson={lessonInfo || undefined}
      onComplete={handleSessionComplete}
    />
  )
}

function SuspenseFallback() {
  const { t } = useI18n()
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850 flex items-center justify-center">
      <LoadingOverlay isLoading={true} message={t('blastMode.loading.default')} />
    </div>
  )
}

export default function BlastLearnPage() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <LearnContent />
    </Suspense>
  )
}
