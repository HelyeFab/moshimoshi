'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMoodBoards } from '@/hooks/useMoodBoards';
import { MoodBoard as MoodBoardType } from '@/types/moodboard';
import {
  getBoardProgress,
  toggleKanjiLearned,
  isKanjiLearned,
  resetBoardProgress
} from '@/utils/moodBoardProgress';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import Navbar from '@/components/layout/Navbar';
import LearningPageHeader from '@/components/learn/LearningPageHeader';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import KanjiDetailsModal from '@/components/kanji/KanjiDetailsModal';
import { Kanji } from '@/types/kanji';
import { useToast } from '@/components/ui/Toast/ToastContext';

export default function MoodBoardDetailPage() {
  const router = useRouter();
  const params = useParams();
  const boardId = params.boardId as string;

  const { t } = useI18n();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { moodBoards, loading } = useMoodBoards();

  const [board, setBoard] = useState<MoodBoardType | null>(null);
  const [progress, setProgress] = useState(getBoardProgress(boardId));
  const [viewMode, setViewMode] = useState<'grid' | 'study' | 'list'>('grid');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showCompleted, setShowCompleted] = useState(true);
  const [selectedKanji, setSelectedKanji] = useState<Kanji | null>(null);

  // Find the board
  useEffect(() => {
    if (!loading && moodBoards.length > 0) {
      const foundBoard = moodBoards.find(b => b.id === boardId);
      if (foundBoard) {
        setBoard(foundBoard);
      } else {
        showToast(
          `${t('error.notFound')}: ${t('moodboards.boardNotFound')}`,
          'error'
        );
        router.push('/kanji-moods');
      }
    }
  }, [boardId, moodBoards, loading, router, showToast, t]);

  // Update progress when board changes
  useEffect(() => {
    setProgress(getBoardProgress(boardId));
  }, [boardId]);

  const handleToggleKanji = (kanjiChar: string) => {
    if (!board) return;
    const newProgress = toggleKanjiLearned(boardId, kanjiChar, board.kanji.length);
    setProgress(newProgress);

    // Show toast on completion
    if (newProgress.progressPercentage === 100 && newProgress.completedAt) {
      showToast(
        `${t('congratulations')}: ${t('moodboards.boardCompleted')}`,
        'success'
      );
    }
  };

  const handleResetProgress = () => {
    if (window.confirm(t('moodboards.confirmReset'))) {
      resetBoardProgress(boardId);
      setProgress(null);
      showToast(t('moodboards.progressReset'), 'success');
    }
  };

  const handleStudyMode = () => {
    setViewMode('study');
    // Start with first unlearned kanji
    const firstUnlearnedIndex = board?.kanji.findIndex(k =>
      !isKanjiLearned(boardId, k.char)
    ) ?? 0;
    setCurrentCardIndex(firstUnlearnedIndex === -1 ? 0 : firstUnlearnedIndex);
  };

  const handleNextCard = () => {
    if (!board) return;
    setCurrentCardIndex((prev) => (prev + 1) % board.kanji.length);
  };

  const handlePreviousCard = () => {
    if (!board) return;
    setCurrentCardIndex((prev) => (prev - 1 + board.kanji.length) % board.kanji.length);
  };

  const handleGenerateStory = async () => {
    if (!board || !user) return;

    try {
      showToast('Creating a story from this mood board...', 'info');

      const response = await fetch('/api/admin/generate-story-from-moodboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}`
        },
        body: JSON.stringify({
          moodboardId: boardId,
          targetLength: 'medium',
          includeDialogue: true,
          genre: 'slice-of-life'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate story');
      }

      const story = await response.json();

      // Save the story to Firebase
      const { createStory } = await import('@/hooks/useStories').then(m => ({ createStory: m.useStories().createStory }));
      const storyId = await createStory(story);

      showToast('Story generated successfully!', 'success');

      // Navigate to the story
      router.push(`/stories/${storyId}`);
    } catch (error) {
      console.error('Error generating story:', error);
      showToast('Failed to generate story', 'error');
    }
  };

  if (loading || !board) {
    return <LoadingOverlay />;
  }

  const learnedCount = progress?.learnedKanji.length || 0;
  const totalCount = board.kanji.length;
  const progressPercentage = progress?.progressPercentage || 0;
  const isCompleted = progressPercentage === 100;

  // Transform moodboard kanji to standard Kanji interface
  // Handle both old (nested readings) and new (flat onyomi/kunyomi) structures
  const transformedKanji: Kanji[] = board.kanji.map(k => ({
    kanji: k.char,
    meaning: k.meaning,
    meanings: [k.meaning],
    onyomi: k.onyomi || k.readings?.on || [],
    kunyomi: k.kunyomi || k.readings?.kun || [],
    strokeCount: k.strokeCount || 0, // Fixed field name from 'strokes' to 'strokeCount'
    frequency: undefined, // Don't set to 0, leave undefined so it doesn't display
    jlpt: k.jlpt || board.jlpt || 'N5',
    examples: k.examples?.map(ex => ({
      word: typeof ex === 'string' ? ex : ex.sentence,
      reading: '',
      meaning: typeof ex === 'string' ? '' : ex.translation || ''
    })) || []
  }));

  // Filter kanji based on show completed setting
  const displayKanji = showCompleted
    ? transformedKanji
    : transformedKanji.filter(k => !isKanjiLearned(boardId, k.kanji));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background to-background-dark dark:from-dark-900 dark:via-dark-850 dark:to-dark-900">
      <Navbar user={user} showUserMenu={true} />

      {/* Learning Page Header */}
      <LearningPageHeader
        title={`${board.emoji} ${board.title}`}
        description={board.description}
        mode={viewMode}
        onModeChange={(mode) => {
          if (mode === 'study') {
            handleStudyMode();
          } else {
            setViewMode(mode as 'grid' | 'study' | 'list');
          }
        }}
        stats={{
          total: totalCount,
          learned: learnedCount,
          reviewing: 0,
          accuracy: 0
        }}
        progress={progressPercentage}
        selectionMode={false}
        onToggleSelection={() => {}}
        customActions={
          <div className="flex items-center gap-4">
            {/* Show completed toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCompleted}
                onChange={(e) => setShowCompleted(e.target.checked)}
                className="rounded border-gray-300 dark:border-dark-600"
              />
              <span className="text-sm">{t('moodboards.showCompleted')}</span>
            </label>

            {/* Generate Story button (admin only) */}
            {user?.isAdmin && (
              <button
                onClick={() => handleGenerateStory()}
                className="px-3 py-1.5 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Generate Story
              </button>
            )}

            {/* Reset progress button */}
            <button
              onClick={handleResetProgress}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
            >
              {t('common.resetProgress')}
            </button>
          </div>
        }
        backLink="/kanji-moods"
      />

      {/* Content area */}
      <div className="container mx-auto px-4 py-8">
        {viewMode === 'grid' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {displayKanji.map((kanji) => {
              const isLearned = isKanjiLearned(boardId, kanji.kanji);
              return (
                <div
                  key={kanji.kanji}
                  onClick={() => setSelectedKanji(kanji)}
                  className={`
                    relative p-6 bg-white dark:bg-dark-800 rounded-lg shadow-md
                    hover:shadow-xl transition-all cursor-pointer
                    ${isLearned ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20' : ''}
                  `}
                >
                  {/* Learned indicator */}
                  {isLearned && (
                    <div className="absolute top-2 right-2">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}

                  {/* Kanji character */}
                  <div className="text-4xl font-bold text-center mb-3 font-japanese">
                    {kanji.kanji}
                  </div>

                  {/* Meaning */}
                  <div className="text-sm text-center text-gray-600 dark:text-gray-400">
                    {kanji.meaning}
                  </div>

                  {/* JLPT Level */}
                  <div className="text-xs text-center mt-2 text-gray-500 dark:text-gray-500">
                    {kanji.jlpt}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {viewMode === 'study' && displayKanji.length > 0 && (
          <div className="max-w-lg mx-auto">
            <div className="mb-4 text-center">
              <span className="text-sm text-muted-foreground dark:text-dark-400">
                {t('common.card')} {currentCardIndex + 1} / {displayKanji.length}
              </span>
            </div>

            {/* Study Card */}
            <div
              className="bg-white dark:bg-dark-800 rounded-lg shadow-xl p-8 cursor-pointer"
              onClick={() => setSelectedKanji(displayKanji[currentCardIndex])}
            >
              <div className="text-6xl font-bold text-center mb-4 font-japanese">
                {displayKanji[currentCardIndex].kanji}
              </div>
              <div className="text-xl text-center text-gray-700 dark:text-gray-300 mb-4">
                {displayKanji[currentCardIndex].meaning}
              </div>
              <div className="space-y-2">
                {displayKanji[currentCardIndex].onyomi.length > 0 && (
                  <div className="text-center">
                    <span className="text-sm text-gray-500">On: </span>
                    <span className="font-japanese">{displayKanji[currentCardIndex].onyomi.join('、')}</span>
                  </div>
                )}
                {displayKanji[currentCardIndex].kunyomi.length > 0 && (
                  <div className="text-center">
                    <span className="text-sm text-gray-500">Kun: </span>
                    <span className="font-japanese">{displayKanji[currentCardIndex].kunyomi.join('、')}</span>
                  </div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleKanji(displayKanji[currentCardIndex].kanji);
                }}
                className={`mt-4 w-full py-2 px-4 rounded-lg transition-colors ${
                  isKanjiLearned(boardId, displayKanji[currentCardIndex].kanji)
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-200 dark:bg-dark-700 hover:bg-gray-300 dark:hover:bg-dark-600'
                }`}
              >
                {isKanjiLearned(boardId, displayKanji[currentCardIndex].kanji) ? t('common.learned') : t('common.markAsLearned')}
              </button>
            </div>

            <div className="flex justify-between items-center mt-6">
              <button
                onClick={handlePreviousCard}
                className="px-4 py-2 bg-gray-100 dark:bg-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600"
              >
                {t('common.previous')}
              </button>

              <div className="flex gap-1">
                {board.kanji.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentCardIndex(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentCardIndex
                        ? 'bg-primary-600'
                        : 'bg-gray-300 dark:bg-dark-600'
                    }`}
                    aria-label={`Go to card ${index + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={handleNextCard}
                className="px-4 py-2 bg-gray-100 dark:bg-dark-700 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600"
              >
                {t('common.next')}
              </button>
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className="max-w-4xl mx-auto space-y-2">
            {displayKanji.map((kanji) => (
              <div
                key={kanji.kanji}
                className="flex items-center gap-4 p-4 bg-white dark:bg-dark-800 rounded-lg border border-gray-200 dark:border-dark-700 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedKanji(kanji)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleKanji(kanji.kanji);
                  }}
                  className={`p-2 rounded-full transition-colors ${
                    isKanjiLearned(boardId, kanji.kanji)
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-dark-400'
                  }`}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>

                <div className="text-3xl font-bold font-japanese">{kanji.kanji}</div>

                <div className="flex-1">
                  <p className="font-medium">{kanji.meaning}</p>
                  <div className="flex gap-4 text-sm text-muted-foreground dark:text-dark-400">
                    {kanji.onyomi.length > 0 && (
                      <span>On: {kanji.onyomi.join('、')}</span>
                    )}
                    {kanji.kunyomi.length > 0 && (
                      <span>Kun: {kanji.kunyomi.join('、')}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {displayKanji.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-semibold">{t('moodboards.allLearned')}</h3>
            <p className="text-muted-foreground dark:text-dark-400 mt-2">
              {t('moodboards.toggleShowCompleted')}
            </p>
          </div>
        )}
      </div>

      {/* Kanji Details Modal */}
      {selectedKanji && (
        <KanjiDetailsModal
          kanji={selectedKanji}
          isOpen={!!selectedKanji}
          onClose={() => setSelectedKanji(null)}
        />
      )}
    </div>
  );
}