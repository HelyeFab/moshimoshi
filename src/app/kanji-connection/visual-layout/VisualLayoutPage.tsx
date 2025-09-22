'use client';

import { useState, useEffect } from 'react';
import { SKIP_PATTERNS, type SkipPattern, type SkipKanji } from '@/lib/kanji/skip';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal';

interface SkipData {
  patterns: typeof SKIP_PATTERNS;
  totalCount: number;
  kanji: SkipKanji[];
  categorized: Record<SkipPattern, SkipKanji[]>;
  subcategorized?: Record<string, Record<string, SkipKanji[]>>;
  stats: {
    leftRight: number;
    upDown: number;
    enclosure: number;
    solid: number;
  };
}

export default function VisualLayoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();

  const [selectedPattern, setSelectedPattern] = useState<SkipPattern | null>(null);
  const [skipData, setSkipData] = useState<SkipData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'visual'>('visual');
  const [showSubcategories, setShowSubcategories] = useState(true);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [skipCodeSearch, setSkipCodeSearch] = useState('');
  const [modalKanji, setModalKanji] = useState<any>(null);
  const [showPatternDropdown, setShowPatternDropdown] = useState(false);

  const loadSkipData = async (pattern: SkipPattern | undefined, subcategories: boolean) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (pattern) params.append('pattern', pattern);
      params.append('subcategories', subcategories.toString());

      const response = await fetch(`/api/kanji/by-skip?${params}`);

      if (!response.ok) {
        throw new Error('Failed to load SKIP data');
      }

      const data = await response.json();
      setSkipData(data);

      // Auto-select first subcategory if pattern is selected
      if (pattern && data.subcategorized && data.subcategorized[pattern]) {
        const subKeys = Object.keys(data.subcategorized[pattern]);
        if (subKeys.length > 0) {
          setSelectedSubcategory(subKeys[0]);
        }
      }
    } catch (err) {
      console.error('Error loading SKIP data:', err);
      setError('Failed to load visual layout data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSkipData(selectedPattern || undefined, showSubcategories);
  }, [selectedPattern, showSubcategories]);

  const handlePatternSelect = (pattern: SkipPattern) => {
    setSelectedPattern(pattern);
    setSelectedSubcategory(null);
  };

  const handleKanjiClick = (kanjiDetail: SkipKanji) => {
    // Convert SkipKanji to modal format
    const kanjiForModal = {
      kanji: kanjiDetail.kanji,
      meaning: kanjiDetail.meanings?.join(', ') || '',
      onyomi: kanjiDetail.readings?.on || [],
      kunyomi: kanjiDetail.readings?.kun || [],
      jlpt: kanjiDetail.jlpt ? `N${kanjiDetail.jlpt}` : 'N5'
    };
    setModalKanji(kanjiForModal);
  };

  const searchBySkipCode = async () => {
    if (!skipCodeSearch) return;

    setLoading(true);
    try {
      const response = await fetch('/api/kanji/by-skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skipCode: skipCodeSearch })
      });

      if (response.ok) {
        const data = await response.json();
        // Handle search results - for demo, just show alert
        alert(`Found ${data.kanji?.length || 0} kanji for SKIP code ${data.skipCode}`);
      }
    } catch (err) {
      console.error('SKIP code search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPatternIcon = (pattern: SkipPattern) => {
    return SKIP_PATTERNS[pattern]?.icon || '⬜';
  };

  const getPatternColor = (pattern: SkipPattern) => {
    return SKIP_PATTERNS[pattern]?.color || '#888';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light to-background-DEFAULT dark:from-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} />

      {/* Header */}
      <header className="px-4 pt-24 pb-4 md:pt-24">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-lg hover:bg-muted dark:hover:bg-dark-700 transition-colors"
              aria-label="Go back"
            >
              <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <h1 className="text-xl font-bold text-foreground dark:text-dark-50 flex-1">
              {t('kanjiConnection.visualLayout.title')}
            </h1>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-between gap-3 flex-wrap sm:ml-11">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showSubcategories}
                onChange={(e) => setShowSubcategories(e.target.checked)}
                className="rounded"
              />
              <span className="text-muted-foreground dark:text-dark-400">{t('kanjiConnection.visualLayout.showSubcategories')}</span>
            </label>

            <div className="flex gap-2 bg-muted dark:bg-dark-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('visual')}
                className={`px-3 py-1 rounded ${
                  viewMode === 'visual'
                    ? 'bg-background dark:bg-dark-800 text-foreground dark:text-dark-50 shadow-sm'
                    : 'text-muted-foreground dark:text-dark-400'
                }`}
              >
                Visual
              </button>
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
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 pb-8">
        {/* SKIP Code Search */}
        <div className="bg-card dark:bg-dark-800 rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground dark:text-dark-400 mb-3">
            {t('kanjiConnection.visualLayout.description')}
          </p>

          <div className="flex gap-2 max-w-md">
            <input
              type="text"
              placeholder={t('kanjiConnection.visualLayout.searchPlaceholder')}
              value={skipCodeSearch}
              onChange={(e) => setSkipCodeSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchBySkipCode()}
              className="flex-1 px-3 py-2 border border-border dark:border-dark-700 rounded-lg bg-background dark:bg-dark-900 text-foreground dark:text-dark-50 focus:ring-2 focus:ring-primary focus:border-primary"
            />
            <button
              onClick={searchBySkipCode}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              {t('common.search')}
            </button>
          </div>
        </div>

        {/* Pattern Selector - Mobile Dropdown */}
        <div className="md:hidden mb-4">
          <button
            onClick={() => setShowPatternDropdown(!showPatternDropdown)}
            className="w-full flex items-center justify-between px-4 py-3 bg-card dark:bg-dark-800 border border-border dark:border-dark-700 rounded-lg"
          >
            <span className="font-medium text-foreground dark:text-dark-50">
              {selectedPattern ? SKIP_PATTERNS[selectedPattern]?.name : t('kanjiConnection.visualLayout.selectPattern')}
            </span>
            <svg
              className={`w-5 h-5 transition-transform ${showPatternDropdown ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {showPatternDropdown && (
            <div className="absolute left-4 right-4 z-50 mt-2 bg-background dark:bg-dark-800 border border-border dark:border-dark-700 rounded-lg shadow-lg overflow-hidden">
              {Object.entries(SKIP_PATTERNS).map(([key, pattern]) => (
                <button
                  key={key}
                  onClick={() => {
                    handlePatternSelect(key as SkipPattern);
                    setShowPatternDropdown(false);
                  }}
                  className={`w-full text-left p-3 hover:bg-muted dark:hover:bg-dark-700 transition-colors ${
                    selectedPattern === key ? 'bg-primary-100 dark:bg-primary-900/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
                      style={{
                        backgroundColor: `${pattern.color}20`,
                        color: pattern.color
                      }}
                    >
                      {pattern.icon}
                    </div>
                    <div>
                      <div className="font-medium text-foreground dark:text-dark-50">{pattern.name}</div>
                      <div className="text-xs text-muted-foreground dark:text-dark-400">{pattern.nameJa}</div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pattern Selector - Desktop Visual Mode */}
        {viewMode === 'visual' && (
          <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {Object.entries(SKIP_PATTERNS).map(([key, pattern]) => (
              <motion.button
                key={key}
                onClick={() => handlePatternSelect(key as SkipPattern)}
                className={`relative p-6 rounded-xl border-2 transition-all ${
                  selectedPattern === key
                    ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/20'
                    : 'border-border dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-muted dark:hover:bg-dark-700'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="mb-4 flex justify-center">
                  <div
                    className="w-20 h-20 rounded-lg flex items-center justify-center text-4xl"
                    style={{
                      backgroundColor: `${pattern.color}20`,
                      color: pattern.color
                    }}
                  >
                    {pattern.icon}
                  </div>
                </div>

                <h3 className="font-semibold text-foreground dark:text-dark-50 mb-1">{pattern.name}</h3>
                <p className="text-xs text-muted-foreground dark:text-dark-400 mb-2">{pattern.nameJa}</p>

                {skipData && (
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-xs rounded-full">
                      {skipData.stats[key as keyof typeof skipData.stats]} kanji
                    </span>
                  </div>
                )}

                <div className="flex justify-center gap-1 mt-3">
                  {pattern.examples.slice(0, 4).map(ex => (
                    <span key={ex} className="text-lg text-muted-foreground dark:text-dark-400">{ex}</span>
                  ))}
                </div>
              </motion.button>
            ))}
          </div>
        )}

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subcategory Selector */}
          {selectedPattern && showSubcategories && (
            <div className="lg:col-span-1">
              <div className="bg-card dark:bg-dark-800 rounded-lg p-4 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
                <h2 className="font-semibold mb-4 text-foreground dark:text-dark-50">{t('kanjiConnection.visualLayout.subcategories')}</h2>

                <div className="space-y-2">
                  {SKIP_PATTERNS[selectedPattern].subCategories?.map(subcat => {
                    const kanjiCount = skipData?.subcategorized?.[selectedPattern]?.[subcat.id]?.length || 0;

                    return (
                      <button
                        key={subcat.id}
                        onClick={() => setSelectedSubcategory(subcat.id)}
                        disabled={kanjiCount === 0}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedSubcategory === subcat.id
                            ? 'border-primary-500 bg-primary-100 dark:bg-primary-900/20'
                            : kanjiCount === 0
                            ? 'border-border dark:border-dark-700 opacity-50 cursor-not-allowed'
                            : 'border-border dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-muted dark:hover:bg-dark-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-foreground dark:text-dark-50">{subcat.name}</div>
                            <div className="text-xs text-muted-foreground dark:text-dark-400">{subcat.description}</div>
                          </div>
                          <span className="text-sm text-muted-foreground dark:text-dark-400">{kanjiCount}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Kanji Display */}
          <div className={`${selectedPattern && showSubcategories ? 'lg:col-span-2' : 'lg:col-span-3'}`}>
            {!selectedPattern ? (
              <div className="bg-card dark:bg-dark-800 rounded-lg p-8 md:p-12 text-center">
                <div className="text-6xl mb-4">🎨</div>
                <h3 className="text-xl font-semibold mb-2 text-foreground dark:text-dark-50">
                  {t('kanjiConnection.visualLayout.selectPatternPrompt')}
                </h3>
                <p className="text-muted-foreground dark:text-dark-400">
                  {t('kanjiConnection.visualLayout.selectPatternHint')}
                </p>
              </div>
            ) : loading ? (
              <div className="bg-card dark:bg-dark-800 rounded-lg p-8">
                <LoadingOverlay isLoading={true} message={t('common.loading')} />
              </div>
            ) : error ? (
              <div className="bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-200 dark:border-red-800 p-6 text-center">
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            ) : skipData ? (
              <div className="space-y-6">
                {/* Pattern Info */}
                <div className="bg-card dark:bg-dark-800 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl"
                      style={{
                        backgroundColor: `${getPatternColor(selectedPattern)}20`,
                        color: getPatternColor(selectedPattern)
                      }}
                    >
                      {getPatternIcon(selectedPattern)}
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-foreground dark:text-dark-50 mb-1">
                        {SKIP_PATTERNS[selectedPattern].name}
                      </h2>
                      <p className="text-sm text-muted-foreground dark:text-dark-400 mb-3">
                        {SKIP_PATTERNS[selectedPattern].description}
                      </p>
                      <div className="flex flex-wrap gap-2 text-sm">
                        <span className="px-2 py-1 bg-muted dark:bg-dark-700 rounded">
                          {SKIP_PATTERNS[selectedPattern].nameJa}
                        </span>
                        <span className="px-2 py-1 bg-muted dark:bg-dark-700 rounded">
                          {skipData.categorized[selectedPattern]?.length || 0} kanji
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kanji Grid */}
                <div className="bg-card dark:bg-dark-800 rounded-lg p-6">
                  <h3 className="font-semibold mb-4 text-foreground dark:text-dark-50">
                    {selectedSubcategory && showSubcategories
                      ? SKIP_PATTERNS[selectedPattern].subCategories?.find(sc => sc.id === selectedSubcategory)?.name
                      : `${t('common.all')} ${SKIP_PATTERNS[selectedPattern].name} Kanji`}
                  </h3>

                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 md:gap-3">
                    {(() => {
                      let kanjiToShow: SkipKanji[] = [];

                      if (selectedSubcategory && showSubcategories && skipData.subcategorized) {
                        kanjiToShow = skipData.subcategorized[selectedPattern]?.[selectedSubcategory] || [];
                      } else {
                        kanjiToShow = skipData.categorized[selectedPattern] || [];
                      }

                      return kanjiToShow.map((kanjiDetail, index) => (
                        <motion.button
                          key={kanjiDetail.kanji}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.01 }}
                          onClick={() => handleKanjiClick(kanjiDetail)}
                          className="bg-muted dark:bg-dark-700 hover:bg-primary-100 dark:hover:bg-primary-900/20 rounded-lg p-3 md:p-4 transition-all group relative"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <div className="text-3xl mb-2 text-center group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            {kanjiDetail.kanji}
                          </div>

                          <div className="space-y-1 text-xs">
                            {kanjiDetail.meanings && kanjiDetail.meanings[0] && (
                              <div className="text-muted-foreground dark:text-dark-400 truncate text-center">
                                {kanjiDetail.meanings[0]}
                              </div>
                            )}

                            <div className="flex justify-center gap-1 text-muted-foreground dark:text-dark-500">
                              {kanjiDetail.jlpt && (
                                <span>N{kanjiDetail.jlpt}</span>
                              )}
                            </div>
                          </div>
                        </motion.button>
                      ));
                    })()}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Kanji Detail Modal */}
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