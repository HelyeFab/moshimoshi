'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { BookOpen, Clock, TrendingUp } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import PageHeader from '@/components/ui/PageHeader'
import { LoadingOverlay } from '@/components/ui/Loading'
import DoshiMascot from '@/components/ui/DoshiMascot'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { ComicEpisode, ComicSeries } from '@/types/comic'

export default function ComicsPage() {
  const { strings } = useI18n()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [series, setSeries] = useState<ComicSeries | null>(null)
  const [episodes, setEpisodes] = useState<ComicEpisode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 12

  const loadComics = useCallback(
    async (reset: boolean = false) => {
      try {
        setLoading(true)
        setError(null)
        const currentOffset = reset ? 0 : offset

        // Load series info
        const seriesResponse = await fetch('/api/comics/series')
        if (seriesResponse.ok) {
          const seriesData = await seriesResponse.json()
          setSeries(seriesData.series)
        }

        // Build episodes query params
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: currentOffset.toString(),
          seriesId: 'moshi-goes-to-japan',
        })

        // Load episodes
        const episodesResponse = await fetch(`/api/comics/episodes?${params}`)
        if (!episodesResponse.ok) {
          throw new Error('Failed to fetch episodes')
        }

        const episodesData = await episodesResponse.json()

        if (reset) {
          setEpisodes(episodesData.episodes || [])
          setOffset(0)
        } else {
          setEpisodes(prev => [...prev, ...(episodesData.episodes || [])])
        }

        setHasMore(episodesData.hasMore || false)
      } catch (err) {
        console.error('Error loading comics:', err)
        setError('Failed to load comics')
        setEpisodes([])
      } finally {
        setLoading(false)
      }
    },
    [offset, limit]
  )

  // Load on mount
  useEffect(() => {
    loadComics(true)
  }, [])

  const handleLoadMore = () => {
    setOffset(prev => prev + limit)
    loadComics(false)
  }

  // Show loading state while auth is loading
  if (authLoading) {
    return <LoadingOverlay isLoading={true} message="Loading..." />
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-rose-50 to-white dark:from-dark-900 dark:to-dark-850">
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
      />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Series Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-dark-800 rounded-2xl shadow-lg p-6 mb-8 border border-rose-200 dark:border-dark-700"
        >
          <div className="flex flex-col md:flex-row gap-6 items-center">
            <div className="flex-shrink-0">
              <DoshiMascot size="xlarge" variant="animated" mood="excited" />
            </div>
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-foreground dark:text-dark-100 mb-2 font-japanese">
                {series?.titleJa || 'もしの日本旅行'}
              </h2>
              <p className="text-muted-foreground dark:text-dark-400 mb-4">
                {series?.descriptionJa ||
                  'レッサーパンダのもしと一緒に日本を冒険しながら日本語を学ぼう！'}
              </p>
              <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                <span className="px-3 py-1 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-full text-sm">
                  {series?.publishedEpisodeCount || episodes.length} Episodes
                </span>
                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full text-sm">
                  Weekly Episodes
                </span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Loading State */}
        {loading && offset === 0 && <LoadingOverlay isLoading={true} />}

        {/* Episodes Grid */}
        {!loading && episodes.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <DoshiMascot size="xlarge" variant="animated" mood="thinking" />
            <h3 className="text-xl font-semibold mt-6 mb-2 text-foreground dark:text-dark-100">
              Coming Soon!
            </h3>
            <p className="text-muted-foreground dark:text-dark-400 max-w-md mx-auto">
              Moshi is preparing for the first adventure in Japan.
              <br />
              Check back soon for new episodes!
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <span className="px-4 py-2 bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 rounded-lg text-sm">
                New episodes every Sunday
              </span>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
            {episodes.map((episode, index) => (
              <motion.div
                key={episode.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/comics/${episode.id}`} className="block group">
                  <div className="bg-white dark:bg-dark-850 rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-gray-200 dark:border-dark-700 h-full flex flex-col">
                    {/* Cover Image */}
                    <div className="relative aspect-[3/4] bg-gradient-to-br from-rose-100 to-orange-100 dark:from-rose-900/30 dark:to-orange-900/30 overflow-hidden">
                      {episode.coverImageUrl ? (
                        <Image
                          src={episode.coverImageUrl}
                          alt={episode.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center p-6 group-hover:scale-105 transition-transform duration-300">
                          <div className="text-center">
                            <DoshiMascot size="large" variant="static" />
                            <p className="text-rose-600 dark:text-rose-400 font-bold text-lg mt-2 font-japanese">
                              {episode.titleJa}
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Episode Number Badge */}
                      <div className="absolute top-3 left-3 bg-rose-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                        EP {episode.episodeNumber}
                      </div>
                    </div>

                    {/* Episode Info */}
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-semibold text-foreground dark:text-dark-100 mb-1 line-clamp-1 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                        {episode.title}
                      </h3>
                      <p className="text-sm text-rose-600 dark:text-rose-400 font-japanese mb-2">
                        {episode.titleJa}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-dark-400 line-clamp-2 mb-3 flex-1">
                        {episode.description}
                      </p>

                      {/* Stats */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground dark:text-dark-400 pt-3 border-t border-gray-200 dark:border-dark-700">
                        <span className="flex items-center gap-1">
                          <span>📍</span>
                          {episode.location}
                        </span>
                        <span className="flex items-center gap-1">
                          <span>📖</span>
                          {episode.panels?.length || 0} panels
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && !loading && (
          <div className="text-center">
            <button
              onClick={handleLoadMore}
              className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium transition-colors shadow-md"
            >
              Load More Episodes
            </button>
          </div>
        )}

        {/* Loading indicator for load more */}
        {loading && offset > 0 && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-600 mx-auto"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mt-6 text-center">
            <p className="text-red-700 dark:text-red-400">{error}</p>
            <button
              onClick={() => loadComics(true)}
              className="mt-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        <MobileNavSpacer />
      </div>
    </div>
  )
}
