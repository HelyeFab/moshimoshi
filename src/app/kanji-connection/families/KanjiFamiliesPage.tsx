'use client';

import { useState, useEffect, useCallback } from 'react';
import { KANJI_FAMILIES, getFamiliesByCategories, type KanjiFamily } from '@/lib/kanji/families';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal';

interface KanjiDetails {
  kanji: string;
  grade?: number | null;
  jlpt?: number | null;
  stroke_count?: number;
  meanings?: string[];
  kun_readings?: string[];
  on_readings?: string[];
  frequency?: number | null;
}

interface FamilyData {
  family: string;
  label: string;
  labelJa: string;
  color: string;
  icon: string;
  note: string;
  components: string[];
  count: number;
  kanji: KanjiDetails[];
  crossFamilyKanji?: {
    kanji: string;
    families: string[];
  }[];
}

export default function KanjiFamiliesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();

  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [familyData, setFamilyData] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showCrossFamilies, setShowCrossFamilies] = useState(false);
  const [modalKanji, setModalKanji] = useState<any>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showFamilyDropdown, setShowFamilyDropdown] = useState(false);

  const familiesByCategory = getFamiliesByCategories();

  const loadFamilyData = async (familyId: string, crossFamilies: boolean) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/kanji/by-family?family=${familyId}&details=true&crossFamilies=${crossFamilies}`
      );

      if (!response.ok) {
        throw new Error('Failed to load family data');
      }

      const data = await response.json();
      setFamilyData(data);
    } catch (err) {
      console.error('Error loading family:', err);
      setError('Failed to load kanji family data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedFamily) {
      loadFamilyData(selectedFamily, showCrossFamilies);
    }
  }, [selectedFamily, showCrossFamilies]);

  const handleFamilySelect = (familyId: string) => {
    setSelectedFamily(familyId);
  };

  const handleKanjiClick = (kanjiDetail: any) => {
    // The API now returns a full Kanji object, so pass it directly
    setModalKanji(kanjiDetail);
  };

  const getFilteredFamilies = () => {
    if (selectedCategory === 'all') {
      return Object.values(KANJI_FAMILIES);
    }
    return familiesByCategory[selectedCategory] || [];
  };

  const categoryColors: Record<string, string> = {
    elements: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-700',
    nature: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/20 dark:text-green-400 dark:border-green-700',
    human: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700',
    tools: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-700',
    abstract: 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-700',
    movement: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/20 dark:text-cyan-400 dark:border-cyan-700',
    society: 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/20 dark:text-pink-400 dark:border-pink-700'
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
              {t('kanjiConnection.families.title')}
            </h1>

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

          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap sm:ml-11">
            <div className="relative">
              <button
                onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                className="px-4 py-2 bg-muted dark:bg-dark-700 rounded-lg text-sm flex items-center gap-2 hover:bg-muted/80 dark:hover:bg-dark-600"
              >
                <span className="text-muted-foreground dark:text-dark-400">Category:</span>
                <span className="text-foreground dark:text-dark-50">{selectedCategory === 'all' ? 'All' : selectedCategory}</span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showCategoryDropdown && (
                <div className="absolute top-full left-0 mt-2 bg-background dark:bg-dark-800 border border-border dark:border-dark-700 rounded-lg shadow-lg z-10">
                  <button
                    onClick={() => {
                      setSelectedCategory('all');
                      setShowCategoryDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-muted dark:hover:bg-dark-700"
                  >
                    All Categories
                  </button>
                  {Object.keys(familiesByCategory).map(cat => (
                    <button
                      key={cat}
                      onClick={() => {
                        setSelectedCategory(cat);
                        setShowCategoryDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 hover:bg-muted dark:hover:bg-dark-700 capitalize"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selectedFamily && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showCrossFamilies}
                  onChange={(e) => setShowCrossFamilies(e.target.checked)}
                  className="rounded"
                />
                <span className="text-muted-foreground dark:text-dark-400">Show cross-families</span>
              </label>
            )}
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Families List */}
          <div className="lg:col-span-1">
            <div className="bg-card dark:bg-dark-800 rounded-lg p-4 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
              <h2 className="font-semibold mb-3 text-foreground dark:text-dark-50">Select a Family</h2>
              <div className="space-y-2">
                {getFilteredFamilies().map((family) => (
                  <button
                    key={family.id}
                    onClick={() => handleFamilySelect(family.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedFamily === family.id
                        ? 'bg-primary-100 dark:bg-primary-900/20 border-2 border-primary-500'
                        : 'bg-muted dark:bg-dark-700 hover:bg-muted/80 dark:hover:bg-dark-600 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{family.icon}</span>
                      <div className="flex-1">
                        <div className="font-medium text-foreground dark:text-dark-50">{family.label}</div>
                        <div className="text-xs text-muted-foreground dark:text-dark-400">{family.labelJa}</div>
                      </div>
                      {selectedCategory === 'all' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border ${categoryColors[family.category]}`}>
                          {family.category}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground dark:text-dark-400 mt-1">
                      {family.components.join(', ')}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Kanji Display */}
          <div className="lg:col-span-2">
            {!selectedFamily ? (
              <div className="bg-card dark:bg-dark-800 rounded-lg p-8 text-center">
                <p className="text-muted-foreground dark:text-dark-400">
                  Select a kanji family to view its characters
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
            ) : familyData ? (
              <div className="bg-card dark:bg-dark-800 rounded-lg p-6">
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{familyData.icon}</span>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground dark:text-dark-50">{familyData.label}</h2>
                      <p className="text-sm text-muted-foreground dark:text-dark-400">{familyData.labelJa}</p>
                    </div>
                  </div>
                  <p className="text-muted-foreground dark:text-dark-300 mb-2">{familyData.note}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-muted-foreground dark:text-dark-400">
                      Components: <span className="text-foreground dark:text-dark-50 font-medium">{familyData.components.join(', ')}</span>
                    </span>
                    <span className="text-muted-foreground dark:text-dark-400">
                      Total: <span className="text-foreground dark:text-dark-50 font-medium">{familyData.count} kanji</span>
                    </span>
                  </div>
                </div>

                {/* Kanji Grid/List */}
                <div className={viewMode === 'grid' ? 'grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2' : 'space-y-2'}>
                  {familyData.kanji.map((kanjiDetail, index) => (
                    <motion.button
                      key={kanjiDetail.kanji}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.01 }}
                      onClick={() => handleKanjiClick(kanjiDetail)}
                      title={kanjiDetail.meaning || kanjiDetail.meanings?.join(', ') || ''}
                      className={
                        viewMode === 'grid'
                          ? 'aspect-square bg-muted dark:bg-dark-700 hover:bg-primary-100 dark:hover:bg-primary-900/20 rounded-lg flex items-center justify-center text-2xl font-bold transition-colors'
                          : 'flex items-center gap-4 p-3 bg-muted dark:bg-dark-700 hover:bg-primary-100 dark:hover:bg-primary-900/20 rounded-lg transition-colors'
                      }
                    >
                      <span className={viewMode === 'list' ? 'text-2xl font-bold' : ''}>
                        {kanjiDetail.kanji}
                      </span>
                      {viewMode === 'list' && (
                        <div className="flex-1 text-left">
                          <div className="text-sm text-muted-foreground dark:text-dark-400">
                            {kanjiDetail.meaning || kanjiDetail.meanings?.join(', ') || ''}
                          </div>
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>

                {/* Cross-family kanji */}
                {showCrossFamilies && familyData.crossFamilyKanji && familyData.crossFamilyKanji.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-border dark:border-dark-700">
                    <h3 className="font-semibold mb-3 text-foreground dark:text-dark-50">Cross-family Kanji</h3>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {familyData.crossFamilyKanji.map(({ kanji, families }) => (
                        <button
                          key={kanji}
                          className="aspect-square bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/20 dark:to-blue-900/20 hover:from-purple-200 hover:to-blue-200 dark:hover:from-purple-900/30 dark:hover:to-blue-900/30 rounded-lg flex items-center justify-center text-2xl font-bold transition-colors"
                          title={`Also in: ${families.join(', ')}`}
                        >
                          {kanji}
                        </button>
                      ))}
                    </div>
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