"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import YouTube, { type YouTubeProps } from "react-youtube";
import styles from "./page.module.css";
import { clampRepeatCount, extractVideoId } from "@/lib/video";
import { nextOnSegmentEnd, onRepeatCountChange } from "@/lib/shadowing/repeat";
import { useWordExplanation } from "@/hooks/useWordExplanation";
import WordExplanationModal from "@/components/word/WordExplanationModal";
import { GrammarHighlightedText } from "@/components/reading/GrammarHighlightedText";
import { PlayIcon, PauseIcon } from "@heroicons/react/24/solid";
import { useI18n } from "@/i18n/I18nContext";
import { Settings, Repeat, Type, Highlighter, ChevronDown, Trash2, Link, Play, Languages, RefreshCw, Lock, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LockScreen } from "@/components/ui/LockScreen";
import Modal from "@/components/ui/Modal";
import Dropdown from "@/components/ui/Dropdown";
import PageHeader from "@/components/ui/PageHeader";
import Navbar from "@/components/layout/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/Loading";
import ChannelBanner from "@/components/shadowing/ChannelBanner";
import YouTubeButton from "@/components/shadowing/YouTubeButton";
import { useFeature } from "@/hooks/useFeature";
import { useFeatureUsage, DesktopCircularIndicator, FeatureUsageIndicator } from "@/components/entitlements/FeatureUsageIndicator";

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
  showTranslation: boolean;
  highlightMode: HighlightMode;
}

type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
  translation?: string;
};

type TranscriptResponse = {
  segments: TranscriptSegment[];
  language?: string;
  source: string;
};

type VideoMetadata = {
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  channelId?: string;
  channelAvatarUrl?: string;
};

const PLAYER_STATES = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
} as const;

