'use client';

/**
 * Help Modal Component
 *
 * Displays full help content with examples, tips, and navigation.
 * Supports both smart mode (error-triggered) and manual mode (user-initiated).
 */

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Modal from '@/components/ui/Modal';
import { useConjugationHelp } from '@/contexts/ConjugationHelpContext';
import { useI18n } from '@/i18n/I18nContext';

export function HelpModal() {
  const { t } = useI18n();
  const {
    currentHelp,
    helpQueue,
    currentHelpIndex,
    isModalOpen,
    errorReport,
    mode,
    nextHelp,
    prevHelp,
    closeHelp,
  } = useConjugationHelp();

  if (!currentHelp) return null;

  const hasMultipleHelps = helpQueue.length > 1;
  const canGoPrev = currentHelpIndex > 0;
  const canGoNext = currentHelpIndex < helpQueue.length - 1;

  return (
    <Modal
      isOpen={isModalOpen}
      onClose={closeHelp}
      title={
        <div className="flex items-center gap-2">
          <span className="text-2xl" role="img" aria-label={currentHelp.title}>
            {currentHelp.emoji}
          </span>
          <span>{currentHelp.title}</span>
        </div>
      }
      size="lg"
      showCloseButton={true}
      closeOnOverlayClick={true}
      closeOnEsc={true}
    >
      <div className="space-y-6">
        {/* Smart Mode Context Banner */}
        {mode === 'smart' && errorReport && (
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
              {t('conjugation.help.smartModeTitle') || 'Smart Help'}
            </div>
            <div className="text-sm text-yellow-800 dark:text-yellow-200">
              {errorReport.quickTip || t('conjugation.help.smartModeDesc') || 'This help was suggested based on your answer.'}
            </div>
          </div>
        )}

        {/* Explanation */}
        <section>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <div className="whitespace-pre-line text-gray-700 dark:text-gray-300">
              {currentHelp.explanation}
            </div>
          </div>
        </section>

        {/* Examples */}
        {currentHelp.examples && currentHelp.examples.length > 0 && (
          <section>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide mb-3">
              {t('conjugation.help.examples') || 'Examples'}
            </h3>
            <div className="space-y-3">
              {currentHelp.examples.map((example, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700"
                >
                  <div className="text-base font-medium text-gray-900 dark:text-gray-100 mb-1 japanese-text">
                    {example.japanese}
                  </div>
                  {example.romaji && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      {example.romaji}
                    </div>
                  )}
                  {example.translation && (
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {example.translation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tip/Mnemonic */}
        {currentHelp.tip && (
          <section className="p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-300 dark:border-yellow-700">
            <div className="flex items-start gap-2">
              <span className="text-xl" role="img" aria-label="tip">
                💡
              </span>
              <div>
                <div className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-1">
                  {t('conjugation.help.tip') || 'Tip'}
                </div>
                <div className="text-sm text-yellow-900 dark:text-yellow-50 font-medium">
                  {currentHelp.tip}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Navigation for multiple helps */}
        {hasMultipleHelps && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-dark-700">
            <button
              type="button"
              onClick={prevHelp}
              disabled={!canGoPrev}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg
                text-sm font-medium
                transition-colors
                ${canGoPrev
                  ? 'bg-gray-100 dark:bg-dark-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-dark-600'
                  : 'bg-gray-50 dark:bg-dark-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                }
              `}
              aria-label="Previous help"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>{t('conjugation.help.previous') || 'Previous'}</span>
            </button>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              {currentHelpIndex + 1} / {helpQueue.length}
            </div>

            <button
              type="button"
              onClick={nextHelp}
              disabled={!canGoNext}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg
                text-sm font-medium
                transition-colors
                ${canGoNext
                  ? 'bg-primary-500 text-white hover:bg-primary-600'
                  : 'bg-gray-50 dark:bg-dark-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                }
              `}
              aria-label="Next help"
            >
              <span>{t('conjugation.help.next') || 'Next'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
