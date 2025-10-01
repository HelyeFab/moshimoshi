'use client';

import { useState, useEffect } from 'react';
import FallingObject from './FallingObject';
import GameStats from './GameStats';
import {
  FallingObject as FallingObjectType,
  GameState,
  GAME_CONSTANTS,
  DISTRACTOR_IMAGES
} from '../types';
import { useAudioManager } from '../hooks/useAudioManager';
import { kanaData } from '@/data/kanaData';
import { useI18n } from '@/i18n/I18nContext';

interface GameCanvasProps {
  gameState: GameState;
  onGameStateUpdate: (updates: Partial<GameState>) => void;
}

// Helper function to get basic kana
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

  const { playSound, playBackgroundMusic, stopBackgroundMusic, enabled: soundEnabled, toggleSound } = useAudioManager();
  const { t } = useI18n();

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
      const musicDelay = setTimeout(() => {
        playBackgroundMusic();
      }, 200);
      return () => clearTimeout(musicDelay);
    } else {
      stopBackgroundMusic();
    }
  }, [gameState.isPlaying, gameState.isPaused, soundEnabled, playBackgroundMusic, stopBackgroundMusic]);

  // SPAWN SYSTEM - Simple setInterval approach
  useEffect(() => {
    if (!gameState.isPlaying || gameState.isPaused) return;

    console.log('[KanaDrop] Starting spawn interval');

    const spawnInterval = setInterval(() => {
      console.log('[KanaDrop] Spawning new object');

      // Create new object
      const rand = Math.random();
      let newObject: FallingObjectType;

      if (rand < 0.4 && gameState.selectedKana.length > 0) {
        // 40% - Target kana
        const randomKana = gameState.selectedKana[Math.floor(Math.random() * gameState.selectedKana.length)];
        newObject = {
          id: `kana-${Date.now()}-${Math.random()}`,
          type: 'kana',
          content: randomKana.kana,
          kanaData: randomKana,
          x: Math.random() * 60 + 20, // 20-80% horizontal
          y: 0,
          speed: gameState.gameSpeed
        };
      } else if (rand < 0.7) {
        // 30% - Wrong kana
        const selectedBaseIds = gameState.selectedKana.map(k => k.id.replace(/-(hiragana|katakana)$/, ''));
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
            x: Math.random() * 60 + 20,
            y: 0,
            speed: gameState.gameSpeed
          };
        } else {
          // Fallback to distractor
          const randomImage = DISTRACTOR_IMAGES[Math.floor(Math.random() * DISTRACTOR_IMAGES.length)];
          newObject = {
            id: `distractor-${Date.now()}-${Math.random()}`,
            type: 'distractor',
            content: randomImage,
            x: Math.random() * 60 + 20,
            y: 0,
            speed: gameState.gameSpeed
          };
        }
      } else {
        // 30% - Distractor
        const randomImage = DISTRACTOR_IMAGES[Math.floor(Math.random() * DISTRACTOR_IMAGES.length)];
        newObject = {
          id: `distractor-${Date.now()}-${Math.random()}`,
          type: 'distractor',
          content: randomImage,
          x: Math.random() * 60 + 20,
          y: 0,
          speed: gameState.gameSpeed
        };
      }

      // Add to state
      onGameStateUpdate({
        fallingObjects: [...gameState.fallingObjects, newObject]
      });

    }, 750); // Spawn every 750ms

    return () => {
      console.log('[KanaDrop] Clearing spawn interval');
      clearInterval(spawnInterval);
    };
  }, [gameState.isPlaying, gameState.isPaused, gameState.selectedKana, gameState.gameSpeed, gameState.fallingObjects, onGameStateUpdate]);

  // Handle object click
  const handleObjectClick = (object: FallingObjectType) => {
    const clickPosition = { x: object.x, y: 50 };

    if (object.type === 'distractor') {
      setShowFeedback({ type: 'distractor', ...clickPosition });
      playSound('thud');
      onGameStateUpdate({
        score: Math.max(0, gameState.score + GAME_CONSTANTS.POINTS_DISTRACTOR),
        clicks: {
          ...gameState.clicks,
          distractor: gameState.clicks.distractor + 1
        },
        fallingObjects: gameState.fallingObjects.filter(o => o.id !== object.id)
      });
    } else if (object.type === 'kana' && object.kanaData) {
      const isTargetKana = gameState.selectedKana.some(k => k.romaji === object.kanaData!.romaji);
      if (isTargetKana) {
        setShowFeedback({ type: 'correct', ...clickPosition });
        playSound('start');
        onGameStateUpdate({
          score: gameState.score + GAME_CONSTANTS.POINTS_CORRECT,
          clicks: {
            ...gameState.clicks,
            correct: gameState.clicks.correct + 1
          },
          fallingObjects: gameState.fallingObjects.filter(o => o.id !== object.id)
        });
      }
    } else if (object.type === 'wrong-kana') {
      setShowFeedback({ type: 'wrong', ...clickPosition });
      playSound('wrong');
      onGameStateUpdate({
        score: Math.max(0, gameState.score + GAME_CONSTANTS.POINTS_WRONG_KANA),
        clicks: {
          ...gameState.clicks,
          wrong: gameState.clicks.wrong + 1
        },
        fallingObjects: gameState.fallingObjects.filter(o => o.id !== object.id)
      });
    }

    setTimeout(() => setShowFeedback(null), 800);
  };

  // Handle object reaching bottom
  const handleObjectReachBottom = (objectId: string) => {
    console.log('[KanaDrop] Object reached bottom:', objectId);
    onGameStateUpdate({
      fallingObjects: gameState.fallingObjects.filter(o => o.id !== objectId)
    });
  };

  // Calculate fall duration based on game speed
  const getFallDuration = () => {
    const speedReduction = 1 / gameState.gameSpeed;
    return GAME_CONSTANTS.INITIAL_FALL_DURATION * speedReduction;
  };

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

  return (
    <div className="relative w-full h-screen bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 overflow-hidden">
      {/* Sound Toggle Button */}
      <button
        onClick={toggleSound}
        className="absolute top-4 left-4 z-30 p-2 rounded-lg bg-white/80 dark:bg-dark-800/80 hover:bg-white dark:hover:bg-dark-700 border border-gray-200 dark:border-gray-700 transition-colors"
        title={soundEnabled ? t('games.disableSound') : t('games.enableSound')}
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
      <GameStats gameState={gameState} showFeedback={showFeedback} />

      {/* Falling Objects */}
      {gameState.fallingObjects.map((object) => (
        <FallingObject
          key={object.id}
          object={object}
          fallDuration={getFallDuration()}
          onReachBottom={handleObjectReachBottom}
          onClick={handleObjectClick}
        />
      ))}

      {/* Target Kana Display */}
      <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 z-20 px-2">
        <div className={`grid gap-1 sm:gap-2 ${gameState.selectedKana.length <= 5 ? 'grid-cols-5' : 'grid-cols-5 grid-rows-2'} w-full max-w-xs sm:max-w-md`}>
          {gameState.selectedKana.map((kana, index) => {
            const pastelColors = [
              'bg-pink-100 border-pink-300',
              'bg-blue-100 border-blue-300',
              'bg-green-100 border-green-300',
              'bg-yellow-100 border-yellow-300',
              'bg-purple-100 border-purple-300',
              'bg-indigo-100 border-indigo-300',
              'bg-red-100 border-red-300',
              'bg-orange-100 border-orange-300',
              'bg-teal-100 border-teal-300',
              'bg-cyan-100 border-cyan-300'
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
    </div>
  );
}
