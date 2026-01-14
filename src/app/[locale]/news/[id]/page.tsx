'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import EnhancedArticleReader from '@/components/news/EnhancedArticleReaderFinal'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useCachedArticle } from '@/hooks/useArticleCache'
import { useFeature } from '@/hooks/useFeature'

export default function NewsArticlePage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useI18n()
  const { user } = useAuth()
  const { checkAndTrack } = useFeature('news')

  // Use cache-first article fetching
  const articleId = typeof params.id === 'string' ? params.id : null
  const { article, loading, error, fromCache } = useCachedArticle(articleId)

  useEffect(() => {
    if (!articleId) return
    checkAndTrack({ showUI: true, metadata: { itemId: articleId } }).then(allowed => {
      if (!allowed) {
        router.push('/news')
      }
    })
  }, [articleId, checkAndTrack, router])

  const handleBack = () => {
    router.push('/news')
  }

  if (loading) {
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
      {/* Cache indicator for development - shows if article was served from cache */}
      {process.env.NODE_ENV === 'development' && fromCache && (
        <div className="fixed bottom-20 left-4 z-50 px-3 py-1.5 bg-green-500 text-white text-xs font-medium rounded-full shadow-lg">
          📦 From Cache
        </div>
      )}
      <EnhancedArticleReader article={article} onBack={handleBack} />
      <MobileNavSpacer />
    </div>
  )
}
