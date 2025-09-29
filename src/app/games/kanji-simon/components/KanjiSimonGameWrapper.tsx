'use client';

import { useState } from 'react';
import { MoodBoard } from '@/types/moodboard';
import { motion } from 'framer-motion';
import KanjiSimonGame from './KanjiSimonGame';
import GameOverScreen from './GameOverScreen';
import { useI18n } from '@/i18n/I18nContext';

interface KanjiSimonGameWrapperProps {
  board: MoodBoard;
  onComplete: () => void;
}

export default function KanjiSimonGameWrapper({ board, onComplete }: KanjiSimonGameWrapperProps) {
  const { t, strings } = useI18n();
  const [currentKanjiIndex, setCurrentKanjiIndex] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [kanjiScores, setKanjiScores] = useState<Record<string, number>>({});
  const [gameState, setGameState] = useState<'playing' | 'completed'>('playing');
  const [lives, setLives] = useState(3);
  const [roundsPerKanji] = useState(5); // Max rounds per kanji before moving on
  const [currentKanjiRounds, setCurrentKanjiRounds] = useState(0);

  const currentKanji = board.kanji[currentKanjiIndex];

  const handleRoundComplete = (roundScore: number) => {
    // Add to this kanji's score
    setKanjiScores(prev => ({
      ...prev,
      [currentKanji.char]: (prev[currentKanji.char] || 0) + roundScore
    }));
    setTotalScore(prev => prev + roundScore);

    // Increment rounds for current kanji
    const newRounds = currentKanjiRounds + 1;
    setCurrentKanjiRounds(newRounds);

    // Check if we should move to next kanji
    if (newRounds >= roundsPerKanji && currentKanjiIndex < board.kanji.length - 1) {
      setTimeout(() => {
        setCurrentKanjiIndex(prev => prev + 1);
        setCurrentKanjiRounds(0);
      }, 2000); // Give time to see the success before moving on
    } else if (newRounds >= roundsPerKanji && currentKanjiIndex === board.kanji.length - 1) {
      // Completed all kanji
      setTimeout(() => {
        setGameState('completed');
      }, 2000);
    }
  };

  const handleGameOver = (kanjiScore: number) => {
    // Record final score for this kanji
    if (kanjiScore > 0) {
      setKanjiScores(prev => ({
        ...prev,
        [currentKanji.char]: kanjiScore
      }));
      setTotalScore(prev => prev + kanjiScore);
    }

    // Lose a life
    const newLives = lives - 1;
    setLives(newLives);

    if (newLives > 0) {
      // Still have lives, continue with next kanji if available
      if (currentKanjiIndex < board.kanji.length - 1) {
        setTimeout(() => {
          setCurrentKanjiIndex(prev => prev + 1);
          setCurrentKanjiRounds(0);
        }, 1500);
      } else {
        // No more kanji but still have lives
        setGameState('completed');
      }
    } else {
      // No more lives
      setGameState('completed');
    }
  };

  const handlePlayAgain = () => {
    // Reset everything
    setCurrentKanjiIndex(0);
    setTotalScore(0);
    setKanjiScores({});
    setGameState('playing');
    setLives(3);
    setCurrentKanjiRounds(0);
  };

  const totalQuestions = Object.keys(kanjiScores).length;
  const correctAnswers = Object.values(kanjiScores).filter(s => s > 0).length;

  if (gameState === 'completed') {
    return (
      <GameOverScreen
        score={totalScore}
        totalQuestions={totalQuestions}
        correctAnswers={correctAnswers}
        onPlayAgain={handlePlayAgain}
        onExit={onComplete}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Board Info */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {board.emoji} {board.title}
        </h2>
        <p className="text-sm text-muted-foreground">
          {strings.games?.kanjiSimon?.kanji || 'Kanji'} {currentKanjiIndex + 1} {strings.games?.kanjiSimon?.of || 'of'} {board.kanji.length}
        </p>
      </div>

      {/* Lives indicator */}
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <motion.div
            key={idx}
            animate={{ scale: idx < lives ? 1 : 0.5, opacity: idx < lives ? 1 : 0.3 }}
            className="text-2xl"
          >
            ❤️
          </motion.div>
        ))}
      </div>

      {/* Game */}
      <KanjiSimonGame
        kanji={currentKanji}
        onRoundComplete={handleRoundComplete}
        onGameOver={handleGameOver}
      />
    </div>
  );
}