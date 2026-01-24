'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase/client';
import { AdminErrorBoundary } from '@/components/admin/AdminErrorBoundary';
import {
  UserEngagementChart,
  TrafficBarChart,
  StatCard,
} from '@/components/admin/charts/AdminCharts';

interface LearningVillagePageAnalytics {
  route: string;
  pageKey: string;
  pageViews: number;
  uniqueVisitors: number;
  avgDurationMs: number;
  lastVisit: string | null;
}

interface DailyUserStats {
  date: string;
  newUsers: number;
  returningUsers: number;
  totalActive: number;
}

interface UserDetail {
  uid: string;
  email: string | null;
  displayName: string | null;
  createdAt: string | null;
  lastSignIn: string | null;
  type: 'new' | 'returning';
  reviewSessions?: number;
}

interface UserEngagementData {
  totalUsers: number;
  newUsersLast7Days: number;
  returningUsersLast7Days: number;
  retentionRate: number;
  dailyBreakdown: DailyUserStats[];
  recentUsers: UserDetail[];
}

export default function VillageTrafficPage() {
  const { user } = useAuth();
  const [learningVillagePages, setLearningVillagePages] = useState<LearningVillagePageAnalytics[]>([]);
  const [learningVillageTotals, setLearningVillageTotals] = useState<{ pageViews: number; uniqueVisitors: number; avgDurationMs: number } | null>(null);
  const [learningVillageSearch, setLearningVillageSearch] = useState('');
  const [visitorsLoading, setVisitorsLoading] = useState(true);
  const [visitorsError, setVisitorsError] = useState<string | null>(null);

  // Returning users state
  const [userEngagement, setUserEngagement] = useState<UserEngagementData | null>(null);
  const [engagementLoading, setEngagementLoading] = useState(true);
  const [engagementError, setEngagementError] = useState<string | null>(null);
  const [showUserList, setShowUserList] = useState(false);
  const [userFilter, setUserFilter] = useState<'all' | 'new' | 'returning'>('all');

  // View mode for traffic data
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  const formatDuration = (durationMs: number) => {
    if (!durationMs || durationMs <= 0) return 'N/A';
    const totalSeconds = Math.round(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

  // Fetch visitor analytics
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          setVisitorsLoading(false);
          return;
        }

        const response = await fetch('/api/admin/analytics/visitors', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch analytics');
        }

        const result = await response.json();

        if (result.error) {
          setVisitorsError(result.message || result.error);
        } else {
          setLearningVillagePages(result.learningVillage?.pages || []);
          setLearningVillageTotals(result.learningVillage?.totals || null);
        }
      } catch (err) {
        setVisitorsError(err instanceof Error ? err.message : 'Failed to load analytics');
      } finally {
        setVisitorsLoading(false);
      }
    };

    if (user) {
      fetchAnalytics();
    }
  }, [user]);

  // Fetch returning users data
  useEffect(() => {
    const fetchEngagement = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          setEngagementLoading(false);
          return;
        }

        const response = await fetch('/api/admin/analytics/returning-users', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user engagement data');
        }

        const result = await response.json();

        if (result.success && result.data) {
          setUserEngagement(result.data);
        } else {
          setEngagementError(result.message || 'Failed to load engagement data');
        }
      } catch (err) {
        setEngagementError(err instanceof Error ? err.message : 'Failed to load engagement data');
      } finally {
        setEngagementLoading(false);
      }
    };

    if (user) {
      fetchEngagement();
    }
  }, [user]);

  // Memoized chart data for traffic - show ALL pages
  const trafficChartData = useMemo(() => {
    return learningVillagePages
      .filter(page => page.pageViews > 0)
      .sort((a, b) => b.pageViews - a.pageViews)
      .map(page => ({
        name: page.route.replace('/learning-village/', '').replace(/^\//, '') || 'Home',
        pageViews: page.pageViews,
        uniqueVisitors: page.uniqueVisitors,
      }));
  }, [learningVillagePages]);

  return (
    <AdminErrorBoundary componentName="Village Traffic">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full space-y-4 sm:space-y-6"
    >
      {/* Page Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-100 via-primary-50 to-transparent dark:from-primary-900/20 dark:via-primary-800/10 dark:to-transparent rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="relative">
          <h2 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent">
            🏮 Village Traffic
          </h2>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Track page views, unique visitors & returning users
          </p>
        </div>
      </div>

      {/* User Engagement Section */}
      <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-4 sm:p-6">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4 text-sm sm:text-base">
          👥 User Engagement (Last 7 Days)
        </h3>

        {engagementLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-20 sm:h-24 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse"></div>
              ))}
            </div>
            <div className="h-48 sm:h-64 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse mt-4"></div>
          </div>
        ) : engagementError ? (
          <p className="text-red-500 text-sm">❌ {engagementError}</p>
        ) : userEngagement ? (
          <>
            {/* Stats Grid - 2 cols on mobile, 4 on desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-4 sm:mb-6">
              <StatCard
                title="Total Users"
                value={userEngagement.totalUsers.toLocaleString()}
                icon="👤"
                color="blue"
                compact
              />
              <StatCard
                title="New (7 days)"
                value={userEngagement.newUsersLast7Days.toLocaleString()}
                icon="✨"
                color="green"
                compact
              />
              <StatCard
                title="Returning"
                value={userEngagement.returningUsersLast7Days.toLocaleString()}
                icon="🔄"
                color="purple"
                compact
              />
              <StatCard
                title="Retention"
                value={`${userEngagement.retentionRate}%`}
                icon="📈"
                color={userEngagement.retentionRate >= 20 ? 'green' : userEngagement.retentionRate >= 10 ? 'orange' : 'red'}
                compact
              />
            </div>

            {/* Engagement Chart */}
            <div className="bg-gray-50/50 dark:bg-dark-700/30 rounded-xl p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2 sm:mb-3">
                New vs Returning Users
              </p>
              <UserEngagementChart data={userEngagement.dailyBreakdown} />
            </div>

            {/* User List Toggle */}
            <div className="mt-4 sm:mt-6">
              <button
                onClick={() => setShowUserList(!showUserList)}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors flex items-center justify-center gap-2"
              >
                {showUserList ? '🔼 Hide User Details' : '🔽 Show User Details'}
                <span className="text-xs text-gray-500">({userEngagement.recentUsers?.length || 0} users)</span>
              </button>
            </div>

            {/* User List */}
            {showUserList && userEngagement.recentUsers && userEngagement.recentUsers.length > 0 && (
              <div className="mt-4 bg-gray-50/50 dark:bg-dark-700/30 rounded-xl p-3 sm:p-4">
                {/* Filter Tabs */}
                <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                  {(['all', 'new', 'returning'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setUserFilter(filter)}
                      className={`px-3 py-1.5 text-xs sm:text-sm rounded-lg whitespace-nowrap transition-colors ${
                        userFilter === filter
                          ? 'bg-primary-500 text-white'
                          : 'bg-gray-200 dark:bg-dark-600 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-dark-500'
                      }`}
                    >
                      {filter === 'all' ? '👥 All' : filter === 'new' ? '✨ New' : '🔄 Returning'}
                    </button>
                  ))}
                </div>

                {/* User Table */}
                <div className="overflow-x-auto -mx-3 sm:mx-0">
                  <table className="w-full text-xs sm:text-sm min-w-[500px]">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 px-2 sm:px-3">User</th>
                        <th className="py-2 px-2 sm:px-3">Type</th>
                        <th className="py-2 px-2 sm:px-3">Sessions</th>
                        <th className="py-2 px-2 sm:px-3 hidden sm:table-cell">Created</th>
                        <th className="py-2 px-2 sm:px-3">Last Active</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userEngagement.recentUsers
                        .filter(u => userFilter === 'all' || u.type === userFilter)
                        .map((u) => (
                          <tr key={u.uid} className="border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-100/50 dark:hover:bg-dark-600/30">
                            <td className="py-2 px-2 sm:px-3">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900 dark:text-white truncate max-w-[150px] sm:max-w-[200px]">
                                  {u.displayName || u.email?.split('@')[0] || 'Unknown'}
                                </span>
                                <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 truncate max-w-[150px] sm:max-w-[200px]">
                                  {u.email || u.uid.slice(0, 8) + '...'}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-2 sm:px-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium ${
                                u.type === 'new'
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                              }`}>
                                {u.type === 'new' ? '✨ New' : '🔄 Return'}
                              </span>
                            </td>
                            <td className="py-2 px-2 sm:px-3 text-gray-700 dark:text-gray-300">
                              {u.reviewSessions || 0}
                            </td>
                            <td className="py-2 px-2 sm:px-3 text-gray-500 dark:text-gray-400 hidden sm:table-cell">
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}
                            </td>
                            <td className="py-2 px-2 sm:px-3 text-gray-500 dark:text-gray-400">
                              {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString() : '-'}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {userEngagement.recentUsers.filter(u => userFilter === 'all' || u.type === userFilter).length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-4 text-sm">
                    No {userFilter === 'all' ? '' : userFilter} users found
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No engagement data available</p>
        )}
      </div>

      {/* Learning Village Traffic */}
      <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm sm:text-base">
            🧭 Learning Village Pages
          </h3>
          <div className="flex items-center gap-2 sm:gap-4">
            {learningVillageTotals && (
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:inline">
                {learningVillageTotals.pageViews} views • {learningVillageTotals.uniqueVisitors} unique
              </span>
            )}
            {/* View Mode Toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setViewMode('chart')}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm transition-colors ${
                  viewMode === 'chart'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600'
                }`}
              >
                📊 Chart
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-2 sm:px-3 py-1 text-xs sm:text-sm transition-colors ${
                  viewMode === 'table'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600'
                }`}
              >
                📋 Table
              </button>
            </div>
          </div>
        </div>

        {/* Mobile totals */}
        {learningVillageTotals && (
          <div className="sm:hidden text-xs text-gray-500 dark:text-gray-400 mb-3">
            {learningVillageTotals.pageViews} views • {learningVillageTotals.uniqueVisitors} unique • Avg {formatDuration(learningVillageTotals.avgDurationMs)}
          </div>
        )}

        {visitorsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
            ))}
          </div>
        ) : visitorsError ? (
          <p className="text-red-500 text-sm">❌ {visitorsError}</p>
        ) : learningVillagePages.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No Learning Village analytics yet</p>
        ) : viewMode === 'chart' ? (
          /* Chart View */
          <div className="bg-gray-50/50 dark:bg-dark-700/30 rounded-xl p-3 sm:p-4">
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-2 sm:mb-3">
              Top Pages by Traffic
            </p>
            <TrafficBarChart data={trafficChartData} />
          </div>
        ) : (
          /* Table View */
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="mb-3 px-4 sm:px-0">
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <input
                  type="text"
                  value={learningVillageSearch}
                  onChange={(e) => setLearningVillageSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setLearningVillageSearch((value) => value.trim())}
                  placeholder="Search route..."
                  className="flex-1 px-3 py-2 sm:px-4 sm:py-3 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={() => setLearningVillageSearch((value) => value.trim())}
                  className="px-4 py-2 sm:px-6 sm:py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium text-sm"
                >
                  🔍
                </button>
              </div>
            </div>
            <div className="min-w-full px-4 sm:px-0">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400">
                    <th className="py-2 pr-2 sm:pr-4">Route</th>
                    <th className="py-2 pr-2 sm:pr-4">Views</th>
                    <th className="py-2 pr-2 sm:pr-4 hidden sm:table-cell">Unique</th>
                    <th className="py-2 pr-2 sm:pr-4 hidden md:table-cell">Avg Time</th>
                    <th className="py-2 whitespace-nowrap hidden lg:table-cell">Last Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {[...learningVillagePages]
                    .filter((page) => {
                      const query = learningVillageSearch.trim().toLowerCase();
                      if (!query) return true;
                      return page.route.toLowerCase().includes(query);
                    })
                    .sort((a, b) => b.pageViews - a.pageViews)
                    .map((page) => (
                      <tr key={page.pageKey} className="border-t border-gray-100 dark:border-gray-700">
                        <td className="py-2 pr-2 sm:pr-4 font-medium text-gray-900 dark:text-white truncate max-w-[120px] sm:max-w-none">
                          {page.route}
                        </td>
                        <td className="py-2 pr-2 sm:pr-4 text-gray-700 dark:text-gray-300">{page.pageViews}</td>
                        <td className="py-2 pr-2 sm:pr-4 text-gray-700 dark:text-gray-300 hidden sm:table-cell">{page.uniqueVisitors}</td>
                        <td className="py-2 pr-2 sm:pr-4 text-gray-700 dark:text-gray-300 hidden md:table-cell">{formatDuration(page.avgDurationMs)}</td>
                        <td className="py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap hidden lg:table-cell">
                          {page.lastVisit ? new Date(page.lastVisit).toLocaleDateString() : 'N/A'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </motion.div>
    </AdminErrorBoundary>
  );
}
