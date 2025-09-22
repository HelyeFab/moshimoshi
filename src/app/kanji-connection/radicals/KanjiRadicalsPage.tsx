'use client';

import { useState, useEffect } from 'react';
import { SEMANTIC_RADICALS, getRadicalsByCategory, RADICAL_CATEGORIES, type RadicalKanji } from '@/lib/kanji/radicals';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal';

interface RadicalData {
  radical: any;
  totalCount: number;
  kanji: RadicalKanji[];
  subThemeGroups?: Record<string, RadicalKanji[]>;
  uncategorized?: RadicalKanji[];
}

export default function KanjiRadicalsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();

  const [selectedRadical, setSelectedRadical] = useState<string | null>(null);
  const [radicalData, setRadicalData] = useState<RadicalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showSubThemes, setShowSubThemes] = useState(true);
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [modalKanji, setModalKanji] = useState<any>(null);

  const radicalsByCategory = getRadicalsByCategory();

  const loadRadicalData = async (radicalId: string, subThemes: boolean) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/kanji/by-radical?radical=${radicalId}&subThemes=${subThemes}`
      );

      if (!response.ok) {
        throw new Error('Failed to load radical data');
      }

      const data = await response.json();
      setRadicalData(data);

      // Auto-expand first theme
      if (data.subThemeGroups && Object.keys(data.subThemeGroups).length > 0) {
        setExpandedThemes(new Set([Object.keys(data.subThemeGroups)[0]]));
      }
    } catch (err) {
      console.error('Error loading radical:', err);
      setError('Failed to load kanji for this radical');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedRadical) {
      loadRadicalData(selectedRadical, showSubThemes);
    }
  }, [selectedRadical, showSubThemes]);

  const handleRadicalSelect = (radicalId: string) => {
    setSelectedRadical(radicalId);
    setExpandedThemes(new Set());
  };

  const handleKanjiClick = (kanjiDetail: any) => {
    const kanjiForModal = {
      kanji: kanjiDetail.kanji,
      meaning: kanjiDetail.meanings?.join(', ') || '',
      onyomi: kanjiDetail.readings?.on || [],
      kunyomi: kanjiDetail.readings?.kun || [],
      jlpt: kanjiDetail.jlpt ? `N${kanjiDetail.jlpt}` : 'N5'
    };
    setModalKanji(kanjiForModal);
  };

  const toggleTheme = (themeId: string) => {
    const newExpanded = new Set(expandedThemes);
    if (newExpanded.has(themeId)) {
      newExpanded.delete(themeId);
    } else {
      newExpanded.add(themeId);
    }
    setExpandedThemes(newExpanded);
  };

  const getFilteredRadicals = () => {
    if (selectedCategory === 'all') {
      return Object.values(SEMANTIC_RADICALS);
    }
    return radicalsByCategory[selectedCategory] || [];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-DEFAULT dark:from-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} />

      {/* Header */}
      <header className="px-4 pt-24 pb-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-muted dark:hover:bg-dark-700 transition-colors"
            >
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <h1 className="text-xl font-bold text-foreground dark:text-dark-50 flex-1">
              {t('kanjiConnection.radicals.title')}
            </h1>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showSubThemes}
                onChange={(e) => setShowSubThemes(e.target.checked)}
                className="rounded"
              />
              <span className="text-muted-foreground dark:text-dark-400">Sub-themes</span>
            </label>

            <div className="flex gap-2 bg-muted dark:bg-dark-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded ${
                  viewMode === 'grid'
                    ? 'bg-background dark:bg-dark-800 text-foreground dark:text-dark-50 shadow-sm'
                    : 'text-muted-foreground dark:text-dark-400'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded ${
                  viewMode === 'list'
                    ? 'bg-background dark:bg-dark-800 text-foreground dark:text-dark-50 shadow-sm'
                    : 'text-muted-foreground dark:text-dark-400'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Radicals List */}
          <div className="lg:col-span-1">
            <div className="bg-card dark:bg-dark-800 rounded-lg p-4 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <h2 className="font-semibold mb-3 text-foreground dark:text-dark-50">Select a Radical</h2>
              <div className="space-y-2">
                {getFilteredRadicals().map((radical) => (
                  <button
                    key={radical.id}
                    onClick={() => handleRadicalSelect(radical.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedRadical === radical.id
                        ? 'bg-primary-100 dark:bg-primary-900/20 border-2 border-primary-500'
                        : 'bg-muted dark:bg-dark-700 hover:bg-muted/80 dark:hover:bg-dark-600 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold">{radical.radical}</span>
                      <div className="flex-1">
                        <div className="font-medium text-foreground dark:text-dark-50">{radical.meaning}</div>
                        <div className="text-xs text-muted-foreground dark:text-dark-400">{radical.meaningJa}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Kanji Display */}
          <div className="lg:col-span-2">
            {!selectedRadical ? (
              <div className="bg-card dark:bg-dark-800 rounded-lg p-8 text-center">
                <p className="text-muted-foreground dark:text-dark-400">
                  Select a radical to view its kanji
                </p>
              </div>
            ) : loading ? (
              <div className="bg-card dark:bg-dark-800 rounded-lg p-8">
                <LoadingOverlay isLoading={true} message="Loading kanji..." />
              </div>
            ) : error ? (
              <div className="bg-card dark:bg-dark-800 rounded-lg p-8 text-center">
                <p className="text-red-500">{error}</p>
              </div>
            ) : radicalData ? (
              <div className="bg-card dark:bg-dark-800 rounded-lg p-6">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-4xl font-bold">{radicalData.radical.radical}</span>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground dark:text-dark-50">{radicalData.radical.meaning}</h2>
                      <p className="text-sm text-muted-foreground dark:text-dark-400">{radicalData.radical.meaningJa}</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground dark:text-dark-300">
                    Total: {radicalData.totalCount} kanji
                  </p>
                </div>

                {/* Sub-theme Groups */}
                {showSubThemes && radicalData.subThemeGroups ? (
                  <div className="space-y-4">
                    {Object.entries(radicalData.subThemeGroups).map(([theme, kanjiList]) => (
                      <div key={theme} className="border border-border dark:border-dark-700 rounded-lg p-4">
                        <button
                          onClick={() => toggleTheme(theme)}
                          className="flex items-center justify-between w-full mb-3"
                        >
                          <h3 className="font-semibold text-foreground dark:text-dark-50">{theme}</h3>
                          <svg
                            className={`w-5 h-5 transition-transform ${expandedThemes.has(theme) ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {expandedThemes.has(theme) && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className={viewMode === 'grid' ? 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2' : 'space-y-2'}
                          >
                            {kanjiList.map((kanjiDetail: any, index: number) => (
                              <motion.button
                                key={kanjiDetail.kanji}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.01 }}
                                onClick={() => handleKanjiClick(kanjiDetail)}
                                className={
                                  viewMode === 'grid'
                                    ? 'aspect-square bg-muted dark:bg-dark-700 hover:bg-primary-100 dark:hover:bg-primary-900/20 rounded-lg flex items-center justify-center text-2xl font-bold transition-colors'
                                    : 'flex items-center gap-4 p-3 bg-muted dark:bg-dark-700 hover:bg-primary-100 dark:hover:bg-primary-900/20 rounded-lg transition-colors'
                                }
                              >
                                {kanjiDetail.kanji}
                              </motion.button>
                            ))}
                          </motion.div>
                        )}
                      </div>
                    ))}

                    {/* Uncategorized */}
                    {radicalData.uncategorized && radicalData.uncategorized.length > 0 && (
                      <div className="border border-border dark:border-dark-700 rounded-lg p-4">
                        <h3 className="font-semibold mb-3 text-foreground dark:text-dark-50">Other</h3>
                        <div className={viewMode === 'grid' ? 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2' : 'space-y-2'}>
                          {radicalData.uncategorized.map((kanjiDetail: any, index: number) => (
                            <button
                              key={kanjiDetail.kanji}
                              onClick={() => handleKanjiClick(kanjiDetail)}
                              className={
                                viewMode === 'grid'
                                  ? 'aspect-square bg-muted dark:bg-dark-700 hover:bg-primary-100 dark:hover:bg-primary-900/20 rounded-lg flex items-center justify-center text-2xl font-bold transition-colors'
                                  : 'flex items-center gap-4 p-3 bg-muted dark:bg-dark-700 hover:bg-primary-100 dark:hover:bg-primary-900/20 rounded-lg transition-colors'
                              }
                            >
                              {kanjiDetail.kanji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Simple grid without themes
                  <div className={viewMode === 'grid' ? 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2' : 'space-y-2'}>
                    {radicalData.kanji.map((kanjiDetail: any, index: number) => (
                      <motion.button
                        key={kanjiDetail.kanji}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.01 }}
                        onClick={() => handleKanjiClick(kanjiDetail)}
                        className={
                          viewMode === 'grid'
                            ? 'aspect-square bg-muted dark:bg-dark-700 hover:bg-primary-100 dark:hover:bg-primary-900/20 rounded-lg flex items-center justify-center text-2xl font-bold transition-colors'
                            : 'flex items-center gap-4 p-3 bg-muted dark:bg-dark-700 hover:bg-primary-100 dark:hover:bg-primary-900/20 rounded-lg transition-colors'
                        }
                      >
                        {kanjiDetail.kanji}
                      </motion.button>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Kanji Details Modal */}
      {modalKanji && (
        <KanjiDetailsModal
          kanji={modalKanji}
          isOpen={!!modalKanji}
          onClose={() => setModalKanji(null)}
          showSaveButton={false}
        />
      )}
    </div>
  );
}