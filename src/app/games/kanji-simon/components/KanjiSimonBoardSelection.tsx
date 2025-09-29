'use client';

import { useState, useEffect } from 'react';
import { useMoodBoards } from '@/hooks/useMoodBoards';
import { MoodBoard as MoodBoardType } from '@/types/moodboard';
import { useI18n } from '@/i18n/I18nContext';

interface KanjiSimonBoardSelectionProps {
  onSelect: (boardId: string) => void;
}

export default function KanjiSimonBoardSelection({ onSelect }: KanjiSimonBoardSelectionProps) {
  const { t, strings } = useI18n();
  const { moodBoards, loading } = useMoodBoards();
  const [filteredBoards, setFilteredBoards] = useState<MoodBoardType[]>([]);

  useEffect(() => {
    // Filter active boards with kanji
    const activeBoards = moodBoards.filter(board =>
      board.isActive !== false &&
      board.kanji &&
      board.kanji.length > 0
    );
    setFilteredBoards(activeBoards);
  }, [moodBoards]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">⏳</div>
          <p className="text-muted-foreground">{strings.common?.loading || 'Loading mood boards...'}</p>
        </div>
      </div>
    );
  }

  if (filteredBoards.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-5xl mb-4">📚</div>
        <h3 className="text-xl font-semibold mb-2">
          {strings.games?.kanjiSimon?.noBoardsTitle || 'No Mood Boards Available'}
        </h3>
        <p className="text-muted-foreground">
          {strings.games?.kanjiSimon?.noBoardsDesc || 'There are no active mood boards with kanji to practice.'}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xl font-semibold text-foreground mb-6 text-center">
        {strings.games?.kanjiSimon?.selectBoard || 'Select a Mood Board'}
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBoards.map((board) => (
          <button
            key={board.id}
            onClick={() => onSelect(board.id)}
            className="group relative overflow-hidden rounded-2xl bg-card hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1"
          >
            {/* Background with subtle gradient */}
            <div
              className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity duration-300"
              style={{
                background: `linear-gradient(135deg, ${board.background}, transparent)`
              }}
            />

            <div className="relative p-6">
              {/* Emoji and Title */}
              <div className="text-center mb-4">
                <div className="text-5xl mb-3">{board.emoji}</div>
                <h4 className="text-xl font-bold text-foreground mb-1">{board.title}</h4>
                <p className="text-sm text-muted-foreground font-medium">
                  {board.kanji.length} kanji • {board.jlpt}
                </p>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground text-center mb-4 line-clamp-2 min-h-[2.5rem]">
                {board.description}
              </p>

              {/* Start Practice Button */}
              <div className="mt-4 text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500/10 text-primary-500 rounded-full text-sm font-medium group-hover:bg-primary-500/20 transition-colors">
                  <span>{strings.games?.kanjiSimon?.startPractice || 'Start Practice'}</span>
                  <span className="text-lg">→</span>
                </div>
              </div>
            </div>

            {/* Hover border effect */}
            <div className="absolute inset-0 rounded-2xl border-2 border-transparent group-hover:border-primary-500/30 transition-colors duration-300" />
          </button>
        ))}
      </div>
    </div>
  );
}