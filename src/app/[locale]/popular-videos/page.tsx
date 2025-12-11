'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useI18n } from '@/i18n/I18nContext'
import { useAuth } from '@/hooks/useAuth'
import { useSubscription } from '@/hooks/useSubscription'
import { useToast } from '@/components/ui/Toast/ToastContext'
import Navbar from '@/components/layout/Navbar'
import MobileNavSpacer from '@/components/layout/MobileNavSpacer'
import PageHeader from '@/components/ui/PageHeader'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import DoshiMascot from '@/components/ui/DoshiMascot'
import {
  Play,
  Clock,
  Timer,
  TrendingUp,
  User,
  Calendar,
  Users,
  PlayCircle,
  Sparkles,
  Flame,
  Trash2,
  Loader2,
  X,
} from 'lucide-react'

interface PopularVideo {
  videoId: string
  videoUrl: string
  videoTitle: string
  thumbnailUrl: string
  channelName: string
  uniqueViewers: number
  totalWatchCount: number
  averageWatchTime: number
  totalWatchTime?: number
  lastWatched: string
  rank: number
  isTrending: boolean
  badge: string
}

interface UserQuota {
  used: number
  limit: number
  remaining: number
}

// Funny messages for premium users who hit their limit
const PREMIUM_LIMIT_MESSAGES = [
  {
    title: 'popularVideos.quotaExceeded.speedLearner.title',
    message: 'popularVideos.quotaExceeded.speedLearner.message',
    doshiMood: 'sleeping' as const,
  },
  {
    title: 'popularVideos.quotaExceeded.achievement.title',
    message: 'popularVideos.quotaExceeded.achievement.message',
    doshiMood: 'excited' as const,
  },
  {
    title: 'popularVideos.quotaExceeded.bufferOverflow.title',
    message: 'popularVideos.quotaExceeded.bufferOverflow.message',
    doshiMood: 'thinking' as const,
  },
  {
    title: 'popularVideos.quotaExceeded.senpaiNoticed.title',
    message: 'popularVideos.quotaExceeded.senpaiNoticed.message',
    doshiMood: 'waving' as const,
  },
]

function VideoCard({
  video,
  onWatch,
  onDelete,
  index,
  isAdmin,
}: {
  video: PopularVideo
  onWatch: (video: PopularVideo) => void
  onDelete?: (video: PopularVideo) => void
  index: number
  isAdmin?: boolean
}) {
  const { t, strings } = useI18n()

  // Helper function to get YouTube thumbnail
  const getYouTubeThumbnail = (videoId: string) => {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
  }

  // Format date helper
  const formatDate = (date: string | Date) => {
    const now = new Date()
    const videoDate = new Date(date)
    const diff = now.getTime() - videoDate.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return strings.myVideos?.video?.today || 'Today'
    if (days === 1) return strings.myVideos?.video?.yesterday || 'Yesterday'
    if (days < 7) return t('myVideos.video.daysAgo', { days })
    if (days < 30) return t('myVideos.video.weeksAgo', { weeks: Math.floor(days / 7) })
    return videoDate.toLocaleDateString()
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 50 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        type: 'spring',
        stiffness: 300,
        damping: 25,
      }}
      whileHover={{ y: -8, transition: { duration: 0.3 } }}
      className="relative group"
    >
      {/* Glow effect on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-primary-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl border border-white/20 dark:border-white/10 group-hover:shadow-2xl transition-all duration-500">
        {/* Thumbnail with rich overlays */}
        <div className="relative aspect-video overflow-hidden">
          <img
            src={video.thumbnailUrl || getYouTubeThumbnail(video.videoId)}
            alt={video.videoTitle}
            className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
            onError={e => {
              const target = e.target as HTMLImageElement
              target.src = getYouTubeThumbnail(video.videoId)
            }}
          />

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Play Button Overlay */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onWatch(video)}
              className="px-6 py-3 bg-white/90 dark:bg-dark-900/90 backdrop-blur-xl rounded-2xl shadow-2xl flex items-center gap-3 transform transition-all duration-300"
            >
              <Play className="w-5 h-5 text-primary-600" />
              <span className="font-medium text-primary-900 dark:text-primary-100">
                {strings.myVideos?.video?.practiceAgain || 'Watch Now'}
              </span>
            </motion.button>
          </div>

          {/* Top Badges Row */}
          <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
            {/* Rank Badge */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 + 0.2 }}
              className={`
                backdrop-blur-xl px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1 shadow-lg
                ${
                  video.rank <= 3
                    ? 'bg-gradient-to-r from-yellow-400/90 to-orange-500/90 text-white'
                    : 'bg-black/70 text-white'
                }
              `}
            >
              {video.rank <= 3 && <Sparkles className="w-3.5 h-3.5" />}#{video.rank}
            </motion.div>

            {/* Trending/Stats Badges */}
            <div className="flex gap-2">
              {video.totalWatchCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 + 0.3 }}
                  className="bg-black/70 backdrop-blur-xl text-white px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1"
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  {video.totalWatchCount}x
                </motion.div>
              )}

              {video.averageWatchTime > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 + 0.4 }}
                  className="bg-white/90 dark:bg-dark-900/90 backdrop-blur-xl text-primary-700 dark:text-primary-300 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1"
                >
                  <Timer className="w-3.5 h-3.5" />
                  {Math.round(video.averageWatchTime / 60)}m
                </motion.div>
              )}

              {video.isTrending && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 + 0.5 }}
                  className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1 shadow-lg"
                >
                  <Flame className="w-3.5 h-3.5" />
                  {t('common.trending')}
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Content Section */}
        <div className="p-5">
          <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {video.videoTitle}
          </h3>

          <div className="flex items-center gap-2 mb-3">
            <User className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{video.channelName}</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary-500" />
              <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                {video.uniqueViewers} {video.uniqueViewers === 1 ? 'viewer' : 'viewers'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {video.lastWatched && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-xs">{formatDate(video.lastWatched)}</span>
                </div>
              )}

              {/* Admin Delete Button */}
              {isAdmin && onDelete && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={e => {
                    e.stopPropagation()
                    onDelete(video)
                  }}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all duration-300"
                  title="Delete video (Admin only)"
                >
                  <Trash2 className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Accent Bar */}
        <div className="h-1 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
      </div>
    </motion.div>
  )
}

