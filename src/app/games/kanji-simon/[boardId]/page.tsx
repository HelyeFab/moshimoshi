'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useMoodBoards } from '@/hooks/useMoodBoards';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n/I18nContext';
import { MoodBoard } from '@/types/moodboard';
// Navigation is now global via NavigationWrapper in root layout;
import KanjiSimonGameWrapper from '../components/KanjiSimonGameWrapper';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { useToast } from '@/components/ui/Toast/ToastContext';

export default function KanjiSimonGamePage() {
  const router = useRouter();
  const params = useParams();
  const boardId = params.boardId as string;

  const { t, strings } = useI18n();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { moodBoards, loading } = useMoodBoards();

  const [board, setBoard] = useState<MoodBoard | null>(null);

  // Find the board
  useEffect(() => {
    if (!loading && moodBoards.length > 0) {
      const foundBoard = moodBoards.find(b => b.id === boardId);
      if (foundBoard && foundBoard.kanji && foundBoard.kanji.length > 0) {
        setBoard(foundBoard);
      } else if (!foundBoard) {
        showToast(
          strings.games?.kanjiSimon?.boardNotFound || 'Board not found',
          'error'
        );
        router.push('/games/kanji-simon');
      } else {
        showToast(
          strings.games?.kanjiSimon?.noKanjiInBoard || 'This board has no kanji',
          'error'
        );
        router.push('/games/kanji-simon');
      }
    }
  }, [moodBoards, loading, boardId, router, showToast, strings]);

  const handleComplete = () => {
    router.push('/games/kanji-simon');
  };

  if (loading) {
    return <LoadingOverlay message={strings.common?.loading || 'Loading...'} />;
  }

  if (!board) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-background-light/90 to-primary-100/20 dark:from-dark-850 dark:via-dark-900 dark:to-primary-900/10">
      {/* Navigation is now global - rendered in root layout */}
      </div>
    </div>
  );
}