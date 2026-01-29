'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useI18n, useLocalePath } from '@/i18n/I18nContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import BlastSession from './BlastSession'
import { BlastItem, BlastStep, BlastSessionStats } from '@/lib/blast-mode/types'
import { loadKanjiItems, kanjiToBlastItem } from '@/lib/blast-mode/adapters/kanji.adapter'
import { loadVocabItems } from '@/lib/blast-mode/adapters/vocab.adapter'
import { generateBlastSteps } from '@/lib/blast-mode/step-generator'
import { listToBlastItems } from '@/lib/blast-mode/adapters/list.adapter'
import { buildDistractorPool } from '@/lib/blast-mode/distractor-pool'
import { JLPTLevel } from '@/types/kanji'
import { listManager } from '@/lib/lists/ListManager'
import { useSubscription } from '@/hooks/useSubscription'
import type { ListItem } from '@/types/userLists'
import { kanjiService } from '@/services/kanjiService'
import { isFeatureEnabled } from '@/lib/features/featureFlags'

/**
 * Load items and generate steps based on content type
 * Uses Agent B's adapters and step generator
 */
async function loadBlastData(
  contentType: string,
  size: number,
  level: string,
  userId: string,
  isPremium: boolean,
  listId?: string,
  selectedKanji?: string[]
): Promise<{ items: BlastItem[], steps: BlastStep[] }> {
  let items: BlastItem[] = []
  let listItems: ListItem[] = []

  try {
    if (contentType === 'kanji') {
      if (selectedKanji && selectedKanji.length > 0) {
        const kanjiMap = await kanjiService.getMultipleKanjiDetails(selectedKanji)
        const selected = selectedKanji
          .map(k => kanjiMap.get(k))
          .filter((k): k is NonNullable<typeof k> => Boolean(k))
        items = selected.map(kanjiToBlastItem)
      } else {
      // Load kanji items
        items = await loadKanjiItems({
          level: level as JLPTLevel,
          count: size,
          selection: 'random'
        })
      }
    } else if (contentType === 'vocabulary') {
      // Load vocabulary items
      items = await loadVocabItems({
        count: size,
        level,
        selection: 'common'
      })
    } else if (contentType === 'mixed') {
      // Load mix of kanji and vocabulary
      const kanjiCount = Math.floor(size / 2)
      const vocabCount = size - kanjiCount

      const kanjiItems = await loadKanjiItems({
        level: level as JLPTLevel,
        count: kanjiCount,
        selection: 'random'
      })

      const vocabItems = await loadVocabItems({
        count: vocabCount,
        level,
        selection: 'common'
      })

      items = [...kanjiItems, ...vocabItems]
      // Shuffle mixed items
      items = shuffleArray(items)
    } else if (contentType === 'list' || contentType === 'sentence') {
      if (!listId) {
        throw new Error('Missing listId for list content type')
      }

      const lists = await listManager.getLists(userId, isPremium)
      const list = lists.find(l => l.id === listId)
      if (!list) {
        throw new Error('List not found')
      }

      if (contentType === 'sentence' && list.type !== 'sentence') {
        throw new Error('List is not a sentence list')
      }

      listItems = list.items
      items = listToBlastItems({ list, count: size })
    }

    const pool = await buildDistractorPool({
      contentType,
      level: level as JLPTLevel,
      size,
      items,
      listItems
    })

    // Generate steps using Agent B's step generator
    const steps = generateBlastSteps(items, pool)

    return { items, steps }
  } catch (error) {
    console.error('Failed to load blast data:', error)
    throw error
  }
}

/**
 * Shuffle array
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

function LearnContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: authLoading, isGuest } = useAuth()
  const { isPremium } = useSubscription()
  const { t } = useI18n()
  const { getLocalePath } = useLocalePath()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<BlastItem[]>([])
  const [steps, setSteps] = useState<BlastStep[]>([])
  const [sessionId] = useState(`blast-${Date.now()}`)

  // Get session parameters
  const sessionSize = parseInt(searchParams.get('size') || '10')
  const contentType = searchParams.get('type') || 'kanji'
  const level = searchParams.get('level') || 'N5'
  const listId = searchParams.get('listId') || undefined
  const selectedKanji = searchParams.get('kanji')?.split(',').filter(Boolean)

  useEffect(() => {
    if (authLoading) return

    if (!user && !isGuest) {
      router.push(getLocalePath('/auth/signin'))
      return
    }

    if (!isFeatureEnabled('BLAST_MODE')) {
      router.push(getLocalePath('/dashboard'))
      return
    }

    loadData()
  }, [authLoading, user, isGuest])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load real data using Agent B's adapters and step generator
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
    } catch (err) {
      console.error('Failed to load blast mode data:', err)
      setError(t('blastMode.errors.loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSessionComplete = (stats: BlastSessionStats) => {
    console.log('Session completed:', stats)
    // TODO: Save stats to backend
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
