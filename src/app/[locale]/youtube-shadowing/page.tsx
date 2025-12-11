"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import YouTube, { type YouTubeProps } from "react-youtube";
import styles from "./page.module.css";
import { clampRepeatCount, extractVideoId } from "@/lib/video";
import { nextOnSegmentEnd, onRepeatCountChange } from "@/lib/shadowing/repeat";
import { useWordExplanation } from "@/hooks/useWordExplanation";
import WordExplanationModal from "@/components/word/WordExplanationModal";
import { GrammarHighlightedText } from "@/components/reading/GrammarHighlightedText";
import { PlayIcon } from "@heroicons/react/24/solid";
import { useI18n } from "@/i18n/I18nContext";
import { Settings, Repeat, Type, Highlighter, ChevronDown, ChevronUp, Video, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import Navbar from "@/components/layout/Navbar";
import MobileNavSpacer from "@/components/layout/MobileNavSpacer";
import { useAuth } from "@/hooks/useAuth";

// Session persistence key
const SESSION_STORAGE_KEY = "moshiPlayerSession";

type HighlightMode = "none" | "all" | "content" | "grammar";

// Session data structure for localStorage
interface PlayerSession {
  version: number;
  savedAt: number;
  videoInput: string;
  videoId: string | null;
  segments: TranscriptSegment[];
  source: string | null;
  currentSegmentIndex: number;
  currentRepeat: number;
  repeatCount: number;
  showFurigana: boolean;
  highlightMode: HighlightMode;
}

type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

type TranscriptResponse = {
  segments: TranscriptSegment[];
  language?: string;
  source: string;
};

const PLAYER_STATES = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
} as const;

