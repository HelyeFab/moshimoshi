'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BookOpen, Sparkles, MapPin, BookMarked } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import { LoadingOverlay } from '@/components/ui/Loading'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useAuth } from '@/hooks/useAuth'
import { useComicCache } from '@/hooks/useComicCache'
import { ComicEpisode, ComicSeries } from '@/types/comic'
import type { CachedComicEpisode } from '@/lib/comics/comic-cache.types'
import { getValidatedEntitlementsSnapshot, isOffline } from '@/lib/pwa/offline-entitlements'
import {
  FeatureUsageIndicator,
  DesktopCircularIndicator,
  useFeatureUsage
} from '@/components/entitlements/FeatureUsageIndicator'


function ComicsContent() {
  const { user, loading: authLoading } = useAuth()
  const { prefetchEpisodes, getCachedIds, getEpisode } = useComicCache()
  const usageData = useFeatureUsage('comics')

  const [series, setSeries] = useState<ComicSeries | null>(null)
  const [episodes, setEpisodes] = useState<ComicEpisode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 12
  const offlineLimit = 10

  const normalizeCachedEpisode = (episode: CachedComicEpisode): ComicEpisode => ({
    ...episode,
    publishedAt: episode.publishedAt ? new Date(episode.publishedAt) : undefined,
    createdAt: new Date(episode.createdAt),
    updatedAt: episode.updatedAt ? new Date(episode.updatedAt) : new Date(episode.createdAt),
  })

  const loadCachedEpisodes = async () => {
    const cachedIds = await getCachedIds()
    if (cachedIds.length === 0) return []

    const cached = await Promise.all(
      cachedIds.map(async (id) => {
        const result = await getEpisode(id)
        return result.episode
      })
    )

    const normalized = cached.filter(Boolean).map(entry => normalizeCachedEpisode(entry as CachedComicEpisode))
    return normalized
      .sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())
      .slice(0, offlineLimit)
  }

  const loadComics = useCallback(
    async (reset: boolean = false, newOffset?: number) => {
      try {
        setLoading(true)
        setError(null)
        const currentOffset = reset ? 0 : (newOffset !== undefined ? newOffset : offset)
        console.log('[ComicsPage] loadComics called, reset:', reset, 'offset:', currentOffset)

        const snapshot = await getValidatedEntitlementsSnapshot()
        const offlineTier = snapshot?.tier || null

        if (isOffline()) {
          if (offlineTier !== 'premium') {
            setEpisodes([])
            setHasMore(false)
            setLoading(false)
            return
          }

          const cachedEpisodes = await loadCachedEpisodes()
          if (cachedEpisodes.length > 0) {
            setEpisodes(cachedEpisodes)
            setHasMore(false)
            setOffset(0)
            setLoading(false)
            return
          }
          throw new Error('Offline with no cached episodes')
        }

        // Load series info
        const seriesResponse = await fetch('/api/comics/series')
        if (seriesResponse.ok) {
          const seriesData = await seriesResponse.json()
          console.log('[ComicsPage] Series loaded:', seriesData.series?.title)
          setSeries(seriesData.series)
        }

        // Build episodes query params
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: currentOffset.toString(),
          seriesId: 'moshi-goes-to-japan',
        })

        // Load episodes
        console.log('[ComicsPage] Fetching episodes...')
        const episodesResponse = await fetch(`/api/comics/episodes?${params}`)
        if (!episodesResponse.ok) {
          throw new Error('Failed to fetch episodes')
        }

        const episodesData = await episodesResponse.json()
        console.log('[ComicsPage] Episodes loaded:', episodesData.episodes?.length, 'hasMore:', episodesData.hasMore)

        if (reset) {
          setEpisodes(episodesData.episodes || [])
          setOffset(0)
        } else {
          setEpisodes(prev => [...prev, ...(episodesData.episodes || [])])
          setOffset(currentOffset + limit)
        }

        setHasMore(episodesData.hasMore || false)
      } catch (err) {
        console.error('[ComicsPage] Error loading comics:', err)
        setError('Failed to load comics')
        const snapshot = await getValidatedEntitlementsSnapshot()
        if (snapshot?.tier === 'premium') {
          const cachedEpisodes = await loadCachedEpisodes()
          if (cachedEpisodes.length > 0) {
            setEpisodes(cachedEpisodes)
            setHasMore(false)
            setOffset(0)
            setError(null)
            return
          }
        }
        setEpisodes([])
      } finally {
        setLoading(false)
      }
    },
    [offset, limit, getCachedIds, getEpisode]
  )

  // Load on mount
  useEffect(() => {
    console.log('[ComicsPage] Loading comics on mount...')
    loadComics(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Prefetch top 10 episodes for offline use
  useEffect(() => {
    if (episodes.length > 0 && offset === 0) {
      const episodeIds = episodes.slice(0, offlineLimit).map(ep => ep.id)
      prefetchEpisodes(episodeIds, { skipCached: true }).then(result => {
        console.log('[ComicsPage] Prefetch complete:', result)
      })
    }
  }, [episodes, offset, prefetchEpisodes, offlineLimit])

  const handleLoadMore = () => {
    const newOffset = offset + limit
    loadComics(false, newOffset)
  }

  // Show loading state while auth is loading
  if (authLoading) {
    return <LoadingOverlay isLoading={true} message="Loading..." />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-50 via-white to-primary-50/30 dark:from-dark-950 dark:via-dark-900 dark:to-dark-850">
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      {/* Page Header */}
      <PageHeader
        title={series?.title || 'Moshi Goes to Japan'}
        description={
          series?.description || 'Follow Moshi the red panda on adventures across Japan!'
        }
        backHref="/dashboard"
        actions={
          usageData.hasData ? (
            <DesktopCircularIndicator
              remaining={usageData.remaining}
              limitCount={usageData.limitCount}
              usedCount={usageData.usedCount}
              color={usageData.color}
            />
          ) : null
        }
      />
      <FeatureUsageIndicator featureId="comics" />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Series Info Card - Premium Glassmorphism Design */}
        <div className="relative overflow-hidden rounded-3xl mb-10">
          {/* Gradient background layer */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 via-primary-400/10 to-transparent dark:from-primary-500/10 dark:via-primary-400/5" />

          {/* Glassmorphism card */}
          <div className="relative bg-white/70 dark:bg-dark-800/60 backdrop-blur-xl border border-white/50 dark:border-dark-600/50 p-6 sm:p-8">
            <div className="flex flex-col md:flex-row gap-6 items-center">
              {/* Mascot with glow effect */}
              <div className="relative flex-shrink-0">
                <div className="absolute inset-0 bg-primary-400/30 dark:bg-primary-500/20 rounded-full blur-2xl scale-150" />
                <div className="relative">
                  <DoshiMascot size="xlarge" variant="animated" mood="excited" />
                </div>
              </div>

              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-primary-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
                    Weekly Series
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-foreground dark:text-dark-100 mb-2 font-japanese">
                  {series?.titleJa || 'もしの日本旅行'}
                </h2>
                <p className="text-muted-foreground dark:text-dark-300 mb-5 max-w-xl">
                  {series?.descriptionJa ||
                    'レッサーパンダのもしと一緒に日本を冒険しながら日本語を学ぼう！'}
                </p>
                <div className="flex flex-wrap gap-3 justify-center md:justify-start">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
                    <BookMarked className="w-4 h-4" />
                    {series?.publishedEpisodeCount || episodes.length} Episodes
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium">
                    <Sparkles className="w-4 h-4" />
                    New Every Sunday
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && offset === 0 && <LoadingOverlay isLoading={true} />}

        {/* Episodes Grid */}
        {!loading && episodes.length === 0 ? (
          <div className="text-center py-20">
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-primary-400/20 rounded-full blur-3xl scale-150" />
              <div className="relative">
                <DoshiMascot size="xlarge" variant="animated" mood="thinking" />
              </div>
            </div>
            <h3 className="text-2xl font-bold mt-8 mb-3 text-foreground dark:text-dark-100">
              Coming Soon!
            </h3>
            <p className="text-muted-foreground dark:text-dark-400 max-w-md mx-auto mb-6">
              Moshi is preparing for the first adventure in Japan.
              Check back soon for new episodes!
            </p>
            <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-xl text-sm font-medium">
              <Sparkles className="w-4 h-4" />
              New episodes every Sunday
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {episodes.map((episode, index) => (
              <div key={episode.id}>
                <Link href={`/comics/${episode.id}`} className="block group h-full">
                  <div className="relative bg-white dark:bg-dark-800 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-primary-500/10 dark:hover:shadow-primary-400/5 transition-all duration-300 border border-gray-100 dark:border-dark-700 h-full flex flex-col group-hover:-translate-y-1">
                    {/* Cover Image */}
                    <div className="relative aspect-[3/4] overflow-hidden">
                      {/* Gradient background */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary-100 via-primary-50 to-orange-50 dark:from-primary-900/40 dark:via-dark-800 dark:to-orange-900/20" />

                      {episode.coverImageUrl ? (
                        <>
                          <Image
                            src={episode.coverImageUrl}
                            alt={episode.title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-500"
                            priority={index === 0} // First episode is LCP
                          />
                          {/* Bottom gradient overlay for text readability */}
                          <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent" />
                        </>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center p-6 group-hover:scale-105 transition-transform duration-500">
                          <div className="text-center">
                            <DoshiMascot size="large" variant="static" />
                            <p className="text-primary-600 dark:text-primary-400 font-bold text-lg mt-2 font-japanese">
                              {episode.titleJa}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Episode Number Badge - Premium pill design */}
                      <div className="absolute top-3 left-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white px-3.5 py-1.5 rounded-full text-sm font-bold shadow-lg shadow-primary-500/30">
                        EP {episode.episodeNumber}
                      </div>

                      {/* Hover glow effect */}
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                        <div className="absolute inset-0 bg-gradient-to-t from-primary-500/20 to-transparent" />
                      </div>
                    </div>

                    {/* Episode Info */}
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-semibold text-foreground dark:text-dark-100 mb-1 line-clamp-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {episode.title}
                      </h3>
                      <p className="text-sm text-primary-600 dark:text-primary-400 font-japanese mb-2 font-medium">
                        {episode.titleJa}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-dark-400 line-clamp-2 mb-4 flex-1">
                        {episode.description}
                      </p>

                      {/* Stats - Modern pill design */}
                      <div className="flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-dark-700 text-muted-foreground dark:text-dark-300 rounded-full">
                          <MapPin className="w-3 h-3" />
                          {episode.location}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 dark:bg-dark-700 text-muted-foreground dark:text-dark-300 rounded-full">
                          <BookOpen className="w-3 h-3" />
                          {episode.panels?.length || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* Load More Button - Premium styling */}
        {hasMore && !loading && (
          <div className="text-center">
            <button
              onClick={handleLoadMore}
              className="px-8 py-3.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              Load More Episodes
            </button>
          </div>
        )}

        {/* Loading indicator for load more */}
        {loading && offset > 0 && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary-200 border-t-primary-600 mx-auto"></div>
          </div>
        )}

        {/* Error state - themed */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-6 mt-6 text-center">
            <p className="text-red-700 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={() => loadComics(true)}
              className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default function ComicsPage() {
  return <ComicsContent />
}
