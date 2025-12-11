// @ts-nocheck
// TODO: This file is unused dead code with many broken imports to deleted modules.
// Either properly integrate or remove in next cleanup pass.
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GameCanvas from './GameCanvas';
import RomajiControls from './RomajiControls';
import VictoryScreen from './VictoryScreen';
import { GameState, GameStats as GameStatsType, KanaChar, GAME_CONSTANTS } from '../types';
import { getGameAudioManager } from './audioManager';
import { useAuth } from '@/contexts/AuthContext';
import { useFeature } from '@/hooks/useFeature';
import { useSubscription2 } from '@/hooks/useSubscription2';
import KanaChart from '@/components/kana/KanaChart';
import { useNotification } from '@/contexts/NotificationContext';
import { kanaData, getBasicKana } from '@/data/kanaData';
import { trackGamePlayed } from '@/lib/stats/trackingEvents';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useLearnTracking } from '@/hooks/useLearnTracking';
import SlideUpModal from '@/components/SlideUpModal';

interface KanaDropModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedKana: KanaChar[];
}

export default function KanaDropModal({ isOpen, onClose, selectedKana }: KanaDropModalProps) {
  const { user } = useAuth();
  const { checkAndTrack } = useFeature('kana_drop', {
    showModal: true,
    showToast: true,
    trackUsage: true
  });
  const { isPremium, userType } = useSubscription2();
  const { trackGameComplete } = useAnalytics();
  const { track: trackLearning } = useLearnTracking();

  const [countdown, setCountdown] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [hasIncrementedUsage, setHasIncrementedUsage] = useState(false);
  const [lastGameScore, setLastGameScore] = useState(0);
  const [gameState, setGameState] = useState<GameState>({
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
  const [showVictory, setShowVictory] = useState(false);
  const [gameStats, setGameStats] = useState<GameStatsType | null>(null);
  const audioManager = getGameAudioManager();
  const [showHowToPlay, setShowHowToPlay] = useState(true);

  // Kana selection state (for games page flow)
  const [showKanaSelection, setShowKanaSelection] = useState(false);
  const [kanaChartType, setKanaChartType] = useState<'hiragana' | 'katakana'>('hiragana');
  const [selectedHiragana, setSelectedHiragana] = useState<Set<string>>(new Set());
  const [selectedKatakana, setSelectedKatakana] = useState<Set<string>>(new Set());
  const [showRomaji, setShowRomaji] = useState(true);
  const [internalSelectedKana, setInternalSelectedKana] = useState<KanaChar[]>([]);
  const { showNotification } = useNotification();

  // Helper function to get selected kana data
  const getSelectedKanaData = useMemo((): KanaChar[] => {
    const selectedData: KanaChar[] = [];

    // Get hiragana selections
    selectedHiragana.forEach(id => {
      const kana = kanaData.find(k => k.id === id);
      if (kana) {
        selectedData.push({
          id: `${id}-hiragana`,
          kana: kana.hiragana,
          romaji: kana.romaji,
          type: 'hiragana'
        });
      }
    });

    // Get katakana selections
    selectedKatakana.forEach(id => {
      const kana = kanaData.find(k => k.id === id);
      if (kana) {
        selectedData.push({
          id: `${id}-katakana`,
          kana: kana.katakana,
          romaji: kana.romaji,
          type: 'katakana'
        });
      }
    });

    return selectedData;
  }, [selectedHiragana, selectedKatakana]);
  const handleToggleKana = (kanaId: string) => {
    if (kanaChartType === 'hiragana') {
      const newSelection = new Set(selectedHiragana);
      if (newSelection.has(kanaId)) {
        newSelection.delete(kanaId);
      } else {
        // Check if adding this would exceed the limit
        const totalSelected = newSelection.size + selectedKatakana.size;

        if (totalSelected >= 10) {
          showNotification({
            title: 'Maximum Reached',
            message: 'You can only select up to 10 characters for Kana Drop.',
            type: 'info'
          });
          return;
        }
        newSelection.add(kanaId);
      }
      setSelectedHiragana(newSelection);
    } else {
      const newSelection = new Set(selectedKatakana);
      if (newSelection.has(kanaId)) {
        newSelection.delete(kanaId);
      } else {
        // Check if adding this would exceed the limit
        const totalSelected = selectedHiragana.size + newSelection.size;
        if (totalSelected >= 10) {
          showNotification({
            title: 'Maximum Reached',
            message: 'You can only select up to 10 characters for Kana Drop.',
            type: 'info'
          });
          return;
        }
        newSelection.add(kanaId);
      }
      setSelectedKatakana(newSelection);
    }
  };

  // Clear kana selection
  const handleClearKanaSelection = () => {
    setSelectedHiragana(new Set());
    setSelectedKatakana(new Set());
  };

  // Handle start game with selected kana
  const handleStartWithSelectedKana = () => {
    const kanaData = getSelectedKanaData;

    if (kanaData.length === 0) {
      showNotification({
        title: 'No Characters Selected',
        message: 'Please select some kana characters to play Kana Drop!',
        type: 'info'
      });
      return;
    }

    if (kanaData.length > 10) {
      showNotification({
        title: 'Too Many Characters',
        message: 'Please select up to 10 characters for Kana Drop.',
        type: 'info'
      });
      return;
    }

    // Set the selected kana and proceed to how-to-play
    setInternalSelectedKana(kanaData);

    // Update game state with the selected kana
    setGameState(prev => ({
      ...prev,
      selectedKana: kanaData
    }));

    setShowKanaSelection(false);
    setShowHowToPlay(true);
  };

  // Determine which kana to use
  const effectiveSelectedKana = selectedKana.length > 0 ? selectedKana : internalSelectedKana;

  // Start countdown when modal opens
  useEffect(() => {

    if (isOpen && !gameState.isPlaying && !showVictory) {

      setCountdown(GAME_CONSTANTS.COUNTDOWN_DURATION);
    }
  }, [isOpen, gameState.isPlaying, showVictory]);

  // Update audio manager mute state
  useEffect(() => {
    audioManager.setEnabled(!isMuted);
  }, [isMuted, audioManager]);

  // Cleanup audio when modal closes
  useEffect(() => {
    return () => {
      // Stop all sounds when component unmounts
      audioManager.stopAllSounds();
    };
  }, [audioManager]);

  // Countdown timer
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;

    const timer = setTimeout(() => {
      if (countdown === 1) {
        // Stop ALL sounds before starting game
        const audioManager = getGameAudioManager();
        audioManager.stopAllSounds();

        // Start game
        setCountdown(null);
        const startTime = Date.now();
        setGameState(prev => ({
          ...prev,
          isPlaying: true,
          startTime
        }));
        
        // Track game start with ULAS
        trackLearning({
          type: 'practice',
          category: 'game',
          content: {
            value: 'kana_drop_started',
            metadata: {
              gameType: 'kana_drop',
              selectedKana: effectiveSelectedKana.map(k => ({
                kana: k.kana,
                romaji: k.romaji,
                type: k.type
              })),
              kanaCount: effectiveSelectedKana.length
            }
          }
        });
        
        // Play start sound
        audioManager.playSound('start').catch(() => {

        });
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  // Save the score when game is playing
  useEffect(() => {
    if (gameState.isPlaying && gameState.score !== 0) {
      setLastGameScore(gameState.score);
    }
  }, [gameState.isPlaying, gameState.score]);

  // Track game completion when game ends (both win and lose)
  useEffect(() => {

    if (!gameState.isPlaying && gameState.startTime > 0 && !hasIncrementedUsage) {
      const timePlayed = Date.now() - gameState.startTime;
      const finalScore = gameState.score || lastGameScore;

      console.log('[KanaDrop] Game ended, checking tracking conditions:', {
        timePlayed: Math.round(timePlayed / 1000),
        needsMoreThan5Seconds: timePlayed > 5000,
        finalScore
      });

      // Only track if game lasted more than 5 seconds (to avoid tracking immediate quits)
      if (timePlayed > 5000) {
        console.log('[KanaDrop] Game ended, tracking completion:', {
          score: finalScore,
          timePlayed: Math.round(timePlayed / 1000),
          isWin: finalScore >= GAME_CONSTANTS.WINNING_SCORE,
          isLoss: finalScore <= -50
        });

        // Track game completion
        trackGamePlayed('kana-drop', finalScore).catch(error => {
          console.error('Failed to track game completion:', error);
        });
        
        // Track with new analytics (no accuracy metric for this game)
        trackGameComplete('kana_drop', finalScore);
        
        // Track with ULAS
        trackLearning({
          type: 'complete',
          category: 'game',
          content: {
            value: 'kana_drop_completed',
            metadata: {
              gameType: 'kana_drop',
              selectedKana: gameState.selectedKana.map(k => ({
                kana: k.kana,
                romaji: k.romaji,
                type: k.type
              })),
              kanaCount: gameState.selectedKana.length,
              isWin: finalScore >= GAME_CONSTANTS.WINNING_SCORE,
              isLoss: finalScore <= -50
            }
          },
          metrics: {
            score: finalScore,
            duration: timePlayed,
            correctClicks: gameState.clicks.correct,
            wrongClicks: gameState.clicks.wrong,
            distractorClicks: gameState.clicks.distractor,
            totalClicks: gameState.clicks.correct + gameState.clicks.wrong + gameState.clicks.distractor,
            accuracy: (gameState.clicks.correct + gameState.clicks.wrong + gameState.clicks.distractor) > 0
              ? Math.round((gameState.clicks.correct / (gameState.clicks.correct + gameState.clicks.wrong + gameState.clicks.distractor)) * 100)
              : 0
          }
        });

        setHasIncrementedUsage(true);
        setLastGameScore(0); // Reset for next game
      }
    }
  }, [gameState.isPlaying, gameState.startTime, gameState.score, lastGameScore, hasIncrementedUsage]);

  // Check for victory
  useEffect(() => {
    if (gameState.score >= GAME_CONSTANTS.WINNING_SCORE && gameState.isPlaying && !hasIncrementedUsage) {
      // Victory!
      const endTime = Date.now();
      let timeTaken = 0;
      if (gameState.startTime && gameState.startTime > 0) {
        timeTaken = Math.round((endTime - gameState.startTime) / 1000);
      }
      const totalClicks = gameState.clicks.correct + gameState.clicks.wrong + gameState.clicks.distractor;
      const accuracy = totalClicks > 0
        ? Math.round((gameState.clicks.correct / totalClicks) * 100)
        : 0;

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

      // Usage tracking is now handled automatically by checkAndTrack
      // Game completion tracking is now handled in the general game end useEffect

      // Play victory sound
      getGameAudioManager().playSound('victory').catch(() => {

      });
    }
  }, [gameState.score, gameState.isPlaying, gameState.startTime, gameState.clicks, hasIncrementedUsage]);

  // Handle romaji button click
  const handleRomajiClick = useCallback((romaji: string) => {
    setGameState(prev => ({
      ...prev,
      activeRomaji: prev.activeRomaji === romaji ? null : romaji
    }));
  }, []);

  // Update game state
  const handleGameStateUpdate = useCallback((updates: Partial<GameState> | ((prev: GameState) => Partial<GameState>)) => {
    if (typeof updates === 'function') {
      setGameState(prev => {
        const newState = { ...prev, ...updates(prev) };
        if (prev.score !== newState.score) {
          console.log('[KanaDrop] Score updated in modal:', {
            from: prev.score,
            to: newState.score,
            update: updates(prev),
            timestamp: new Date().toISOString()
          });
        }
        return newState;
      });
    } else {
      setGameState(prev => {
        const newState = { ...prev, ...updates };
        if (prev.score !== newState.score) {
          console.log('[KanaDrop] Score updated in modal:', {
            from: prev.score,
            to: newState.score,
            update: updates,
            timestamp: new Date().toISOString()
          });
        }
        return newState;
      });
    }
  }, []);

  // Handle end game button click
  const handleEndGame = () => {

    // Track the game if it's been playing for more than 5 seconds
    if (gameState.startTime > 0 && !hasIncrementedUsage) {
      const timePlayed = Date.now() - gameState.startTime;
      const finalScore = gameState.score || lastGameScore;

      if (timePlayed > 5000) {

        trackGamePlayed('kana-drop', finalScore).catch(error => {
          console.error('Failed to track game completion:', error);
        });
        
        // Track with new analytics (no accuracy metric for this game)
        trackGameComplete('kana_drop', finalScore);
        console.log('[KanaDrop] Analytics tracked (early exit):', { game: 'kana_drop', score: finalScore });
        
        // Track early exit with ULAS
        trackLearning({
          type: 'abandon',
          category: 'game',
          content: {
            value: 'kana_drop_abandoned',
            metadata: {
              gameType: 'kana_drop',
              selectedKana: gameState.selectedKana.map(k => ({
                kana: k.kana,
                romaji: k.romaji,
                type: k.type
              })),
              kanaCount: gameState.selectedKana.length
            }
          },
          metrics: {
            score: finalScore,
            duration: timePlayed,
            correctClicks: gameState.clicks.correct,
            wrongClicks: gameState.clicks.wrong,
            distractorClicks: gameState.clicks.distractor
          }
        });

        setHasIncrementedUsage(true);
      }
    }

    // Close the modal after tracking
    setTimeout(() => {
      onClose();
    }, 100);
  };

  // Play again
  const handlePlayAgain = () => {
    setShowVictory(false);
    setGameStats(null);
    setHasIncrementedUsage(false); // Reset usage tracking

    // Use the current game state's selectedKana to ensure consistency
    const currentSelectedKana = gameState.selectedKana.length > 0 ? gameState.selectedKana : effectiveSelectedKana;

    setGameState({
      score: 0,
      selectedKana: currentSelectedKana,
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
    setCountdown(GAME_CONSTANTS.COUNTDOWN_DURATION);
  };

  // Select new kana
  const handleSelectNewKana = () => {
    onClose();
  };

  // When modal opens, determine flow based on selectedKana
  useEffect(() => {
    if (isOpen) {
      setCountdown(null);
      setShowVictory(false);
      setGameStats(null);
      setHasIncrementedUsage(false); // Reset usage tracking

      // If no kana provided (games page flow), show kana selection
      if (selectedKana.length === 0) {
        setShowKanaSelection(true);
        setShowHowToPlay(false);
        // Clear any previous internal selection
        setInternalSelectedKana([]);
        setSelectedHiragana(new Set());
        setSelectedKatakana(new Set());
      } else {
        // Practice page flow - proceed to how-to-play
        setShowKanaSelection(false);
        setShowHowToPlay(true);
      }

      setGameState({
        score: 0,
        selectedKana: effectiveSelectedKana,
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
    }
  }, [isOpen, selectedKana]);

  // Start game from how-to-play screen
  const handleStartGame = () => {
    startCountdown();
  };

  // Start countdown
  const startCountdown = useCallback(async () => {
    // Check if user can play before starting
    const canPlay = await checkAndTrack();
    if (!canPlay) {
      onClose();
      return;
    }

    setShowHowToPlay(false);
    setCountdown(3);
    const audioManager = getGameAudioManager();
    audioManager.playSound('countdown');

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownInterval);

          // Stop ALL sounds before starting game
          audioManager.stopAllSounds();

          // Start the game
          audioManager.playSound('start');
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
  }, [checkAndTrack, onClose]);

  if (!isOpen) return null;

  // Kana Selection Screen (for games page flow)
  if (showKanaSelection) {
    return (
      <SlideUpModal
        isOpen={true}
        onClose={onClose}
        height="90%"
        showHandle={false}
      >
        <div className="h-full flex flex-col relative">
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-20 w-10 h-10 flex items-center justify-center rounded-lg bg-muted hover:bg-muted/80 transition-colors border border-border"
              aria-label="Close modal"
            >
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 pt-2">
              {/* Header with drop icon */}
              <div className="flex flex-col items-center justify-center space-y-4">
                <img 
                  src="/flat-icons/root-icons/kana-drop.svg" 
                  alt="Kana Drop" 
                  className="w-20 h-20 md:w-24 md:h-24"
                />
                <h2 className="text-2xl md:text-3xl font-bold text-foreground">Select Kana to Practice</h2>
                <p className="text-muted-foreground text-center max-w-md">
                  Choose 5-8 kana characters to play Kana Drop. Click on the purple corners to select.
                </p>
              </div>

              {/* Chart Type Toggle */}
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setKanaChartType('hiragana')}
                  className={`px-4 py-2 rounded-lg border transition-colors ${kanaChartType === 'hiragana'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-input hover:bg-muted'
                    }`}
                >
                  ひらがな Hiragana
                </button>
                <button
                  onClick={() => setKanaChartType('katakana')}
                  className={`px-4 py-2 rounded-lg border transition-colors ${kanaChartType === 'katakana'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-foreground border-input hover:bg-muted'
                    }`}
                >
                  カタカナ Katakana
                </button>
              </div>

              {/* Options */}
              <div className="flex flex-wrap items-center justify-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRomaji}
                    onChange={(e) => setShowRomaji(e.target.checked)}
                    className="rounded border-input"
                  />
                  <span className="text-sm">Show Romaji</span>
                </label>

                {(selectedHiragana.size > 0 || selectedKatakana.size > 0) && (
                  <button
                    onClick={handleClearKanaSelection}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear Selection ({selectedHiragana.size + selectedKatakana.size})
                  </button>
                )}
              </div>

              {/* Kana Chart */}
              <div className="w-full">
                <KanaChart
                  chartType={kanaChartType}
                  selectedKana={kanaChartType === 'hiragana' ? selectedHiragana : selectedKatakana}
                  onToggleKana={handleToggleKana}
                  showRomaji={showRomaji}
                />
              </div>
            </div>

            {/* Footer with Start Button */}
            <div className="p-6 border-t border-border bg-muted/50">
              <div className="text-center space-y-4">
                <div className={`text-sm ${(selectedHiragana.size + selectedKatakana.size) > 10
                  ? 'text-red-600 font-medium'
                  : 'text-muted-foreground'
                }`}>
                  {selectedHiragana.size + selectedKatakana.size} characters selected
                  {(selectedHiragana.size + selectedKatakana.size) > 10
                    ? ' (Too many! Maximum is 10)'
                    : ' (1-10 required)'
                  }
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-muted text-foreground rounded-lg font-semibold hover:bg-muted/80 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartWithSelectedKana}
                    disabled={getSelectedKanaData.length === 0 || getSelectedKanaData.length > 10}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    Start Game ({getSelectedKanaData.length} selected)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </SlideUpModal>
    );
  }

  if (showHowToPlay) {
    return (
      <SlideUpModal
        isOpen={true}
        onClose={onClose}
        title="How to Play Kana Drop"
        height="auto"
        showHandle={false}
        showCloseButton={true}
      >
        <div className="p-6 text-center">
          <ul className="text-lg text-muted-foreground mb-6 space-y-2 text-left max-w-md mx-auto">
            <li>• Score <span className="font-bold text-primary">100 points</span> to win!</li>
            <li>• Click any falling kana that matches your selected characters.</li>
            <li>• Avoid clicking distractors (images or symbols).</li>
            <li>• Each correct kana: <span className="text-green-600 font-bold">+5</span> points</li>
            <li>• Each distractor: <span className="text-orange-600 font-bold">-5</span> points</li>
            <li>• Each wrong kana: <span className="text-red-600 font-bold">-10</span> points</li>
          </ul>
          
          {effectiveSelectedKana.length > 0 ? (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Your Selected Kana:</h3>
              <div className="flex justify-center gap-3 flex-wrap max-h-40 overflow-y-auto p-2">
                {effectiveSelectedKana.map((kana) => (
                  <div key={kana.id} className="bg-card rounded-lg p-3 border border-border">
                    <div className="text-2xl japanese-text">{kana.kana}</div>
                    <div className="text-sm text-muted-foreground">{kana.romaji}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-orange-100 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-lg">
              <p className="text-orange-700 dark:text-orange-300 text-center">
                No kana selected! The game will use a default set of basic hiragana characters.
              </p>
            </div>
          )}
          
          <div className="flex justify-center gap-3">
            <button
              onClick={handleStartGame}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-lg hover:bg-primary/90 transition-colors"
            >
              Start Game
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-muted text-foreground rounded-lg font-semibold text-lg hover:bg-muted/90 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </SlideUpModal>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget && !gameState.isPlaying) {
            onClose();
          }
        }}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full h-full md:w-[900px] md:h-[700px] bg-background rounded-lg shadow-2xl overflow-hidden flex flex-col"
        >

          {/* Game controls - Close/Pause and Mute buttons */}
          {!showVictory && (
            <div className="absolute top-4 right-4 z-30 flex gap-2">
              {/* Close/Pause button */}
              <button
                onClick={() => {
                  if (gameState.isPlaying && !gameState.isPaused) {
                    // Pause the game
                    handleGameStateUpdate({ isPaused: true });
                  } else if (gameState.isPaused) {
                    // Resume the game
                    handleGameStateUpdate({ isPaused: false });
                  } else {
                    // Close the modal
                    onClose();
                  }
                }}
                className="p-2 rounded-lg bg-background/80 hover:bg-background border border-border transition-colors"
                title={gameState.isPlaying && !gameState.isPaused ? "Pause Game" : gameState.isPaused ? "Resume Game" : "Close"}
              >
                {gameState.isPlaying && !gameState.isPaused ? (
                  // Pause icon
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : gameState.isPaused ? (
                  // Play/Resume icon
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3l14 9-14 9V3z" />
                  </svg>
                ) : (
                  // Close icon
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </button>

              {/* Close button (always visible) */}
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-background/80 hover:bg-background border border-border transition-colors"
                title="Close Game"
              >
                {/* Close icon */}
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}

          {/* Countdown */}
          {countdown !== null && (
            <div className="absolute inset-0 flex items-center justify-center z-40 bg-background/90">
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
                    <div className="text-8xl font-bold text-primary mb-4">
                      {countdown}
                    </div>
                    <div className="text-2xl text-muted-foreground">
                      Get Ready!
                    </div>
                  </>
                ) : (
                  <div className="text-6xl font-bold text-green-600">
                    GO!
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
              onClose={onClose}
            />
          )}

          {/* Game Canvas */}
          {!showVictory && (
            <>
              <GameCanvas
                gameState={gameState}
                onGameStateUpdate={handleGameStateUpdate}
              />
            </>
          )}

          {/* Start/Pause Screen */}
          {!gameState.isPlaying && !countdown && !showVictory && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-30">
              <div className="text-center p-8">
                <h2 className="text-4xl font-bold text-foreground mb-4">
                  {gameState.isPaused ? 'Game Paused' : 'Kana Drop'}
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  {gameState.isPaused
                    ? 'Click Resume to continue playing or Close to exit the game.'
                    : 'Click the romaji buttons below to catch falling kana characters. Avoid clicking distractors and wrong kana!'}
                </p>

                {effectiveSelectedKana.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold mb-3">Selected Kana:</h3>
                    <div className="flex justify-center gap-3 flex-wrap">
                      {effectiveSelectedKana.map((kana) => (
                        <div key={kana.id} className="bg-card rounded-lg p-3 border border-border">
                          <div className="text-2xl japanese-text">{kana.kana}</div>
                          <div className="text-sm text-muted-foreground">{kana.romaji}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-4 text-sm text-muted-foreground mb-6">
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-green-600 font-semibold">+5</span>
                    <span>Correct kana</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-red-600 font-semibold">-10</span>
                    <span>Missed target / Wrong kana</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-orange-600 font-semibold">-5</span>
                    <span>Distractor click</span>
                  </div>
                </div>

                <div className="flex gap-4 justify-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      if (gameState.isPaused) {
                        // Resume the game
                        setGameState(prev => ({
                          ...prev,
                          isPlaying: true,
                          isPaused: false
                        }));
                      } else {
                        // Start new game
                        setCountdown(GAME_CONSTANTS.COUNTDOWN_DURATION);
                      }
                    }}
                    className="px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold text-xl hover:bg-primary/90 transition-colors"
                  >
                    {gameState.isPaused ? 'Resume Game' : 'Start Game'}
                  </motion.button>

                  {gameState.isPaused && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleEndGame}
                      className="px-8 py-4 bg-destructive text-destructive-foreground rounded-lg font-semibold text-xl hover:bg-destructive/90 transition-colors"
                    >
                      End Game
                    </motion.button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pause overlay logic */}
          {gameState.isPaused && !showVictory && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-30">
              <div className="text-center p-8">
                <h2 className="text-4xl font-bold text-foreground mb-4">Game Paused</h2>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Click Resume to continue playing or Close to exit the game.
                </p>
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={() => handleGameStateUpdate({ isPaused: false })}
                    className="px-8 py-4 bg-primary text-primary-foreground rounded-lg font-semibold text-xl hover:bg-primary/90 transition-colors"
                  >
                    Resume Game
                  </button>
                  <button
                    onClick={handleEndGame}
                    className="px-8 py-4 bg-destructive text-destructive-foreground rounded-lg font-semibold text-xl hover:bg-destructive/90 transition-colors"
                  >
                    End Game
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}