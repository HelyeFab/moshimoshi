'use client';

import { useState } from 'react';
import { XMarkIcon, LightBulbIcon } from '@heroicons/react/24/outline';
import { useConjugationHelp } from '@/contexts/ConjugationHelpContext';
import type { ConjugationErrorReport } from '@/lib/conjugation-help';

interface HelpBannerProps {
  errorReport: ConjugationErrorReport;
  onDismiss: () => void;
}

/**
 * Subtle, non-intrusive help banner that shows contextual tips
 * Appears below answer feedback when user makes a mistake
 * Only shows THE MOST RELEVANT help for the specific form being practiced
 */
export function HelpBanner({ errorReport, onDismiss }: HelpBannerProps) {
  const { showMultipleHelps } = useConjugationHelp();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if no relevant help
  if (!errorReport.relevantHelp || errorReport.relevantHelp.length === 0) {
    return null;
  }

  // Don't show if dismissed
  if (dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  const handleLearnMore = () => {
    const helps = errorReport.relevantHelp.map(rh => rh.helpContent);
    showMultipleHelps(helps, errorReport.analysis);
    handleDismiss();
  };

  return (
    <div className="mt-4 rounded-lg border-2 border-yellow-400 dark:border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 p-4 shadow-sm animate-fade-in">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <LightBulbIcon className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Quick Tip */}
          {errorReport.quickTip && (
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
              {errorReport.quickTip}
            </p>
          )}

          {/* Relevant Help Title */}
          {errorReport.relevantHelp[0] && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg" role="img" aria-label="help emoji">
                {errorReport.relevantHelp[0].helpContent.emoji}
              </span>
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                {errorReport.relevantHelp[0].helpContent.title}
              </span>
            </div>
          )}

          {/* Learn More Button */}
          <button
            onClick={handleLearnMore}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium underline decoration-dotted underline-offset-2 transition-colors"
          >
            Learn more
          </button>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          aria-label="Dismiss help"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
