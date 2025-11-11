'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
   * Custom className
   */
  className?: string;

  /**
   * Callback when handle is tapped/clicked
   */
  onTap?: () => void;
}

/**
 * Bouncing handle indicator - shows when navbar is hidden
 * Inspired by iOS pull-to-refresh and YouTube page implementation
 */
export default function NavHandle({
  isVisible,
  position = 'top',
  className,
  onTap
}: NavHandleProps) {
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
            {/* Bouncing handle */}
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
