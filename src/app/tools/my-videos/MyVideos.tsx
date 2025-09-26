'use client';

import { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import {
  Play,
  Clock,
  Trash2,
  Search,
  Loader2,
  History,
  TrendingUp,
  User,
  ChevronLeft,
  Calendar,
  Filter,
  Sparkles,
  Video,
  Award,
  X,
  PlayCircle,
  Timer,
  BarChart3
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { PracticeHistoryItem } from '@/services/practiceHistory/types';
import Navbar from '@/components/layout/Navbar';
import { useToast } from '@/components/ui/Toast/ToastContext';
import Link from 'next/link';

export default function MyVideos() {
  const { t, strings } = useI18n();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { checkAndTrack, remaining } = useFeature('media_upload');
  const { showToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const parallaxY = useTransform(scrollY, [0, 300], [0, -50]);

  const [videos, setVideos] = useState<PracticeHistoryItem[]>([]);
  const [filteredVideos, setFilteredVideos] = useState<PracticeHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'mostPracticed'>('recent');
  const [userTier, setUserTier] = useState<string>('guest');
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    video: PracticeHistoryItem | null;
    isDeleting: boolean;
  }>({
    isOpen: false,
    video: null,
    isDeleting: false
  });

  // Load videos from API
  useEffect(() => {
    if (!authLoading) {
      loadVideos();
    }
  }, [user, authLoading, sortBy]);

  const loadVideos = async () => {
    try {
      setIsLoading(true);

      // Fetch videos from API
      const response = await fetch(`/api/practice/track?limit=100&sortBy=${sortBy}`);
      if (!response.ok) {
        throw new Error('Failed to fetch videos');
      }

      const data = await response.json();
      setVideos(data.items || []);
      setFilteredVideos(data.items || []);
      setUserTier(data.userTier || 'guest');
    } catch (error) {
      console.error('Error loading videos:', error);
      showToast(t('common.error'), 'error');
      setVideos([]);
      setFilteredVideos([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter videos based on search
  useEffect(() => {
    let filtered = [...videos];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(video => {
        const title = video.videoTitle.toLowerCase();
        const channel = video.channelName?.toLowerCase() || '';
        return title.includes(query) || channel.includes(query);
      });
    }

    setFilteredVideos(filtered);
  }, [searchQuery, videos]);

  const handlePracticeAgain = (video: PracticeHistoryItem) => {
    // Navigate to YouTube shadowing with the video URL
    router.push(`/youtube-shadowing?url=${encodeURIComponent(video.videoUrl)}&fromHistory=true`);
  };

  const handleDelete = (video: PracticeHistoryItem) => {
    setDeleteConfirm({
      isOpen: true,
      video,
      isDeleting: false
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.video) return;

    setDeleteConfirm(prev => ({ ...prev, isDeleting: true }));

    try {
      // Call API to delete video
      const response = await fetch('/api/practice/track', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: deleteConfirm.video.videoId })
      });

      if (!response.ok) {
        throw new Error('Failed to delete video');
      }

      // Update local state
      setVideos(prev => prev.filter(v => v.videoId !== deleteConfirm.video!.videoId));
      setFilteredVideos(prev => prev.filter(v => v.videoId !== deleteConfirm.video!.videoId));
      setDeleteConfirm({ isOpen: false, video: null, isDeleting: false });
      showToast(t('common.success'), 'success');
    } catch (error) {
      console.error('Error deleting video:', error);
      showToast(t('common.error'), 'error');
      setDeleteConfirm(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const cancelDelete = () => {
    setDeleteConfirm({ isOpen: false, video: null, isDeleting: false });
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return strings.myVideos?.video?.today || 'Today';
    if (days === 1) return strings.myVideos?.video?.yesterday || 'Yesterday';
    if (days < 7) return t('myVideos.video.daysAgo', { days });
    if (days < 30) return t('myVideos.video.weeksAgo', { weeks: Math.floor(days / 7) });
    return new Date(date).toLocaleDateString();
  };

  const getYouTubeThumbnail = (videoId: string) => {
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  };

  // Calculate stats
  const totalPracticeTime = videos.reduce((sum, v) => sum + (v.totalPracticeTime || 0), 0);
  const totalPracticeCount = videos.reduce((sum, v) => sum + v.practiceCount, 0);

  // Show login required for guests
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-soft-white to-primary-100 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
        <Navbar user={user ? {
          uid: user.uid,
          email: user.email || undefined,
          displayName: user.displayName,
          photoURL: user.photoURL,
          isAdmin: user.isAdmin
        } : undefined} showUserMenu={true} />

        <div className="container mx-auto px-4 py-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto text-center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-600 blur-3xl opacity-20 animate-pulse" />
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", duration: 0.6 }}
                className="relative bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-white/20"
              >
                <History className="w-20 h-20 mx-auto mb-6 text-primary-500" />
                <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                  {strings.myVideos?.loginRequired || 'Sign in Required'}
                </h2>
                <p className="text-muted-foreground mb-8">
                  {strings.myVideos?.loginDescription || 'Sign in to view your practice history'}
                </p>
                <Link
                  href="/auth/signin"
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-2xl hover:from-primary-700 hover:to-primary-600 transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  <Sparkles className="w-5 h-5" />
                  {t('common.signIn')}
                </Link>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50/50 via-soft-white to-primary-100/30 dark:from-dark-850 dark:via-dark-900 dark:to-dark-850">
      <Navbar user={user || undefined} showUserMenu={true} />

      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          style={{ y: parallaxY }}
          className="absolute top-0 left-1/4 w-96 h-96 bg-gradient-to-br from-primary-300/10 to-primary-500/10 rounded-full blur-3xl"
        />
        <motion.div
          style={{ y: parallaxY }}
          className="absolute bottom-0 right-1/4 w-[30rem] h-[30rem] bg-gradient-to-tl from-primary-400/10 to-primary-600/10 rounded-full blur-3xl"
        />
      </div>

      <div className="relative px-4 pb-20" ref={containerRef}>
        <div className="max-w-7xl mx-auto">
          {/* Enhanced Header with Glassmorphism */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 pt-6"
          >
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 text-muted-foreground hover:text-foreground transition-all duration-300 group"
            >
              <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
              {t('common.back')}
            </Link>
          </motion.div>

          {/* Hero Section with Gradient Text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <motion.h1
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, type: "spring" }}
              className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary-600 via-primary-500 to-primary-400 bg-clip-text text-transparent"
            >
              {strings.myVideos?.title || 'My Videos'}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
            >
              {strings.myVideos?.subtitle || 'Track your YouTube shadowing practice history'}
            </motion.p>
          </motion.div>

          {/* Enhanced Stats Cards with Glassmorphism */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-10">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -5 }}
              transition={{ delay: 0.1 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-600 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
              <div className="relative bg-white/70 dark:bg-dark-800/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/20 dark:border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <Video className="w-10 h-10 text-primary-500" />
                  <span className="text-xs font-medium text-primary-600 bg-primary-100 dark:bg-primary-900/30 px-2 py-1 rounded-full">
                    {strings.myVideos?.stats?.videosPracticed || 'Total Videos'}
                  </span>
                </div>
                <p className="text-4xl font-bold bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  {videos.length}
                </p>
                <div className="mt-2 h-1 bg-gradient-to-r from-primary-400 to-primary-600 rounded-full opacity-50" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -5 }}
              transition={{ delay: 0.2 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-green-600 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
              <div className="relative bg-white/70 dark:bg-dark-800/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/20 dark:border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <TrendingUp className="w-10 h-10 text-green-500" />
                  <span className="text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                    {strings.myVideos?.stats?.totalSessions || 'Total Practice'}
                  </span>
                </div>
                <p className="text-4xl font-bold bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  {totalPracticeCount}
                </p>
                <div className="mt-2 h-1 bg-gradient-to-r from-green-400 to-green-600 rounded-full opacity-50" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -5 }}
              transition={{ delay: 0.3 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-blue-600 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
              <div className="relative bg-white/70 dark:bg-dark-800/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/20 dark:border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <Timer className="w-10 h-10 text-blue-500" />
                  <span className="text-xs font-medium text-blue-600 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-full">
                    {strings.myVideos?.stats?.practiceTime || 'Total Time'}
                  </span>
                </div>
                <p className="text-4xl font-bold bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  {Math.round(totalPracticeTime / 60)}
                  <span className="text-lg ml-1 opacity-70">min</span>
                </p>
                <div className="mt-2 h-1 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full opacity-50" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -5 }}
              transition={{ delay: 0.4 }}
              className="relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-purple-600 rounded-3xl opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
              <div className="relative bg-white/70 dark:bg-dark-800/70 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/20 dark:border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <Award className="w-10 h-10 text-purple-500" />
                  <span className="text-xs font-medium text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded-full">
                    {'User Tier'}
                  </span>
                </div>
                <p className="text-2xl font-bold bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
                  {userTier === 'premium_monthly' || userTier === 'premium_yearly' ?
                    `Premium` :
                    userTier}
                </p>
                <div className="mt-2 h-1 bg-gradient-to-r from-purple-400 to-purple-600 rounded-full opacity-50" />
              </div>
            </motion.div>
          </div>

          {/* Enhanced Search and Filter Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mb-8"
          >
            <div className="bg-white/60 dark:bg-dark-800/60 backdrop-blur-xl rounded-2xl shadow-xl border border-white/20 dark:border-white/10 p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search Input with Icon Animation */}
                <div className="flex-1 relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary-500 transition-colors" />
                  <input
                    type="text"
                    placeholder={strings.myVideos?.search?.placeholder || 'Search videos...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-white/70 dark:bg-dark-700/70 backdrop-blur rounded-xl border border-gray-200/50 dark:border-dark-600/50 focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-400 transition-all duration-300"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 dark:hover:bg-dark-600 rounded-lg transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`px-4 py-3 rounded-xl border transition-all duration-300 flex items-center gap-2 ${
                      showFilters
                        ? 'bg-primary-500 text-white border-primary-500 shadow-lg shadow-primary-500/20'
                        : 'bg-white/70 dark:bg-dark-700/70 border-gray-200/50 dark:border-dark-600/50 hover:border-primary-400'
                    }`}
                  >
                    <Filter className="w-5 h-5" />
                    <span className="hidden sm:inline">{'Filters'}</span>
                  </button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSortBy(sortBy === 'recent' ? 'mostPracticed' : 'recent')}
                    className="px-4 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center gap-2"
                  >
                    {sortBy === 'recent' ? <Clock className="w-5 h-5" /> : <BarChart3 className="w-5 h-5" />}
                    <span className="hidden sm:inline">
                      {sortBy === 'recent'
                        ? strings.myVideos?.sort?.mostRecent || 'Recent'
                        : strings.myVideos?.sort?.mostPracticed || 'Most Practiced'}
                    </span>
                  </motion.button>
                </div>
              </div>

              {/* Expandable Filter Options */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 pt-4 border-t border-gray-200/50 dark:border-dark-600/50 overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg text-sm font-medium">
                        {filteredVideos.length} {'results'}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Videos Grid with Stunning Cards */}
          {isLoading ? (
            <div className="flex flex-col justify-center items-center py-20">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="w-12 h-12 text-primary-500" />
              </motion.div>
              <p className="mt-4 text-muted-foreground">{t('common.loading')}</p>
            </div>
          ) : filteredVideos.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20"
            >
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-gradient-to-r from-primary-400 to-primary-600 blur-2xl opacity-20 animate-pulse" />
                <div className="relative bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl rounded-3xl p-12 shadow-2xl border border-white/20">
                  <History className="w-24 h-24 mx-auto mb-6 text-gray-300 dark:text-gray-700" />
                  <h3 className="text-2xl font-bold mb-3">
                    {searchQuery ?
                      strings.myVideos?.search?.noResults || 'No videos found' :
                      strings.myVideos?.empty?.title || 'No practice history yet'}
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    {searchQuery ?
                      strings.myVideos?.search?.noResultsDescription || 'Try a different search' :
                      strings.myVideos?.empty?.description || 'Start practicing with YouTube videos to see them here'}
                  </p>
                  <Link
                    href="/youtube-shadowing"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl hover:from-primary-700 hover:to-primary-600 transition-all duration-300 transform hover:scale-105 shadow-lg"
                  >
                    <PlayCircle className="w-5 h-5" />
                    {strings.myVideos?.empty?.startPracticing || 'Start Practicing'}
                  </Link>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredVideos.map((video, index) => (
                  <motion.div
                    key={video.id}
                    layout
                    initial={{ opacity: 0, scale: 0.8, y: 50 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -50 }}
                    transition={{
                      delay: index * 0.05,
                      type: "spring",
                      stiffness: 300,
                      damping: 25
                    }}
                    whileHover={{ y: -8, transition: { duration: 0.3 } }}
                    className="relative group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-500/20 to-primary-600/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="relative bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl rounded-2xl overflow-hidden shadow-xl border border-white/20 dark:border-white/10 group-hover:shadow-2xl transition-all duration-500">
                      {/* Thumbnail with Overlay Effects */}
                      <div className="relative aspect-video overflow-hidden">
                        <img
                          src={video.thumbnailUrl || getYouTubeThumbnail(video.videoId)}
                          alt={video.videoTitle}
                          className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = getYouTubeThumbnail(video.videoId);
                          }}
                        />

                        {/* Gradient Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Play Button Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500">
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handlePracticeAgain(video)}
                            className="px-6 py-3 bg-white/90 dark:bg-dark-900/90 backdrop-blur-xl rounded-2xl shadow-2xl flex items-center gap-3 transform transition-all duration-300"
                          >
                            <Play className="w-5 h-5 text-primary-600" />
                            <span className="font-medium text-primary-900 dark:text-primary-100">
                              {strings.myVideos?.video?.practiceAgain || 'Practice Again'}
                            </span>
                          </motion.button>
                        </div>

                        {/* Stats Badges */}
                        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
                          <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 + 0.2 }}
                            className="bg-black/70 backdrop-blur-xl text-white px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            {video.practiceCount}x
                          </motion.div>

                          {video.totalPracticeTime && (
                            <motion.div
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 + 0.3 }}
                              className="bg-white/90 dark:bg-dark-900/90 backdrop-blur-xl text-primary-700 dark:text-primary-300 px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1"
                            >
                              <Timer className="w-3.5 h-3.5" />
                              {Math.round(video.totalPracticeTime / 60)}m
                            </motion.div>
                          )}
                        </div>
                      </div>

                      {/* Enhanced Content Section */}
                      <div className="p-5">
                        <h3 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                          {video.videoTitle}
                        </h3>

                        {video.channelName && (
                          <p className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {video.channelName}
                          </p>
                        )}

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(video.lastPracticed)}</span>
                          </div>

                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(video);
                            }}
                            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all duration-300"
                          >
                            <Trash2 className="w-4 h-4" />
                          </motion.button>
                        </div>
                      </div>

                      {/* Bottom Accent Bar */}
                      <div className="h-1 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Enhanced Delete Confirmation Modal */}
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
                  transition={{ type: "spring", duration: 0.5 }}
                  className="bg-white/95 dark:bg-dark-800/95 backdrop-blur-2xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="text-center mb-6">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                      <Trash2 className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">
                      {strings.myVideos?.confirmDelete?.title || 'Delete Video'}
                    </h3>
                    <p className="text-muted-foreground">
                      {strings.myVideos?.confirmDelete?.message || 'Are you sure you want to delete this video from your history?'}
                    </p>
                  </div>

                  {deleteConfirm.video && (
                    <div className="bg-gray-50/50 dark:bg-dark-700/50 backdrop-blur rounded-xl p-4 mb-6">
                      <p className="font-semibold line-clamp-2 mb-1">{deleteConfirm.video.videoTitle}</p>
                      {deleteConfirm.video.channelName && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          {deleteConfirm.video.channelName}
                        </p>
                      )}
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
                      {strings.myVideos?.confirmDelete?.confirm || 'Delete'}
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}