export default function PopularVideosPage() {
  const { t, strings } = useI18n()
  const { user, isGuest } = useAuth()
  const { isPremium, isFreeTier } = useSubscription()
  const { showToast } = useToast()
  const router = useRouter()

  // Check if current user is admin
  const isAdmin = user?.isAdmin === true

  const [videos, setVideos] = useState<PopularVideo[]>([])
  const [userQuota, setUserQuota] = useState<UserQuota>({ used: 0, limit: 0, remaining: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showQuotaModal, setShowQuotaModal] = useState(false)
  const [quotaMessage, setQuotaMessage] = useState<(typeof PREMIUM_LIMIT_MESSAGES)[0] | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean
    video: PopularVideo | null
    isDeleting: boolean
  }>({
    isOpen: false,
    video: null,
    isDeleting: false,
  })

  // Fetch popular videos
  useEffect(() => {
    const fetchPopularVideos = async () => {
      try {
        setIsLoading(true)
        const response = await fetch('/api/youtube/popular')

        if (!response.ok) {
          throw new Error('Failed to fetch popular videos')
        }

        const data = await response.json()
        setVideos(data.videos || [])
        setUserQuota(data.userQuota || { used: 0, limit: 0, remaining: 0 })
      } catch (err) {
        console.error('Error fetching popular videos:', err)
        setError(t('popularVideos.error'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchPopularVideos()
  }, [t])

  const handleWatchVideo = async (video: PopularVideo) => {
    // Check if user has quota remaining
    if (userQuota.remaining === 0) {
      if (isGuest || isFreeTier) {
        // Redirect to pricing page
        router.push('/pricing?reason=video_limit')
      } else if (isPremium) {
        // Show funny message for premium users
        const randomMessage =
          PREMIUM_LIMIT_MESSAGES[Math.floor(Math.random() * PREMIUM_LIMIT_MESSAGES.length)]
        setQuotaMessage(randomMessage)
        setShowQuotaModal(true)
      }
      return
    }

    // Navigate to YouTube shadowing with the video URL
    router.push(`/youtube-shadowing?url=${encodeURIComponent(video.videoUrl)}`)
  }

  const handleDeleteVideo = (video: PopularVideo) => {
    setDeleteConfirm({
      isOpen: true,
      video,
      isDeleting: false,
    })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.video) return

    setDeleteConfirm(prev => ({ ...prev, isDeleting: true }))

    try {
      // Call API to delete video from all user histories
      const response = await fetch('/api/admin/videos/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: deleteConfirm.video.videoId }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete video')
      }

      // Update local state
      setVideos(prev => prev.filter(v => v.videoId !== deleteConfirm.video!.videoId))
      setDeleteConfirm({ isOpen: false, video: null, isDeleting: false })
      showToast(t('common.success'), 'success')

      // Clear cache to force refresh
      await fetch('/api/youtube/popular/clear-cache', { method: 'POST' })
    } catch (error) {
      console.error('Error deleting video:', error)
      showToast(t('common.error'), 'error')
      setDeleteConfirm(prev => ({ ...prev, isDeleting: false }))
    }
  }

  const cancelDelete = () => {
    setDeleteConfirm({ isOpen: false, video: null, isDeleting: false })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background dark:from-dark-850 dark:to-dark-900">
      {/* Desktop Navbar */}
      <div className="hidden sm:block">
        <Navbar user={user} showUserMenu={true} />
      </div>

      <PageHeader
        title={t('popularVideos.title') || 'Popular Videos'}
        description={t('popularVideos.description') || 'Most watched videos in the community'}
        backHref="/dashboard"
      />

      {isLoading && <LoadingOverlay message={t('popularVideos.loading')} />}

      <div className="container mx-auto px-4">
        {/* Quota Badge */}
        {!isLoading && userQuota.limit > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div
              className={`
              rounded-xl p-4 text-center
              ${
                userQuota.remaining > 0
                  ? 'bg-primary-100 dark:bg-primary-900/20'
                  : 'bg-red-100 dark:bg-red-900/20'
              }
            `}
            >
              <p
                className={`
                text-lg font-medium
                ${
                  userQuota.remaining > 0
                    ? 'text-primary-700 dark:text-primary-300'
                    : 'text-red-700 dark:text-red-300'
                }
              `}
              >
                {userQuota.remaining > 0
                  ? t('popularVideos.quotaStatus', { used: userQuota.used, limit: userQuota.limit })
                  : t('popularVideos.noQuota')}
              </p>
            </div>
          </motion.div>
        )}

        {/* Video Grid */}
        {!isLoading && !error && videos.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            <AnimatePresence mode="popLayout">
              {videos.map((video, index) => (
                <VideoCard
                  key={video.videoId}
                  video={video}
                  onWatch={handleWatchVideo}
                  onDelete={isAdmin ? handleDeleteVideo : undefined}
                  index={index}
                  isAdmin={isAdmin}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && videos.length === 0 && (
          <div className="text-center py-20">
            <DoshiMascot size="large" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mt-6">
              {t('popularVideos.empty')}
            </h3>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-20">
            <DoshiMascot size="large" />
            <h3 className="text-xl font-semibold text-red-600 dark:text-red-400 mt-6">{error}</h3>
          </div>
        )}
      </div>

      {/* Quota Exceeded Modal for Premium Users */}
      {showQuotaModal && quotaMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-dark-800 rounded-2xl p-8 max-w-md w-full shadow-2xl"
          >
            <div className="text-center">
              <DoshiMascot size="large" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2">
                {t(quotaMessage.title)}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{t(quotaMessage.message)}</p>
              <button
                onClick={() => setShowQuotaModal(false)}
                className="px-6 py-3 bg-primary-500 text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
              >
                {t('popularVideos.quotaExceeded.button')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal (Admin Only) */}
      <AnimatePresence>
        {deleteConfirm.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={cancelDelete}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="bg-white/95 dark:bg-dark-800/95 backdrop-blur-2xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20"
              onClick={e => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <Trash2 className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Admin: Delete Video</h3>
                <p className="text-muted-foreground">
                  This will permanently remove this video from all user histories and the popular
                  videos list. This action cannot be undone.
                </p>
              </div>

              {deleteConfirm.video && (
                <div className="bg-gray-50/50 dark:bg-dark-700/50 backdrop-blur rounded-xl p-4 mb-6">
                  <p className="font-semibold line-clamp-2 mb-1">
                    {deleteConfirm.video.videoTitle}
                  </p>
                  {deleteConfirm.video.channelName && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {deleteConfirm.video.channelName}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    Watched by {deleteConfirm.video.uniqueViewers} user(s)
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={cancelDelete}
                  disabled={deleteConfirm.isDeleting}
                  className="flex-1 px-6 py-3 bg-gray-100 dark:bg-dark-700 text-foreground rounded-xl hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors disabled:opacity-50 font-medium"
                >
                  {t('common.cancel')}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={confirmDelete}
                  disabled={deleteConfirm.isDeleting}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 font-medium shadow-lg"
                >
                  {deleteConfirm.isDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Delete Permanently
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <MobileNavSpacer />
    </div>
  )
}
