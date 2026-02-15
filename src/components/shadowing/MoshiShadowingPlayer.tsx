'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useTTS } from '@/hooks/useTTS';
import { useWordExplanation } from '@/hooks/useWordExplanation';
import WordExplanationModal from '@/components/word/WordExplanationModal';
import { GrammarHighlightedText } from '@/components/reading/GrammarHighlightedText';
import Modal from '@/components/ui/Modal';
import Dropdown from '@/components/ui/Dropdown';
import SettingsDropdown from '@/components/ui/SettingsDropdown';
import { Settings, Repeat, Type, Highlighter, X, Trash2, Gauge, ChevronDown, ChevronUp, MoreVertical } from 'lucide-react';
import { PlayIcon } from '@heroicons/react/24/solid';
import { nextOnSegmentEnd, onRepeatCountChange, clampRepeatCount, type RepeatState } from '@/lib/shadowing/repeat';
import {
  joinSegmentTexts,
  findSplitIndexForText,
  splitLeadingTokens,
  splitTrailingTokens,
} from '@/lib/shadowing/transcriptEditing';
import styles from './MoshiShadowingPlayer.module.css';

type HighlightMode = 'none' | 'all' | 'content' | 'grammar';

function cloneSentences(input: string[]): string[] {
  return input.map(sentence => sentence);
}

interface MoshiShadowingPlayerProps {
  sentences: string[];
  title: string;
  contentId: string;
  contentType: 'article' | 'story' | 'book';
  onClose: () => void;
  initialSettings?: {
    showFurigana?: boolean;
    highlightMode?: HighlightMode;
    repeatCount?: number;
    playbackSpeed?: number;
  };
  /** Optional: Function to get pre-cached audio URL for a sentence */
  getAudioUrl?: (text: string) => string | null;
}

