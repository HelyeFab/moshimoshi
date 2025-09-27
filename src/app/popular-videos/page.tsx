'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { useToast } from '@/components/ui/Toast/ToastContext';
import Navbar from '@/components/layout/Navbar';
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import DoshiMascot from '@/components/ui/DoshiMascot';

interface PopularVideo {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  thumbnailUrl: string;
  channelName: string;
  uniqueViewers: number;
  totalWatchCount: number;
  averageWatchTime: number;
  lastWatched: string;
  rank: number;
  isTrending: boolean;
  badge: string;
}

interface UserQuota {
  used: number;
  limit: number;
  remaining: number;
}

// Funny messages for premium users who hit their limit
const PREMIUM_LIMIT_MESSAGES = [
  {
    title: 'popularVideos.quotaExceeded.speedLearner.title',
    message: 'popularVideos.quotaExceeded.speedLearner.message',
    doshiMood: 'sleeping' as const
  },
  {
    title: 'popularVideos.quotaExceeded.achievement.title',
    message: 'popularVideos.quotaExceeded.achievement.message',
    doshiMood: 'excited' as const
  },
  {
    title: 'popularVideos.quotaExceeded.bufferOverflow.title',
    message: 'popularVideos.quotaExceeded.bufferOverflow.message',
    doshiMood: 'thinking' as const
  },
  {
    title: 'popularVideos.quotaExceeded.senpaiNoticed.title',
    message: 'popularVideos.quotaExceeded.senpaiNoticed.message',
    doshiMood: 'waving' as const
  }
];

function VideoCard({ video, onWatch }: { video: PopularVideo; onWatch: (video: PopularVideo) => void }) {
  const { t } = useI18n();

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="bg-white dark:bg-dark-800 rounded-xl shadow-lg overflow-hidden cursor-pointer group"
      onClick={() => onWatch(video)}
    >
      {/* Rank Badge */}
      <div className="absolute top-2 left-2 z-10">
        <div className={`
          px-3 py-1 rounded-full font-bold text-sm
          ${video.rank <= 3
            ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-lg'
            : 'bg-gray-800/80 text-gray-200'}
        `}>
          {t('popularVideos.rank', { rank: video.rank })}
        </div>
      </div>

      {/* Trending/Suggested Badge */}
      {video.badge && (
        <div className="absolute top-2 right-2 z-10">
          <div className={`
            px-2 py-1 text-white text-xs rounded-full font-medium
            ${video.isTrending ? 'bg-red-500' : 'bg-primary-500'}
          `}>
            {video.badge}
          </div>
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative aspect-video bg-gray-200 dark:bg-dark-700">
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.videoTitle}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">📺</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-white/90 dark:bg-dark-800/90 rounded-full p-4">
            <span className="text-3xl">▶️</span>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-2 mb-1">
          {video.videoTitle}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          {video.channelName}
        </p>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-1 rounded">
            👥 {t('popularVideos.watchedBy', { count: video.uniqueViewers })}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default function PopularVideosPage() {
  const { t, strings } = useI18n();
  const { user, isGuest } = useAuth();
  const { isPremium, isFreeTier } = useSubscription();
  const { showToast } = useToast();
  const router = useRouter();

  const [videos, setVideos] = useState<PopularVideo[]>([]);
  const [userQuota, setUserQuota] = useState<UserQuota>({ used: 0, limit: 0, remaining: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [quotaMessage, setQuotaMessage] = useState<typeof PREMIUM_LIMIT_MESSAGES[0] | null>(null);

  // Fetch popular videos
  useEffect(() => {
    const fetchPopularVideos = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/youtube/popular');

        if (!response.ok) {
          throw new Error('Failed to fetch popular videos');
        }

        const data = await response.json();
        setVideos(data.videos || []);
        setUserQuota(data.userQuota || { used: 0, limit: 0, remaining: 0 });
      } catch (err) {
        console.error('Error fetching popular videos:', err);
        setError(t('popularVideos.error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchPopularVideos();
  }, [t]);

  const handleWatchVideo = async (video: PopularVideo) => {
    // Check if user has quota remaining
    if (userQuota.remaining === 0) {
      if (isGuest || isFreeTier) {
        // Redirect to pricing page
        router.push('/pricing?reason=video_limit');
      } else if (isPremium) {
        // Show funny message for premium users
        const randomMessage = PREMIUM_LIMIT_MESSAGES[Math.floor(Math.random() * PREMIUM_LIMIT_MESSAGES.length)];
        setQuotaMessage(randomMessage);
        setShowQuotaModal(true);
      }
      return;
    }

    // Navigate to YouTube shadowing with the video URL
    router.push(`/youtube-shadowing?url=${encodeURIComponent(video.videoUrl)}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background dark:from-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} />

      {/* LearningPageHeader with ONLY required props - NO optional props */}
      <LearningPageHeader
        title={t('popularVideos.title')}
        description={t('popularVideos.subtitle')}
      />

      {isLoading && <LoadingOverlay message={t('popularVideos.loading')} />}

      <div className="container mx-auto px-4 pb-20">
        {/* Quota Badge */}
        {!isLoading && userQuota.limit > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <div className={`
              rounded-xl p-4 text-center
              ${userQuota.remaining > 0
                ? 'bg-primary-100 dark:bg-primary-900/20'
                : 'bg-red-100 dark:bg-red-900/20'}
            `}>
              <p className={`
                text-lg font-medium
                ${userQuota.remaining > 0
                  ? 'text-primary-700 dark:text-primary-300'
                  : 'text-red-700 dark:text-red-300'}
              `}>
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
            {videos.map((video) => (
              <VideoCard
                key={video.videoId}
                video={video}
                onWatch={handleWatchVideo}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && videos.length === 0 && (
          <div className="text-center py-20">
            <DoshiMascot size="large" variant="thinking" />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mt-6">
              {t('popularVideos.empty')}
            </h3>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-20">
            <DoshiMascot size="large" variant="sad" />
            <h3 className="text-xl font-semibold text-red-600 dark:text-red-400 mt-6">
              {error}
            </h3>
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
              <DoshiMascot size="large" variant={quotaMessage.doshiMood} />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-4 mb-2">
                {t(quotaMessage.title)}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {t(quotaMessage.message)}
              </p>
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
    </div>
  );
}