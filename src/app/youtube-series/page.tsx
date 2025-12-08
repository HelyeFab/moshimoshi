'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { YouTubeChannel } from '@/types/youtube-series'
import { formatDistanceToNow } from 'date-fns'
// Navigation is now global via NavigationWrapper in root layout;
import PageHeader from '@/components/ui/PageHeader'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import {
  Youtube,
  Users,
  Calendar,
  ExternalLink,
  Search,
  X,
  Tag,
  Sparkles,
  Video,
  ChevronDown,
} from 'lucide-react'

export default function YouTubeSeriesPage() {
  const { t, strings } = useI18n()
  const router = useRouter()
  const { user } = useAuth()
  const [channels, setChannels] = useState<YouTubeChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [showOnlyShadowing, setShowOnlyShadowing] = useState(false)
  const [showTagsDropdown, setShowTagsDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Load channels
  useEffect(() => {
    loadChannels()
  }, [])

  // Click outside handler for dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTagsDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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

  // Get all unique tags from channels
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    channels.forEach(channel => {
      channel.resourceTags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [channels])

  // Filter channels based on search and filters
  const filteredChannels = useMemo(() => {
    return channels.filter(channel => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = channel.channelTitle.toLowerCase().includes(query)
        const matchesDescription = channel.description?.toLowerCase().includes(query)
        if (!matchesTitle && !matchesDescription) return false
      }

      // Tag filter
      if (selectedTags.length > 0) {
        const hasTag = selectedTags.some(tag => channel.resourceTags?.includes(tag))
        if (!hasTag) return false
      }

      // Shadowing filter
      if (showOnlyShadowing && !channel.shadowingEnabled) return false

      return true
    })
  }, [channels, searchQuery, selectedTags, showOnlyShadowing])

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))
  }

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-white to-primary-50 dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      {/* Navigation is now global - rendered in root layout */}

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

          {/* Filter Tags Dropdown */}
          {allTags.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowTagsDropdown(!showTagsDropdown)}
                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
              >
                <Tag className="w-4 h-4" />
                <span>Filter by tags</span>
                {selectedTags.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-primary-500 text-white text-xs rounded-full">
                    {selectedTags.length}
                  </span>
                )}
                <ChevronDown
                  className={`w-4 h-4 ml-auto transition-transform ${showTagsDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown Menu */}
              {showTagsDropdown && (
                <div className="absolute z-10 mt-2 w-64 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  <div className="p-2 space-y-1">
                    {allTags.map(tag => (
                      <label
                        key={tag}
                        className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag)}
                          onChange={() => toggleTag(tag)}
                          className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                        />
                        <span className="text-sm">{tag}</span>
                      </label>
                    ))}
                  </div>
                  {selectedTags.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-dark-700 p-2">
                      <button
                        onClick={() => setSelectedTags([])}
                        className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        Clear all
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Shadowing Filter */}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyShadowing}
                onChange={e => setShowOnlyShadowing(e.target.checked)}
                className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                Shadowing enabled channels only
              </span>
            </label>
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
              {searchQuery || selectedTags.length > 0 || showOnlyShadowing
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
                className="group bg-white dark:bg-dark-800 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-dark-700 hover:shadow-xl transition-all duration-300"
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
      </div>
    </div>
  )
}