export default function YouTubeShadowingPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [videoInput, setVideoInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [language] = useState("ja");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [repeatCount, setRepeatCount] = useState(3);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [currentRepeat, setCurrentRepeat] = useState(1);

  // Settings state
  const [showFurigana, setShowFurigana] = useState(true);
  const [highlightMode, setHighlightMode] = useState<HighlightMode>("content");
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(true);

  // Word explanation state
  const [wordModalOpen, setWordModalOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordContext, setWordContext] = useState<string | undefined>(undefined);

  const {
    explainWord,
    loading: wordLoading,
    error: wordError,
    explanation: wordExplanation,
    reset: resetWordExplanation,
    prefetch: prefetchWordExplanations,
  } = useWordExplanation();

  const playerRef = useRef<YT.Player | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const repeatCountRef = useRef(repeatCount);
  const segmentIndexRef = useRef(0);
  const currentRepeatRef = useRef(1);
  const hasHydratedRef = useRef(false);

  const opts: YouTubeProps["opts"] = useMemo(
    () => ({
      width: "100%",
      height: "540",
      playerVars: {
        autoplay: 0,
        modestbranding: 1,
        rel: 0,
        controls: 1,
      },
    }),
    [],
  );

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const seekToSegment = useCallback(
    (index: number) => {
      const player = playerRef.current;
      const segment = segmentsRef.current[index];

      if (!player || !segment) return;

      segmentIndexRef.current = index;
      currentRepeatRef.current = 1;
      setCurrentSegmentIndex(index);
      setCurrentRepeat(1);

      player.seekTo(segment.start, true);
      player.playVideo();
    },
    [setCurrentSegmentIndex],
  );

  const evaluatePlayback = useCallback(() => {
    const player = playerRef.current;
    const segment = segmentsRef.current[segmentIndexRef.current];

    if (!player || !segment) return;

    const currentTime = player.getCurrentTime();
    const segmentEnd = Math.max(segment.end - 0.08, segment.start + 0.05);

    if (currentTime >= segmentEnd) {
      const next = nextOnSegmentEnd({
        repeatCount: repeatCountRef.current,
        currentRepeat: currentRepeatRef.current,
        segmentIndex: segmentIndexRef.current,
        totalSegments: segmentsRef.current.length,
      });

      currentRepeatRef.current = next.currentRepeat;
      setCurrentRepeat(next.currentRepeat);

      if (next.segmentIndex !== segmentIndexRef.current) {
        segmentIndexRef.current = next.segmentIndex;
        setCurrentSegmentIndex(next.segmentIndex);
      }

      const target = segmentsRef.current[next.segmentIndex];
      if (target) {
        player.seekTo(target.start, true);
        player.playVideo();
      } else {
        clearPoll();
      }
    }
  }, [clearPoll]);

  const startPoll = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(evaluatePlayback, 250);
  }, [evaluatePlayback]);

  const handleStateChange: YouTubeProps["onStateChange"] = (event) => {
    if (event.data === PLAYER_STATES.playing) {
      startPoll();
    } else if (
      event.data === PLAYER_STATES.paused ||
      event.data === PLAYER_STATES.ended
    ) {
      clearPoll();
    }
  };

  const handleReady: YouTubeProps["onReady"] = (event) => {
    playerRef.current = event.target;
  };

  const loadTranscript = useCallback(
    async (input: string) => {
      const extractedId = extractVideoId(input);

      if (!extractedId) {
        setError(t('youtubeShadowing.errors.invalidVideoId'));
        return;
      }

      setLoadingTranscript(true);
      setError(null);
      setStatus(null);

      try {
        const response = await fetch(
          `/api/transcript?videoId=${encodeURIComponent(extractedId)}&lang=${encodeURIComponent(language)}`,
        );

        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          throw new Error(
            details.error || t('youtubeShadowing.errors.transcriptUnavailable'),
          );
        }

        const data = (await response.json()) as TranscriptResponse;

        setVideoId(extractedId);
        setSegments(data.segments);
        segmentsRef.current = data.segments;
        segmentIndexRef.current = 0;
        currentRepeatRef.current = 1;
        repeatCountRef.current = repeatCount;
        setCurrentSegmentIndex(0);
        setCurrentRepeat(1);
        setSource(data.source);
        setShowUrlInput(false); // Auto-collapse form after successful load

        setStatus(
          t('youtubeShadowing.status.transcriptLoaded', {
            source: data.source.replace("-", " "),
            language: data.language || language,
          }),
        );

        if (data.segments[0] && playerRef.current) {
          playerRef.current.seekTo(data.segments[0].start, true);
        }

        // Prefetch word explanations for instant modal response
        const transcriptText = data.segments.map((s) => s.text).join(" ");
        prefetchWordExplanations({
          contentId: extractedId,
          contentType: "video",
          text: transcriptText,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : t('youtubeShadowing.errors.transcriptFailed');
        setError(message);
      } finally {
        setLoadingTranscript(false);
      }
    },
    [language, repeatCount, t, prefetchWordExplanations],
  );

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      void loadTranscript(videoInput);
    },
    [loadTranscript, videoInput],
  );

  const handleRepeatChange = useCallback(
    (value: number) => {
      const nextCount = clampRepeatCount(value);
      setRepeatCount(nextCount);
      repeatCountRef.current = nextCount;

      if (!segmentsRef.current.length) return;

      const result = onRepeatCountChange(
        {
          repeatCount: nextCount,
          currentRepeat: currentRepeatRef.current,
          segmentIndex: segmentIndexRef.current,
          totalSegments: segmentsRef.current.length,
        },
        nextCount,
      );

      currentRepeatRef.current = result.currentRepeat;
      setCurrentRepeat(result.currentRepeat);

      if (result.didAdvanceSegment) {
        segmentIndexRef.current = result.segmentIndex;
        setCurrentSegmentIndex(result.segmentIndex);
        seekToSegment(result.segmentIndex);
      }
    },
    [seekToSegment],
  );

  // Handle word tap for explanation
  const handleWordTap = useCallback(
    async (word: string, context: string) => {
      // Filter out punctuation-only tokens
      const cleanWord = word.trim();
      if (!cleanWord || "。、！？「」『』（）".includes(cleanWord)) {
        return;
      }

      setSelectedWord(cleanWord);
      setWordContext(context);
      setWordModalOpen(true);
      await explainWord(cleanWord, context);
    },
    [explainWord],
  );

  const handleCloseWordModal = useCallback(() => {
    setWordModalOpen(false);
    setSelectedWord(null);
    setWordContext(undefined);
    resetWordExplanation();
  }, [resetWordExplanation]);

  useEffect(() => {
    return () => {
      clearPoll();
    };
  }, [clearPoll]);

  // Restore session from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined" || hasHydratedRef.current) return;

    try {
      const stored = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!stored) {
        hasHydratedRef.current = true;
        return;
      }

      const parsed = JSON.parse(stored) as PlayerSession;
      if (!parsed || typeof parsed !== "object" || parsed.version !== 1) {
        hasHydratedRef.current = true;
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return;
      }

      // Restore state
      if (parsed.videoInput) setVideoInput(parsed.videoInput);
      if (parsed.videoId) setVideoId(parsed.videoId);
      if (parsed.segments?.length) {
        setSegments(parsed.segments);
        segmentsRef.current = parsed.segments;
        setShowUrlInput(false); // Collapse form when restoring a session
      }
      if (parsed.source) setSource(parsed.source);
      if (typeof parsed.currentSegmentIndex === "number") {
        setCurrentSegmentIndex(parsed.currentSegmentIndex);
        segmentIndexRef.current = parsed.currentSegmentIndex;
      }
      if (typeof parsed.currentRepeat === "number") {
        setCurrentRepeat(parsed.currentRepeat);
        currentRepeatRef.current = parsed.currentRepeat;
      }
      if (typeof parsed.repeatCount === "number") {
        setRepeatCount(parsed.repeatCount);
        repeatCountRef.current = parsed.repeatCount;
      }
      if (typeof parsed.showFurigana === "boolean") setShowFurigana(parsed.showFurigana);
      if (parsed.highlightMode) setHighlightMode(parsed.highlightMode);

      hasHydratedRef.current = true;
      console.log(`[MoshiPlayer] Restored session: ${parsed.segments?.length || 0} segments`);
    } catch (err) {
      console.warn("[MoshiPlayer] Failed to restore session:", err);
      hasHydratedRef.current = true;
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  // Save session to localStorage when state changes
  useEffect(() => {
    if (typeof window === "undefined" || !hasHydratedRef.current) return;

    // Don't save empty sessions
    if (!videoId && !segments.length) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    const session: PlayerSession = {
      version: 1,
      savedAt: Date.now(),
      videoInput,
      videoId,
      segments,
      source,
      currentSegmentIndex,
      currentRepeat,
      repeatCount,
      showFurigana,
      highlightMode,
    };

    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (err) {
      console.warn("[MoshiPlayer] Failed to save session:", err);
    }
  }, [videoInput, videoId, segments, source, currentSegmentIndex, currentRepeat, repeatCount, showFurigana, highlightMode]);

  // Clear session function (can be called from UI)
  const clearSession = useCallback(() => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setVideoInput("");
    setVideoId(null);
    setSegments([]);
    segmentsRef.current = [];
    setSource(null);
    setCurrentSegmentIndex(0);
    segmentIndexRef.current = 0;
    setCurrentRepeat(1);
    currentRepeatRef.current = 1;
    setError(null);
    setStatus(null);
    setShowUrlInput(true);
    console.log("[MoshiPlayer] Session cleared");
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      <Navbar user={user} showUserMenu={true} />

      <PageHeader
        title={t('youtubeShadowing.header.title')}
        description={t('youtubeShadowing.header.subtitle')}
        subtitle={t('youtubeShadowing.header.eyebrow')}
        backHref="/dashboard"
      />

      <main className="container mx-auto px-4 py-6">
        {/* URL Input Form - Collapsible when video is loaded */}
        {segments.length > 0 && !showUrlInput ? (
          <button
            type="button"
            onClick={() => setShowUrlInput(true)}
            className={styles.changeVideoButton}
          >
            <Video className="w-4 h-4" />
            <span>{t('youtubeShadowing.form.changeVideo')}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
        ) : (
          <form className={styles.controls} onSubmit={handleSubmit}>
            <div className={styles.urlRow}>
              <input
                id="video"
                name="video"
                className={styles.urlInput}
                placeholder={t('youtubeShadowing.form.videoPlaceholder')}
                value={videoInput}
                onChange={(e) => setVideoInput(e.target.value)}
              />
              <button
                className={styles.loadButton}
                type="submit"
                disabled={loadingTranscript}
              >
                {loadingTranscript ? t('youtubeShadowing.form.loadingButton') : t('youtubeShadowing.form.loadButton')}
              </button>
              {segments.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowUrlInput(false)}
                  className={styles.collapseButton}
                  aria-label="Collapse"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              )}
            </div>
            {(error || status) && (
              <div className={styles.statusBar}>
                {error && <span className={styles.error}>{error}</span>}
                {!error && status && <span className={styles.status}>{status}</span>}
              </div>
            )}
          </form>
        )}

        <div className={styles.shell}>

        <section className={styles.grid}>
          <div className={styles.playerCard}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.pill}>{t('youtubeShadowing.player.title')}</p>
                <h2 className={`${styles.cardTitle} ${styles.hideOnMobile}`}>
                  {videoId ? t('youtubeShadowing.player.nowPlaying', { videoId }) : t('youtubeShadowing.player.awaitingVideo')}
                </h2>
              </div>
              <div className={styles.playerMeta}>
                <span className={styles.meta}>
                  {t('youtubeShadowing.player.segmentProgress', { current: segments.length ? currentSegmentIndex + 1 : 0, total: segments.length })}
                </span>
                <span className={styles.meta}>
                  {t('youtubeShadowing.player.repeatProgress', { current: currentRepeat, total: repeatCount })}
                </span>
              </div>
            </div>
            <div className={styles.playerFrame}>
              {videoId ? (
                <YouTube
                  videoId={videoId}
                  opts={opts}
                  onReady={handleReady}
                  onStateChange={handleStateChange}
                />
              ) : (
                <div className={styles.placeholder}>
                  {t('youtubeShadowing.hints.pasteToStart')}
                </div>
              )}
              {/* Mobile Settings Button - inside player frame */}
              {segments.length > 0 && (
                <button
                  onClick={() => setSettingsModalOpen(true)}
                  className={styles.mobileSettingsButton}
                  aria-label={t("youtubeShadowing.settings.title")}
                >
                  <Settings className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Current Segment Display - Mobile only */}
            {segments.length > 0 && segments[currentSegmentIndex] && (
              <div className={styles.currentSegmentDisplay}>
                <div className={styles.currentSegmentLabel}>
                  <span>{t('youtubeShadowing.currentSegment.nowPlaying')}</span>
                  <span>{currentRepeat}/{repeatCount}</span>
                </div>
                <div className={styles.currentSegmentText}>
                  <GrammarHighlightedText
                    text={segments[currentSegmentIndex].text}
                    highlightMode={highlightMode}
                    showFurigana={showFurigana}
                    onWordClick={(word: string, event: React.MouseEvent) => {
                      event.stopPropagation();
                      handleWordTap(word, segments[currentSegmentIndex].text);
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className={styles.transcriptCard}>
            <div className={styles.cardHeader}>
              <div>
                <p className={styles.pill}>{t('youtubeShadowing.player.transcript.title')}</p>
                <h2 className={styles.cardTitle}>{t('youtubeShadowing.player.tapWordsForExplanation')}</h2>
              </div>
              {source && <span className={styles.source}>{t('youtubeShadowing.player.sourceLabel', { source })}</span>}
            </div>
            <div className={styles.segmentList}>
              {segments.length === 0 && (
                <p className={styles.hint}>
                  {t('youtubeShadowing.hints.transcriptWillAppear')}
                </p>
              )}
              {segments.map((segment, index) => {
                const active = index === currentSegmentIndex;

                return (
                  <div
                    key={`${segment.start}-${index}`}
                    className={`${styles.segment} ${active ? styles.segmentActive : ""}`}
                  >
                    {/* Repeat badge - top right corner */}
                    {active && (
                      <span className={styles.repeatBadge}>
                        {currentRepeat}/{repeatCount}
                      </span>
                    )}
                    <div className={styles.segmentHeader}>
                      <button
                        className={styles.jumpButton}
                        onClick={() => seekToSegment(index)}
                        title="Jump to this segment"
                      >
                        <PlayIcon className={styles.jumpIcon} />
                      </button>
                      <div className={styles.segmentMeta}>
                        <span>
                          {index + 1}. {segment.start.toFixed(2)}s{" "}
                          {segment.end.toFixed(2)}s
                        </span>
                      </div>
                    </div>
                    <div className={styles.segmentText}>
                      <GrammarHighlightedText
                        text={segment.text}
                        highlightMode={highlightMode}
                        showFurigana={showFurigana}
                        onWordClick={(word: string, event: React.MouseEvent) => {
                          event.stopPropagation();
                          handleWordTap(word, segment.text);
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>

      {/* Floating Navbar */}
      {segments.length > 0 && (
        <div className={styles.floatingNav}>
          <button
            onClick={() => setSettingsModalOpen(true)}
            className={styles.navButton}
            aria-label={t("youtubeShadowing.settings.title")}
          >
            <Settings className="w-5 h-5" />
          </button>
          <span className={styles.navProgress}>
            {t("youtubeShadowing.player.segmentProgress", {
              current: currentSegmentIndex + 1,
              total: segments.length,
            })}{" "}
            •{" "}
            {t("youtubeShadowing.player.repeatProgress", {
              current: currentRepeat,
              total: repeatCount,
            })}
          </span>
        </div>
      )}

      {/* Settings Modal */}
      <Modal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title={t("youtubeShadowing.settings.title")}
        size="sm"
      >
        <div className="space-y-4">
          {/* Repeat Count */}
          <div className="py-3 border-b border-gray-200 dark:border-dark-700">
            <div className="flex items-center justify-between mb-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Repeat className="w-4 h-4 text-primary-500" />
                {t("youtubeShadowing.form.repeatLabel")}
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
              {t("youtubeShadowing.settings.furigana")}
            </label>
            <button
              onClick={() => setShowFurigana(!showFurigana)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                showFurigana
                  ? "bg-primary-500 text-white"
                  : "bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600"
              }`}
            >
              {showFurigana ? "On" : "Off"}
            </button>
          </div>

          {/* Grammar Highlight */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-dark-700">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Highlighter className="w-4 h-4 text-primary-500" />
              {t("youtubeShadowing.settings.highlighting")}
            </label>
            <select
              value={highlightMode}
              onChange={(e) =>
                setHighlightMode(e.target.value as HighlightMode)
              }
              className="px-3 py-1.5 border border-gray-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="none">
                {t("youtubeShadowing.settings.noHighlighting")}
              </option>
              <option value="content">
                {t("youtubeShadowing.settings.contentWords")}
              </option>
              <option value="grammar">
                {t("youtubeShadowing.settings.grammarWords")}
              </option>
              <option value="all">
                {t("youtubeShadowing.settings.allWords")}
              </option>
            </select>
          </div>

          {/* Clear Session */}
          {segments.length > 0 && (
            <div className="flex items-center justify-between py-3">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Trash2 className="w-4 h-4 text-red-500" />
                {t("youtubeShadowing.settings.clearSession")}
              </label>
              <button
                onClick={() => {
                  clearSession();
                  setSettingsModalOpen(false);
                }}
                className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
              >
                {t("youtubeShadowing.settings.clearButton")}
              </button>
            </div>
          )}
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
        onWordLookup={(word) => handleWordTap(word, wordContext || "")}
      />
      <MobileNavSpacer />
      </main>
    </div>
  );
}
