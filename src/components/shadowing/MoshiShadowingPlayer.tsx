'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useI18n } from '@/i18n/I18nContext';
import { useTTS } from '@/hooks/useTTS';
import { useWordExplanation } from '@/hooks/useWordExplanation';
import WordExplanationModal from '@/components/word/WordExplanationModal';
import { GrammarHighlightedText } from '@/components/reading/GrammarHighlightedText';
import Modal from '@/components/ui/Modal';
import Dropdown from '@/components/ui/Dropdown';
import { Settings, Repeat, Type, Highlighter, X, Trash2 } from 'lucide-react';
import { PlayIcon } from '@heroicons/react/24/solid';
import { nextOnSegmentEnd, onRepeatCountChange, clampRepeatCount, type RepeatState } from '@/lib/shadowing/repeat';
import styles from './MoshiShadowingPlayer.module.css';

type HighlightMode = 'none' | 'all' | 'content' | 'grammar';

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
  };
}

export default function MoshiShadowingPlayer({
  sentences,
  title,
  contentId,
  contentType,
  onClose,
  initialSettings,
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
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Word explanation state
  const [wordModalOpen, setWordModalOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordContext, setWordContext] = useState<string | undefined>(undefined);

  // Refs for state machine (avoid stale closures)
  const repeatCountRef = useRef(repeatCount);
  const currentRepeatRef = useRef(currentRepeat);
  const currentSentenceIndexRef = useRef(currentSentenceIndex);
  const totalSentencesRef = useRef(sentences.length);
  const isPlayingRef = useRef(false);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const playSentenceRef = useRef<((index: number) => Promise<void>) | null>(null);
  // Guard to prevent handleAudioEnd from firing during manual seek/stop
  const isManualStopRef = useRef(false);

  // Pause duration between repeats (1 second)
  const PAUSE_DURATION = 1000;

  // Sync refs
  useEffect(() => {
    repeatCountRef.current = repeatCount;
    currentRepeatRef.current = currentRepeat;
    currentSentenceIndexRef.current = currentSentenceIndex;
    totalSentencesRef.current = sentences.length;
  }, [repeatCount, currentRepeat, currentSentenceIndex, sentences.length]);

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

  // Play current sentence
  const playSentence = useCallback(async (index: number) => {
    const sentence = sentences[index];
    if (!sentence) return;

    console.log('[MoshiShadowingPlayer] Playing sentence:', index, sentence.substring(0, 30));

    try {
      await playTTS(sentence, {
        voice: 'ja-JP-NanamiNeural',
        speed: 1.0,
      });
    } catch (error) {
      console.error('[MoshiShadowingPlayer] Play error:', error);
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
  }, [sentences, playTTS]);

  // Keep playSentenceRef updated
  useEffect(() => {
    playSentenceRef.current = playSentence;
  }, [playSentence]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  // Preload sentences
  useEffect(() => {
    if (sentences.length > 0) {
      const textsToPreload = sentences.slice(0, Math.min(5, sentences.length));
      preload(textsToPreload, { voice: 'ja-JP-NanamiNeural', speed: 1.0 });

      // Prefetch word explanations
      const fullText = sentences.join(' ');
      prefetchWordExplanations({
        contentId,
        contentType,
        text: fullText,
      });
    }
  }, [sentences, contentId, contentType, preload, prefetchWordExplanations]);

  // Jump to sentence
  const seekToSentence = useCallback((index: number) => {
    console.log('[MoshiShadowingPlayer] seekToSentence called:', index, 'total:', sentences.length);

    // Set guard to prevent handleAudioEnd from firing
    isManualStopRef.current = true;
    stopTTS();

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
  }, [stopTTS, playSentence, sentences.length]);

  // Handle repeat count change
  const handleRepeatChange = useCallback((value: number) => {
    const nextCount = clampRepeatCount(value);
    setRepeatCount(nextCount);
    repeatCountRef.current = nextCount;

    if (sentences.length === 0) return;

    const result = onRepeatCountChange(
      {
        repeatCount: nextCount,
        currentRepeat: currentRepeatRef.current,
        segmentIndex: currentSentenceIndexRef.current,
        totalSegments: sentences.length,
      },
      nextCount,
    );

    currentRepeatRef.current = result.currentRepeat;
    setCurrentRepeat(result.currentRepeat);

    if (result.didAdvanceSegment) {
      currentSentenceIndexRef.current = result.segmentIndex;
      setCurrentSentenceIndex(result.segmentIndex);
    }
  }, [sentences.length]);

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
    stopTTS();
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

  const currentSentence = sentences[currentSentenceIndex];

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>{title}</h1>
            <span className={styles.contentType}>{contentType}</span>
          </div>
          <button onClick={onClose} className={styles.closeButton}>
            <X className="w-5 h-5" />
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
                  {t('youtubeShadowing.player.segmentProgress', { current: currentSentenceIndex + 1, total: sentences.length })}
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
              >
                {ttsLoading ? (
                  <span className={styles.loader} />
                ) : isPlaying || ttsPlaying ? (
                  <span className={styles.pauseIcon}>❚❚</span>
                ) : (
                  <PlayIcon className="w-8 h-8" />
                )}
              </button>

              {/* Settings Button (Mobile) */}
              <button
                onClick={() => setSettingsModalOpen(true)}
                className={styles.mobileSettingsButton}
              >
                <Settings className="w-5 h-5" />
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
            </div>

            <div className={styles.segmentList}>
              {sentences.map((sentence, index) => {
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
                        title="Jump to this sentence"
                      >
                        <PlayIcon className={styles.jumpIcon} />
                      </button>
                      <div className={styles.segmentMeta}>
                        <span>{index + 1}.</span>
                      </div>
                    </div>

                    <div className={styles.segmentText}>
                      <GrammarHighlightedText
                        text={sentence}
                        highlightMode={highlightMode}
                        showFurigana={showFurigana}
                        onWordClick={(word: string, event: React.MouseEvent) => {
                          event.stopPropagation();
                          handleWordTap(word, sentence);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Floating Nav */}
        <div className={styles.floatingNav}>
          <button
            onClick={() => setSettingsModalOpen(true)}
            className={styles.navButton}
          >
            <Settings className="w-5 h-5" />
          </button>
          <span className={styles.navProgress}>
            {t('youtubeShadowing.player.segmentProgress', { current: currentSentenceIndex + 1, total: sentences.length })}
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
            {/* Repeat Count */}
            <div className="py-3 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Repeat className="w-4 h-4 text-primary-500" />
                  {t('youtubeShadowing.form.repeatLabel')}
                </label>
                <span className="text-lg font-semibold text-primary-500">{repeatCount}x</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={repeatCount}
                onChange={(e) => handleRepeatChange(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-dark-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
              <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
                <span>1x</span>
                <span>10x</span>
              </div>
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
