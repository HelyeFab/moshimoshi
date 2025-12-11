'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import Link from 'next/link';
import { motion } from 'framer-motion';
import DoshiMascot from '@/components/ui/DoshiMascot';
import DateRangeScrapingModal from '@/components/admin/DateRangeScrapingModal';
import ScrapingLogsPanel from '@/components/admin/ScrapingLogsPanel';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  totalLessons: number;
  completedLessons: number;
  totalCompletedLessons: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
  recentUsers: Array<{
    id: string;
    email: string;
    displayName: string;
    createdAt: Date;
    photoURL?: string;
  }>;
  changes: {
    newUsersChange: number;
    activeUsersChange: number;
  };
  systemStatus: {
    database: string;
    apiResponseTime: number;
    cacheHitRate: number;
    errorRate: number;
    uptime: number;
  };
}

export default function AdminDashboard() {
  const { strings } = useI18n();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrapingMessage, setScrapingMessage] = useState<string | null>(null);
  const [isScrapingModalOpen, setIsScrapingModalOpen] = useState(false);
  const [logsRefreshTrigger, setLogsRefreshTrigger] = useState(0);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  async function fetchDashboardStats() {
    try {
      const response = await fetch('/api/admin/stats', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch stats');
      }
      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  const handleScrapingStart = (message: string) => {
    setScrapingMessage(message);
  };

  const handleScrapingComplete = (message: string) => {
    setScrapingMessage(message);
    // Refresh logs after scraping completes
    setLogsRefreshTrigger(prev => prev + 1);
    // Clear message after 5 seconds
    setTimeout(() => setScrapingMessage(null), 5000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <DoshiMascot size="medium" mood="loading" variant="animated" />
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {strings.common?.loading || 'Loading dashboard data...'}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 shadow-lg">
        <p className="text-red-800 dark:text-red-200 flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          {error}
        </p>
      </div>
    );
  }

  const formatChange = (value: number) => {
    if (!value || value === 0) return '';
    return value > 0 ? `+${value}%` : `${value}%`;
  };

  const statCards = [
    {
      title: strings.admin?.statCards?.totalUsers || 'Total Users',
      value: stats?.totalUsers || 0,
      change: null,
      icon: '👥',
      gradient: 'from-blue-400 to-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      title: strings.admin?.statCards?.activeToday || 'Active Today',
      value: stats?.activeUsers || 0,
      change: formatChange(stats?.changes?.activeUsersChange || 0),
      icon: '🟢',
      gradient: 'from-green-400 to-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      title: strings.admin?.statCards?.newUsersToday || 'New Today',
      value: stats?.newUsersToday || 0,
      change: formatChange(stats?.changes?.newUsersChange || 0),
      icon: '🆕',
      gradient: 'from-purple-400 to-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      title: strings.admin?.statCards?.activeSubscriptions || 'Subscriptions',
      value: stats?.activeSubscriptions || 0,
      change: null,
      icon: '💳',
      gradient: 'from-indigo-400 to-indigo-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    },
    {
      title: strings.admin?.statCards?.monthlyRevenue || 'MRR',
      value: `£${(stats?.monthlyRevenue || 0).toLocaleString()}`,
      change: 'MRR',
      icon: '💰',
      gradient: 'from-emerald-400 to-emerald-600',
      bgColor: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    {
      title: strings.admin?.statCards?.totalLessons || 'Total Lessons',
      value: stats?.totalLessons || 0,
      change: null,
      icon: '📚',
      gradient: 'from-pink-400 to-pink-600',
      bgColor: 'bg-pink-50 dark:bg-pink-900/20',
    },
    {
      title: strings.admin?.statCards?.completedToday || 'Completed',
      value: stats?.completedLessons || 0,
      change: stats?.totalCompletedLessons ? `${stats.totalCompletedLessons} total` : null,
      icon: '✅',
      gradient: 'from-teal-400 to-teal-600',
      bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full space-y-4 sm:space-y-6 pb-20 min-h-screen"
    >
      {/* Page Header with Gradient Background */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-100 via-primary-50 to-transparent dark:from-primary-900/20 dark:via-primary-800/10 dark:to-transparent rounded-2xl p-4 sm:p-6 shadow-sm">
        {/* Animated Background Pattern */}
        <div className="absolute inset-0 opacity-10 dark:opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ef4444' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        <div className="relative flex items-center justify-between">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent">
              {strings.admin?.pageTitle || 'Admin Dashboard'}
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
              {strings.admin?.pageDescription || 'Monitor and manage your application'}
            </p>
          </div>
          <div className="hidden sm:block">
            <DoshiMascot size="small" mood="happy" />
          </div>
        </div>
      </div>

      {/* Quick Actions - Mobile Optimized Card Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-4 sm:p-6"
      >
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-primary-500">⚡</span>
          {strings.admin?.sections?.quickActions || 'Quick Actions'}
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { href: '/admin/resources', icon: '📚', label: 'Resources' },
            { href: '/admin/stories', icon: '📖', label: 'Stories' },
            { href: '/admin/moodboards', icon: '🎨', label: strings.admin?.quickActionButtons?.moodBoards || 'Moodboards' },
            { href: '/admin/subscriptions', icon: '💳', label: strings.admin?.quickActionButtons?.subscriptions || 'Subscriptions' },
            { href: '/admin/blog', icon: '📝', label: strings.admin?.quickActionButtons?.blog || 'Blog' },
            { href: '/admin/monitoring', icon: '📊', label: strings.admin?.quickActionButtons?.monitoring || 'Monitoring' },
            { href: '/admin/entitlements', icon: '🔐', label: strings.admin?.quickActionButtons?.entitlements || 'Entitlements' },
            { href: '/admin/xp-config', icon: '⚡', label: 'XP Config' },
            { href: '/admin/gamification-xp-config', icon: '🎮', label: 'Gamification XP' },
          ].map((action, index) => (
            <motion.div
              key={action.href}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
            >
              <Link
                href={action.href}
                className="group relative flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-dark-700 dark:to-dark-800 hover:from-primary-50 hover:to-primary-100 dark:hover:from-primary-900/20 dark:hover:to-primary-800/20 transition-all duration-300 hover:scale-105 hover:shadow-lg"
              >
                <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform duration-300">
                  {action.icon}
                </span>
                <span className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 text-center leading-tight">
                  {action.label}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Stats Grid - Beautiful Mobile-First Cards */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4"
      >
        {statCards.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 + index * 0.05 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="relative group"
          >
            <div className={`absolute inset-0 ${stat.bgColor} rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-300`} />
            <div className="relative bg-white/90 dark:bg-dark-800/90 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-dark-700/50 p-4 sm:p-5 shadow-lg hover:shadow-xl transition-all duration-300">
              <div className="flex items-start justify-between mb-2">
                <div className={`p-2 rounded-xl ${stat.bgColor} backdrop-blur-sm`}>
                  <span className="text-xl sm:text-2xl block">{stat.icon}</span>
                </div>
                {stat.change && (
                  <span className={`text-xs font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                    {stat.change}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                <p className={`text-2xl sm:text-3xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent`}>
                  {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                </p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 font-medium">
                  {stat.title}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* News Scraping Section - Beautiful Mobile Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-4 sm:p-6"
      >
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <span className="text-primary-500">📰</span>
          {strings.admin?.sections?.newsScraping || 'News Scraping'}
        </h3>

        {scrapingMessage && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`mb-4 p-3 rounded-xl text-sm font-medium ${
              scrapingMessage.startsWith('✅')
                ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                : 'bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
            }`}
          >
            {scrapingMessage}
          </motion.div>
        )}

        <div className="flex flex-col items-center gap-4">
          <motion.button
            onClick={() => setIsScrapingModalOpen(true)}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group relative flex items-center gap-4 p-6 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 hover:shadow-lg transition-all duration-300 border border-blue-200 dark:border-blue-700 w-full max-w-md"
          >
            <div className="flex-shrink-0">
              <span className="text-4xl group-hover:scale-110 transition-transform duration-300">
                📺
              </span>
            </div>
            <div className="flex-grow text-left">
              <p className="text-lg font-bold bg-gradient-to-r from-blue-500 to-blue-700 bg-clip-text text-transparent">
                NHK Easy News
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Scrape articles with custom date range
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Click to select dates (max 30 days)
              </p>
            </div>
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-500 group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </motion.button>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center max-w-md">
            Watanoc and Mainichi scrapers have been archived. NHK Easy provides the most reliable and comprehensive Japanese news content.
          </p>
        </div>
      </motion.div>

      {/* Scraping Logs Panel */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
      >
        <ScrapingLogsPanel refreshTrigger={logsRefreshTrigger} />
      </motion.div>

      {/* Recent Activity - Beautiful Mobile-First Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Users */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-4 sm:p-6 overflow-hidden">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-primary-500">👥</span>
            {strings.admin?.sections?.recentUsers || 'Recent Users'}
          </h3>
          <div className="space-y-3">
            {stats?.recentUsers && stats.recentUsers.length > 0 ? (
              stats.recentUsers.map((user) => {
                const timeAgo = new Date().getTime() - new Date(user.createdAt).getTime();
                const minutesAgo = Math.floor(timeAgo / 60000);
                const hoursAgo = Math.floor(timeAgo / 3600000);
                const daysAgo = Math.floor(timeAgo / 86400000);

                let timeDisplay = '';
                if (daysAgo > 0) {
                  timeDisplay = strings.admin.userLabels?.daysAgo?.replace('{{days}}', daysAgo.toString()) || `${daysAgo}d ago`;
                } else if (hoursAgo > 0) {
                  timeDisplay = strings.admin.userLabels?.hoursAgo?.replace('{{hours}}', hoursAgo.toString()) || `${hoursAgo}h ago`;
                } else if (minutesAgo > 0) {
                  timeDisplay = strings.admin.userLabels?.minutesAgo?.replace('{{minutes}}', minutesAgo.toString()) || `${minutesAgo}m ago`;
                } else {
                  timeDisplay = strings.admin.userLabels?.justNow || 'Just now';
                }

                return (
                  <motion.div
                    key={user.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 }}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName} className="w-10 h-10 rounded-full ring-2 ring-primary-200 dark:ring-primary-800 flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                          {user.displayName[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user.displayName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-primary-600 dark:text-primary-400 flex-shrink-0 ml-2">
                      {timeDisplay}
                    </span>
                  </motion.div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{strings.admin.userLabels?.noRecentUsers || 'No recent users'}</p>
            )}
          </div>
        </motion.div>

        {/* System Status */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-4 sm:p-6"
        >
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <span className="text-primary-500">📊</span>
            {strings.admin?.sections?.systemStatus || 'System Status'}
          </h3>
          <div className="space-y-3">
            {[
              {
                label: strings.admin?.systemMetrics?.database || 'Database',
                value: (
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-green-600 dark:text-green-400 font-medium">
                      {strings.admin?.systemMetrics?.operational || 'Operational'}
                    </span>
                  </span>
                ),
              },
              {
                label: strings.admin?.systemMetrics?.apiResponseTime || 'API Response',
                value: `${stats?.systemStatus?.apiResponseTime || 0}ms`,
                color: (stats?.systemStatus?.apiResponseTime || 0) < 100 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400',
              },
              {
                label: strings.admin?.systemMetrics?.cacheHitRate || 'Cache Hit Rate',
                value: `${stats?.systemStatus?.cacheHitRate || 0}%`,
                color: (stats?.systemStatus?.cacheHitRate || 0) > 80 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400',
              },
              {
                label: strings.admin?.systemMetrics?.errorRate || 'Error Rate',
                value: `${stats?.systemStatus?.errorRate || 0}%`,
                color: (stats?.systemStatus?.errorRate || 0) < 1 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
              },
              {
                label: strings.admin?.systemMetrics?.uptime || 'Uptime',
                value: `${stats?.systemStatus?.uptime || 0}%`,
                color: (stats?.systemStatus?.uptime || 0) > 99 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400',
              },
            ].map((metric, index) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.05 * index }}
                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-dark-700/50 hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors"
              >
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {metric.label}
                </span>
                {typeof metric.value === 'string' ? (
                  <span className={`text-sm font-semibold ${metric.color || 'text-gray-900 dark:text-white'}`}>
                    {metric.value}
                  </span>
                ) : (
                  metric.value
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Date Range Scraping Modal */}
      <DateRangeScrapingModal
        isOpen={isScrapingModalOpen}
        onClose={() => setIsScrapingModalOpen(false)}
        onScrapingStart={handleScrapingStart}
        onScrapingComplete={handleScrapingComplete}
      />
    </motion.div>
  );
}