export default function MoshiShadowingPlayer({
  sentences,
  title,
  contentId,
  contentType,
  onClose,
  initialSettings,
  getAudioUrl,
}: MoshiShadowingPlayerProps) {
  const { t } = useI18n();

  // Player state
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [currentRepeat, setCurrentRepeat] = useState(1);
  const [repeatCount, setRepeatCount] = useState(initialSettings?.repeatCount ?? 3);
  const [isPlaying, setIsPlaying] = useState(false);

  // Settings state
  const [showFurigana, setShowFurigana] = useState(initialSettings?.showFurigana ?? true);
  const [highlightMode, setHighlightMode] = useState<HighlightMode>(initialSettings?.highlightMode ?? 'content');
  const [playbackSpeed, setPlaybackSpeed] = useState(initialSettings?.playbackSpeed ?? 1.0);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [splitCursorByIndex, setSplitCursorByIndex] = useState<Record<number, number>>({});
  const [dirtyEdits, setDirtyEdits] = useState(false);
  const [canUndo, setCanUndo] = useState(false);

  // Word explanation state
  const [wordModalOpen, setWordModalOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordContext, setWordContext] = useState<string | undefined>(undefined);

  // Refs for state machine (avoid stale closures)
  const repeatCountRef = useRef(repeatCount);
  const currentRepeatRef = useRef(currentRepeat);
  const currentSentenceIndexRef = useRef(currentSentenceIndex);
  const [editableSentences, setEditableSentences] = useState<string[]>(() => cloneSentences(sentences));
  const totalSentencesRef = useRef(editableSentences.length);
  const playbackSpeedRef = useRef(playbackSpeed);
  const isPlayingRef = useRef(false);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playSentenceRef = useRef<((index: number) => Promise<void>) | null>(null);
  // Guard to prevent handleAudioEnd from firing during manual seek/stop
  const isManualStopRef = useRef(false);
  // Ref for cached audio element (separate from TTS audio)
  const cachedAudioRef = useRef<HTMLAudioElement | null>(null);
  const baselineSentencesRef = useRef<string[]>(cloneSentences(sentences));
  const editHistoryRef = useRef<string[][]>([]);

  // Pause duration between repeats (1 second)
  const PAUSE_DURATION = 1000;

  // Sync refs
  useEffect(() => {
    repeatCountRef.current = repeatCount;
    currentRepeatRef.current = currentRepeat;
    currentSentenceIndexRef.current = currentSentenceIndex;
    totalSentencesRef.current = editableSentences.length;
    playbackSpeedRef.current = playbackSpeed;
  }, [repeatCount, currentRepeat, currentSentenceIndex, editableSentences.length, playbackSpeed]);

  useEffect(() => {
    const next = cloneSentences(sentences);
    setEditableSentences(next);
    baselineSentencesRef.current = cloneSentences(next);
    editHistoryRef.current = [];
    setCanUndo(false);
    setDirtyEdits(false);
    setSplitCursorByIndex({});
    setEditMode(false);
  }, [sentences]);

  // Word explanation hook
  const {
    explainWord,
    loading: wordLoading,
    error: wordError,
    explanation: wordExplanation,
    reset: resetWordExplanation,
    prefetch: prefetchWordExplanations,
  } = useWordExplanation();

  // Handle audio end - state machine logic
  const handleAudioEnd = useCallback(() => {
    // Skip if this was a manual stop (seeking or stopping)
    if (isManualStopRef.current) {
      isManualStopRef.current = false;
      console.log('[MoshiShadowingPlayer] Skipping handleAudioEnd - manual stop');
      return;
    }

    const state: RepeatState = {
      repeatCount: repeatCountRef.current,
      currentRepeat: currentRepeatRef.current,
      segmentIndex: currentSentenceIndexRef.current,
      totalSegments: totalSentencesRef.current,
    };

    const next = nextOnSegmentEnd(state);

    console.log('[MoshiShadowingPlayer] State machine:', { current: state, next });

    // Update refs immediately
    currentRepeatRef.current = next.currentRepeat;
    currentSentenceIndexRef.current = next.segmentIndex;

    // Update React state
    setCurrentRepeat(next.currentRepeat);

    if (next.didAdvanceSegment) {
      if (next.segmentIndex < totalSentencesRef.current) {
        // Advanced to next sentence - pause then play
        setCurrentSentenceIndex(next.segmentIndex);
        pauseTimeoutRef.current = setTimeout(() => {
          if (playSentenceRef.current && isPlayingRef.current) {
            playSentenceRef.current(next.segmentIndex);
          }
        }, PAUSE_DURATION);
      } else {
        // Completed all sentences
        setIsPlaying(false);
        isPlayingRef.current = false;
      }
    } else {
      // Same sentence, next repeat - pause then replay
      pauseTimeoutRef.current = setTimeout(() => {
        if (playSentenceRef.current && isPlayingRef.current) {
          playSentenceRef.current(currentSentenceIndexRef.current);
        }
      }, PAUSE_DURATION);
    }
  }, []);

  // TTS hook
  const {
    play: playTTS,
    stop: stopTTS,
    preload,
    loading: ttsLoading,
    playing: ttsPlaying,
  } = useTTS({
    cacheFirst: true,
    onEnd: handleAudioEnd,
    onError: (err) => {
      console.error('[MoshiShadowingPlayer] TTS error:', err);
      setIsPlaying(false);
      isPlayingRef.current = false;
    },
  });

  // Play current sentence (pre-cached audio → TTS fallback)
  const playSentence = useCallback(async (index: number) => {
    const sentence = editableSentences[index];
    if (!sentence) return;

    console.log('[MoshiShadowingPlayer] Playing sentence:', index, sentence.substring(0, 30), 'speed:', playbackSpeedRef.current);

    // 1. Check for pre-cached audio first
    const cachedUrl = getAudioUrl?.(sentence);

    if (cachedUrl) {
      console.log('[MoshiShadowingPlayer] Using pre-cached audio');

      try {
        // Cleanup previous cached audio if exists
        if (cachedAudioRef.current) {
          cachedAudioRef.current.pause();
          cachedAudioRef.current.onended = null;
          cachedAudioRef.current.onerror = null;
          cachedAudioRef.current = null;
        }

        // Create new audio element for cached URL
        const audio = new Audio(cachedUrl);
        cachedAudioRef.current = audio;
        audio.playbackRate = playbackSpeedRef.current;

        // Setup event handlers
        audio.onended = () => {
          console.log('[MoshiShadowingPlayer] Cached audio ended');
          cachedAudioRef.current = null;
          handleAudioEnd();
        };

        audio.onerror = (error) => {
          console.error('[MoshiShadowingPlayer] Cached audio error, falling back to TTS:', error);
          cachedAudioRef.current = null;
          // Fallback to TTS on error (uses default VOICEVOX voice)
          playTTS(sentence, {
            speed: playbackSpeedRef.current,
          }).catch((err) => {
            console.error('[MoshiShadowingPlayer] TTS fallback failed:', err);
            setIsPlaying(false);
            isPlayingRef.current = false;
          });
        };

        // Play cached audio
        await audio.play();
        return;
      } catch (error) {
        console.error('[MoshiShadowingPlayer] Cached audio play failed, falling back to TTS:', error);
        cachedAudioRef.current = null;
        // Fall through to TTS
      }
    }

    // 2. Fallback to TTS synthesis
    console.log('[MoshiShadowingPlayer] Using TTS synthesis');
    try {
      // Omit voice parameter to use default from config (VOICEVOX voice '23' = Kokoro)
      await playTTS(sentence, {
        speed: playbackSpeedRef.current,
      });
    } catch (error) {
      console.error('[MoshiShadowingPlayer] TTS play error:', error);
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  }, [editableSentences, playTTS, getAudioUrl, handleAudioEnd]);

  // Keep playSentenceRef updated
  useEffect(() => {
    playSentenceRef.current = playSentence;
  }, [playSentence]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup timeout
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }

      // Cleanup cached audio
      if (cachedAudioRef.current) {
        cachedAudioRef.current.pause();
        cachedAudioRef.current.onended = null;
        cachedAudioRef.current.onerror = null;
        cachedAudioRef.current = null;
      }
    };
  }, []);

  // Preload sentences
  useEffect(() => {
    if (editableSentences.length > 0) {
      const textsToPreload = editableSentences.slice(0, Math.min(5, editableSentences.length));
      preload(textsToPreload, { voice: 'ja-JP-NanamiNeural', speed: 1.0 });

      // Prefetch word explanations
      const fullText = editableSentences.join(' ');
      prefetchWordExplanations({
        contentId,
        contentType,
        text: fullText,
      });
    }
  }, [editableSentences, contentId, contentType, preload, prefetchWordExplanations]);

  // Jump to sentence
  const seekToSentence = useCallback((index: number) => {
    console.log('[MoshiShadowingPlayer] seekToSentence called:', index, 'total:', editableSentences.length);

    // Set guard to prevent handleAudioEnd from firing
    isManualStopRef.current = true;
    stopTTS();

    // Stop cached audio if playing
    if (cachedAudioRef.current) {
      cachedAudioRef.current.pause();
      cachedAudioRef.current.onended = null;
      cachedAudioRef.current.onerror = null;
      cachedAudioRef.current = null;
    }

    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }

    // Update refs first
    currentSentenceIndexRef.current = index;
    currentRepeatRef.current = 1;

    // Update state
    setCurrentSentenceIndex(index);
    setCurrentRepeat(1);
    setIsPlaying(true);
    isPlayingRef.current = true;

    // Use setTimeout to ensure stopTTS completes before starting new audio
    setTimeout(() => {
      console.log('[MoshiShadowingPlayer] About to play sentence:', index);
      playSentence(index);
    }, 50);
  }, [stopTTS, playSentence, editableSentences.length]);

  // Handle repeat count change
  const handleRepeatChange = useCallback((value: number) => {
    const nextCount = clampRepeatCount(value);
    setRepeatCount(nextCount);
    repeatCountRef.current = nextCount;

    if (editableSentences.length === 0) return;

    const result = onRepeatCountChange(
      {
        repeatCount: nextCount,
        currentRepeat: currentRepeatRef.current,
        segmentIndex: currentSentenceIndexRef.current,
        totalSegments: editableSentences.length,
      },
      nextCount,
    );

    currentRepeatRef.current = result.currentRepeat;
    setCurrentRepeat(result.currentRepeat);

    if (result.didAdvanceSegment) {
      const wasPlaying = isPlayingRef.current;
      isManualStopRef.current = true;
      stopTTS();
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = null;
      }
      currentSentenceIndexRef.current = result.segmentIndex;
      setCurrentSentenceIndex(result.segmentIndex);

      if (wasPlaying) {
        setIsPlaying(true);
        isPlayingRef.current = true;
        setTimeout(() => {
          playSentence(result.segmentIndex);
        }, 50);
      }
    }
  }, [editableSentences.length, stopTTS, playSentence]);

  // Handle word tap
  const handleWordTap = useCallback(async (word: string, context: string) => {
    const cleanWord = word.trim();
    if (!cleanWord || '。、！？「」『』（）'.includes(cleanWord)) return;

    setSelectedWord(cleanWord);
    setWordContext(context);
    setWordModalOpen(true);
    await explainWord(cleanWord, context);
  }, [explainWord]);

  const handleCloseWordModal = useCallback(() => {
    setWordModalOpen(false);
    setSelectedWord(null);
    setWordContext(undefined);
    resetWordExplanation();
  }, [resetWordExplanation]);

  // Stop playback
  const handleStop = useCallback(() => {
    // Set guard to prevent handleAudioEnd from firing
    isManualStopRef.current = true;

    // Stop TTS audio
    stopTTS();

    // Stop cached audio if playing
    if (cachedAudioRef.current) {
      cachedAudioRef.current.pause();
      cachedAudioRef.current.onended = null;
      cachedAudioRef.current.onerror = null;
      cachedAudioRef.current = null;
    }

    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }

    setIsPlaying(false);
    isPlayingRef.current = false;
  }, [stopTTS]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      handleStop();
    } else {
      setIsPlaying(true);
      isPlayingRef.current = true;
      // Start playing immediately
      playSentence(currentSentenceIndex);
    }
  }, [isPlaying, handleStop, playSentence, currentSentenceIndex]);

  // Keyboard shortcuts for accessibility
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Don't intercept if user is in a modal or input field
      if (settingsModalOpen || wordModalOpen) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          seekToSentence(Math.max(0, currentSentenceIndex - 1));
          break;
        case 'ArrowRight':
          e.preventDefault();
          seekToSentence(Math.min(editableSentences.length - 1, currentSentenceIndex + 1));
          break;
        case 'Escape':
          e.preventDefault();
          if (isPlaying) {
            handleStop();
          } else {
            onClose();
          }
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [
    togglePlay,
    seekToSentence,
    handleStop,
    onClose,
    currentSentenceIndex,
    editableSentences.length,
    isPlaying,
    settingsModalOpen,
    wordModalOpen,
  ]);

  const currentSentence = editableSentences[currentSentenceIndex];

  // Screen reader announcement text
  const playbackStatus = isPlaying
    ? `Playing sentence ${currentSentenceIndex + 1} of ${editableSentences.length}, repeat ${currentRepeat} of ${repeatCount}`
    : `Paused at sentence ${currentSentenceIndex + 1} of ${editableSentences.length}`;

  const applyEditedSentences = useCallback((nextSentences: string[], requestedIndex: number, recordHistory: boolean = true) => {
    const cleaned = nextSentences.map(sentence => sentence.trim()).filter(Boolean);
    if (!cleaned.length) return;

    if (recordHistory) {
      editHistoryRef.current.push(cloneSentences(editableSentences));
      if (editHistoryRef.current.length > 50) editHistoryRef.current.shift();
      setCanUndo(editHistoryRef.current.length > 0);
    }

    const boundedIndex = Math.max(0, Math.min(requestedIndex, cleaned.length - 1));
    setEditableSentences(cleaned);
    totalSentencesRef.current = cleaned.length;
    currentSentenceIndexRef.current = boundedIndex;
    setCurrentSentenceIndex(boundedIndex);
    currentRepeatRef.current = 1;
    setCurrentRepeat(1);
    setDirtyEdits(true);

    if (isPlayingRef.current) {
      isManualStopRef.current = true;
      stopTTS();
      if (cachedAudioRef.current) {
        cachedAudioRef.current.pause();
        cachedAudioRef.current.onended = null;
        cachedAudioRef.current.onerror = null;
        cachedAudioRef.current = null;
      }
      setTimeout(() => {
        if (playSentenceRef.current) {
          playSentenceRef.current(boundedIndex);
        }
      }, 50);
    }
  }, [editableSentences, stopTTS]);

  const handleSentenceTextChange = useCallback((index: number, text: string) => {
    editHistoryRef.current.push(cloneSentences(editableSentences));
    if (editHistoryRef.current.length > 50) editHistoryRef.current.shift();
    setCanUndo(editHistoryRef.current.length > 0);
    const next = cloneSentences(editableSentences);
    next[index] = text;
    setEditableSentences(next);
    setDirtyEdits(true);
  }, [editableSentences]);

  const handleSplitSentence = useCallback((index: number) => {
    const current = editableSentences[index];
    if (!current) return;
    const cursorIndex = splitCursorByIndex[index];
    const trimmed = current.trim();
    const cursorSplitValid =
      typeof cursorIndex === 'number' &&
      cursorIndex >= 2 &&
      cursorIndex <= trimmed.length - 2;
    const splitIndex = cursorSplitValid ? cursorIndex : findSplitIndexForText(current);
    if (splitIndex == null) return;

    const left = trimmed.slice(0, splitIndex).trim();
    const right = trimmed.slice(splitIndex).trim();
    if (!left || !right) return;

    const next = cloneSentences(editableSentences);
    next.splice(index, 1, left, right);
    applyEditedSentences(next, currentSentenceIndexRef.current > index ? currentSentenceIndexRef.current + 1 : currentSentenceIndexRef.current);
  }, [editableSentences, splitCursorByIndex, applyEditedSentences]);

  const handleMergeWithPrevious = useCallback((index: number) => {
    if (index <= 0) return;
    const next = cloneSentences(editableSentences);
    next.splice(index - 1, 2, joinSegmentTexts(next[index - 1], next[index]));
    applyEditedSentences(next, Math.max(0, currentSentenceIndexRef.current >= index ? currentSentenceIndexRef.current - 1 : currentSentenceIndexRef.current));
  }, [editableSentences, applyEditedSentences]);

  const handleMergeWithNext = useCallback((index: number) => {
    if (index >= editableSentences.length - 1) return;
    const next = cloneSentences(editableSentences);
    next.splice(index, 2, joinSegmentTexts(next[index], next[index + 1]));
    applyEditedSentences(next, Math.min(currentSentenceIndexRef.current, next.length - 1));
  }, [editableSentences, applyEditedSentences]);

  const handleBoundaryTakeFromNext = useCallback((index: number, tokenCount: number = 1) => {
    if (index >= editableSentences.length - 1) return;
    const split = splitLeadingTokens(editableSentences[index + 1], tokenCount);
    if (!split) return;
    const next = cloneSentences(editableSentences);
    next[index] = joinSegmentTexts(next[index], split.token);
    next[index + 1] = split.remainder;
    applyEditedSentences(next, currentSentenceIndexRef.current);
  }, [editableSentences, applyEditedSentences]);

  const handleBoundaryGiveToNext = useCallback((index: number, tokenCount: number = 1) => {
    if (index >= editableSentences.length - 1) return;
    const split = splitTrailingTokens(editableSentences[index], tokenCount);
    if (!split) return;
    const next = cloneSentences(editableSentences);
    next[index] = split.remainder;
    next[index + 1] = joinSegmentTexts(split.token, next[index + 1]);
    applyEditedSentences(next, currentSentenceIndexRef.current);
  }, [editableSentences, applyEditedSentences]);

  const handleUndoEdit = useCallback(() => {
    const previous = editHistoryRef.current.pop();
    if (!previous || !previous.length) return;
    setCanUndo(editHistoryRef.current.length > 0);
    applyEditedSentences(previous, Math.min(currentSentenceIndexRef.current, previous.length - 1), false);
  }, [applyEditedSentences]);

  const handleResetEdits = useCallback(() => {
    const baseline = baselineSentencesRef.current;
    if (!baseline.length) return;
    editHistoryRef.current = [];
    setCanUndo(false);
    applyEditedSentences(cloneSentences(baseline), Math.min(currentSentenceIndexRef.current, baseline.length - 1), false);
    setDirtyEdits(false);
    setSplitCursorByIndex({});
  }, [applyEditedSentences]);

  const handleSaveEdits = useCallback(() => {
    baselineSentencesRef.current = cloneSentences(editableSentences);
    editHistoryRef.current = [];
    setCanUndo(false);
    setDirtyEdits(false);
  }, [editableSentences]);

  const transcriptEditSections = useMemo(
    () => [
      {
        id: 'audio-transcript-edit',
        title: 'Transcript Edit',
        items: [
          {
            id: 'toggle-edit',
            label: 'Edit Transcript',
            type: 'toggle' as const,
            value: editMode,
            onClick: () => setEditMode(prev => !prev),
          },
          {
            id: 'save-edits',
            label: 'Save Edits',
            disabled: !dirtyEdits,
            onClick: handleSaveEdits,
          },
          {
            id: 'undo-edit',
            label: 'Undo',
            disabled: !canUndo,
            onClick: handleUndoEdit,
          },
          {
            id: 'reset-edits',
            label: 'Reset Edits',
            disabled: !dirtyEdits,
            onClick: handleResetEdits,
          },
        ],
      },
    ],
    [editMode, dirtyEdits, canUndo, handleSaveEdits, handleUndoEdit, handleResetEdits]
  );

  return (
    <div
      className={styles.overlay}
      role="application"
      aria-label="Japanese Shadowing Practice Player"
    >
      {/* Screen reader live region for status announcements */}
      <div
        className={styles.srOnly}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {playbackStatus}
      </div>

      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>{title}</h1>
            <span className={styles.contentType}>{contentType}</span>
          </div>
          <button
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close shadowing player"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Main Grid */}
        <div className={styles.grid}>
          {/* Player Card - Current Sentence */}
          <div className={styles.playerCard}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.pill}>{t('youtubeShadowing.player.title')}</p>
              </div>
              <div className={styles.playerMeta}>
                <span className={styles.meta}>
                  {t('youtubeShadowing.player.segmentProgress', { current: currentSentenceIndex + 1, total: editableSentences.length })}
                </span>
                <span className={styles.meta}>
                  {t('youtubeShadowing.player.repeatProgress', { current: currentRepeat, total: repeatCount })}
                </span>
              </div>
            </div>

            {/* Current Sentence Display */}
            <div className={styles.playerFrame}>
              {currentSentence ? (
                <div className={styles.sentenceDisplay}>
                  <GrammarHighlightedText
                    text={currentSentence}
                    highlightMode={highlightMode}
                    showFurigana={showFurigana}
                    onWordClick={(word: string, event: React.MouseEvent) => {
                      event.stopPropagation();
                      handleWordTap(word, currentSentence);
                    }}
                    className={styles.currentSentenceText}
                  />
                </div>
              ) : (
                <div className={styles.placeholder}>
                  {t('youtubeShadowing.hints.transcriptWillAppear')}
                </div>
              )}

              {/* Play/Pause Button */}
              <button
                onClick={togglePlay}
                disabled={ttsLoading}
                className={styles.playButton}
                aria-label={
                  ttsLoading
                    ? 'Loading audio'
                    : isPlaying || ttsPlaying
                      ? `Pause playback. Sentence ${currentSentenceIndex + 1} of ${editableSentences.length}, repeat ${currentRepeat} of ${repeatCount}`
                      : `Play sentence ${currentSentenceIndex + 1} of ${editableSentences.length}`
                }
                aria-pressed={isPlaying || ttsPlaying}
              >
                {ttsLoading ? (
                  <span className={styles.loader} aria-hidden="true" />
                ) : isPlaying || ttsPlaying ? (
                  <span className={styles.pauseIcon} aria-hidden="true">❚❚</span>
                ) : (
                  <PlayIcon className="w-8 h-8" aria-hidden="true" />
                )}
              </button>

              {/* Settings Button (Mobile) */}
              <button
                onClick={() => setSettingsModalOpen(true)}
                className={styles.mobileSettingsButton}
                aria-label="Open settings"
              >
                <Settings className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Transcript Card - Sentence List */}
          <div className={styles.transcriptCard}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.pill}>{t('youtubeShadowing.player.transcript.title')}</p>
                <h2 className={styles.cardTitle}>{t('youtubeShadowing.player.tapWordsForExplanation')}</h2>
              </div>
              <SettingsDropdown
                sections={transcriptEditSections}
                buttonIcon={<MoreVertical className="w-4 h-4" />}
                showChevron={false}
                buttonClassName={styles.editMenuButton}
                position="right"
                showDividers={false}
              />
            </div>

            <div className={styles.segmentList}>
              {editableSentences.map((sentence, index) => {
                const active = index === currentSentenceIndex;

                return (
                  <div
                    key={index}
                    className={`${styles.segment} ${active ? styles.segmentActive : ''}`}
                  >
                    {/* Repeat badge */}
                    {active && (
                      <span className={styles.repeatBadge}>
                        {currentRepeat}/{repeatCount}
                      </span>
                    )}

                    <div className={styles.segmentHeader}>
                      <button
                        className={styles.jumpButton}
                        onClick={() => seekToSentence(index)}
                        aria-label={`Jump to sentence ${index + 1}${active ? ' (current)' : ''}`}
                      >
                        <PlayIcon className={styles.jumpIcon} aria-hidden="true" />
                      </button>
                      <div className={styles.segmentMeta}>
                        <span>{index + 1}.</span>
                      </div>
                    </div>

                    <div className={styles.segmentText}>
                      {editMode ? (
                        <textarea
                          value={sentence}
                          className={styles.segmentTextEditor}
                          onChange={(event) => handleSentenceTextChange(index, event.target.value)}
                          onSelect={(event) => {
                            const value = event.currentTarget.selectionStart ?? 0;
                            setSplitCursorByIndex(prev => ({ ...prev, [index]: value }));
                          }}
                        />
                      ) : (
                        <GrammarHighlightedText
                          text={sentence}
                          highlightMode={highlightMode}
                          showFurigana={showFurigana}
                          onWordClick={(word: string, event: React.MouseEvent) => {
                            event.stopPropagation();
                            handleWordTap(word, sentence);
                          }}
                        />
                      )}
                    </div>
                    {editMode && (
                      <div className={styles.segmentEditRow}>
                        <button type="button" className={styles.segmentEditButton} onClick={() => handleSplitSentence(index)}>
                          Split
                        </button>
                        <button
                          type="button"
                          className={styles.segmentEditButton}
                          onClick={() => handleBoundaryTakeFromNext(index)}
                          disabled={index >= editableSentences.length - 1}
                        >
                          Take Next
                        </button>
                        <button
                          type="button"
                          className={styles.segmentEditButton}
                          onClick={() => handleBoundaryTakeFromNext(index, 2)}
                          disabled={index >= editableSentences.length - 1}
                        >
                          Take 2
                        </button>
                        <button
                          type="button"
                          className={styles.segmentEditButton}
                          onClick={() => handleBoundaryGiveToNext(index)}
                          disabled={index >= editableSentences.length - 1}
                        >
                          Give Next
                        </button>
                        <button
                          type="button"
                          className={styles.segmentEditButton}
                          onClick={() => handleBoundaryGiveToNext(index, 2)}
                          disabled={index >= editableSentences.length - 1}
                        >
                          Give 2
                        </button>
                        <button
                          type="button"
                          className={styles.segmentEditButton}
                          onClick={() => handleMergeWithPrevious(index)}
                          disabled={index === 0}
                        >
                          Merge Prev
                        </button>
                        <button
                          type="button"
                          className={styles.segmentEditButton}
                          onClick={() => handleMergeWithNext(index)}
                          disabled={index >= editableSentences.length - 1}
                        >
                          Merge Next
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Floating Nav */}
        <div className={styles.floatingNav} role="toolbar" aria-label="Playback controls">
          <button
            onClick={() => setSettingsModalOpen(true)}
            className={styles.navButton}
            aria-label="Open settings"
          >
            <Settings className="w-5 h-5" aria-hidden="true" />
          </button>
          <span className={styles.navProgress}>
            {t('youtubeShadowing.player.segmentProgress', { current: currentSentenceIndex + 1, total: editableSentences.length })}
            {' • '}
            {t('youtubeShadowing.player.repeatProgress', { current: currentRepeat, total: repeatCount })}
          </span>
        </div>

        {/* Settings Modal */}
        <Modal
          isOpen={settingsModalOpen}
          onClose={() => setSettingsModalOpen(false)}
          title={t('youtubeShadowing.settings.title')}
          size="sm"
        >
          <div className="space-y-4">
            {/* Repeat Count - YouTube Style */}
            <div className="py-3 border-b border-gray-200 dark:border-dark-700">
              <div className="flex flex-col items-center gap-4">
                <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                  {t('news.reader.repeatCount')}
                </span>

                {/* Counter Display with +/- Controls */}
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => handleRepeatChange(repeatCount - 1)}
                    disabled={repeatCount <= 1}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      backgroundColor: repeatCount <= 1
                        ? 'rgba(var(--palette-primary-500), 0.1)'
                        : 'rgba(var(--palette-primary-500), 0.15)',
                      color: repeatCount <= 1
                        ? 'rgb(156, 163, 175)'
                        : 'rgb(var(--palette-primary-600))'
                    }}
                    title="Decrease repeat count"
                    aria-label="Decrease repeat count"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>

                  <div className="flex flex-col items-center">
                    <div className="text-4xl font-bold tabular-nums text-primary-600">
                      {repeatCount}
                    </div>
                    <div className="text-xs font-medium text-gray-500">
                      {repeatCount === 1 ? 'time' : 'times'}
                    </div>
                    {/* Progress indicator during playback */}
                    {(isPlaying || ttsPlaying) && repeatCount > 1 && (
                      <div className="text-xs mt-1 text-primary-600" aria-live="polite">
                        {currentRepeat}/{repeatCount}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleRepeatChange(repeatCount + 1)}
                    disabled={repeatCount >= 20}
                    className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
                    style={{
                      backgroundColor: repeatCount >= 20
                        ? 'rgba(var(--palette-primary-500), 0.1)'
                        : 'rgba(var(--palette-primary-500), 0.15)',
                      color: repeatCount >= 20
                        ? 'rgb(156, 163, 175)'
                        : 'rgb(var(--palette-primary-600))'
                    }}
                    title="Increase repeat count"
                    aria-label="Increase repeat count"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Select Buttons */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-center text-gray-500">
                    Quick Select
                  </div>
                  <div className="flex gap-2" role="group" aria-label="Quick repeat count selection">
                    {[1, 2, 3, 5, 10].map(count => (
                      <button
                        key={count}
                        onClick={() => handleRepeatChange(count)}
                        className={`w-12 h-9 rounded-lg font-bold transition-all duration-200 hover:scale-105 active:scale-95 text-sm ${
                          repeatCount === count
                            ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                            : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                        }`}
                        style={
                          repeatCount === count
                            ? { border: '2px solid rgba(var(--palette-primary-500), 0.5)' }
                            : {}
                        }
                        aria-label={`Set repeat count to ${count}`}
                        aria-pressed={repeatCount === count}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Playback Speed */}
            <div className="py-3 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Gauge className="w-4 h-4 text-primary-500" />
                  {t('news.reader.playbackSpeed')}
                </label>
                <span className="text-lg font-semibold text-primary-500">{playbackSpeed.toFixed(2)}x</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {[0.5, 0.75, 1.0, 1.25, 1.5].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setPlaybackSpeed(speed)}
                    className={`px-2 py-2 rounded-lg text-sm font-medium transition-all ${
                      playbackSpeed === speed
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                    }`}
                  >
                    {speed}x
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                {t('news.reader.playbackSpeedHint')}
              </p>
            </div>

            {/* Furigana Toggle */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-dark-700">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Type className="w-4 h-4 text-primary-500" />
                {t('youtubeShadowing.settings.furigana')}
              </label>
              <button
                onClick={() => setShowFurigana(!showFurigana)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  showFurigana
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                }`}
              >
                {showFurigana ? 'On' : 'Off'}
              </button>
            </div>

            {/* Highlight Mode */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-dark-700">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Highlighter className="w-4 h-4 text-primary-500" />
                {t('youtubeShadowing.settings.highlighting')}
              </label>
              <Dropdown
                value={highlightMode}
                onChange={(value) => setHighlightMode(value as HighlightMode)}
                size="small"
                options={[
                  { value: 'none', label: t('youtubeShadowing.settings.noHighlighting') },
                  { value: 'content', label: t('youtubeShadowing.settings.contentWords') },
                  { value: 'grammar', label: t('youtubeShadowing.settings.grammarWords') },
                  { value: 'all', label: t('youtubeShadowing.settings.allWords') },
                ]}
              />
            </div>

            {/* Close Shadowing */}
            <div className="flex items-center justify-between py-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Trash2 className="w-4 h-4 text-red-500" />
                {t('youtubeShadowing.settings.clearSession')}
              </label>
              <button
                onClick={() => {
                  handleStop();
                  onClose();
                }}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                {t('youtubeShadowing.settings.clearButton')}
              </button>
            </div>
          </div>
        </Modal>

        {/* Word Explanation Modal */}
        <WordExplanationModal
          isOpen={wordModalOpen}
          onClose={handleCloseWordModal}
          word={selectedWord}
          explanation={wordExplanation}
          loading={wordLoading}
          error={wordError}
          translationContext={wordContext ? { sentence: wordContext } : undefined}
          showTranslationContext={true}
          enableRelatedTranslations={true}
          onWordLookup={(word) => handleWordTap(word, wordContext || '')}
        />
      </div>
    </div>
  );
}
