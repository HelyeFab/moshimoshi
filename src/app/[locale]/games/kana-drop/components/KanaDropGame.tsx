'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameCanvas from './GameCanvas';
import VictoryScreen from './VictoryScreen';
import KanaSelection from './KanaSelection';
import { GameState, GameStats as GameStatsType, KanaChar, GAME_CONSTANTS } from '../types';
import { useAudioManager } from '../hooks/useAudioManager';
import { kanaData } from '@/data/kanaData';
import { useI18n, buildLocalePath } from '@/i18n/I18nContext';

interface KanaDropGameProps {
  initialSelectedKana?: KanaChar[];
  onClose?: () => void;
}

export default function KanaDropGame({ initialSelectedKana = [], onClose }: KanaDropGameProps) {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(true);
  const [showKanaSelection, setShowKanaSelection] = useState(false);
  const [selectedKana, setSelectedKana] = useState<KanaChar[]>(initialSelectedKana);
  const [showVictory, setShowVictory] = useState(false);
  const [gameStats, setGameStats] = useState<GameStatsType | null>(null);
  const { playSound, stopAllSounds } = useAudioManager();
  const { t } = useI18n();

  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    selectedKana: initialSelectedKana,
    activeRomaji: null,
    fallingObjects: [],
    gameSpeed: 1,
    isPlaying: false,
    isPaused: false,
    startTime: 0,
    clicks: {
      correct: 0,
      wrong: 0,
      distractor: 0
    }
  });

  // Initialize game when component mounts
  useEffect(() => {
    if (initialSelectedKana.length === 0) {
      setShowKanaSelection(true);
      setShowHowToPlay(false);
    } else {
      setShowKanaSelection(false);
      setShowHowToPlay(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      stopAllSounds();
    };
  }, [stopAllSounds]);

  // Check for victory
  useEffect(() => {
    if (gameState.score >= GAME_CONSTANTS.WINNING_SCORE && gameState.isPlaying) {
      // Victory!
      const endTime = Date.now();
      const timeTaken = gameState.startTime ? Math.round((endTime - gameState.startTime) / 1000) : 0;
      const totalClicks = gameState.clicks.correct + gameState.clicks.wrong + gameState.clicks.distractor;
      const accuracy = totalClicks > 0 ? Math.round((gameState.clicks.correct / totalClicks) * 100) : 0;

      setGameStats({
        finalScore: gameState.score,
        timeTaken,
        accuracy,
        totalClicks,
        correctClicks: gameState.clicks.correct
      });

      setGameState(prev => ({
        ...prev,
        isPlaying: false,
        fallingObjects: []
      }));

      setShowVictory(true);
      playSound('victory');
    }
  }, [gameState.score, gameState.isPlaying, gameState.startTime, gameState.clicks, playSound]);

  // Update game state
  const handleGameStateUpdate = useCallback((updates: Partial<GameState> | ((prev: GameState) => Partial<GameState>)) => {
    if (typeof updates === 'function') {
      setGameState(prev => ({ ...prev, ...updates(prev) }));
    } else {
      setGameState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  // Start countdown
  const startCountdown = useCallback(() => {
    setShowHowToPlay(false);
    setCountdown(3);
    // Removed countdown sound - out of sync

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);
          playSound('start');
          setGameState(prev => ({
            ...prev,
            isPlaying: true,
            startTime: Date.now()
          }));
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [playSound]);

  // Handle kana selection
  const handleKanaSelected = (kana: KanaChar[]) => {
    setSelectedKana(kana);
    setGameState(prev => ({
      ...prev,
      selectedKana: kana
    }));
    setShowKanaSelection(false);
    setShowHowToPlay(true);
  };

  // Play again
  const handlePlayAgain = () => {
    setShowVictory(false);
    setGameStats(null);
    setGameState({
      score: 0,
      selectedKana,
      activeRomaji: null,
      fallingObjects: [],
      gameSpeed: 1,
      isPlaying: false,
      isPaused: false,
      startTime: 0,
      clicks: {
        correct: 0,
        wrong: 0,
        distractor: 0
      }
    });
    setShowHowToPlay(true);
  };

  // Handle close/exit
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      // Navigate back to games page
      window.location.href = buildLocalePath('/games');
    }
  };

  // Handle selecting new kana (from victory screen)
  const handleSelectNewKana = () => {
    setShowVictory(false);
    setGameStats(null);
    setShowKanaSelection(true);
  };

  // Kana Selection Screen
  if (showKanaSelection) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-dark-900 dark:to-dark-800">
        <KanaSelection
          onStartGame={handleKanaSelected}
          onCancel={handleClose}
        />
      </div>
    );
  }

  // How to Play Screen
  if (showHowToPlay) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-dark-850 rounded-2xl p-8 max-w-2xl w-full shadow-2xl">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
              {t('games.howToPlay')}
            </h1>

            <ul className="text-lg text-gray-700 dark:text-gray-300 mb-6 space-y-2 text-left max-w-md mx-auto">
              <li>• {t('games.kanaDrop.rule1')}</li>
              <li>• {t('games.kanaDrop.rule2')}</li>
              <li>• {t('games.kanaDrop.rule3')}</li>
              <li>• {t('games.kanaDrop.rule4')}</li>
              <li>• {t('games.kanaDrop.rule5')}</li>
              <li>• {t('games.kanaDrop.rule6')}</li>
            </ul>

            {selectedKana.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                  {t('games.yourSelectedKana')}:
                </h3>
                <div className="flex justify-center gap-3 flex-wrap">
                  {selectedKana.map((kana) => (
                    <div key={kana.id} className="bg-gray-100 dark:bg-dark-900 rounded-lg p-3 border border-gray-300 dark:border-gray-700">
                      <div className="text-2xl">{kana.kana}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{kana.romaji}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-center gap-3">
              <button
                onClick={startCountdown}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold text-lg hover:bg-primary-700 transition-colors"
              >
                {t('games.startGame')}
              </button>
              <button
                onClick={handleClose}
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold text-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative">
      {/* Game controls - Close/Pause buttons */}
      {!showVictory && (
        <div className="absolute top-4 right-4 z-30 flex gap-2">
          {/* Pause/Resume button */}
          {gameState.isPlaying && (
            <button
              onClick={() => handleGameStateUpdate({ isPaused: !gameState.isPaused })}
              className="p-2 rounded-lg bg-white/80 dark:bg-dark-800/80 hover:bg-white dark:hover:bg-dark-700 border border-gray-200 dark:border-gray-700 transition-colors"
              title={gameState.isPaused ? "Resume Game" : "Pause Game"}
            >
              {gameState.isPaused ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
          )}

          {/* Close button */}
          <button
            onClick={handleClose}
            className="p-2 rounded-lg bg-white/80 dark:bg-dark-800/80 hover:bg-white dark:hover:bg-dark-700 border border-gray-200 dark:border-gray-700 transition-colors"
            title="Close Game"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Countdown */}
      {countdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/50 backdrop-blur-sm">
          <motion.div
            key={countdown}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            {countdown > 0 ? (
              <>
                <div className="text-8xl font-bold text-white mb-4">
                  {countdown}
                </div>
                <div className="text-2xl text-white">
                  {t('games.getReady')}
                </div>
              </>
            ) : (
              <div className="text-6xl font-bold text-green-400">
                {t('games.go')}
              </div>
            )}
          </motion.div>
        </div>
      )}

      {/* Victory Screen */}
      {showVictory && gameStats && (
        <VictoryScreen
          stats={gameStats}
          onPlayAgain={handlePlayAgain}
          onSelectNewKana={handleSelectNewKana}
          onClose={handleClose}
        />
      )}

      {/* Game Canvas */}
      {!showVictory && (
        <GameCanvas
          gameState={gameState}
          onGameStateUpdate={handleGameStateUpdate}
        />
      )}

      {/* Pause Screen */}
      {gameState.isPaused && !showVictory && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-30">
          <div className="text-center p-8 bg-white dark:bg-dark-850 rounded-2xl shadow-2xl">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              {t('games.gamePaused')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('games.resumeOrExit')}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => handleGameStateUpdate({ isPaused: false })}
                className="px-8 py-4 bg-primary-600 text-white rounded-lg font-semibold text-xl hover:bg-primary-700 transition-colors"
              >
                {t('games.resumeGame')}
              </button>
              <button
                onClick={handleClose}
                className="px-8 py-4 bg-red-600 text-white rounded-lg font-semibold text-xl hover:bg-red-700 transition-colors"
              >
                {t('games.endGame')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}