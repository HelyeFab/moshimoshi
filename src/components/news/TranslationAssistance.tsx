/**
 * Translation Assistance Component
 * Progressive disclosure UI for learning-focused translation
 */

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EyeIcon,
  EyeSlashIcon,
  LightBulbIcon,
  AcademicCapIcon,
  SpeakerWaveIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BookOpenIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { TranslationMode } from '@/types/story';
import { AIService } from '@/lib/ai/AIService';
import { TranslationResult } from '@/lib/ai/processors/TranslationProcessor';
import { useTTS } from '@/hooks/useTTS';

// ============================================
// Translation Assistance Types
// ============================================

export interface TranslationAssistanceProps {
  text: string;
  mode: TranslationMode;
  userLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  showConfidence: boolean;
  includeGrammarNotes: boolean;
  onWordSelect?: (word: string) => void;
  onVocabularyAdd?: (word: string, translation: string) => void;
  className?: string;
  children?: React.ReactNode;
}

interface TranslationState {
  hints: string[];
  partial: {
    translatedText: string;
    translatedParts: Array<{
      original: string;
      translation: string;
      type: string;
    }>;
  } | null;
  full: TranslationResult | null;
  loading: boolean;
  error: string | null;
}

// ============================================
// Main Translation Assistance Component
// ============================================

