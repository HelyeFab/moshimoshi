'use client';

import React from 'react';
import Modal from '@/components/ui/Modal';
import type { WordExplanation } from '@/lib/ai/types';
import { useTTS } from '@/hooks/useTTS';

interface WordExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  word: string | null;
  explanation: WordExplanation | null;
  loading: boolean;
  error: string | null;
}

export default function WordExplanationModal({
  isOpen,
  onClose,
  word,
  explanation,
  loading,
  error
}: WordExplanationModalProps) {
  const { play, playing, currentText } = useTTS();

  const handlePlayExample = async (text: string) => {
    try {
      await play(text);
    } catch (error) {
      console.error('TTS playback failed:', error);
    }
  };

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
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400" />
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              Analyzing word...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
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

        {explanation && !loading && !error && (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-5">
              <div className="space-y-1 mb-3">
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {explanation.word}
                </h3>
                <div className="text-lg text-gray-600 dark:text-gray-400">
                  {explanation.reading}
                </div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {explanation.romaji}
              </p>
              <p className="text-lg text-gray-900 dark:text-white font-medium">
                {explanation.meaning}
              </p>
              <div className="flex items-center gap-3 mt-3">
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

            {/* Conjugation Table */}
            {explanation.conjugation && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  Conjugations
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.entries(explanation.conjugation).map(([form, value]) => (
                    value && (
                      <div key={form} className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-1">
                          {form.replace(/([A-Z])/g, ' $1').trim()}
                        </div>
                        <div className="text-base font-medium text-gray-900 dark:text-white">
                          {value}
                        </div>
                      </div>
                    )
                  ))}
                </div>
              </div>
            )}

            {/* Pitch Accent */}
            {explanation.pitchAccent && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                  </svg>
                  Pitch Accent
                </h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Pattern:</span>
                    <span className="text-base text-gray-900 dark:text-white font-mono">
                      {explanation.pitchAccent.pattern}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Notation:</span>
                    <span className="text-lg text-gray-900 dark:text-white">
                      {explanation.pitchAccent.notation}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Related Words */}
            {explanation.relatedWords && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                  </svg>
                  Related Words
                </h4>
                <div className="space-y-3">
                  {explanation.relatedWords.synonyms && explanation.relatedWords.synonyms.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Synonyms</div>
                      <div className="flex flex-wrap gap-2">
                        {explanation.relatedWords.synonyms.map((word, idx) => (
                          <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {explanation.relatedWords.antonyms && explanation.relatedWords.antonyms.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Antonyms</div>
                      <div className="flex flex-wrap gap-2">
                        {explanation.relatedWords.antonyms.map((word, idx) => (
                          <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {explanation.relatedWords.compounds && explanation.relatedWords.compounds.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Compounds</div>
                      <div className="flex flex-wrap gap-2">
                        {explanation.relatedWords.compounds.map((word, idx) => (
                          <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Usage Notes */}
            {explanation.usageNotes && (
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Usage Notes
                </h4>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {explanation.usageNotes}
                </p>
              </div>
            )}

            {/* Examples */}
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
                          {playing && currentText === example.japanese ? (
                            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                            </svg>
                          )}
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
          </div>
        )}
      </div>
    </Modal>
  );
}
