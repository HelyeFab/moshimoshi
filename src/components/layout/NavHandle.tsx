'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavHandleProps {
  /**
   * Whether the handle should be visible
   */
  isVisible: boolean;

  /**
   * Position of the handle
   */
  position?: 'top' | 'bottom';

  /**
   * Style variant of the handle
   * - 'bar': Centered horizontal bar (legacy)
   * - 'fab': Floating action button in bottom-right corner (default, recommended)
   */
  variant?: 'bar' | 'fab';

  /**
   * Custom className
   */
  className?: string;

  /**
   * Callback when handle is tapped/clicked
   */
  onTap?: () => void;
}

/**
 * Navigation restore handle - shows when navbar is hidden
 * Two variants:
 * - 'bar': Centered horizontal bar (legacy, inspired by iOS pull-to-refresh)
 * - 'fab': Bottom-right floating action button with glassmorphism (default)
 *          Avoids conflicts with system UI and provides clear tap target
 */
export default function NavHandle({
  isVisible,
  position = 'top',
  variant = 'fab',
  className,
  onTap
}: NavHandleProps) {
  // FAB variant - glassmorphism floating button (universal design)
  if (variant === 'fab') {
    return (
      <AnimatePresence>
        {isVisible && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className={cn(
              'fixed z-[60] md:hidden',
              'bottom-1 right-4',
              'w-12 h-12 rounded-full',
              // Glassmorphism styling to match bottom navbar
              'bg-soft-white/20 dark:bg-dark-900/30',
              'backdrop-blur-2xl backdrop-saturate-150',
              'shadow-2xl shadow-japanese-sakura/20 dark:shadow-black/60',
              'flex items-center justify-center',
              'cursor-pointer',
              'active:scale-95 transition-transform',
              'overflow-hidden',
              className
            )}
            style={{
              // Add safe area padding for iPhone home indicator
              bottom: 'calc(0.25rem + env(safe-area-inset-bottom, 0px))',
            }}
            onClick={onTap}
            aria-label="Show navigation"
          >
            {/* Subtle pulsing glow */}
            <motion.div
              className="absolute inset-0 rounded-full bg-primary-500/10 dark:bg-primary-400/10"
              animate={{
                scale: [1, 1.15, 1],
                opacity: [0.3, 0.1, 0.3],
              }}
              transition={{
                repeat: Infinity,
                duration: 2.5,
                ease: 'easeInOut',
              }}
            />

            {/* Top-left curved white border accent */}
            <div
              className="absolute inset-0 rounded-full border-2 border-white/30 pointer-events-none"
              style={{
                maskImage: 'linear-gradient(135deg, black 0%, black 10%, transparent 25%)',
                WebkitMaskImage: 'linear-gradient(135deg, black 0%, black 10%, transparent 25%)',
              }}
            />

            {/* Dock Icon */}
            <Dock
              className="relative z-10 w-5 h-5 text-gray-700 dark:text-gray-200"
              strokeWidth={2}
              aria-hidden="true"
            />
          </motion.button>
        )}
      </AnimatePresence>
    );
  }

  // Default bar variant
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'fixed left-0 right-0 z-[60] md:hidden',
            position === 'top' ? 'top-0' : 'bottom-0',
            onTap ? 'cursor-pointer' : 'pointer-events-none',
            className
          )}
          onClick={onTap}
          role={onTap ? 'button' : undefined}
          aria-label={onTap ? 'Show navigation' : undefined}
        >
          <div className={cn(
            'flex justify-center',
            position === 'top' ? 'pt-2' : 'pb-2'
          )}>
            {/* Bouncing handle bar */}
            <motion.div
              animate={{
                y: position === 'top' ? [0, 5, 0] : [0, -5, 0]
              }}
              transition={{
                repeat: Infinity,
                duration: 1.5,
                ease: 'easeInOut'
              }}
              className={cn(
                'w-12 h-1 rounded-full',
                'bg-primary-600 dark:bg-primary-400',
                'shadow-lg shadow-primary-600/20 dark:shadow-primary-400/20'
              )}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
