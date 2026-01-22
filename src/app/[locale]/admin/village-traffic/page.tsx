'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase/client';

interface LearningVillagePageAnalytics {
  route: string;
  pageKey: string;
  pageViews: number;
  uniqueVisitors: number;
  avgDurationMs: number;
  lastVisit: string | null;
}

export default function VillageTrafficPage() {
  const { user } = useAuth();
  const [learningVillagePages, setLearningVillagePages] = useState<LearningVillagePageAnalytics[]>([]);
  const [learningVillageTotals, setLearningVillageTotals] = useState<{ pageViews: number; uniqueVisitors: number; avgDurationMs: number } | null>(null);
  const [learningVillageSearch, setLearningVillageSearch] = useState('');
  const [visitorsLoading, setVisitorsLoading] = useState(true);
  const [visitorsError, setVisitorsError] = useState<string | null>(null);

  const formatDuration = (durationMs: number) => {
    if (!durationMs || durationMs <= 0) return 'N/A';
    const totalSeconds = Math.round(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) return `${seconds}s`;
    return `${minutes}m ${seconds}s`;
  };

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full space-y-6"
    >
      {/* Page Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-100 via-primary-50 to-transparent dark:from-primary-900/20 dark:via-primary-800/10 dark:to-transparent rounded-2xl p-6 shadow-sm">
        <div className="relative">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent">
            🏮 Village Traffic
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track Learning Village page views and unique visitors
          </p>
        </div>
      </div>

      {/* Learning Village Traffic */}
      <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            🧭 Learning Village Pages
          </h3>
          {learningVillageTotals && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {learningVillageTotals.pageViews} views • {learningVillageTotals.uniqueVisitors} unique • Avg {formatDuration(learningVillageTotals.avgDurationMs)}
            </span>
          )}
        </div>

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
        ) : (
            <div className="overflow-x-auto">
            <div className="mb-3">
              <div className="flex flex-col sm:flex-row gap-4">
                <input
                  type="text"
                  value={learningVillageSearch}
                  onChange={(e) => setLearningVillageSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setLearningVillageSearch((value) => value.trim())}
                  placeholder="Search route (e.g. /news)"
                  className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="button"
                  onClick={() => setLearningVillageSearch((value) => value.trim())}
                  className="px-6 py-3 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
                >
                  🔍 Search
                </button>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4">Route</th>
                  <th className="py-2 pr-4">Views</th>
                  <th className="py-2 pr-4">Unique</th>
                  <th className="py-2 pr-4">Avg Time</th>
                  <th className="py-2 whitespace-nowrap">Last Visit</th>
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
                      <td className="py-2 pr-4 font-medium text-gray-900 dark:text-white">{page.route}</td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{page.pageViews}</td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{page.uniqueVisitors}</td>
                      <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{formatDuration(page.avgDurationMs)}</td>
                      <td className="py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {page.lastVisit ? new Date(page.lastVisit).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
