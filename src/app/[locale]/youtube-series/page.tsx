'use client'

import { useState, useEffect, useMemo } from 'react'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { YouTubeChannel } from '@/types/youtube-series'
import Navbar from '@/components/layout/Navbar'
import PageHeader from '@/components/ui/PageHeader'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import {
  Youtube,
  Users,
  ExternalLink,
  Search,
  X,
  Sparkles,
  Video,
} from 'lucide-react'

export default function YouTubeSeriesPage() {
  const { strings } = useI18n()
  const { user } = useAuth()
  const [channels, setChannels] = useState<YouTubeChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Load channels
  useEffect(() => {
    loadChannels()
  }, [])


  const loadChannels = async () => {
    try {
      setLoading(true)

      // Fetch data from API endpoint (uses admin SDK, no auth required)
      const response = await fetch('/api/youtube/series')

      if (!response.ok) {
        throw new Error('Failed to fetch YouTube series')
      }

      const data = await response.json()

      // Convert ISO strings back to Date objects for timestamps
      const channelsList = data.channels.map(
        (channel: any) =>
          ({
            ...channel,
            createdAt: channel.createdAt ? new Date(channel.createdAt) : null,
            updatedAt: channel.updatedAt ? new Date(channel.updatedAt) : null,
            lastCheckedAt: channel.lastCheckedAt ? new Date(channel.lastCheckedAt) : null,
          }) as YouTubeChannel
      )

      setChannels(channelsList)
    } catch (err) {
      console.error('Error loading channels:', err)
      setError('Failed to load YouTube series')
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort channels (featured first)
  const filteredChannels = useMemo(() => {
    const filtered = channels.filter(channel => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = channel.channelTitle.toLowerCase().includes(query)
        const matchesDescription = channel.description?.toLowerCase().includes(query)
        if (!matchesTitle && !matchesDescription) return false
      }
      return true
    })
    // Sort featured channels first
    return filtered.sort((a, b) => {
      const aFeatured = a.isFeatured ? 1 : 0
      const bFeatured = b.isFeatured ? 1 : 0
      return bFeatured - aFeatured
    })
  }, [channels, searchQuery])

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <PageHeader
        title={strings.youtubeSeries?.title || 'YouTube Series'}
        description={strings.youtubeSeries?.description || 'Japanese learning channels for shadowing practice'}
        backHref="/dashboard"
      />

      <div className="container mx-auto px-4 pb-8">
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={strings.youtubeSeries.searchPlaceholder}
              className="w-full pl-10 pr-10 py-3 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>

        {/* Loading State */}
        {loading && <LoadingOverlay />}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredChannels.length === 0 && (
          <div className="text-center py-12">
            <Youtube className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {searchQuery
                ? 'No channels match your search'
                : 'No YouTube channels have been added yet'}
            </p>
          </div>
        )}

        {/* Channels Grid */}
        {!loading && !error && filteredChannels.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredChannels.map(channel => (
              <div
                key={channel.id}
                className={`group bg-white dark:bg-dark-800 rounded-xl overflow-hidden shadow-sm border-2 hover:shadow-xl transition-all duration-300 ${
                  channel.isFeatured
                    ? 'border-primary-500 dark:border-primary-400 ring-2 ring-primary-500/20 dark:ring-primary-400/20 shadow-primary-500/10'
                    : 'border-gray-200 dark:border-dark-700'
                }`}
              >
                {/* Channel Header */}
                <div className="relative h-48 bg-gradient-to-br from-primary-400 to-primary-600 dark:from-primary-500 dark:to-primary-700">
                  {channel.thumbnailUrl ? (
                    <img
                      src={channel.thumbnailUrl}
                      alt={channel.channelTitle}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Youtube className="w-16 h-16 text-white/50" />
                    </div>
                  )}

                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Channel Title */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-xl font-bold text-white line-clamp-1">
                      {channel.channelTitle}
                    </h3>
                  </div>

                  {/* Featured Ribbon */}
                  {channel.isFeatured && (
                    <div className="absolute top-0 left-0">
                      <div className="bg-yellow-500 text-white text-xs font-bold px-3 py-1 shadow-lg" style={{ transform: 'rotate(-45deg) translate(-30%, -10%)', transformOrigin: 'center' }}>
                        ⭐ Featured
                      </div>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="absolute top-2 right-2 flex gap-2">
                    {channel.shadowingEnabled && (
                      <span className="px-2 py-1 bg-purple-500/90 text-white text-xs font-medium rounded-lg flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Shadowing
                      </span>
                    )}
                  </div>
                </div>

                {/* Channel Content */}
                <div className="p-4">
                  {/* Description */}
                  {channel.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                      {channel.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400 mb-3">
                    {channel.subscriberCount && channel.subscriberCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {formatNumber(channel.subscriberCount)} subscribers
                      </span>
                    )}
                    {channel.videoCount && channel.videoCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        {formatNumber(channel.videoCount!)} videos
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  {channel.resourceTags && channel.resourceTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {channel.resourceTags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-gray-100 dark:bg-dark-700 text-xs text-gray-600 dark:text-gray-400 rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Category */}
                  {channel.resourceCategory && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                      Category: {channel.resourceCategory}
                    </p>
                  )}

                  {/* Action Button */}
                  <a
                    href={channel.channelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Youtube className="w-4 h-4" />
                    Visit Channel
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
        <MobileNavSpacer />
      </div>
    </div>
  )
}
