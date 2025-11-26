/**
 * Enhanced Word Explanation Modal
 * Integrates with translation system for seamless learning experience
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import type { WordExplanation } from '@/lib/ai/types';
import { useTTS } from '@/hooks/useTTS';
import { TranslationResult } from '@/lib/ai/processors/TranslationProcessor';
import { useContentTranslation } from '@/hooks/useContentTranslation';
import {
  SpeakerWaveIcon,
  BookmarkIcon,
  ArrowLeftIcon,
  GlobeAsiaAustraliaIcon,
  AcademicCapIcon,
  LightBulbIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// Enhanced Modal Props
// ============================================

export interface EnhancedWordExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  word: string | null;
  explanation: WordExplanation | null;
  loading: boolean;
  error: string | null;

  // Translation integration
  translationContext?: {
    sentence?: string;
    translationResult?: TranslationResult;
    userLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  };

  // Vocabulary integration
  onAddToVocabulary?: (word: string, translation: string) => void;
  onWordLookup?: (word: string) => void;

  // Enhanced features
  showTranslationContext?: boolean;
  enableRelatedTranslations?: boolean;
}

// ============================================
// Enhanced Word Explanation Modal Component
// ============================================

export default function EnhancedWordExplanationModal({
  isOpen,
  onClose,
  word,
  explanation,
  loading,
  error,
  translationContext,
  onAddToVocabulary,
  onWordLookup,
  showTranslationContext = true,
  enableRelatedTranslations = true
}: EnhancedWordExplanationModalProps) {
  // ============================================
  // State and Hooks
  // ============================================

  const [activeTab, setActiveTab] = useState<'explanation' | 'context' | 'related'>('explanation');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [relatedTranslations, setRelatedTranslations] = useState<TranslationResult | null>(null);

  const { play, playing, currentText } = useTTS();
  const {
    translateText,
    isLoading: translationLoading,
    error: translationError,
    addToVocabulary
  } = useContentTranslation({
    mode: 'learning',
    trigger: 'manual',
    userLevel: translationContext?.userLevel || 'N5'
  });

  // ============================================
  // Handlers
  // ============================================

  const handlePlayExample = useCallback(async (text: string) => {
    try {
      await play(text);
    } catch (error) {
      console.error('TTS playback failed:', error);
    }
  }, [play]);

  const handleAddToVocabulary = useCallback(() => {
    if (explanation && word) {
      const translation = explanation.meaning;

      // Use provided handler or built-in vocabulary system
      if (onAddToVocabulary) {
        onAddToVocabulary(word, translation);
      } else {
        addToVocabulary(word, translation);
      }

      setIsBookmarked(true);
    }
  }, [explanation, word, onAddToVocabulary, addToVocabulary]);

  const handleRelatedWordClick = useCallback((relatedWord: string) => {
    if (onWordLookup) {
      onWordLookup(relatedWord);
    }
  }, [onWordLookup]);

  const handleTranslateSentence = useCallback(async () => {
    if (translationContext?.sentence) {
      const result = await translateText(translationContext.sentence, 'learning');
      if (result) {
        setRelatedTranslations(result);
        setActiveTab('related');
      }
    }
  }, [translationContext?.sentence, translateText]);

  // ============================================
  // Effects
  // ============================================

  useEffect(() => {
    // Reset state when modal opens with new word
    if (isOpen && word) {
      setActiveTab('explanation');
      setIsBookmarked(false);
      setRelatedTranslations(null);
    }
  }, [isOpen, word]);

  // ============================================
  // Render Helpers
  // ============================================

  const renderTabButtons = () => {
    const tabs = [
      { id: 'explanation', label: 'Word Details', icon: BookmarkIcon },
      ...(showTranslationContext && translationContext ? [
        { id: 'context' as const, label: 'Context', icon: GlobeAsiaAustraliaIcon }
      ] : []),
      ...(enableRelatedTranslations ? [
        { id: 'related' as const, label: 'Related', icon: AcademicCapIcon }
      ] : [])
    ];

    return (
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    );
  };

  const renderTranslationContext = () => {
    if (!translationContext) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Original Sentence */}
        {translationContext.sentence && (
          <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <LightBulbIcon className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" />
              Context Sentence
            </h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => handlePlayExample(translationContext.sentence!)}
                  className="p-2 rounded-full hover:bg-white/50 dark:hover:bg-black/20 transition-colors"
                  title="Play sentence audio"
                >
                  <SpeakerWaveIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                </button>
                <div className="flex-1">
                  <p className="text-lg text-gray-900 dark:text-white mb-2">
                    {translationContext.sentence}
                  </p>
                  {translationContext.translationResult && (
                    <p className="text-gray-600 dark:text-gray-400">
                      {translationContext.translationResult.translatedText}
                    </p>
                  )}
                </div>
              </div>

              {/* Translate Sentence Button */}
              <button
                onClick={handleTranslateSentence}
                disabled={translationLoading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
              >
                <GlobeAsiaAustraliaIcon className="w-4 h-4" />
                {translationLoading ? 'Analyzing...' : 'Analyze Full Context'}
              </button>

              {translationError && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                  <ExclamationCircleIcon className="w-4 h-4" />
                  {translationError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Word in Context */}
        {explanation && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Word Usage in This Context
            </h4>
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
              <div className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {explanation.word}
              </div>
              <div className="text-gray-600 dark:text-gray-400 mb-2">
                {explanation.reading} ({explanation.romaji})
              </div>
              <p className="text-gray-900 dark:text-white">
                {explanation.meaning}
              </p>

              {/* Context-specific meaning if available */}
              {translationContext.translationResult?.keyVocabulary && (
                (() => {
                  const contextWord = translationContext.translationResult.keyVocabulary.find(
                    v => v.word === word
                  );
                  return contextWord && contextWord.meaning !== explanation.meaning ? (
                    <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                      <div className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                        In this context:
                      </div>
                      <div className="text-yellow-700 dark:text-yellow-300">
                        {contextWord.meaning}
                      </div>
                    </div>
                  ) : null;
                })()
              )}
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  const renderRelatedTranslations = () => {
    if (!relatedTranslations) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No related translations loaded yet.
          </p>
          {translationContext?.sentence && (
            <button
              onClick={handleTranslateSentence}
              disabled={translationLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <GlobeAsiaAustraliaIcon className="w-4 h-4" />
              {translationLoading ? 'Loading...' : 'Analyze Context'}
            </button>
          )}
        </div>
      );
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Grammar Notes */}
        {relatedTranslations.grammarNotes && relatedTranslations.grammarNotes.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Grammar Context
            </h4>
            <div className="space-y-3">
              {relatedTranslations.grammarNotes.map((note, idx) => (
                <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="font-medium text-gray-900 dark:text-white mb-1">
                    {note.pattern}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 text-sm">
                    {note.explanation}
                  </div>
                  {note.example && (
                    <div className="text-gray-500 dark:text-gray-500 text-sm italic mt-2">
                      Example: {note.example}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Vocabulary */}
        {relatedTranslations.keyVocabulary && relatedTranslations.keyVocabulary.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Related Vocabulary
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {relatedTranslations.keyVocabulary
                .filter(vocab => vocab.word !== word)
                .slice(0, 8)
                .map((vocab, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRelatedWordClick(vocab.word)}
                  className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="font-medium text-gray-900 dark:text-white">
                    {vocab.word}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {vocab.reading} - {vocab.meaning}
                  </div>
                  {vocab.jlptLevel && (
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {vocab.jlptLevel} • {vocab.difficulty}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Learning Points */}
        {relatedTranslations.learningPoints && relatedTranslations.learningPoints.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Learning Points
            </h4>
            <ul className="space-y-2">
              {relatedTranslations.learningPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                  <span className="text-blue-500 mt-1">•</span>
                  <span className="text-sm">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>
    );
  };

  const renderMainExplanation = () => {
    if (!explanation) return null;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-6"
      >
        {/* Basic Info with Enhanced Actions */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-5">
          <div className="flex justify-between items-start mb-3">
            <div className="space-y-1">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                {explanation.word}
              </h3>
              <div className="text-lg text-gray-600 dark:text-gray-400">
                {explanation.reading}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {explanation.romaji}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handlePlayExample(explanation.word)}
                className="p-2 rounded-full hover:bg-white/50 dark:hover:bg-black/20 transition-colors"
                title="Play pronunciation"
              >
                <SpeakerWaveIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </button>
              <button
                onClick={handleAddToVocabulary}
                className={`p-2 rounded-full transition-colors ${
                  isBookmarked
                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400'
                    : 'hover:bg-white/50 dark:hover:bg-black/20 text-gray-600 dark:text-gray-400'
                }`}
                title={isBookmarked ? 'Added to vocabulary' : 'Add to vocabulary'}
              >
                <BookmarkIcon className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>
            </div>
          </div>

          <p className="text-lg text-gray-900 dark:text-white font-medium mb-3">
            {explanation.meaning}
          </p>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              {explanation.partOfSpeech}
            </span>
            {explanation.jlptLevel && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200">
                {explanation.jlptLevel}
              </span>
            )}
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
              {explanation.formality}
            </span>
          </div>
        </div>

        {/* Rest of the original content */}
        {/* Kanji Breakdown */}
        {explanation.kanjiBreakdown && explanation.kanjiBreakdown.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
              </svg>
              Kanji Breakdown
            </h4>
            <div className="space-y-3">
              {explanation.kanjiBreakdown.map((kanji, idx) => (
                <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-start gap-4">
                    <div className="text-4xl font-bold text-gray-900 dark:text-white">
                      {kanji.kanji}
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-medium text-gray-900 dark:text-white mb-2">
                        {kanji.meaning}
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {kanji.kunYomi.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">Kun:</span>
                            <span className="ml-2 text-gray-600 dark:text-gray-400">
                              {kanji.kunYomi.join(', ')}
                            </span>
                          </div>
                        )}
                        {kanji.onYomi.length > 0 && (
                          <div>
                            <span className="font-medium text-gray-700 dark:text-gray-300">On:</span>
                            <span className="ml-2 text-gray-600 dark:text-gray-400">
                              {kanji.onYomi.join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Examples with Enhanced Audio */}
        {explanation.examples && explanation.examples.length > 0 && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <svg className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              Example Sentences
            </h4>
            <div className="space-y-4">
              {explanation.examples.map((example, idx) => (
                <div key={idx} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <button
                      onClick={() => handlePlayExample(example.japanese)}
                      disabled={playing && currentText === example.japanese}
                      className="flex-shrink-0 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                      title="Play audio"
                    >
                      <SpeakerWaveIcon className={`w-5 h-5 ${
                        playing && currentText === example.japanese
                          ? 'text-indigo-600 dark:text-indigo-400 animate-pulse'
                          : 'text-indigo-600 dark:text-indigo-400'
                      }`} />
                    </button>
                    <div className="text-lg text-gray-900 dark:text-white font-medium">
                      {example.furigana}
                    </div>
                  </div>
                  <div className="text-base text-gray-700 dark:text-gray-300 mb-2">
                    {example.translation}
                  </div>
                  {example.notes && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                      {example.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    );
  };

  // ============================================
  // Main Render
  // ============================================

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      size="xl"
      closeOnOverlayClick={true}
      closeOnEsc={true}
    >
      <div className="space-y-6">
        {/* Header with Back Button */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {word ? `Word: ${word}` : 'Word Explanation'}
          </h2>
          {translationContext && (
            <button
              onClick={onClose}
              className="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span className="text-sm">Back to article</span>
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Analyzing word...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start">
              <ExclamationCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                  Error loading explanation
                </h3>
                <p className="mt-1 text-sm text-red-700 dark:text-red-300">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {explanation && !loading && !error && (
          <>
            {/* Tab Navigation */}
            {(showTranslationContext || enableRelatedTranslations) && renderTabButtons()}

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'explanation' && (
                <motion.div key="explanation">
                  {renderMainExplanation()}
                </motion.div>
              )}

              {activeTab === 'context' && showTranslationContext && (
                <motion.div key="context">
                  {renderTranslationContext()}
                </motion.div>
              )}

              {activeTab === 'related' && enableRelatedTranslations && (
                <motion.div key="related">
                  {renderRelatedTranslations()}
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </Modal>
  );
}