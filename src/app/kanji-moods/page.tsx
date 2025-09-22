'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useMoodBoards, searchMoodBoards, filterMoodBoardsByJLPT } from '@/hooks/useMoodBoards';
import { getAllProgress } from '@/utils/moodBoardProgress';
import MoodBoardCard from '@/components/kanji-moods/MoodBoardCard';
import { MoodBoard, MoodBoardsProgress } from '@/types/moodboard';
import { useI18n } from '@/i18n/I18nContext';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/layout/Navbar';
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

type ViewMode = 'grid' | 'list';
type JLPTFilter = 'all' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

export default function KanjiMoodsPage() {
  const router = useRouter();
  const { t, strings } = useI18n();
  const { user } = useAuth();
  const { moodBoards, loading } = useMoodBoards();
  const [progress, setProgress] = useState<MoodBoardsProgress>({});

  // View and filter state
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJLPT, setSelectedJLPT] = useState<JLPTFilter>('all');
  const [showCompleted, setShowCompleted] = useState(true);
  const [sortBy, setSortBy] = useState<'title' | 'progress' | 'kanji'>('title');

  // Load progress data
  useEffect(() => {
    const loadProgress = () => {
      try {
        const allProgress = getAllProgress();
        setProgress(allProgress);
      } catch (error) {
        console.error('Error loading progress:', error);
      }
    };

    loadProgress();
  }, []);

  // Filter and sort mood boards
  const filteredBoards = useMemo(() => {
    let boards = moodBoards.filter(board => board.isActive !== false);

    // Apply search filter
    if (searchQuery.trim()) {
      boards = searchMoodBoards(boards, searchQuery);
    }

    // Apply JLPT filter
    boards = filterMoodBoardsByJLPT(boards, selectedJLPT);

    // Apply completion filter
    if (!showCompleted) {
      boards = boards.filter(board =>
        progress[board.id]?.progressPercentage !== 100
      );
    }

    // Sort boards
    boards.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'progress':
          const progressA = progress[a.id]?.progressPercentage || 0;
          const progressB = progress[b.id]?.progressPercentage || 0;
          return progressB - progressA;
        case 'kanji':
          return a.kanji.length - b.kanji.length;
        default:
          return 0;
      }
    });

    return boards;
  }, [moodBoards, searchQuery, selectedJLPT, showCompleted, sortBy, progress]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalBoards = filteredBoards.length;
    const completedBoards = filteredBoards.filter(board =>
      progress[board.id]?.progressPercentage === 100
    ).length;

    let totalKanji = 0;
    let learnedKanji = 0;

    filteredBoards.forEach(board => {
      totalKanji += board.kanji.length;
      learnedKanji += progress[board.id]?.learnedKanji.length || 0;
    });

    return {
      total: totalBoards,
      completed: completedBoards,
      progress: totalBoards > 0 ? Math.round((completedBoards / totalBoards) * 100) : 0,
      totalKanji,
      learnedKanji
    };
  }, [filteredBoards, progress]);

  const handleBoardClick = (boardId: string) => {
    router.push(`/kanji-moods/${boardId}`);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleFilterChange = (filters: any) => {
    if (filters.jlpt !== undefined) setSelectedJLPT(filters.jlpt);
    if (filters.showCompleted !== undefined) setShowCompleted(filters.showCompleted);
    if (filters.sortBy !== undefined) setSortBy(filters.sortBy);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background to-background-dark dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} />

      <LearningPageHeader
        title={t('moodboards.title')}
        description={t('moodboards.description')}
        mode={viewMode}
        onModeChange={setViewMode}
        stats={stats}
        onSearch={handleSearch}
        searchPlaceholder={t('moodboards.searchPlaceholder')}
        filters={{
          jlpt: {
            value: selectedJLPT,
            options: [
              { value: 'all', label: t('common.all') },
              { value: 'N5', label: 'N5' },
              { value: 'N4', label: 'N4' },
              { value: 'N3', label: 'N3' },
              { value: 'N2', label: 'N2' },
              { value: 'N1', label: 'N1' },
            ],
            onChange: (value) => handleFilterChange({ jlpt: value })
          },
          showCompleted: {
            value: showCompleted,
            onChange: (value) => handleFilterChange({ showCompleted: value })
          },
          sortBy: {
            value: sortBy,
            options: [
              { value: 'title', label: t('common.title') },
              { value: 'progress', label: t('common.progress') },
              { value: 'kanji', label: t('common.kanjiCount') },
            ],
            onChange: (value) => handleFilterChange({ sortBy: value })
          }
        }}
      />

      {loading ? (
        <LoadingOverlay />
      ) : (
        <div className="container mx-auto px-4 py-8">
          {filteredBoards.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎨</div>
              <h3 className="text-xl font-semibold text-foreground dark:text-dark-100 mb-2">
                {t('moodboards.noResults')}
              </h3>
              <p className="text-muted-foreground dark:text-dark-400">
                {searchQuery
                  ? t('moodboards.tryDifferentSearch')
                  : t('moodboards.noMoodboards')}
              </p>
            </div>
          ) : (
            <>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredBoards.map((board) => (
                    <MoodBoardCard
                      key={board.id}
                      board={board}
                      progress={progress[board.id]}
                      onClick={handleBoardClick}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredBoards.map((board) => (
                    <div
                      key={board.id}
                      className="bg-white dark:bg-dark-800 rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 cursor-pointer"
                      onClick={() => handleBoardClick(board.id)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-3xl">{board.emoji}</div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-foreground dark:text-dark-100">
                            {board.title}
                          </h3>
                          <p className="text-sm text-muted-foreground dark:text-dark-400">
                            {board.description}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground dark:text-dark-500">
                            <span>{board.jlpt}</span>
                            <span>{board.kanji.length} {t('common.kanji')}</span>
                            <span>{progress[board.id]?.progressPercentage || 0}% {t('common.complete')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}