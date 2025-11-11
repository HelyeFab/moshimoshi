/**
 * AI Enhancement Progress Indicator
 * Non-intrusive progress bar showing AI enhancement status
 * User can continue shadowing while this processes
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AIEnhancementProgressProps {
  progress: number; // 0-100
  className?: string;
}

export function AIEnhancementProgress({ progress, className = '' }: AIEnhancementProgressProps) {
  // Don't show if progress is 0 (not started) or 100 (completed)
  if (progress === 0 || progress === 100) {
    return null;
  }

  // Get appropriate message based on progress
  const getMessage = (progress: number): string => {
    if (progress < 25) return 'Analyzing speech patterns...';
    if (progress < 50) return 'Optimizing line breaks for shadowing...';
    if (progress < 75) return 'Adding educational enhancements...';
    if (progress < 90) return 'Applying finishing touches...';
    return 'Almost done...';
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: 'auto' }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        transition={{ duration: 0.3 }}
        className={`bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 mb-4 border border-purple-200/50 dark:border-purple-700/30 shadow-sm ${className}`}
      >
        <div className="flex items-start gap-3">
          {/* Animated sparkle icon */}
          <motion.div
            animate={{
              rotate: [0, 360],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="text-2xl flex-shrink-0"
          >
            ✨
          </motion.div>

          {/* Progress content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">
                Enhancing transcript with AI
              </p>
              <span className="text-xs font-mono text-purple-700 dark:text-purple-300 tabular-nums">
                {Math.round(progress)}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-purple-100 dark:bg-purple-900/30 rounded-full h-2 mb-2 overflow-hidden">
              <motion.div
                className="h-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              />
            </div>

            {/* Status message */}
            <p className="text-xs text-purple-700 dark:text-purple-300 mb-2">
              {getMessage(progress)}
            </p>

            {/* User notification */}
            <div className="flex items-start gap-2 bg-white/50 dark:bg-black/20 rounded-md p-2 mt-2">
              <span className="text-base flex-shrink-0">💡</span>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                You can continue shadowing with the raw transcript while AI enhances it
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Completion notification component
 * Shows briefly when AI enhancement completes
 */
interface AIEnhancementCompleteProps {
  show: boolean;
  onDismiss?: () => void;
}

export function AIEnhancementComplete({ show, onDismiss }: AIEnhancementCompleteProps) {
  React.useEffect(() => {
    if (show && onDismiss) {
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 200 }}
      className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 mb-4 border border-green-200/50 dark:border-green-700/30 shadow-lg"
    >
      <div className="flex items-center gap-3">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
          className="text-3xl"
        >
          ✨
        </motion.div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-900 dark:text-green-100">
            AI Enhancement Complete!
          </p>
          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
            Better line breaks and educational features have been added. The transcript will update smoothly.
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  );
}
