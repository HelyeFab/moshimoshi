'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { GameState } from '../types';
import { useStrings } from '@/contexts/LanguageContext';

interface GameStatsProps {
  gameState: GameState;
  showFeedback?: {
    type: 'correct' | 'wrong' | 'distractor';
    x: number;
    y: number;
  } | null;
}

export default function GameStats({ gameState, showFeedback }: GameStatsProps) {
  const accuracy = gameState.clicks.correct + gameState.clicks.wrong + gameState.clicks.distractor > 0
    ? Math.round((gameState.clicks.correct / (gameState.clicks.correct + gameState.clicks.wrong + gameState.clicks.distractor)) * 100)
    : 0;

  return (
    <>
      {/* Score and Stats - Combined in top left to avoid overlap */}
      <div className="absolute top-4 left-4 space-y-2 pointer-events-none" style={{ zIndex: 15 }}>
        <motion.div
          className="bg-background/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border-2 border-border"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 0.3 }}
          key={gameState.score}
        >
          <div className="text-2xl font-bold text-foreground">
            SCORE: {gameState.score}
          </div>
          <div className="text-xs text-muted-foreground">
            Accuracy: {accuracy}%
          </div>
        </motion.div>

        <div className="bg-background/90 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-border">
          <div className="text-xs text-muted-foreground">Speed</div>
          <div className="text-sm font-semibold text-foreground">
            {Math.round(gameState.gameSpeed * 100)}%
          </div>
        </div>
      </div>

      {/* Feedback Animations */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            key={`feedback-${Date.now()}`}
            initial={{ opacity: 1, scale: 0.5, y: 0 }}
            animate={{ opacity: 0, scale: 1.5, y: -30 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute pointer-events-none z-30"
            style={{
              left: `${showFeedback.x}%`,
              top: `${showFeedback.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            {showFeedback.type === 'correct' && (
              <div className="text-4xl font-bold text-green-500">
                +5 ✨
              </div>
            )}
            {showFeedback.type === 'wrong' && (
              <div className="text-3xl font-bold text-red-500">
                -10 ❌
              </div>
            )}
            {showFeedback.type === 'distractor' && (
              <div className="text-3xl font-bold text-orange-500">
                -5 💥
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Bar to 100 */}
      <div className="absolute bottom-20 left-4 right-4 pointer-events-none" style={{ zIndex: 15 }}>
        <div className="bg-background/80 backdrop-blur-sm rounded-full h-2 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(gameState.score, 100)}%` }}
            transition={{ type: "spring", damping: 20 }}
          />
        </div>
        <div className="text-center mt-1 text-xs text-muted-foreground">
          {100 - gameState.score} points to victory!
        </div>
      </div>
    </>
  );
}