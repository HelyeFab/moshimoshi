'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import EnhancedArticleReader from '@/components/news/EnhancedArticleReaderFinal'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useCachedArticle } from '@/hooks/useArticleCache'
import { useFeature } from '@/hooks/useFeature'
import { getUsageSnapshotEntry, hasOfflineItemSeen, markOfflineItemSeen } from '@/lib/pwa/offline-usage'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'

export default function NewsArticlePage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useI18n()
  const { user } = useAuth()
  const { checkAndTrack } = useFeature('news')
  const [hasAccess, setHasAccess] = useState<boolean | null>(null)

  // Use cache-first article fetching
  const articleId = typeof params.id === 'string' ? params.id : null
  const { article, loading, error, fromCache } = useCachedArticle(articleId)
  const cachedRepeatAllowed = Boolean(
    fromCache &&
      articleId &&
      (() => {
        const entry = getUsageSnapshotEntry('news')
        return entry?.resetAtUtc && hasOfflineItemSeen('news', articleId, entry.resetAtUtc)
      })()
  )

  useEffect(() => {
    if (!articleId) return
    let isActive = true
    setHasAccess(cachedRepeatAllowed ? true : null)
    checkAndTrack({ showUI: true, metadata: { itemId: articleId } }).then(allowed => {
      if (!isActive) return
      if (!allowed) {
        setHasAccess(false)
        router.replace('/news')
      } else {
        setHasAccess(true)
        const entry = getUsageSnapshotEntry('news')
        if (entry?.resetAtUtc) {
          markOfflineItemSeen('news', articleId, entry.resetAtUtc)
        }
      }
    })
    return () => {
      isActive = false
    }
  }, [articleId, cachedRepeatAllowed, checkAndTrack, router])

  const handleBack = () => {
    // On mobile, go to dashboard; on desktop, go to news list
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
    router.push(isMobile ? '/dashboard' : '/news')
  }

  if (loading || (!cachedRepeatAllowed && hasAccess === null)) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-dark-850">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-dark-400">{t('common.loading')}</p>
          </div>
        </div>
      </div>
    )
  }

  if (hasAccess === false) {
    return null
  }

  if (error || !article) {
    return (
      <div className="min-h-screen bg-background-light dark:bg-dark-850">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">
              {error || t('news.error.articleNotFound')}
            </p>
            <button
              onClick={handleBack}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              {t('news.backToNews')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background-light dark:bg-dark-850">
      <EnhancedArticleReader article={article} onBack={handleBack} />
      <MobileNavSpacer />
    </div>
  )
}
