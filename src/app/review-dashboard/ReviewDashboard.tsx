'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useI18n } from '@/i18n/I18nContext'
import { useToast } from '@/components/ui/Toast/ToastContext'
import { LoadingOverlay } from '@/components/ui/Loading'
import { Tabs } from '@/components/ui/Tabs'
import {
  Clock,
  Calendar,
  BookOpen,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Filter,
  ChevronRight,
  Brain,
  Target,
  Zap
} from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow, format, isToday, isTomorrow, isThisWeek } from 'date-fns'

interface ReviewItem {
  id: string
  contentType: 'kana' | 'kanji' | 'vocabulary' | 'sentence'
  primaryDisplay: string
  secondaryDisplay?: string
  status: 'new' | 'learning' | 'review' | 'mastered'
  lastReviewedAt?: Date
  nextReviewAt?: Date
  srsLevel?: number
  accuracy: number
  reviewCount: number
  correctCount: number
  tags?: string[]
  source?: string
}

interface ReviewStats {
  totalStudied: number
  totalLearned: number
  totalMastered: number
  dueNow: number
  dueToday: number
  dueTomorrow: number
  dueThisWeek: number
}

export default function ReviewDashboard() {
  const { user, loading: authLoading } = useAuth()
  const { t, strings } = useI18n()
  const { showToast } = useToast()

  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [filterType, setFilterType] = useState<'all' | 'kana' | 'kanji' | 'vocabulary' | 'sentence'>('all')

  const [studiedItems, setStudiedItems] = useState<ReviewItem[]>([])
  const [stats, setStats] = useState<ReviewStats>({
    totalStudied: 0,
    totalLearned: 0,
    totalMastered: 0,
    dueNow: 0,
    dueToday: 0,
    dueTomorrow: 0,
    dueThisWeek: 0
  })

  // Derived states
  const learnedItems = studiedItems.filter(item =>
    item.status === 'review' || item.status === 'mastered'
  )

  const queueItems = studiedItems.filter(item => {
    if (!item.nextReviewAt) return false
    const reviewTime = new Date(item.nextReviewAt)
    return reviewTime <= new Date()
  })

  const upcomingItems = studiedItems.filter(item => {
    if (!item.nextReviewAt) return false
    const reviewTime = new Date(item.nextReviewAt)
    return reviewTime > new Date()
  }).sort((a, b) => {
    const timeA = new Date(a.nextReviewAt!).getTime()
    const timeB = new Date(b.nextReviewAt!).getTime()
    return timeA - timeB
  })

  // Filter items by type
  const filteredItems = (items: ReviewItem[]) => {
    if (filterType === 'all') return items
    return items.filter(item => item.contentType === filterType)
  }

  // Load review data
  const loadReviewData = async () => {
    setLoading(true)
    try {
      const [studiedRes, statsRes, queueRes] = await Promise.all([
        fetch('/api/review/progress/studied'),
        fetch('/api/review/stats'),
        fetch('/api/review/queue')
      ])

      if (studiedRes.ok) {
        const data = await studiedRes.json()
        setStudiedItems(data.items || [])
      }

      if (statsRes.ok) {
        const data = await statsRes.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to load review data:', error)
      showToast(t('messages.loadError', 'Failed to load review data'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReviewData()
  }, [])

  // Helper functions
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-gray-500'
      case 'learning': return 'bg-blue-500'
      case 'review': return 'bg-green-500'
      case 'mastered': return 'bg-purple-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'new': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
      case 'learning': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'review': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'mastered': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'
    }
  }

  const formatReviewTime = (date: Date | string) => {
    const reviewDate = new Date(date)
    const now = new Date()
    const diffMs = reviewDate.getTime() - now.getTime()
    const diffHours = Math.abs(diffMs) / (1000 * 60 * 60)

    if (diffMs < 0) {
      // Overdue
      if (diffHours < 1) {
        return { text: formatDistanceToNow(reviewDate, { addSuffix: true }), className: 'text-red-600' }
      } else {
        return { text: `${formatDistanceToNow(reviewDate)} overdue`, className: 'text-red-600' }
      }
    } else if (diffHours < 1) {
      // Due soon
      return { text: formatDistanceToNow(reviewDate, { addSuffix: true }), className: 'text-orange-600' }
    } else if (isToday(reviewDate)) {
      return { text: `Today at ${format(reviewDate, 'h:mm a')}`, className: 'text-blue-600' }
    } else if (isTomorrow(reviewDate)) {
      return { text: `Tomorrow at ${format(reviewDate, 'h:mm a')}`, className: 'text-green-600' }
    } else if (isThisWeek(reviewDate)) {
      return { text: format(reviewDate, 'EEEE \'at\' h:mm a'), className: 'text-gray-600' }
    } else {
      return { text: format(reviewDate, 'MMM d \'at\' h:mm a'), className: 'text-gray-500' }
    }
  }

  // Prepare tabs configuration
  const tabs = [
    {
      id: 'overview',
      label: `${t('tabs.overview', 'Overview')}`
    },
    {
      id: 'studied',
      label: `${t('tabs.studied', 'Studied')} (${filteredItems(studiedItems).length})`
    },
    {
      id: 'learned',
      label: `${t('tabs.learned', 'Learned')} (${filteredItems(learnedItems).length})`
    },
    {
      id: 'queue',
      label: `${t('tabs.queue', 'Queue')} (${filteredItems(queueItems).length})`
    },
    {
      id: 'schedule',
      label: t('tabs.schedule', 'Schedule')
    }
  ]

  if (loading || authLoading) {
    return (
      <LoadingOverlay
        isLoading={true}
        message={t('messages.loading', 'Loading review data...')}
        showDoshi={true}
      />
    )
  }

  // Render tab content based on activeTab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Review Queue Summary */}
            <div className="p-6 bg-white/90 dark:bg-dark-800/90 backdrop-blur rounded-xl shadow-sm">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                {t('sections.reviewQueue', 'Review Queue')}
              </h2>
              {queueItems.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  {t('messages.noReviewsDue', 'No reviews due right now. Great job!')}
                </p>
              ) : (
                <div className="space-y-2">
                  {queueItems.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-dark-700">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-medium">{item.primaryDisplay}</span>
                        {item.secondaryDisplay && (
                          <span className="text-sm text-gray-500">{item.secondaryDisplay}</span>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                  {queueItems.length > 5 && (
                    <button
                      className="w-full py-2 text-sm text-primary-600 hover:text-primary-700"
                      onClick={() => setActiveTab('queue')}
                    >
                      {t('actions.viewAll', 'View all')} {queueItems.length} {t('items', 'items')}
                      <ChevronRight className="w-4 h-4 inline ml-1" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Upcoming Reviews */}
            <div className="p-6 bg-white/90 dark:bg-dark-800/90 backdrop-blur rounded-xl shadow-sm">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                {t('sections.upcomingReviews', 'Upcoming Reviews')}
              </h2>
              {upcomingItems.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  {t('messages.noUpcoming', 'No upcoming reviews scheduled')}
                </p>
              ) : (
                <div className="space-y-2">
                  {upcomingItems.slice(0, 5).map(item => {
                    const timeInfo = formatReviewTime(item.nextReviewAt!)
                    return (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-dark-700">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-medium">{item.primaryDisplay}</span>
                        </div>
                        <span className={`text-sm ${timeInfo.className}`}>
                          {timeInfo.text}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Progress Charts */}
            <div className="col-span-full">
              <div className="p-6 bg-white/90 dark:bg-dark-800/90 backdrop-blur rounded-xl shadow-sm">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  {t('sections.learningProgress', 'Learning Progress')}
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {['kana', 'kanji', 'vocabulary', 'sentence'].map(type => {
                    const typeItems = studiedItems.filter(item => item.contentType === type)
                    const learned = typeItems.filter(item => item.status === 'review' || item.status === 'mastered').length
                    const percentage = typeItems.length > 0 ? (learned / typeItems.length) * 100 : 0

                    return (
                      <div key={type} className="text-center">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1 capitalize">
                          {t(`contentTypes.${type}`, type)}
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                          {percentage.toFixed(0)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {learned}/{typeItems.length}
                        </div>
                        <div className="mt-2 h-2 bg-gray-200 dark:bg-dark-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary-400 to-primary-600 transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )

      case 'studied':
        return (
          <div className="p-6 bg-white/90 dark:bg-dark-800/90 backdrop-blur rounded-xl shadow-sm">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-600" />
              {t('sections.allStudiedItems', 'All Studied Items')}
              <span className="px-2 py-1 text-xs bg-gray-200 dark:bg-dark-700 rounded-full">
                {filteredItems(studiedItems).length}
              </span>
            </h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredItems(studiedItems).length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  {filterType !== 'all'
                    ? t('messages.noItemsFiltered', 'No items found for this filter')
                    : t('messages.noStudiedItems', 'You haven\'t studied any items yet')}
                </p>
              ) : (
                filteredItems(studiedItems).map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-dark-700 hover:bg-gray-100 dark:hover:bg-dark-600 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-medium">{item.primaryDisplay}</span>
                      {item.secondaryDisplay && (
                        <span className="text-sm text-gray-500">{item.secondaryDisplay}</span>
                      )}
                      {item.source && (
                        <span className="text-xs text-gray-400">{item.source}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-sm">
                        <div className="text-gray-500">
                          {item.reviewCount} reviews • {(item.accuracy * 100).toFixed(0)}% accuracy
                        </div>
                        {item.lastReviewedAt && (
                          <div className="text-xs text-gray-400">
                            Last: {formatDistanceToNow(new Date(item.lastReviewedAt), { addSuffix: true })}
                          </div>
                        )}
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )

      case 'learned':
        return (
          <div className="p-6 bg-white/90 dark:bg-dark-800/90 backdrop-blur rounded-xl shadow-sm">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              {t('sections.learnedItems', 'Learned Items')}
              <span className="px-2 py-1 text-xs bg-gray-200 dark:bg-dark-700 rounded-full">
                {filteredItems(learnedItems).length}
              </span>
            </h2>
            <div className="grid md:grid-cols-2 gap-4">
              {/* Mastered Items */}
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-600" />
                  {t('sections.masteredItems', 'Mastered')}
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredItems(learnedItems.filter(item => item.status === 'mastered')).map(item => (
                    <div key={item.id} className="p-2 rounded bg-purple-50 dark:bg-purple-900/20">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.primaryDisplay}</span>
                        <span className="text-xs text-purple-600 dark:text-purple-400">
                          {(item.accuracy * 100).toFixed(0)}%
                        </span>
                      </div>
                      {item.secondaryDisplay && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">{item.secondaryDisplay}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* In Review Items */}
              <div>
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-green-600" />
                  {t('sections.inReview', 'In Review')}
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredItems(learnedItems.filter(item => item.status === 'review')).map(item => (
                    <div key={item.id} className="p-2 rounded bg-green-50 dark:bg-green-900/20">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{item.primaryDisplay}</span>
                        <span className="text-xs text-green-600 dark:text-green-400">
                          Level {item.srsLevel || 0}
                        </span>
                      </div>
                      {item.secondaryDisplay && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">{item.secondaryDisplay}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )

      case 'queue':
        return (
          <div className="p-6 bg-white/90 dark:bg-dark-800/90 backdrop-blur rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                {t('sections.reviewQueueFull', 'Review Queue - Items Due Now')}
                <span className="px-2 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full">
                  {filteredItems(queueItems).length}
                </span>
              </h2>
              {queueItems.length > 0 && (
                <Link href="/review">
                  <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
                    {t('actions.startReview', 'Start Review')}
                  </button>
                </Link>
              )}
            </div>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredItems(queueItems).length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                  {t('messages.queueEmpty', 'Your review queue is empty!')}
                </p>
              ) : (
                filteredItems(queueItems).map(item => {
                  const timeInfo = formatReviewTime(item.nextReviewAt!)
                  return (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-medium">{item.primaryDisplay}</span>
                        {item.secondaryDisplay && (
                          <span className="text-sm text-gray-500">{item.secondaryDisplay}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${timeInfo.className}`}>
                          {timeInfo.text}
                        </span>
                        {item.accuracy < 0.6 && (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full">
                            {(item.accuracy * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )

      case 'schedule':
        return (
          <div className="p-6 bg-white/90 dark:bg-dark-800/90 backdrop-blur rounded-xl shadow-sm">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-600" />
              {t('sections.reviewSchedule', 'Review Schedule')}
            </h2>
            <div className="space-y-4">
              {/* Today */}
              <div>
                <h3 className="font-medium mb-2 text-blue-600">{t('time.today', 'Today')}</h3>
                <div className="space-y-1">
                  {upcomingItems.filter(item => isToday(new Date(item.nextReviewAt!))).map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded bg-blue-50 dark:bg-blue-900/20">
                      <span>{item.primaryDisplay}</span>
                      <span className="text-sm text-blue-600">
                        {format(new Date(item.nextReviewAt!), 'h:mm a')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tomorrow */}
              <div>
                <h3 className="font-medium mb-2 text-green-600">{t('time.tomorrow', 'Tomorrow')}</h3>
                <div className="space-y-1">
                  {upcomingItems.filter(item => isTomorrow(new Date(item.nextReviewAt!))).map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded bg-green-50 dark:bg-green-900/20">
                      <span>{item.primaryDisplay}</span>
                      <span className="text-sm text-green-600">
                        {format(new Date(item.nextReviewAt!), 'h:mm a')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* This Week */}
              <div>
                <h3 className="font-medium mb-2 text-purple-600">{t('time.thisWeek', 'This Week')}</h3>
                <div className="space-y-1">
                  {upcomingItems.filter(item => {
                    const date = new Date(item.nextReviewAt!)
                    return isThisWeek(date) && !isToday(date) && !isTomorrow(date)
                  }).map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded bg-purple-50 dark:bg-purple-900/20">
                      <span>{item.primaryDisplay}</span>
                      <span className="text-sm text-purple-600">
                        {format(new Date(item.nextReviewAt!), 'EEEE h:mm a')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-white/90 dark:bg-dark-800/90 backdrop-blur rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span className="text-xs text-gray-500">{t('stats.studied', 'Studied')}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalStudied}</div>
          <div className="text-xs text-gray-500 mt-1">Total items</div>
        </div>

        <div className="p-4 bg-white/90 dark:bg-dark-800/90 backdrop-blur rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-xs text-gray-500">{t('stats.learned', 'Learned')}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalLearned}</div>
          <div className="text-xs text-gray-500 mt-1">{stats.totalMastered} mastered</div>
        </div>

        <div className="p-4 bg-white/90 dark:bg-dark-800/90 backdrop-blur rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle className="w-4 h-4 text-orange-600" />
            <span className="text-xs text-gray-500">{t('stats.dueNow', 'Due Now')}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.dueNow}</div>
          <div className="text-xs text-gray-500 mt-1">Ready to review</div>
        </div>

        <div className="p-4 bg-white/90 dark:bg-dark-800/90 backdrop-blur rounded-xl shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-purple-600" />
            <span className="text-xs text-gray-500">{t('stats.upcoming', 'Upcoming')}</span>
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {stats.dueToday + stats.dueTomorrow}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.dueToday} today, {stats.dueTomorrow} tomorrow
          </div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filterType === 'all'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600'
          }`}
          onClick={() => setFilterType('all')}
        >
          {t('filter.all', 'All')}
        </button>
        <button
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filterType === 'kana'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600'
          }`}
          onClick={() => setFilterType('kana')}
        >
          {t('filter.kana', 'Kana')}
        </button>
        <button
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filterType === 'kanji'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600'
          }`}
          onClick={() => setFilterType('kanji')}
        >
          {t('filter.kanji', 'Kanji')}
        </button>
        <button
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filterType === 'vocabulary'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600'
          }`}
          onClick={() => setFilterType('vocabulary')}
        >
          {t('filter.vocabulary', 'Vocabulary')}
        </button>
        <button
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            filterType === 'sentence'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600'
          }`}
          onClick={() => setFilterType('sentence')}
        >
          {t('filter.sentences', 'Sentences')}
        </button>

        <button
          className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-200 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-dark-600 transition-colors ml-auto flex items-center gap-1"
          onClick={loadReviewData}
        >
          <RefreshCw className="w-4 h-4" />
          {t('actions.refresh', 'Refresh')}
        </button>
      </div>

      {/* Main Content Tabs */}
      <Tabs
        tabs={tabs}
        defaultTab={activeTab}
        onChange={setActiveTab}
        variant="default"
      >
        {renderTabContent()}
      </Tabs>
    </div>
  )
}