'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/components/ui/Toast/ToastContext';

interface DateRangeScrapingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScrapingStart: (message: string) => void;
  onScrapingComplete: (message: string) => void;
}

interface ProgressState {
  stage: string;
  substage?: string | null;
  details: string;
  percentage: number;
  status: string;
}

const STAGE_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  initializing: { icon: '🚀', label: 'Initializing', color: 'text-blue-500' },
  scraping: { icon: '📰', label: 'Scraping Articles', color: 'text-purple-500' },
  audio: { icon: '🎵', label: 'Generating Audio', color: 'text-green-500' },
  translation: { icon: '🌐', label: 'Translating', color: 'text-orange-500' },
  words: { icon: '📖', label: 'Word Explanations', color: 'text-pink-500' },
  complete: { icon: '✅', label: 'Complete', color: 'text-emerald-500' },
  error: { icon: '❌', label: 'Error', color: 'text-red-500' },
  unknown: { icon: '⏳', label: 'Processing', color: 'text-gray-500' }
};

export default function DateRangeScrapingModal({
  isOpen,
  onClose,
  onScrapingStart,
  onScrapingComplete
}: DateRangeScrapingModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [progressId, setProgressId] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const { showToast } = useToast();

  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Default to 7 days ago
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]; // Default to today
  });

  // Generate unique ID for progress tracking
  const generateProgressId = useCallback(() => {
    return `scrape-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Poll for progress updates
  const pollProgress = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/admin/scraping-progress?id=${id}`);
      const data = await response.json();

      if (data.success && data.progress) {
        setProgress(data.progress);

        // Stop polling if complete
        if (data.progress.status === 'complete') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }
    } catch (error) {
      console.error('Failed to poll progress:', error);
    }
  }, []);

  // Cleanup polling on unmount or modal close
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, []);

  // Reset progress when modal closes
  useEffect(() => {
    if (!isOpen) {
      setProgress(null);
      setProgressId(null);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [isOpen]);

  // Validate date range (max 30 days)
  const validateDateRange = (): string | null => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (start > end) {
      return 'Start date must be before end date';
    }

    if (diffDays > 30) {
      return 'Date range cannot exceed 30 days';
    }

    return null;
  };

  const formatDateForDisplay = (dateStr: string): string => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysDifference = (): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end dates
  };

  const handleStartScraping = async () => {
    setIsLoading(true);
    setProgress(null);

    // Validate date range first
    const validationError = validateDateRange();
    if (validationError) {
      showToast(validationError, 'error');
      setIsLoading(false);
      return;
    }

    // Generate progress ID and start polling
    const newProgressId = generateProgressId();
    setProgressId(newProgressId);

    // Set initial progress state
    setProgress({
      stage: 'initializing',
      details: 'Connecting to scraper...',
      percentage: 0,
      status: 'running'
    });

    // Start polling for progress updates
    pollingRef.current = setInterval(() => {
      pollProgress(newProgressId);
    }, 1500); // Poll every 1.5 seconds

    onScrapingStart(`🔄 Scraping NHK Easy articles from ${formatDateForDisplay(startDate)} to ${formatDateForDisplay(endDate)}...`);

    try {
      const params = new URLSearchParams({
        source: 'nhk-easy',
        force: 'true',
        startDate,
        endDate,
        progressId: newProgressId
      });

      const response = await fetch(`/api/news/scrape?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger scraping: ${response.statusText}`);
      }

      const data = await response.json();
      const successMessage = `✅ Successfully scraped ${data.articlesCount || 0} articles from NHK Easy (${startDate} to ${endDate})`;

      // Stop polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      // Final progress update
      setProgress({
        stage: 'complete',
        details: `Completed: ${data.articlesCount || 0} article(s) processed`,
        percentage: 100,
        status: 'complete'
      });

      onScrapingComplete(successMessage);
      showToast(`Scraped ${data.articlesCount || 0} articles successfully!`, 'success');

      // Wait a moment to show completion state before closing
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err) {
      // Stop polling on error
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }

      setProgress({
        stage: 'error',
        details: err instanceof Error ? err.message : 'Unknown error',
        percentage: 0,
        status: 'error'
      });

      const errorMessage = `❌ Error: ${err instanceof Error ? err.message : 'Failed to trigger scraping'}`;
      onScrapingComplete(errorMessage);
      showToast(err instanceof Error ? err.message : 'Failed to scrape articles', 'error');
      setIsLoading(false);
    }
  };

  const validationError = validateDateRange();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-dark-850 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">📺</span>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Scrape NHK Easy News
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  disabled={isLoading}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Date Range Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      max={endDate}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
                      disabled={isLoading}
                    />
                  </div>

                  {/* End Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      max={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Date Range Summary */}
                {startDate && endDate && !validationError && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div className="text-sm text-blue-800 dark:text-blue-300">
                        <p className="font-medium mb-1">Scraping Range</p>
                        <p>
                          <span className="font-medium">{formatDateForDisplay(startDate)}</span> to{' '}
                          <span className="font-medium">{formatDateForDisplay(endDate)}</span>
                        </p>
                        <p className="text-xs mt-1 opacity-90">
                          ({getDaysDifference()} days total)
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Validation Error */}
                {validationError && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <div className="text-sm text-red-800 dark:text-red-300">
                        <p className="font-medium">Invalid Date Range</p>
                        <p>{validationError}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Info Box - Only show when not loading */}
                {!isLoading && (
                  <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div className="text-sm text-gray-700 dark:text-gray-300">
                        <p className="font-medium mb-1">How it works</p>
                        <ul className="space-y-1 text-xs">
                          <li>• Articles from the selected date range will be fetched from NHK Easy</li>
                          <li>• Duplicates are automatically prevented using URL-based deduplication</li>
                          <li>• Maximum date range is 30 days to prevent API overload</li>
                          <li>• Articles include full text, furigana, and native audio</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Progress Display */}
                {isLoading && progress && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5"
                  >
                    {/* Stage Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">
                        {STAGE_LABELS[progress.stage]?.icon || STAGE_LABELS.unknown.icon}
                      </span>
                      <div>
                        <p className={`font-bold ${STAGE_LABELS[progress.stage]?.color || STAGE_LABELS.unknown.color}`}>
                          {STAGE_LABELS[progress.stage]?.label || STAGE_LABELS.unknown.label}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {progress.details}
                        </p>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                        <span>Progress</span>
                        <span>{Math.round(progress.percentage)}%</span>
                      </div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress.percentage}%` }}
                          transition={{ duration: 0.5, ease: 'easeOut' }}
                          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
                        />
                      </div>
                    </div>

                    {/* Stage Steps */}
                    <div className="flex justify-between text-xs">
                      {['scraping', 'audio', 'translation', 'words'].map((stage, index) => {
                        const stageInfo = STAGE_LABELS[stage];
                        const stageOrder = ['scraping', 'audio', 'translation', 'words'];
                        const currentIndex = stageOrder.indexOf(progress.stage);
                        const isCompleted = index < currentIndex || progress.stage === 'complete';
                        const isCurrent = stage === progress.stage;

                        return (
                          <div key={stage} className="flex flex-col items-center gap-1">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all ${
                                isCompleted
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                                  : isCurrent
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-gray-800'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400'
                              }`}
                            >
                              {isCompleted ? '✓' : stageInfo.icon}
                            </div>
                            <span className={`${isCurrent ? 'font-medium text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
                              {stageInfo.label.split(' ')[0]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors font-medium"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleStartScraping}
                  disabled={isLoading || !!validationError}
                  className="px-6 py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all shadow-sm flex items-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Scraping...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                      Start Scraping
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}