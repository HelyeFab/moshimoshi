/**
 * Transcript Transition Component
 * Provides smooth animated transitions when switching between raw and AI-enhanced transcripts
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TranscriptTransitionProps {
  children: React.ReactNode;
  source: 'raw' | 'ai-enhanced';
  className?: string;
}

export function TranscriptTransition({ children, source, className = '' }: TranscriptTransitionProps) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={source} // Re-mount when source changes
        initial={{ opacity: 0.8, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0.8, scale: 0.98 }}
        transition={{
          duration: 0.4,
          ease: 'easeInOut'
        }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Source indicator badge
 * Shows which version of transcript is currently displayed
 */
interface SourceIndicatorProps {
  source: 'raw' | 'ai-enhanced';
  className?: string;
}

export function SourceIndicator({ source, className = '' }: SourceIndicatorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`inline-flex items-center gap-2 text-xs ${className}`}
    >
      {source === 'ai-enhanced' ? (
        <>
          <motion.span
            animate={{
              rotate: [0, 360],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            ✨
          </motion.span>
          <span className="text-purple-600 dark:text-purple-400 font-medium">
            AI-Enhanced Transcript
          </span>
          <span className="text-gray-500 text-xs">
            (Better line breaks, translations, difficulty ratings)
          </span>
        </>
      ) : (
        <>
          <span>📝</span>
          <span className="text-gray-600 dark:text-gray-400 font-medium">
            Raw Transcript
          </span>
          <span className="text-gray-500 text-xs">
            (Original captions from YouTube)
          </span>
        </>
      )}
    </motion.div>
  );
}
