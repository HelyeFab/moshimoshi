'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ScrapingLog {
  id: string;
  type: 'scheduled' | 'manual';
  totalArticles: number;
  successfulSources: number;
  failedSources: number;
  duration: number;
  sources: Array<{
    name: string;
    status: string;
    articlesCount?: number;
    error?: string;
  }>;
  preCaching?: {
    audioGenerated?: number;
    translationsGenerated?: number;
    wordExplanationsGenerated?: number;
    totalCost?: number;
  };
  createdAt: string | null;
  source?: string;
  dateRange?: { startDate: string; endDate: string };
  error?: string;
}

interface ScrapingLogsPanelProps {
  refreshTrigger?: number;
}

export default function ScrapingLogsPanel({ refreshTrigger }: ScrapingLogsPanelProps) {
  const [logs, setLogs] = useState<ScrapingLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'manual'>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [filter, refreshTrigger]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const typeParam = filter === 'all' ? '' : `&type=${filter}`;
      const response = await fetch(`/api/admin/scraping-logs?limit=20${typeParam}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.logs || []);
      } else {
        setError(data.error || 'Failed to fetch logs');
      }
    } catch (err) {
      // Don't show error for empty collection
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = async () => {
    try {
      setClearing(true);
      const typeParam = filter === 'all' ? '' : `?type=${filter}`;
      const response = await fetch(`/api/admin/scraping-logs${typeParam}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        setLogs([]);
        setShowClearConfirm(false);
      } else {
        setError(data.error || 'Failed to clear logs');
      }
    } catch (err) {
      setError('Failed to clear logs');
    } finally {
      setClearing(false);
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (log: ScrapingLog) => {
    if (log.error || log.failedSources > 0) return 'bg-red-500';
    if (log.totalArticles === 0) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getStatusIcon = (log: ScrapingLog) => {
    if (log.error || log.failedSources > 0) return '❌';
    if (log.totalArticles === 0) return '⚠️';
    return '✅';
  };

  return (
    <div className="bg-white/80 dark:bg-dark-800/80 backdrop-blur-sm rounded-2xl shadow-lg border border-gray-200/50 dark:border-dark-700/50 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="text-primary-500">📋</span>
          Scraping Logs
        </h3>

        {/* Filter Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-dark-700 rounded-lg p-1">
          {(['all', 'scheduled', 'manual'] as const).map((filterType) => (
            <button
              key={filterType}
              onClick={() => setFilter(filterType)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                filter === filterType
                  ? 'bg-white dark:bg-dark-600 text-primary-600 dark:text-primary-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {filterType === 'all' ? 'All' : filterType === 'scheduled' ? '⏰ Auto' : '👆 Manual'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-500">{error}</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No scraping logs found
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-hide">
          <AnimatePresence>
            {logs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="border border-gray-200 dark:border-dark-600 rounded-xl overflow-hidden"
              >
                {/* Log Header */}
                <button
                  onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                  className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                >
                  {/* Status Indicator */}
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(log)}`} />

                  {/* Type Badge */}
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    log.type === 'scheduled'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                  }`}>
                    {log.type === 'scheduled' ? '⏰ Auto' : '👆 Manual'}
                  </span>

                  {/* Status Icon & Articles Count */}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {getStatusIcon(log)} {log.totalArticles} article{log.totalArticles !== 1 ? 's' : ''}
                  </span>

                  {/* Duration */}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDuration(log.duration)}
                  </span>

                  {/* Pre-cache info */}
                  {log.preCaching && (
                    <span className="text-xs text-green-600 dark:text-green-400">
                      💰 ${log.preCaching.totalCost?.toFixed(3) || '0.00'}
                    </span>
                  )}

                  {/* Spacer */}
                  <div className="flex-grow" />

                  {/* Time */}
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(log.createdAt)}
                  </span>

                  {/* Expand Icon */}
                  <svg
                    className={`w-4 h-4 text-gray-400 transition-transform ${expandedLog === log.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded Details */}
                <AnimatePresence>
                  {expandedLog === log.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-700/50 px-4 py-3"
                    >
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        {/* Sources */}
                        {log.sources && log.sources.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Sources</p>
                            {log.sources.map((source, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <span className={source.status === 'success' ? 'text-green-500' : 'text-red-500'}>
                                  {source.status === 'success' ? '✓' : '✗'}
                                </span>
                                <span className="text-gray-700 dark:text-gray-300">{source.name}</span>
                                {source.articlesCount !== undefined && (
                                  <span className="text-gray-500">({source.articlesCount})</span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Pre-caching Details */}
                        {log.preCaching && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Pre-caching</p>
                            <div className="space-y-1 text-gray-700 dark:text-gray-300">
                              {log.preCaching.audioGenerated !== undefined && (
                                <p>🔊 Audio: {log.preCaching.audioGenerated}</p>
                              )}
                              {log.preCaching.translationsGenerated !== undefined && (
                                <p>🌐 Translations: {log.preCaching.translationsGenerated}</p>
                              )}
                              {log.preCaching.wordExplanationsGenerated !== undefined && (
                                <p>📖 Words: {log.preCaching.wordExplanationsGenerated}</p>
                              )}
                              {log.preCaching.totalCost !== undefined && (
                                <p className="text-green-600 dark:text-green-400 font-medium">
                                  💰 Cost: ${log.preCaching.totalCost.toFixed(4)}
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Date Range (for manual) */}
                        {log.dateRange && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Date Range</p>
                            <p className="text-gray-700 dark:text-gray-300">
                              {log.dateRange.startDate} → {log.dateRange.endDate}
                            </p>
                          </div>
                        )}

                        {/* Error */}
                        {log.error && (
                          <div className="col-span-2">
                            <p className="text-xs font-semibold text-red-500 mb-1">Error</p>
                            <p className="text-red-600 dark:text-red-400 text-xs font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded">
                              {log.error}
                            </p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex justify-center gap-3">
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
        >
          🔄 Refresh
        </button>
        {logs.length > 0 && (
          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={loading || clearing}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
          >
            🗑️ Clear {filter !== 'all' ? filter : 'All'}
          </button>
        )}
      </div>

      {/* Clear Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-dark-800 rounded-xl p-6 max-w-sm mx-4 shadow-xl"
            >
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Clear Logs?
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                This will permanently delete {filter === 'all' ? 'all' : filter} scraping logs. This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  disabled={clearing}
                  className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={clearLogs}
                  disabled={clearing}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {clearing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    '🗑️ Clear'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
