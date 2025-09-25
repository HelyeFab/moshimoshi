'use client';

import { useEffect, useState } from 'react';
import { useTranslation } from '@/i18n/I18nContext';
import Link from 'next/link';

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
  const { strings } = useTranslation();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scrapingLoading, setScrapingLoading] = useState(false);
  const [scrapingMessage, setScrapingMessage] = useState<string | null>(null);

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

  async function triggerNewsScraping(source?: string) {
    setScrapingLoading(true);
    setScrapingMessage(null);

    try {
      const response = await fetch('/api/news/scrape?' + new URLSearchParams({
        source: source || 'nhk-easy',
        force: 'true'
      }), {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger scraping: ${response.statusText}`);
      }

      const data = await response.json();
      setScrapingMessage(`✅ Successfully scraped ${data.articlesCount || 0} articles from ${data.source || source}`);
    } catch (err) {
      setScrapingMessage(`❌ Error: ${err instanceof Error ? err.message : 'Failed to trigger scraping'}`);
    } finally {
      setScrapingLoading(false);
      // Clear message after 5 seconds
      setTimeout(() => setScrapingMessage(null), 5000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">Error loading dashboard: {error}</p>
      </div>
    );
  }

  const formatChange = (value: number) => {
    if (!value || value === 0) return '';
    return value > 0 ? `+${value}%` : `${value}%`;
  };

  const statCards = [
    {
      title: strings.admin.statCards.totalUsers,
      value: stats?.totalUsers || 0,
      change: null, // Total users don't need a percentage change
      icon: '👥',
      color: 'blue',
    },
    {
      title: strings.admin.statCards.activeToday,
      value: stats?.activeUsers || 0,
      change: formatChange(stats?.changes?.activeUsersChange || 0),
      icon: '🟢',
      color: 'green',
    },
    {
      title: strings.admin.statCards.newUsersToday,
      value: stats?.newUsersToday || 0,
      change: formatChange(stats?.changes?.newUsersChange || 0),
      icon: '🆕',
      color: 'purple',
    },
    {
      title: strings.admin.statCards.activeSubscriptions,
      value: stats?.activeSubscriptions || 0,
      change: null, // Just show the number, no percentage needed
      icon: '💳',
      color: 'indigo',
    },
    {
      title: strings.admin.statCards.monthlyRevenue,
      value: `£${(stats?.monthlyRevenue || 0).toLocaleString()}`,
      change: 'MRR',
      icon: '💰',
      color: 'green',
    },
    {
      title: strings.admin.statCards.totalLessons,
      value: stats?.totalLessons || 0,
      change: null,
      icon: '📚',
      color: 'pink',
    },
    {
      title: strings.admin.statCards.completedToday,
      value: stats?.completedLessons || 0,
      change: stats?.totalCompletedLessons ? `${stats.totalCompletedLessons} total` : null,
      icon: '✅',
      color: 'teal',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Page Header - Mobile Optimized */}
      <div className="px-0">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{strings.admin.pageTitle}</h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
          {strings.admin.pageDescription}
        </p>
      </div>

      {/* Quick Actions - Better Mobile Grid */}
      <div className="bg-white dark:bg-dark-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-6">
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-white mb-3">{strings.admin.sections.quickActions}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
          <Link
            href="/admin/resources"
            className="flex flex-col items-center gap-1 sm:gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            <span className="text-2xl sm:text-3xl">📰</span>
            <span className="text-xs sm:text-sm font-medium">Resources</span>
          </Link>
          <Link
            href="/admin/moodboards"
            className="flex flex-col items-center gap-1 sm:gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            <span className="text-2xl sm:text-3xl">🎨</span>
            <span className="text-xs sm:text-sm font-medium">{strings.admin.quickActionButtons.moodBoards}</span>
          </Link>
          <Link
            href="/admin/users"
            className="flex flex-col items-center gap-1 sm:gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            <span className="text-2xl sm:text-3xl">👥</span>
            <span className="text-xs sm:text-sm font-medium">{strings.admin.quickActionButtons.users}</span>
          </Link>
          <Link
            href="/admin/blog"
            className="flex flex-col items-center gap-1 sm:gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            <span className="text-2xl sm:text-3xl">📝</span>
            <span className="text-xs sm:text-sm font-medium">{strings.admin.quickActionButtons.blog}</span>
          </Link>
          <Link
            href="/admin/content"
            className="flex flex-col items-center gap-1 sm:gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            <span className="text-2xl sm:text-3xl">📚</span>
            <span className="text-xs sm:text-sm font-medium">{strings.admin.quickActionButtons.content}</span>
          </Link>
          <Link
            href="/admin/analytics"
            className="flex flex-col items-center gap-1 sm:gap-2 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            <span className="text-2xl sm:text-3xl">📊</span>
            <span className="text-xs sm:text-sm font-medium">{strings.admin.quickActionButtons.analytics}</span>
          </Link>
        </div>
      </div>

      {/* Stats Grid - Mobile Optimized */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="bg-white dark:bg-dark-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-5 hover:shadow-lg transition-shadow"
          >
            <div className="flex items-start justify-between mb-1">
              <span className="text-lg sm:text-xl lg:text-2xl flex-shrink-0">{stat.icon}</span>
              {stat.change && (
                <span className={`text-[10px] sm:text-xs font-medium text-${stat.color}-600 dark:text-${stat.color}-400 ml-2`}>
                  {stat.change}
                </span>
              )}
            </div>
            <h3 className="text-gray-600 dark:text-gray-400 text-[11px] sm:text-xs lg:text-sm font-medium mt-1 line-clamp-2">
              {stat.title}
            </h3>
            <p className="text-sm sm:text-lg lg:text-xl font-bold text-gray-900 dark:text-white mt-0.5">
              {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* News Scraping Section - Mobile Optimized */}
      <div className="bg-white dark:bg-dark-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-6">
        <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-white mb-3">{strings.admin.sections.newsScraping}</h3>

        {scrapingMessage && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            scrapingMessage.startsWith('✅')
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
          }`}>
            {scrapingMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
          <button
            onClick={() => triggerNewsScraping('nhk-easy')}
            disabled={scrapingLoading}
            className="flex flex-col items-center gap-1 p-3 sm:p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-2xl sm:text-3xl">📺</span>
            <span className="text-xs sm:text-sm font-medium">{strings.admin.newsScraping.nhkEasy}</span>
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{strings.admin.newsScraping.nhkSchedule}</span>
          </button>

          <button
            onClick={() => triggerNewsScraping('watanoc')}
            disabled={scrapingLoading}
            className="flex flex-col items-center gap-1 p-3 sm:p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-2xl sm:text-3xl">🏯</span>
            <span className="text-xs sm:text-sm font-medium">{strings.admin.newsScraping.watanoc}</span>
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{strings.admin.newsScraping.watanocSchedule}</span>
          </button>

          <button
            onClick={() => triggerNewsScraping('mainichi-shogakusei')}
            disabled={scrapingLoading}
            className="flex flex-col items-center gap-1 p-3 sm:p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="text-2xl sm:text-3xl">🎒</span>
            <span className="text-xs sm:text-sm font-medium">{strings.admin.newsScraping.mainichiShogakusei}</span>
            <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">{strings.admin.newsScraping.mainichiSchedule}</span>
          </button>
        </div>

        {scrapingLoading && (
          <div className="mt-4 flex items-center justify-center">
            <div className="w-6 h-6 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">{strings.admin.newsScraping.scrapingArticles}</span>
          </div>
        )}
      </div>

      {/* Recent Activity - Stack on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
        {/* Recent Users */}
        <div className="bg-white dark:bg-dark-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-6 overflow-hidden">
          <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-white mb-3">{strings.admin.sections.recentUsers}</h3>
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
                  <div key={user.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName} className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex-shrink-0" />
                      ) : (
                        <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-200 dark:bg-gray-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                          {user.displayName[0]?.toUpperCase() || 'U'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white truncate">{user.displayName}</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                      </div>
                    </div>
                    <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">{timeDisplay}</span>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">{strings.admin.userLabels?.noRecentUsers || 'No recent users'}</p>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="bg-white dark:bg-dark-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4 lg:p-6">
          <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 dark:text-white mb-3">{strings.admin.sections.systemStatus}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-1.5 sm:py-2">
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{strings.admin.systemMetrics.database}</span>
              <span className="flex items-center gap-1 text-xs sm:text-sm">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full"></span>
                <span className="text-green-600 dark:text-green-400">{strings.admin.systemMetrics.operational}</span>
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 sm:py-2">
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{strings.admin.systemMetrics.apiResponseTime}</span>
              <span className="text-xs sm:text-sm text-gray-900 dark:text-white font-medium">{stats?.systemStatus?.apiResponseTime || 0}ms</span>
            </div>
            <div className="flex items-center justify-between py-1.5 sm:py-2">
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{strings.admin.systemMetrics.cacheHitRate}</span>
              <span className="text-xs sm:text-sm text-gray-900 dark:text-white font-medium">{stats?.systemStatus?.cacheHitRate || 0}%</span>
            </div>
            <div className="flex items-center justify-between py-1.5 sm:py-2">
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{strings.admin.systemMetrics.errorRate}</span>
              <span className="text-xs sm:text-sm text-gray-900 dark:text-white font-medium">{stats?.systemStatus?.errorRate || 0}%</span>
            </div>
            <div className="flex items-center justify-between py-1.5 sm:py-2">
              <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{strings.admin.systemMetrics.uptime}</span>
              <span className="text-xs sm:text-sm text-gray-900 dark:text-white font-medium">{stats?.systemStatus?.uptime || 0}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}