'use client';

/**
 * LockScreen - A reusable lock screen overlay component
 *
 * Prevents accidental touches when the phone is in a pocket.
 * Users unlock by tapping Doshi 3 times, watching it colorize with each tap.
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import DoshiMascot from '@/components/ui/DoshiMascot';
import { Lock } from 'lucide-react';

export interface LockScreenProps {
  isLocked: boolean;
  onUnlock: () => void;
  /** Instruction text shown below Doshi */
  unlockText?: string;
  /** Title shown at the top */
  title?: string;
  className?: string;
}

const TAP_TIMEOUT_MS = 2000; // Reset tap count if no tap within 2 seconds

export function LockScreen({
  isLocked,
  onUnlock,
  unlockText = 'Tap Doshi 3 times to unlock',
  title = 'Screen Locked',
  className = '',
}: LockScreenProps) {
  const [tapCount, setTapCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Client-side only mounting for portal
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset tap count when locked
  useEffect(() => {
    if (isLocked) {
      setTapCount(0);
      setIsUnlocking(false);
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = null;
      }
    }
  }, [isLocked]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  // Body scroll lock
  useEffect(() => {
    if (isLocked && mounted) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isLocked, mounted]);

  const handleTap = () => {
    if (isUnlocking) return;

    // Clear any existing timeout
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    const newCount = tapCount + 1;
    setTapCount(newCount);

    if (newCount >= 3) {
      setIsUnlocking(true);
      // Brief delay for animation to complete
      setTimeout(() => {
        onUnlock();
      }, 400);
    } else {
      // Reset tap count after timeout if user doesn't continue tapping
      tapTimeoutRef.current = setTimeout(() => {
        setTapCount(0);
      }, TAP_TIMEOUT_MS);
    }
  };

  // Greyscale levels based on tap count (100% -> 66% -> 33% -> 0%)
  const grayscaleLevel = Math.max(0, 100 - tapCount * 34);

  if (!mounted || !isLocked) return null;

  return createPortal(
    <AnimatePresence>
      {isLocked && (
        <motion.div
          className={`fixed inset-0 z-50 ${className}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Content */}
          <div className="relative flex flex-col items-center justify-center h-full px-6">
            {/* Lock icon and title */}
            <motion.div
              className="flex items-center gap-2 mb-6"
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              <Lock className="w-6 h-6 text-white/70" />
              <span className="text-xl font-medium text-white/90">{title}</span>
            </motion.div>

            {/* Doshi with greyscale filter */}
            <motion.div
              onClick={handleTap}
              className="cursor-pointer select-none"
              style={{
                filter: `grayscale(${grayscaleLevel}%)`,
                transition: 'filter 0.3s ease-out',
              }}
              whileTap={{ scale: 1.15 }}
              animate={
                isUnlocking
                  ? {
                      scale: [1, 1.2, 1],
                      rotate: [0, -5, 5, 0],
                    }
                  : {}
              }
              transition={{ duration: 0.4 }}
            >
              <DoshiMascot size="xlarge" variant="static" />
            </motion.div>

            {/* Instructions */}
            <motion.p
              className="text-white/80 mt-6 text-center text-lg"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {unlockText}
            </motion.p>

            {/* Progress dots */}
            <motion.div
              className="flex gap-3 mt-4"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 ${
                    i < tapCount
                      ? 'bg-primary-500 border-primary-500'
                      : 'bg-transparent border-white/40'
                  }`}
                  animate={
                    i === tapCount - 1 && tapCount > 0
                      ? { scale: [1, 1.3, 1] }
                      : {}
                  }
                  transition={{ duration: 0.2 }}
                />
              ))}
            </motion.div>

            {/* Tap counter (subtle) */}
            <motion.span
              className="text-white/50 text-sm mt-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {tapCount}/3
            </motion.span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default LockScreen;
