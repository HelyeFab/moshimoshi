'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { auth } from '@/lib/firebase/client';
import { AdminErrorBoundary } from '@/components/admin/AdminErrorBoundary';

interface ContentClickItem {
  id: string;
  type: 'resource' | 'video';
  contentId: string;
  title?: string;
  url?: string;
  totalClicks?: number;
  sourceClicks?: Record<string, number>;
  lastClickedAt?: { seconds?: number; toDate?: () => Date } | string | null;
}

export default function ContentClicksAdminPage() {
  const [items, setItems] = useState<ContentClickItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'resource' | 'video'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchClicks = async () => {
      try {
        setLoading(true);
        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          setLoading(false);
          return;
        }

        const query = filter === 'all' ? '' : `?type=${filter}`;
        const response = await fetch(`/api/admin/analytics/content-clicks${query}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await response.json();
        if (!data.success) {
          setError(data.error || 'Failed to load content clicks');
        } else {
          setItems(data.items || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load content clicks');
      } finally {
        setLoading(false);
      }
    };

    fetchClicks();
  }, [filter]);

  const formatTimestamp = (value: ContentClickItem['lastClickedAt']) => {
    if (!value) return 'N/A';
    if (typeof value === 'string') return new Date(value).toLocaleDateString();
    if (typeof value === 'object' && value?.toDate) return value.toDate().toLocaleDateString();
    return 'N/A';
  };

  const filteredItems = items.filter((item) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    const haystack = `${item.title || ''} ${item.contentId || ''}`.toLowerCase();
    return haystack.includes(query);
  });

  return (
    <AdminErrorBoundary componentName="Content Clicks">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full space-y-6"
    >
      <div className="relative overflow-hidden bg-gradient-to-br from-primary-100 via-primary-50 to-transparent dark:from-primary-900/20 dark:via-primary-800/10 dark:to-transparent rounded-2xl p-6 shadow-sm">
        <h2 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-primary-800 dark:from-primary-400 dark:to-primary-600 bg-clip-text text-transparent">
          📌 Content Clicks
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Track resource and popular video click activity
        </p>
      </div>

      <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or ID"
            className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-dark-850 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          <div className="flex gap-2">
            {(['all', 'resource', 'video'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === value
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                {value === 'all' ? 'All' : value === 'resource' ? 'Resources' : 'Videos'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded animate-pulse"></div>
            ))}
          </div>
        ) : error ? (
          <p className="text-red-500 text-sm">❌ {error}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No click data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Title</th>
                  <th className="py-2 pr-4">ID</th>
                  <th className="py-2 pr-4">Clicks</th>
                  <th className="py-2 pr-4">Last Click</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-t border-gray-100 dark:border-gray-700">
                    <td className="py-2 pr-4 capitalize text-gray-700 dark:text-gray-300">{item.type}</td>
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">
                      {item.title || 'Untitled'}
                    </td>
                    <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{item.contentId}</td>
                    <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{item.totalClicks || 0}</td>
                    <td className="py-2 text-gray-500 dark:text-gray-400">
                      {formatTimestamp(item.lastClickedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
    </AdminErrorBoundary>
  );
}
