'use client';

import { motion } from 'framer-motion';
import { GameStats } from '../types';
import Confetti from 'react-confetti';
import { useState, useEffect } from 'react';

interface VictoryScreenProps {
  stats: GameStats;
  onPlayAgain: () => void;
  onSelectNewKana: () => void;
  onClose: () => void;
}

export default function VictoryScreen({ stats, onPlayAgain, onSelectNewKana, onClose }: VictoryScreenProps) {
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateWindowSize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };

    updateWindowSize();
    window.addEventListener('resize', updateWindowSize);
    return () => window.removeEventListener('resize', updateWindowSize);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 flex items-center justify-center z-50 bg-background/80 backdrop-blur-sm"
    >
      <Confetti
        width={windowSize.width}
        height={windowSize.height}
        recycle={false}
        numberOfPieces={200}
        gravity={0.2}
      />

      <motion.div
        initial={{ y: 50 }}
        animate={{ y: 0 }}
        className="bg-card rounded-lg shadow-2xl p-8 max-w-md w-full mx-4 border-2 border-primary"
      >
        <div className="text-center">
          {/* Trophy Animation */}
          <motion.div
            animate={{
              rotate: [0, -10, 10, -10, 10, 0],
              scale: [1, 1.1, 1]
            }}
            transition={{
              duration: 1,
              delay: 0.5
            }}
            className="text-8xl mb-4"
          >
            🏆
          </motion.div>

          <h2 className="text-3xl font-bold text-foreground mb-2">Victory!</h2>
          <p className="text-muted-foreground mb-6">You've mastered the kana challenge!</p>

          {/* Stats */}
          <div className="bg-background rounded-lg p-4 mb-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Final Score</span>
              <span className="text-xl font-bold text-primary">{stats.finalScore}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Time Taken</span>
              <span className="font-semibold">{Math.floor(stats.timeTaken / 60)}:{(stats.timeTaken % 60).toString().padStart(2, '0')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Accuracy</span>
              <span className="font-semibold text-green-600">{stats.accuracy}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Total Clicks</span>
              <span className="font-semibold">{stats.totalClicks}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onPlayAgain}
              className="w-full px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
            >
              Play Again
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onSelectNewKana}
              className="w-full px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-semibold hover:bg-secondary/90 transition-colors"
            >
              Select New Kana
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="w-full px-6 py-3 bg-muted text-foreground rounded-lg font-semibold hover:bg-muted/90 transition-colors"
            >
              Close
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}