export const TranslationAssistance: React.FC<TranslationAssistanceProps> = ({
  text,
  mode,
  userLevel,
  showConfidence = true,
  includeGrammarNotes = true,
  onWordSelect,
  onVocabularyAdd,
  className = ''
}) => {
  const [translationState, setTranslationState] = useState<TranslationState>({
    hints: [],
    partial: null,
    full: null,
    loading: false,
    error: null
  });

  const [currentLevel, setCurrentLevel] = useState<'none' | 'hints' | 'partial' | 'full'>('none');
  const [isHovering, setIsHovering] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const hoverTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const aiService = AIService.getInstance();
  const { play: playAudio } = useTTS();

  // ============================================
  // Translation Fetching Logic
  // ============================================

  const fetchTranslation = useCallback(async (requestedLevel: 'hints' | 'partial' | 'full') => {
    if (mode === 'off') return;

    // Check if we already have this level
    if (
      (requestedLevel === 'hints' && translationState.hints.length > 0) ||
      (requestedLevel === 'partial' && translationState.partial) ||
      (requestedLevel === 'full' && translationState.full)
    ) {
      return;
    }

    setTranslationState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await aiService.translateText(text, requestedLevel, {
        jlptLevel: userLevel,
        includeExplanations: includeGrammarNotes
      });

      if (response.success && response.data) {
        const result = response.data;

        setTranslationState(prev => ({
          ...prev,
          loading: false,
          [requestedLevel === 'hints' ? 'hints' :
           requestedLevel === 'partial' ? 'partial' : 'full']:
           requestedLevel === 'hints' ? result.hints?.map(h => h.explanation) || [] :
           requestedLevel === 'partial' ? {
             translatedText: result.partialTranslation?.partial || result.translatedText,
             translatedParts: result.partialTranslation?.translatedParts || []
           } : result
        }));
      } else {
        setTranslationState(prev => ({
          ...prev,
          loading: false,
          error: response.error || 'Translation failed'
        }));
      }
    } catch (error) {
      setTranslationState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Translation failed'
      }));
    }
  }, [text, mode, userLevel, includeGrammarNotes, aiService, translationState]);

  // ============================================
  // Interaction Handlers
  // ============================================

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
    // Note: Hover activation removed - now using icon-based system
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);

    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
  }, []);

  const handleTap = useCallback(() => {
    // Note: Tap activation removed - now using icon-based system
  }, []);

  const handleManualRequest = useCallback((level: 'hints' | 'partial' | 'full') => {
    setCurrentLevel(level);
    fetchTranslation(level);
  }, [fetchTranslation]);

  const handlePlayAudio = useCallback(async (textToPlay: string) => {
    try {
      await playAudio(textToPlay);
    } catch (error) {
      console.error('Audio playback failed:', error);
    }
  }, [playAudio]);

  // ============================================
  // Auto-fetch based on mode
  // ============================================

  useEffect(() => {
    if (mode === 'hints' || mode === 'learning') {
      setCurrentLevel('hints');
      fetchTranslation('hints');
    } else if (mode === 'partial') {
      setCurrentLevel('partial');
      fetchTranslation('partial');
    } else if (mode === 'full') {
      setCurrentLevel('full');
      fetchTranslation('full');
    }
  }, [mode, fetchTranslation]);

  // ============================================
  // Cleanup
  // ============================================

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // ============================================
  // Render Functions
  // ============================================

  const renderHints = () => {
    if (currentLevel !== 'hints' || translationState.hints.length === 0) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500"
      >
        <div className="flex items-start gap-2">
          <LightBulbIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
              Grammar Hints
            </h4>
            <ul className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
              {translationState.hints.map((hint, index) => (
                <li key={index} className="flex items-start gap-1">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{hint}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleManualRequest('partial')}
                className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
              >
                Still need help? Show partial translation →
              </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderPartialTranslation = () => {
    if (currentLevel !== 'partial' || !translationState.partial) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mt-2 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border-l-4 border-amber-500"
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <BookOpenIcon className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <h4 className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Partial Translation
            </h4>
          </div>
          <button
            onClick={() => handlePlayAudio(translationState.partial?.translatedText || '')}
            className="p-1 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300"
            title="Play audio"
          >
            <SpeakerWaveIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="text-sm text-amber-800 dark:text-amber-300 mb-3 leading-relaxed">
          {translationState.partial.translatedText}
        </div>

        {translationState.partial.translatedParts.length > 0 && (
          <div className="space-y-2">
            <h5 className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Translated parts:
            </h5>
            {translationState.partial.translatedParts.map((part, index) => (
              <div key={index} className="flex items-center gap-2 text-xs">
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {part.original}
                </span>
                <span className="text-amber-500">→</span>
                <span className="text-amber-700 dark:text-amber-300">
                  {part.translation}
                </span>
                <span className="px-1 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 rounded text-xs">
                  {part.type}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => handleManualRequest('full')}
            className="mt-3 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 underline"
          >
            Need complete translation? Show full translation →
          </button>
      </motion.div>
    );
  };

  const renderFullTranslation = () => {
    if (currentLevel !== 'full' || !translationState.full) return null;

    const result = translationState.full;

    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="mt-2 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-l-4 border-green-500"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <AcademicCapIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
            <h4 className="text-sm font-medium text-green-800 dark:text-green-300">
              Complete Translation
            </h4>
            {showConfidence && (
              <span className="px-2 py-0.5 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 text-xs rounded-full">
                {Math.round(result.confidence * 100)}% confidence
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePlayAudio(result.translatedText)}
              className="p-1 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
              title="Play translation audio"
            >
              <SpeakerWaveIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="p-1 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
            >
              {showDetails ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Main Translation */}
        <div className="text-green-800 dark:text-green-300 mb-3 leading-relaxed">
          {result.translatedText}
        </div>

        {/* Alternative Translations */}
        {result.alternatives && result.alternatives.length > 0 && (
          <div className="mb-3">
            <h5 className="text-xs font-medium text-green-700 dark:text-green-400 mb-1">
              Alternative translations:
            </h5>
            <div className="space-y-1">
              {result.alternatives.slice(0, 2).map((alt, index) => (
                <div key={index} className="text-xs text-green-600 dark:text-green-400">
                  • {alt}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expandable Details */}
        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 border-t border-green-200 dark:border-green-800 pt-3"
            >
              {/* Grammar Notes */}
              {result.grammarNotes && result.grammarNotes.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">
                    Grammar Notes:
                  </h5>
                  <div className="space-y-2">
                    {result.grammarNotes.map((note, index) => (
                      <div key={index} className="p-2 bg-green-100 dark:bg-green-800/30 rounded text-xs">
                        <div className="font-medium text-green-800 dark:text-green-300">
                          {note.pattern}
                        </div>
                        <div className="text-green-600 dark:text-green-400 mt-1">
                          {note.explanation}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Key Vocabulary */}
              {result.keyVocabulary && result.keyVocabulary.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">
                    Key Vocabulary:
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.keyVocabulary.slice(0, 6).map((vocab, index) => (
                      <div
                        key={index}
                        className="p-2 bg-green-100 dark:bg-green-800/30 rounded text-xs cursor-pointer hover:bg-green-200 dark:hover:bg-green-800/50"
                        onClick={() => onWordSelect?.(vocab.word)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-green-800 dark:text-green-300">
                            {vocab.word}
                          </span>
                          {onVocabularyAdd && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onVocabularyAdd(vocab.word, vocab.meaning);
                              }}
                              className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300"
                              title="Add to vocabulary"
                            >
                              +
                            </button>
                          )}
                        </div>
                        <div className="text-green-600 dark:text-green-400">
                          {vocab.reading} - {vocab.meaning}
                        </div>
                        {vocab.jlptLevel && (
                          <div className="text-xs text-green-500 dark:text-green-500 mt-1">
                            {vocab.jlptLevel} • {vocab.difficulty}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Learning Points */}
              {result.learningPoints && result.learningPoints.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">
                    Learning Points:
                  </h5>
                  <ul className="space-y-1">
                    {result.learningPoints.map((point, index) => (
                      <li key={index} className="text-xs text-green-600 dark:text-green-400 flex items-start gap-1">
                        <span className="text-green-500 mt-1">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Next Steps */}
              {result.nextSteps && result.nextSteps.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">
                    Study Recommendations:
                  </h5>
                  <ul className="space-y-1">
                    {result.nextSteps.map((step, index) => (
                      <li key={index} className="text-xs text-green-600 dark:text-green-400 flex items-start gap-1">
                        <span className="text-green-500 mt-1">→</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  const renderLoadingState = () => {
    if (!translationState.loading) return null;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg flex items-center gap-2"
      >
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600 dark:border-gray-600 dark:border-t-gray-300" />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Getting translation assistance...
        </span>
      </motion.div>
    );
  };

  const renderErrorState = () => {
    if (!translationState.error) return null;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border-l-4 border-red-500"
      >
        <div className="flex items-start gap-2">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-red-800 dark:text-red-300 mb-1">
              Translation Error
            </h4>
            <p className="text-sm text-red-700 dark:text-red-400">
              {translationState.error}
            </p>
            <button
              onClick={() => {
                setTranslationState(prev => ({ ...prev, error: null }));
                if (currentLevel !== 'none') {
                  fetchTranslation(currentLevel as 'hints' | 'partial' | 'full');
                }
              }}
              className="mt-2 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
            >
              Try again
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderManualControls = () => {
    // Note: Manual controls always available now (trigger system removed)

    return (
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          onClick={() => handleManualRequest('hints')}
          disabled={translationState.loading}
          className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 rounded-full hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50"
        >
          <LightBulbIcon className="w-3 h-3 inline mr-1" />
          Hints
        </button>
        <button
          onClick={() => handleManualRequest('partial')}
          disabled={translationState.loading}
          className="px-3 py-1 text-xs bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300 rounded-full hover:bg-amber-200 dark:hover:bg-amber-800 disabled:opacity-50"
        >
          <BookOpenIcon className="w-3 h-3 inline mr-1" />
          Partial
        </button>
        <button
          onClick={() => handleManualRequest('full')}
          disabled={translationState.loading}
          className="px-3 py-1 text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300 rounded-full hover:bg-green-200 dark:hover:bg-green-800 disabled:opacity-50"
        >
          <AcademicCapIcon className="w-3 h-3 inline mr-1" />
          Full
        </button>
      </div>
    );
  };

  // ============================================
  // Main Render
  // ============================================

  if (mode === 'off') {
    return <span className={className}>{text}</span>;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Main Text */}
      <span
        className={`
          ${currentLevel !== 'none' ? 'border-b border-dashed border-blue-400 dark:border-blue-500' : ''}
          ${isHovering ? 'bg-blue-50 dark:bg-blue-900/20' : ''}
          transition-colors duration-200
        `}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleTap}
      >
        {text}
      </span>

      {/* Translation Assistance UI */}
      <AnimatePresence>
        {renderLoadingState()}
        {renderErrorState()}
        {renderHints()}
        {renderPartialTranslation()}
        {renderFullTranslation()}
        {renderManualControls()}
      </AnimatePresence>
    </div>
  );
};

export default TranslationAssistance;