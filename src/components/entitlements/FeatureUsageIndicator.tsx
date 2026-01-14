'use client';

/**
 * FeatureUsageIndicator
 *
 * Responsive usage indicator that shows:
 * - Desktop: Circular progress in page header
 * - Mobile: Gradient progress bar under header
 *
 * Usage:
 *   <FeatureUsageIndicator featureId="kanji_mood_board" />
 */

import { useEffect } from 'react';
import { useFeature } from '@/hooks/useFeature';
import { CircularProgress, ProgressBar } from '@/components/ui/ProgressBar';
import type { FeatureId } from '@/types/FeatureId';

interface FeatureUsageIndicatorProps {
  featureId: FeatureId;
  className?: string;
}

export function FeatureUsageIndicator({ featureId, className = '' }: FeatureUsageIndicatorProps) {
  const { lastDecision, remaining, checkOnly } = useFeature(featureId);

  // Check feature limits on mount
  useEffect(() => {
    checkOnly({ failOpen: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Don't show if no decision yet or unlimited
  const limitCount = lastDecision?.limit ?? 5;
  const isUnlimited = limitCount === -1;

  if (!lastDecision || isUnlimited) {
    return null;
  }

  return (
    <MobileBarIndicator
      remaining={remaining ?? 0}
      limitCount={limitCount}
      className={className}
    />
  );
}

/**
 * Hook to get usage data for manual rendering
 */
export function useFeatureUsage(featureId: FeatureId) {
  const { lastDecision, remaining, checkOnly } = useFeature(featureId);

  // Check feature limits on mount
  useEffect(() => {
    checkOnly({ failOpen: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const limitCount = lastDecision?.limit ?? 5;
  const isUnlimited = limitCount === -1;
  const usedCount = lastDecision?.usageBefore ?? 0;

  // Color based on usage
  const getProgressColor = (): 'green' | 'yellow' | 'red' => {
    const percentage = (usedCount / limitCount) * 100;
    if (percentage >= 100) return 'red';
    if (percentage >= 80) return 'yellow';
    return 'green';
  };

  return {
    lastDecision,
    remaining: remaining ?? 0,
    limitCount,
    usedCount,
    isUnlimited,
    color: getProgressColor(),
    hasData: !!lastDecision && !isUnlimited,
  };
}

interface DesktopCircularIndicatorProps {
  remaining: number;
  limitCount: number;
  usedCount: number;
  color: 'green' | 'yellow' | 'red';
  className?: string;
}

function DesktopCircularIndicator({
  remaining,
  limitCount,
  usedCount,
  color,
  className = ''
}: DesktopCircularIndicatorProps) {
  const used = limitCount - remaining;

  return (
    <div className={`hidden sm:flex flex-col items-center ${className}`}>
      <div className="relative">
        <CircularProgress
          value={used}
          max={limitCount}
          size={80}
          strokeWidth={6}
          color={color}
          showValue={false}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">
            {used}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            / {limitCount}
          </span>
        </div>
      </div>
    </div>
  );
}

interface MobileBarIndicatorProps {
  remaining: number;
  limitCount: number;
  className?: string;
}

function MobileBarIndicator({
  remaining,
  limitCount,
  className = ''
}: MobileBarIndicatorProps) {
  const used = limitCount - remaining;

  return (
    <div className={`sm:hidden px-4 -mt-4 mb-4 ${className}`}>
      <div className="bg-white dark:bg-dark-800 rounded-lg p-3 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {used} / {limitCount}
          </span>
        </div>
        <ProgressBar
          value={used}
          max={limitCount}
          size="md"
          color="gradient"
          className="w-full"
        />
      </div>
    </div>
  );
}

// Export individual components for custom layouts
export { DesktopCircularIndicator, MobileBarIndicator };