function YouTubeShadowingContent() {
  const { t } = useI18n();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { checkAndTrack } = useFeature('youtube_shadowing');
  const usageData = useFeatureUsage('youtube_shadowing');
  const [videoInput, setVideoInput] = useState("");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [language] = useState("ja");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [repeatCount, setRepeatCount] = useState(3);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [currentRepeat, setCurrentRepeat] = useState(1);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);

  // Settings state
  const [showFurigana, setShowFurigana] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);
  const [highlightMode, setHighlightMode] = useState<HighlightMode>("content");
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(true);
  const [videoLoopEnabled, setVideoLoopEnabled] = useState(false);
  const [isScreenLocked, setIsScreenLocked] = useState(false);

  // Word explanation state
  const [wordModalOpen, setWordModalOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordContext, setWordContext] = useState<string | undefined>(undefined);

  // Memoize options to avoid recreating explainWord callback on every render
  const wordExplanationOptions = useMemo(
    () => (videoId ? { videoId } : undefined),
    [videoId]
  );

  const {
    explainWord,
    loading: wordLoading,
    error: wordError,
    explanation: wordExplanation,
    reset: resetWordExplanation,
    prefetch: prefetchWordExplanations,
  } = useWordExplanation(wordExplanationOptions);

  const playerRef = useRef<YT.Player | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const repeatCountRef = useRef(repeatCount);
  const segmentIndexRef = useRef(0);
  const currentRepeatRef = useRef(1);
  const hasHydratedRef = useRef(false);
  const clearedSessionRef = useRef(false);
  const videoLoopEnabledRef = useRef(false);

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
      // When video loop is enabled, bypass segment repeat (treat as repeatCount=1)
      const effectiveRepeatCount = videoLoopEnabledRef.current ? 1 : repeatCountRef.current;

      const next = nextOnSegmentEnd({
        repeatCount: effectiveRepeatCount,
        currentRepeat: currentRepeatRef.current,
        segmentIndex: segmentIndexRef.current,
        totalSegments: segmentsRef.current.length,
      });

      // Check if we've completed all segments (last segment + no advancement)
      const isLastSegment = segmentIndexRef.current >= segmentsRef.current.length - 1;
      const completedAllSegments = isLastSegment && !next.didAdvanceSegment && next.currentRepeat === 1;

      if (completedAllSegments) {
        // In video loop mode, don't pause - let video play to natural end
        // handleStateChange will handle the restart when video ends
        if (videoLoopEnabledRef.current) {
          currentRepeatRef.current = 1;
          setCurrentRepeat(1);
          return;
        }
        // Normal mode: pause at the end
        currentRepeatRef.current = repeatCountRef.current;
        setCurrentRepeat(repeatCountRef.current);
        clearPoll();
        player.pauseVideo();
        return;
      }

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
    const playerState = event.data;
    const isNowPlaying = playerState === PLAYER_STATES.playing;
    setIsPlaying(isNowPlaying);

    if (isNowPlaying) {
      startPoll();
    } else if (playerState === PLAYER_STATES.paused) {
      clearPoll();
    } else if (playerState === PLAYER_STATES.ended) {
      clearPoll();

      // Video loop: restart from first segment when video ends naturally
      if (videoLoopEnabledRef.current && segmentsRef.current.length > 0) {
        const firstSegment = segmentsRef.current[0];
        if (firstSegment && playerRef.current) {
          // Reset segment tracking
          segmentIndexRef.current = 0;
          currentRepeatRef.current = 1;
          setCurrentSegmentIndex(0);
          setCurrentRepeat(1);

          // Seek to first segment and play
          playerRef.current.seekTo(firstSegment.start, true);
          playerRef.current.playVideo();
        }
      }
    }
  };

  const handleReady: YouTubeProps["onReady"] = (event) => {
    playerRef.current = event.target;
  };

  const fetchVideoMetadata = useCallback(async (videoId: string) => {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(
        `/api/youtube/video-info?url=${encodeURIComponent(videoUrl)}`
      );

      if (!response.ok) {
        console.warn('[MoshiPlayer] Failed to fetch video metadata');
        return;
      }

      const data = await response.json();

      if (data.success && data.video) {
        setVideoMetadata({
          title: data.video.title,
          channelTitle: data.video.channelTitle,
          thumbnailUrl: data.video.thumbnailUrl,
        });
      }
    } catch (error) {
      console.error('[MoshiPlayer] Error fetching video metadata:', error);
    }
  }, []);

  const loadTranscript = useCallback(
    async (input: string, checkQuota = true) => {
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

        // Check quota AFTER successful transcript fetch (only consume if transcript exists)
        if (checkQuota) {
          console.log('[YouTubeShadowing] Transcript found, checking quota...');
          const allowed = await checkAndTrack({ showUI: true });
          console.log('[YouTubeShadowing] Quota check result:', allowed);

          if (!allowed) {
            console.log('[YouTubeShadowing] Quota exceeded, not loading video');
            setError(t('youtubeShadowing.errors.quotaExceeded') || 'Daily limit reached');
            return;
          }
        }

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
        setVideoLoopEnabled(false); // Reset video loop when loading new video

        setStatus(
          t('youtubeShadowing.status.transcriptLoaded', {
            source: data.source.replace("-", " "),
            language: data.language || language,
          }),
        );

        if (data.segments[0] && playerRef.current) {
          playerRef.current.seekTo(data.segments[0].start, true);
        }

        // Fetch video metadata
        fetchVideoMetadata(extractedId);

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
    [language, repeatCount, t, prefetchWordExplanations, fetchVideoMetadata, checkAndTrack],
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

  // Keep videoLoopEnabled ref in sync with state
  useEffect(() => {
    videoLoopEnabledRef.current = videoLoopEnabled;
  }, [videoLoopEnabled]);


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
      if (parsed.videoId) {
        setVideoId(parsed.videoId);
        // Fetch metadata for restored video
        fetchVideoMetadata(parsed.videoId);
      }
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
      if (typeof parsed.showTranslation === "boolean") setShowTranslation(parsed.showTranslation);
      if (parsed.highlightMode) setHighlightMode(parsed.highlightMode);

      hasHydratedRef.current = true;
      console.log(`[MoshiPlayer] Restored session: ${parsed.segments?.length || 0} segments`);
    } catch (err) {
      console.warn("[MoshiPlayer] Failed to restore session:", err);
      hasHydratedRef.current = true;
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  // Handle URL params (from my-videos or external links)
  useEffect(() => {
    if (!hasHydratedRef.current) return;

    const urlParam = searchParams.get("url");
    const fromHistory = searchParams.get("fromHistory") === "true";

    if (clearedSessionRef.current) {
      clearedSessionRef.current = false;
      return;
    }

    if (urlParam) {
      const extractedId = extractVideoId(urlParam);

      // Only load if it's a different video or coming from history
      if (extractedId && (fromHistory || extractedId !== videoId)) {
        console.log(`[MoshiPlayer] Loading video from URL param: ${extractedId}`);
        setVideoInput(urlParam);
        void loadTranscript(urlParam);
      }
    }
  }, [searchParams, loadTranscript, videoId]);

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
      showTranslation,
      highlightMode,
    };

    try {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch (err) {
      console.warn("[MoshiPlayer] Failed to save session:", err);
    }
  }, [videoInput, videoId, segments, source, currentSegmentIndex, currentRepeat, repeatCount, showFurigana, showTranslation, highlightMode]);

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
    setVideoMetadata(null);
    clearedSessionRef.current = true;

    // Remove URL params to avoid auto-reloading a cleared session
    if (typeof window !== "undefined" && pathname) {
      router.replace(pathname);
    }

    console.log("[MoshiPlayer] Session cleared");
  }, [pathname, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
      <Navbar user={user} showUserMenu={true} />

      <PageHeader

        title={t('youtubeShadowing.header.title')}
        description={t('youtubeShadowing.header.subtitle')}
        subtitle={t('youtubeShadowing.header.eyebrow')}
        backHref="/dashboard"
        actions={
          usageData.hasData ? (
            <DesktopCircularIndicator
              remaining={usageData.remaining}
              limitCount={usageData.limitCount}
              usedCount={usageData.usedCount}
              color={usageData.color}
            />
          ) : null
        }
      />

      <FeatureUsageIndicator featureId="youtube_shadowing" />

      <main className={styles.mainContainer}>
        <div className={styles.primaryLayout}>
          <div className={styles.leftColumn}>
            {/* Channel Banner - conditionally displayed */}
            {videoMetadata && (
              <ChannelBanner
                channelTitle={videoMetadata.channelTitle}
                videoTitle={videoMetadata.title}
                channelAvatarUrl={videoMetadata.channelAvatarUrl}
              />
            )}

            {/* Video Section */}
            <div className={styles.videoSection}>
              <div className={styles.playerFrame}>
                {videoId ? (
                  <YouTube
                    videoId={videoId}
                    opts={opts}
                    onReady={handleReady}
                    onStateChange={handleStateChange}
                    className={styles.youtubeIframe}
                    iframeClassName={styles.youtubeIframe}
                  />
                ) : (
                  <div className={styles.placeholder}>
                    {t('youtubeShadowing.hints.pasteToStart')}
                  </div>
                )}
              </div>

              {/* YouTube Button - small pill on left side */}
              {videoId && (
                <div className={styles.youtubeButtonWrapper}>
                  <YouTubeButton videoId={videoId} />
                </div>
              )}
            </div>

            {/* Current Segment Card - Hero Style */}
            <div className={styles.currentSegmentCard}>
              {segments.length > 0 && segments[currentSegmentIndex] ? (
                <div className={styles.cardContent}>
                  <div className={styles.cardHeader}>
                    <span className={styles.segmentCounter}>
                      {t('youtubeShadowing.player.segmentProgress', { current: currentSegmentIndex + 1, total: segments.length })}
                    </span>
                    <span className={styles.repeatCounter}>
                      <Repeat className="w-3 h-3" />
                      {currentRepeat}/{repeatCount}
                    </span>
                  </div>

                  <div className={styles.heroText}>
                    <GrammarHighlightedText
                      text={segments[currentSegmentIndex].text}
                      highlightMode={highlightMode}
                      showFurigana={showFurigana}
                      onWordClick={(word: string, event: React.MouseEvent) => {
                        event.stopPropagation();
                        handleWordTap(word, segments[currentSegmentIndex].text);
                      }}
                      className={styles.largeText}
                    />
                  </div>

                  {showTranslation && segments[currentSegmentIndex]?.translation && (
                    <p className="text-base text-gray-500 dark:text-gray-400 mt-1 italic text-center">
                      {segments[currentSegmentIndex].translation}
                    </p>
                  )}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p>{t('youtubeShadowing.hints.transcriptWillAppear')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Transcript List */}
          <div className={styles.transcriptColumn}>
            <div className={styles.transcriptListSection}>
              {segments.length > 0 && (
                <h3 className={styles.listTitle}>{t('youtubeShadowing.player.transcript.title')}</h3>
              )}
              <div className={`${styles.segmentList} scrollbar-hide`}>
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
                            {index + 1}. {segment.start.toFixed(2)}s – {segment.end.toFixed(2)}s
                          </span>
                        </div>
                      </div>
                      <div className={styles.segmentTextSmall}>
                        <GrammarHighlightedText
                          text={segment.text}
                          highlightMode={highlightMode}
                          showFurigana={showFurigana}
                          onWordClick={(word, e) => {
                            e.stopPropagation();
                            handleWordTap(word, segment.text);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* URL Input Form - Card Style */}
        {!segments.length && (
          <form className={styles.controls} onSubmit={handleSubmit}>
            <div className={styles.loadVideoCard}>
              <div className={styles.loadVideoHeader}>
                <div className={styles.loadVideoIcon}>
                  <Play className="w-5 h-5" />
                </div>
                <div>
                  <h3 className={styles.loadVideoTitle}>{t('youtubeShadowing.form.cardTitle')}</h3>
                  <p className={styles.loadVideoSubtitle}>{t('youtubeShadowing.form.cardSubtitle')}</p>
                </div>
              </div>
              <div className={styles.urlRow}>
                <div className={styles.inputWrapper}>
                  <Link className={`w-4 h-4 ${styles.inputIcon}`} />
                  <input
                    ref={urlInputRef}
                    id="video"
                    name="video"
                    className={styles.urlInput}
                    placeholder={t('youtubeShadowing.form.videoPlaceholder')}
                    value={videoInput}
                    onChange={(e) => setVideoInput(e.target.value)}
                  />
                  <AnimatePresence>
                    {videoInput && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        type="button"
                        onClick={() => {
                          setVideoInput("");
                          urlInputRef.current?.focus();
                        }}
                        className={styles.clearButton}
                        aria-label={t('common.clear')}
                      >
                        <X className="w-4 h-4" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
                <button
                  className={styles.loadButton}
                  type="submit"
                  disabled={loadingTranscript}
                >
                  {loadingTranscript ? (
                    <span className={styles.loadingSpinner} />
                  ) : (
                    t('youtubeShadowing.form.loadButton')
                  )}
                </button>
              </div>
              {(error || status) && (
                <div className={styles.statusBar}>
                  {error ? <span className={styles.error}>{error}</span> : <span className={styles.status}>{status}</span>}
                </div>
              )}
            </div>
          </form>
        )}
      </main>

      {/* Sticky Bottom Control Bar */}
      {segments.length > 0 && (
        <div className={styles.bottomControlBar}>
          <div className={styles.controlBarInner}>

            {/* Previous / Replay */}
            <button
              className={styles.controlBtn}
              onClick={() => seekToSegment(Math.max(0, currentSegmentIndex - 1))}
            >
              <ChevronDown className="w-6 h-6 rotate-90" /> {/* Left Icon */}
              <span className="text-[10px] uppercase font-bold mt-1">Prev</span>
            </button>

            {/* Play/Pause - Prominent */}
            <button
              className={styles.playBtnLarge}
              onClick={() => {
                const player = playerRef.current;
                if (!player) return;
                // If currently playing (state is true), we pause. Otherwise play.
                isPlaying ? player.pauseVideo() : player.playVideo();
              }}
            >
              {isPlaying ? (
                <PauseIcon className="w-8 h-8 text-white" />
              ) : (
                <PlayIcon className="w-8 h-8 text-white ml-1" />
              )}
            </button>

            {/* Next */}
            <button
              className={styles.controlBtn}
              onClick={() => seekToSegment(Math.min(segments.length - 1, currentSegmentIndex + 1))}
            >
              <ChevronDown className="w-6 h-6 -rotate-90" /> {/* Right Icon */}
              <span className="text-[10px] uppercase font-bold mt-1">Next</span>
            </button>


            {/* Settings Toggle */}
            <button
              className={styles.controlBtn}
              onClick={() => setSettingsModalOpen(true)}
            >
              <Settings className="w-6 h-6" />
              <span className="text-[10px] uppercase font-bold mt-1">Settings</span>
            </button>

          </div>
        </div>
      )}

      {/* Settings Modal (Unchanged) */}
      <Modal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        title={t("youtubeShadowing.settings.title")}
        size="sm"
      >
        <div className="space-y-4">
          {/* Video Loop Toggle */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-dark-700">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <RefreshCw className="w-4 h-4 text-primary-500" />
              {t("youtubeShadowing.settings.videoLoop")}
            </label>
            <button
              onClick={() => setVideoLoopEnabled(!videoLoopEnabled)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${videoLoopEnabled
                ? "bg-primary-500 text-white"
                : "bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600"
                }`}
            >
              {videoLoopEnabled ? "On" : "Off"}
            </button>
          </div>

          {/* Lock Screen Button - only shown when loop is on and screen is unlocked */}
          {videoLoopEnabled && !isScreenLocked && (
            <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-dark-700">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Lock className="w-4 h-4 text-primary-500" />
                {t("youtubeShadowing.lockScreen.lockButton")}
              </label>
              <button
                onClick={() => {
                  setIsScreenLocked(true);
                  setSettingsModalOpen(false);
                }}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Repeat Count - disabled when video loop is on */}
          <div className={`py-3 border-b border-gray-200 dark:border-dark-700 ${videoLoopEnabled ? "opacity-50" : ""}`}>
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
              disabled={videoLoopEnabled}
              className="w-full h-2 bg-gray-200 dark:bg-dark-600 rounded-lg appearance-none cursor-pointer accent-primary-500 disabled:cursor-not-allowed"
            />
            {videoLoopEnabled && (
              <p className="text-xs text-gray-400 mt-2 italic">
                {t("youtubeShadowing.settings.repeatDisabledByLoop")}
              </p>
            )}
          </div>

          {/* Furigana Toggle */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-dark-700">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Type className="w-4 h-4 text-primary-500" />
              {t("youtubeShadowing.settings.furigana")}
            </label>
            <button
              onClick={() => setShowFurigana(!showFurigana)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${showFurigana
                ? "bg-primary-500 text-white"
                : "bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600"
                }`}
            >
              {showFurigana ? "On" : "Off"}
            </button>
          </div>

          {/* Translation Toggle */}
          <div className="flex items-center justify-between py-3 border-b border-gray-200 dark:border-dark-700">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Languages className="w-4 h-4 text-primary-500" />
              {t("youtubeShadowing.settings.translation")}
            </label>
            <button
              onClick={() => setShowTranslation(!showTranslation)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${showTranslation
                ? "bg-primary-500 text-white"
                : "bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600"
                }`}
            >
              {showTranslation ? "On" : "Off"}
            </button>
          </div>

          {/* Highlight Mode */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-3 border-b border-gray-200 dark:border-dark-700">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              <Highlighter className="w-4 h-4 text-primary-500" />
              {t("youtubeShadowing.settings.highlighting")}
            </label>
            <Dropdown
              value={highlightMode}
              onChange={(value) => setHighlightMode(value as HighlightMode)}
              size="small"
              options={[
                { value: "none", label: t("youtubeShadowing.settings.noHighlighting") },
                { value: "content", label: t("youtubeShadowing.settings.contentWords") },
                { value: "grammar", label: t("youtubeShadowing.settings.grammarWords") },
                { value: "all", label: t("youtubeShadowing.settings.allWords") },
              ]}
            />
          </div>

          {/* Clear Session */}
          <div className="flex items-center justify-between py-3">
            <button
              onClick={() => {
                clearSession();
                setSettingsModalOpen(false);
              }}
              className="w-full py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {t("youtubeShadowing.settings.clearSession")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Word Explanation Modal (Unchanged) */}
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

      {/* Lock Screen for pocket mode */}
      <LockScreen
        isLocked={isScreenLocked && videoLoopEnabled}
        onUnlock={() => {
          setIsScreenLocked(false);
          setVideoLoopEnabled(false);
        }}
        title={t("youtubeShadowing.lockScreen.title")}
        unlockText={t("youtubeShadowing.lockScreen.tapToUnlock")}
      />

    </div>
  );
}

// Wrap in Suspense for useSearchParams compatibility with Next.js 15
export default function YouTubeShadowingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background-light via-japanese-mizu/10 to-japanese-sakura/10 dark:from-dark-900 dark:via-dark-850 dark:to-dark-800">
        <LoadingSpinner size="large" />
      </div>
    }>
      <YouTubeShadowingContent />
    </Suspense>
  );
}
