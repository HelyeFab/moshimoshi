'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import FallingObject from './FallingObject';
import GameStats from './GameStats';
import {
  FallingObject as FallingObjectType,
  GameState,
  KanaChar,
  GAME_CONSTANTS,
  DISTRACTOR_IMAGES
} from '../types';
import { useAudioManager } from '../hooks/useAudioManager';
import { kanaData } from '@/data/kanaData';
import { useI18n } from '@/i18n/I18nContext';

interface GameCanvasProps {
  gameState: GameState;
  onGameStateUpdate: (updates: Partial<GameState> | ((prev: GameState) => Partial<GameState>)) => void;
}

// Define SPAWN_INTERVAL using the average of SPAWN_RATE_MIN and SPAWN_RATE_MAX
const SPAWN_INTERVAL = (GAME_CONSTANTS.SPAWN_RATE_MIN + GAME_CONSTANTS.SPAWN_RATE_MAX) / 2;

// Helper function to get basic kana (exclude digraphs and special characters)
function getBasicKana() {
  return kanaData.filter(k =>
    k.type !== 'digraph' &&
    !['wi', 'we', 'wo'].includes(k.id)
  );
}

export default function GameCanvas({ gameState, onGameStateUpdate }: GameCanvasProps) {
  const [showFeedback, setShowFeedback] = useState<{
    type: 'correct' | 'wrong' | 'distractor';
    x: number;
    y: number;
  } | null>(null);

  const gameLoopRef = useRef<number | undefined>(undefined);
  const lastSpawnRef = useRef<number>(Date.now());
  const { playSound, playBackgroundMusic, stopBackgroundMusic, enabled: soundEnabled, toggleSound } = useAudioManager();
  const gameStateRef = useRef(gameState);
  const spawnObjectRef = useRef<(() => void) | undefined>(undefined);
  const { t } = useI18n();

  // Keep ref updated with current game state
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Check for game over condition
  useEffect(() => {
    if (gameState.score <= -50 && gameState.isPlaying) {
      playSound('gameOver');
      stopBackgroundMusic();
      onGameStateUpdate({ isPlaying: false });
    }
  }, [gameState.score, gameState.isPlaying, onGameStateUpdate, playSound, stopBackgroundMusic]);

  // Start background music when game starts
  useEffect(() => {
    if (gameState.isPlaying && !gameState.isPaused && soundEnabled) {
      // Add a small delay to ensure all sounds have stopped
      const musicDelay = setTimeout(() => {
        playBackgroundMusic();
      }, 200);

      return () => clearTimeout(musicDelay);
    } else {
      stopBackgroundMusic();
    }
  }, [gameState.isPlaying, gameState.isPaused, soundEnabled, playBackgroundMusic, stopBackgroundMusic]);

  // Reset spawn counts when game starts
  useEffect(() => {
    if (gameState.isPlaying && !gameState.isPaused) {
      lastSpawnRef.current = Date.now(); // Reset spawn timer
    }
  }, [gameState.isPlaying, gameState.isPaused]);

  // Calculate current fall duration based on game speed
  const getFallDuration = useCallback(() => {
    const speedReduction = 1 - (gameState.gameSpeed - 1);
    return GAME_CONSTANTS.INITIAL_FALL_DURATION * speedReduction;
  }, [gameState.gameSpeed]);

  // Spawn new falling object
  const spawnObject = useCallback(() => {
    const currentGameState = gameStateRef.current;
    let newObject: FallingObjectType;

    // 40% target kana, 30% wrong kana, 30% distractor
    const rand = Math.random();
    if (rand < 0.4 && currentGameState.selectedKana.length > 0) {
      // Target kana
      const randomKana = currentGameState.selectedKana[Math.floor(Math.random() * currentGameState.selectedKana.length)];
      newObject = {
        id: `kana-${Date.now()}-${Math.random()}`,
        type: 'kana',
        content: randomKana.kana,
        kanaData: randomKana,
        x: Math.random() * 40 + 30,
        y: 0,
        speed: currentGameState.gameSpeed
      };
    } else if (rand < 0.7) {
      // Wrong kana (not in selectedKana)
      const selectedBaseIds = currentGameState.selectedKana.map(k => k.id.replace(/-(hiragana|katakana)$/, ''));
      const wrongKanaList = getBasicKana().filter(k => !selectedBaseIds.includes(k.id));

      if (wrongKanaList.length > 0) {
        const randomWrongKana = wrongKanaList[Math.floor(Math.random() * wrongKanaList.length)];
        newObject = {
          id: `wrong-kana-${Date.now()}-${Math.random()}`,
          type: 'wrong-kana',
          content: randomWrongKana.hiragana,
          kanaData: {
            id: randomWrongKana.id + '-hiragana',
            kana: randomWrongKana.hiragana,
            romaji: randomWrongKana.romaji,
            type: 'hiragana' as const
          },
          x: Math.random() * 40 + 30,
          y: 0,
          speed: currentGameState.gameSpeed
        };
      } else {
        // fallback to distractor
        const randomImage = DISTRACTOR_IMAGES[Math.floor(Math.random() * DISTRACTOR_IMAGES.length)];
        newObject = {
          id: `distractor-${Date.now()}-${Math.random()}`,
          type: 'distractor',
          content: randomImage,
          x: Math.random() * 40 + 30,
          y: 0,
          speed: currentGameState.gameSpeed
        };
      }
    } else {
      // Distractor
      const randomImage = DISTRACTOR_IMAGES[Math.floor(Math.random() * DISTRACTOR_IMAGES.length)];
      newObject = {
        id: `distractor-${Date.now()}-${Math.random()}`,
        type: 'distractor',
        content: randomImage,
        x: Math.random() * 40 + 30,
        y: 0,
        speed: currentGameState.gameSpeed
      };
    }

    onGameStateUpdate(prev => ({
      ...prev,
      fallingObjects: [...prev.fallingObjects, newObject]
    }));
  }, [onGameStateUpdate]);

  // Store spawnObject in ref to avoid dependency issues
  useEffect(() => {
    spawnObjectRef.current = spawnObject;
  }, [spawnObject]);

  // Handle object click
  const handleObjectClick = useCallback(async (object: FallingObjectType) => {
    const clickPosition = {
      x: object.x,
      y: 50
    };

    if (object.type === 'distractor') {
      setShowFeedback({ type: 'distractor', ...clickPosition });
      playSound('distractor');
      onGameStateUpdate(prev => {
        const newScore = Math.max(0, prev.score + GAME_CONSTANTS.POINTS_DISTRACTOR);
        return {
          ...prev,
          score: newScore,
          clicks: {
            ...prev.clicks,
            distractor: prev.clicks.distractor + 1
          },
          fallingObjects: prev.fallingObjects.filter(o => o.id !== object.id)
        };
      });
    } else if (object.type === 'kana' && object.kanaData) {
      const isTargetKana = gameState.selectedKana.some(k => k.romaji === object.kanaData!.romaji);
      if (isTargetKana) {
        setShowFeedback({ type: 'correct', ...clickPosition });
        playSound('correct');
        onGameStateUpdate(prev => {
          const newScore = prev.score + GAME_CONSTANTS.POINTS_CORRECT;
          return {
            ...prev,
            score: newScore,
            clicks: {
              ...prev.clicks,
              correct: prev.clicks.correct + 1
            },
            fallingObjects: prev.fallingObjects.filter(o => o.id !== object.id)
          };
        });
      } else {
        // Should not happen, but treat as wrong kana
        setShowFeedback({ type: 'wrong', ...clickPosition });
        playSound('wrong');
        onGameStateUpdate(prev => {
          const newScore = Math.max(0, prev.score + GAME_CONSTANTS.POINTS_WRONG_KANA);
          return {
            ...prev,
            score: newScore,
            clicks: {
              ...prev.clicks,
              wrong: prev.clicks.wrong + 1
            },
            fallingObjects: prev.fallingObjects.filter(o => o.id !== object.id)
          };
        });
      }
    } else if (object.type === 'wrong-kana' && object.kanaData) {
      // Wrong kana clicked
      setShowFeedback({ type: 'wrong', ...clickPosition });
      playSound('wrong');
      onGameStateUpdate(prev => {
        const newScore = Math.max(0, prev.score + GAME_CONSTANTS.POINTS_WRONG_KANA);
        return {
          ...prev,
          score: newScore,
          clicks: {
            ...prev.clicks,
            wrong: prev.clicks.wrong + 1
          },
          fallingObjects: prev.fallingObjects.filter(o => o.id !== object.id)
        };
      });
    }

    setTimeout(() => setShowFeedback(null), 800);
  }, [gameState.selectedKana, onGameStateUpdate, playSound]);

  // Handle object reaching bottom
  const handleObjectReachBottom = useCallback((object: FallingObjectType) => {
    // Remove the object without any penalty
    onGameStateUpdate(prev => ({
      ...prev,
      fallingObjects: prev.fallingObjects.filter(o => o.id !== object.id)
    }));
  }, [onGameStateUpdate]);

  // Game loop
  const gameLoop = useCallback(() => {
    if (!gameState.isPlaying || gameState.isPaused) return;

    const now = Date.now();

    // Spawn new objects
    if (now - lastSpawnRef.current > SPAWN_INTERVAL) {
      if (spawnObjectRef.current) {
        spawnObjectRef.current();
      }
      lastSpawnRef.current = now;
    }

    // Update falling objects
    onGameStateUpdate(prev => {
      const updatedObjects = prev.fallingObjects.map(obj => {
        const newY = obj.y + (obj.speed * GAME_CONSTANTS.FALL_SPEED);

        // Check if object reached bottom
        if (newY >= 100) {
          handleObjectReachBottom(obj);
          return null;
        }

        return { ...obj, y: newY };
      }).filter(Boolean) as FallingObjectType[];

      return { ...prev, fallingObjects: updatedObjects };
    });

    gameLoopRef.current = requestAnimationFrame(gameLoop);
  }, [gameState.isPlaying, gameState.isPaused, onGameStateUpdate, handleObjectReachBottom]);

  // Start/stop game loop
  useEffect(() => {
    if (gameState.isPlaying && !gameState.isPaused) {
      gameLoopRef.current = requestAnimationFrame(gameLoop);
    } else {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    }

    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
    };
  }, [gameState.isPlaying, gameState.isPaused, gameLoop]);

  // Update game speed based on score
  useEffect(() => {
    const speedLevel = Math.floor(gameState.score / GAME_CONSTANTS.SPEED_INCREMENT_INTERVAL);
    const newSpeed = Math.min(
      1 + (speedLevel * GAME_CONSTANTS.SPEED_INCREMENT_RATE),
      4 // Max 4x speed
    );

    if (newSpeed !== gameState.gameSpeed) {
      onGameStateUpdate({ gameSpeed: newSpeed });
    }
  }, [gameState.score, gameState.gameSpeed, onGameStateUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) {
        cancelAnimationFrame(gameLoopRef.current);
      }
      stopBackgroundMusic();
    };
  }, [stopBackgroundMusic]);

  return (
    <div className="relative w-full h-full bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 overflow-hidden">
      {/* Sound Toggle Button */}
      <button
        onClick={toggleSound}
        className="absolute top-4 left-4 z-30 p-2 rounded-lg bg-white/80 dark:bg-dark-800/80 hover:bg-white dark:hover:bg-dark-700 border border-gray-200 dark:border-gray-700 transition-colors"
        title={soundEnabled ? "Disable Sound" : "Enable Sound"}
      >
        <svg
          className={`w-5 h-5 ${!soundEnabled ? 'opacity-50' : 'opacity-100'} transition-opacity`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {soundEnabled ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
          )}
        </svg>
      </button>

      {/* Score Display */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
        <div className="text-2xl font-bold text-gray-900 dark:text-white bg-white/80 dark:bg-dark-800/80 px-4 py-2 rounded-lg">
          {t('games.score')}: {gameState.score}
        </div>
      </div>

      {/* Game Stats Display */}
      <GameStats
        score={gameState.score}
        correctClicks={gameState.clicks.correct}
        wrongClicks={gameState.clicks.wrong}
        distractorClicks={gameState.clicks.distractor}
      />

      {/* Game Over Screen */}
      {gameState.score <= -50 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-40">
          <div className="text-center p-8 bg-white dark:bg-dark-850 rounded-2xl shadow-2xl">
            <h2 className="text-4xl font-bold text-red-600 dark:text-red-400 mb-4">{t('games.gameOver')}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {t('games.betterLuckNextTime')}
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => onGameStateUpdate({
                  score: 0,
                  isPlaying: false,
                  fallingObjects: [],
                  clicks: { correct: 0, wrong: 0, distractor: 0 }
                })}
                className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold text-xl transition-colors"
              >
                {t('games.tryAgain')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Falling Objects */}
      <AnimatePresence>
        {gameState.fallingObjects.map((object) => (
          <FallingObject
            key={object.id}
            object={object}
            fallDuration={getFallDuration() || 2000}
            onReachBottom={handleObjectReachBottom}
            onClick={handleObjectClick}
            isClickable={true}
            isPaused={gameState.isPaused}
          />
        ))}
      </AnimatePresence>

      {/* Target Kana Display */}
      <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 z-20 px-2">
        <div className={`grid gap-1 sm:gap-2 ${gameState.selectedKana.length <= 5 ? 'grid-cols-5' : 'grid-cols-5 grid-rows-2'} w-full max-w-xs sm:max-w-md`}>
          {gameState.selectedKana.map((kana, index) => {
            const pastelColors = [
              'bg-primary-100 border-primary-300 dark:bg-primary-900/30 dark:border-primary-700',
              'bg-blue-100 border-blue-300 dark:bg-blue-900/30 dark:border-blue-700',
              'bg-green-100 border-green-300 dark:bg-green-900/30 dark:border-green-700',
              'bg-yellow-100 border-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700',
              'bg-purple-100 border-purple-300 dark:bg-purple-900/30 dark:border-purple-700',
              'bg-indigo-100 border-indigo-300 dark:bg-indigo-900/30 dark:border-indigo-700',
              'bg-red-100 border-red-300 dark:bg-red-900/30 dark:border-red-700',
              'bg-orange-100 border-orange-300 dark:bg-orange-900/30 dark:border-orange-700',
              'bg-teal-100 border-teal-300 dark:bg-teal-900/30 dark:border-teal-700',
              'bg-cyan-100 border-cyan-300 dark:bg-cyan-900/30 dark:border-cyan-700'
            ];
            const colorClass = pastelColors[index % pastelColors.length];

            return (
              <div
                key={`${kana.id}-${index}`}
                className={`w-10 h-10 sm:w-12 sm:h-12 ${colorClass} rounded-lg flex items-center justify-center backdrop-blur-sm border-2 shadow-md hover:shadow-lg transition-shadow`}
              >
                <span className="text-xs sm:text-sm font-bold text-gray-700">
                  {kana.romaji}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Feedback Animation */}
      <AnimatePresence>
        {showFeedback && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="absolute pointer-events-none z-30"
            style={{
              left: `${showFeedback.x}%`,
              top: `${showFeedback.y}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className={`text-2xl font-bold ${
              showFeedback.type === 'correct' ? 'text-green-600 dark:text-green-400' :
              showFeedback.type === 'wrong' ? 'text-red-600 dark:text-red-400' :
              'text-orange-600 dark:text-orange-400'
            }`}>
              {showFeedback.type === 'correct' ? '+5 ✨' :
                showFeedback.type === 'wrong' ? '-10 ❌' :
                '-5 💥'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}