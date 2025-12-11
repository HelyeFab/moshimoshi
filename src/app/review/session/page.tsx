'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import ReviewEngine from '@/components/review-engine/ReviewEngine'
import { ReviewableContent } from '@/lib/review-engine/core/interfaces'
import { useAuth } from '@/hooks/useAuth'
import { LoadingOverlay } from '@/components/ui/Loading'
import { useI18n } from '@/i18n/I18nContext'
import { EventEmitter } from 'events'
import { gamificationListener } from '@/lib/gamification/gamificationListener'
import { ReviewEventType } from '@/lib/review-engine/core/events'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

// Global URE event emitter for gamification integration
const ureEventEmitter = new EventEmitter()

// Flag to ensure listener is only initialized once
let listenerInitialized = false

export default function ReviewSessionPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { t } = useI18n()
  const [reviewContent, setReviewContent] = useState<ReviewableContent[]>([])
  const [loading, setLoading] = useState(true)
  const initializedRef = useRef(false)

  // Initialize gamification listener (same pattern as Kana/Kanji browsers)
  useEffect(() => {
    if (user?.uid && !listenerInitialized) {
      console.log('[Review Session] Initializing gamification listener for user:', user.uid)
      gamificationListener.initialize(user.uid, ureEventEmitter)
      listenerInitialized = true
    }
  }, [user?.uid])

  useEffect(() => {
    // Prevent double execution in StrictMode
    if (initializedRef.current) {
      console.log('[Review Session] Already initialized, skipping')
      return
    }

    console.log('[Review Session] Page loading...')

    // Get review items from sessionStorage (set by UpcomingReviews or other components)
    const storedItems = sessionStorage.getItem('reviewItems')
    console.log(
      '[Review Session] SessionStorage content:',
      storedItems ? 'Found items' : 'No items'
    )

    if (storedItems) {
      try {
        const items = JSON.parse(storedItems)
        console.log('[Review Session] Parsed items:', items.length, 'items')
        setReviewContent(items)
        initializedRef.current = true
        setLoading(false)
        // Clear sessionStorage after loading
        sessionStorage.removeItem('reviewItems')
      } catch (error) {
        console.error('[Review Session] Failed to parse review items:', error)
        router.push('/review-dashboard')
      }
    } else {
      console.log('[Review Session] No items in sessionStorage, redirecting to dashboard')
      // No items to review, go back to dashboard
      router.push('/review-dashboard')
    }
  }, [router])

  const handleReviewComplete = async (statistics: any) => {
    console.log('[Review Session] Completed with stats:', statistics)

    // Emit URE SESSION_COMPLETED event for gamification system
    const sessionId = `review_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    console.log('[Review Session] About to emit SESSION_COMPLETED event...')
    console.log(
      '[Review Session] Listener count:',
      ureEventEmitter.listenerCount(ReviewEventType.SESSION_COMPLETED)
    )

    ureEventEmitter.emit(ReviewEventType.SESSION_COMPLETED, {
      data: {
        sessionId,
        statistics: {
          totalItems: statistics.totalItems || 0,
          correctItems: statistics.correctItems || 0,
          accuracy: statistics.accuracy || 0,
          averageResponseTime: statistics.averageResponseTime || 0,
          bestStreak: statistics.bestStreak || 0,
        },
        duration: statistics.duration || 0,
      },
    })

    console.log('[Review Session] Emitted SESSION_COMPLETED event for gamification:', {
      sessionId,
      correctItems: statistics.correctItems,
      accuracy: statistics.accuracy,
      averageResponseTime: statistics.averageResponseTime,
      bestStreak: statistics.bestStreak,
      duration: statistics.duration,
    })

    // Set flag to trigger refresh on dashboard
    sessionStorage.setItem('reviewCompleted', 'true')

    // Dispatch custom event
    window.dispatchEvent(new Event('reviewCompleted'))

    // Navigate back to dashboard after review
    router.push('/review-dashboard')
  }

  const handleCancel = () => {
    router.push('/review-dashboard')
  }

  if (loading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message={t('review.preparingSession')}
        showDoshi={true}
        fullScreen={true}
      />
    )
  }

  if (!reviewContent || reviewContent.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">{t('review.noItems')}</h2>
          <button
            onClick={() => router.push('/review-dashboard')}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            {t('common.back')}
          </button>
        </div>
        <MobileNavSpacer />
      </div>
    )
  }

  return (
    <ReviewEngine
      content={reviewContent}
      mode="recognition"
      onComplete={handleReviewComplete}
      onCancel={handleCancel}
      userId={user?.uid || 'anonymous'}
    />
  )
}
