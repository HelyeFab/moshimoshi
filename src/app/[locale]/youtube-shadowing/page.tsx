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
import { Settings, Repeat, Type, Highlighter, ChevronDown, Trash2, Link, Play, Languages, RefreshCw, Lock, X, Sparkles, MoreVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LockScreen } from "@/components/ui/LockScreen";
import Modal from "@/components/ui/Modal";
import Dropdown from "@/components/ui/Dropdown";
import SettingsDropdown from "@/components/ui/SettingsDropdown";
import PageHeader from "@/components/ui/PageHeader";
import Navbar from "@/components/layout/Navbar";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/Loading";
import ChannelBanner from "@/components/shadowing/ChannelBanner";
import YouTubeButton from "@/components/shadowing/YouTubeButton";
import { useFeature } from "@/hooks/useFeature";
import { useFeatureUsage, DesktopCircularIndicator, FeatureUsageIndicator } from "@/components/entitlements/FeatureUsageIndicator";
import MobileNavSpacer from "@/components/layout/MobileNavSpacer";
import { useYouTubePracticeTracking } from "@/hooks/useYouTubePracticeTracking";
import { useToast } from "@/components/ui/Toast";
import { hasSeenWordLookup } from "@/utils/wordLookupSeen";
import { useSubscription } from "@/hooks/useSubscription";
import { isFeatureEnabled } from "@/lib/features/featureFlags";
import { verifySeekLanding, calculateSegmentBuffers } from "@/utils/youtubePlayerUtils";

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

const SEGMENT_EPSILON_SECONDS = 0.02;
const MIN_SEGMENT_DURATION_SECONDS = 0.2;
const TIMING_NUDGE_SECONDS = 0.05;

function normalizeSegmentsForPlayback(segments: TranscriptSegment[]): TranscriptSegment[] {
  if (!Array.isArray(segments) || segments.length === 0) return [];
  const ordered = segments
    .map((seg) => ({
      ...seg,
      start: Number.isFinite(seg.start) ? seg.start : 0,
      end: Number.isFinite(seg.end)
        ? seg.end
        : (Number.isFinite(seg.start) ? seg.start + MIN_SEGMENT_DURATION_SECONDS : MIN_SEGMENT_DURATION_SECONDS),
    }))
    .sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      return a.end - b.end;
    });

  const normalized: TranscriptSegment[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const prev = normalized[i - 1];
    const current = ordered[i];
    const next = ordered[i + 1];

    let start = current.start;
    let end = current.end;

    if (prev && start < prev.end) {
      start = prev.end + SEGMENT_EPSILON_SECONDS;
    }

    if (next && end > next.start) {
      end = next.start - SEGMENT_EPSILON_SECONDS;
    }

    if (end <= start) {
      end = start + MIN_SEGMENT_DURATION_SECONDS;
    }

    normalized.push({
      ...current,
      start,
      end,
    });
  }

  return normalized;
}

function joinSegmentTexts(left: string, right: string): string {
  const trimmedLeft = left.trimEnd();
  const trimmedRight = right.trimStart();
  const shouldInsertSpace = /[A-Za-z0-9]$/.test(trimmedLeft) && /^[A-Za-z0-9]/.test(trimmedRight);
  return shouldInsertSpace ? `${trimmedLeft} ${trimmedRight}` : `${trimmedLeft}${trimmedRight}`;
}

function findSplitIndexForText(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed.length < 4) return null;

  const punctuationMatches = [...trimmed.matchAll(/[。！？!?、]/g)];
  if (punctuationMatches.length > 0) {
    const midpoint = Math.floor(trimmed.length / 2);
    const best = punctuationMatches.reduce((acc, match) => {
      const idx = (match.index ?? 0) + 1;
      return Math.abs(idx - midpoint) < Math.abs(acc - midpoint) ? idx : acc;
    }, (punctuationMatches[0].index ?? 0) + 1);
    if (best >= 2 && best <= trimmed.length - 2) return best;
  }

  const midpoint = Math.floor(trimmed.length / 2);
  if (midpoint >= 2 && midpoint <= trimmed.length - 2) return midpoint;
  return null;
}

function cloneSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.map(segment => ({ ...segment }));
}

function tokenizeForBoundaryAdjust(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  try {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
    const parts = Array.from(segmenter.segment(trimmed))
      .map((part: any) => String(part.segment ?? ''))
      .filter(Boolean);
    if (parts.length > 0) return parts;
  } catch {
    // Fallback handled below
  }

  if (/\s/.test(trimmed)) {
    return trimmed.split(/\s+/).filter(Boolean);
  }

  return Array.from(trimmed);
}

function splitLeadingTokens(text: string, count: number): { token: string; remainder: string } | null {
  const tokens = tokenizeForBoundaryAdjust(text);
  if (!tokens.length) return null;
  const safeCount = Math.max(1, Math.min(count, tokens.length - 1));
  const token = tokens.slice(0, safeCount).join('');
  const remainder = text.trim().slice(token.length).trimStart();
  if (!remainder) return null;
  return { token: token.trim(), remainder };
}

function splitTrailingTokens(text: string, count: number): { token: string; remainder: string } | null {
  const tokens = tokenizeForBoundaryAdjust(text);
  if (!tokens.length) return null;
  const safeCount = Math.max(1, Math.min(count, tokens.length - 1));
  const token = tokens.slice(tokens.length - safeCount).join('');
  const trimmed = text.trim();
  const remainder = trimmed.slice(0, Math.max(0, trimmed.length - token.length)).trimEnd();
  if (!remainder) return null;
  return { token: token.trim(), remainder };
}

type VideoMetadata = {
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  channelId?: string;
  channelAvatarUrl?: string;
  durationInSeconds?: number;
};

const PLAYER_STATES = {
  unstarted: -1,
  ended: 0,
  playing: 1,
  paused: 2,
  buffering: 3,
  cued: 5,
} as const;

// SYNC_PRECISION_V2: evaluated once at module load, not per-render
const SYNC_V2 = isFeatureEnabled('SYNC_PRECISION_V2');
const POLL_INTERVAL_MS = SYNC_V2 ? 100 : 250;
const REENTRY_DELAY_MS = 50;
const MIN_TRIGGER_BUFFER_SEC = 0.28;
const SHORT_NEXT_SEGMENT_TRIGGER_BUFFER_SEC = 0.45;
const LONG_SEGMENT_TRIGGER_BUFFER_SEC = 1.15;
const LONG_TO_SHORT_TRIGGER_BUFFER_SEC = 1.35;
const MAX_TRIGGER_BUFFER_RATIO = 0.35;

function YouTubeShadowingContent() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { checkAndTrack } = useFeature('youtube_shadowing');
  const { checkOnly: checkWordLookupOnly } = useFeature('word_lookup');
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
  const [currentTime, setCurrentTime] = useState(0);
  const [repeatCount, setRepeatCount] = useState(3);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [currentRepeat, setCurrentRepeat] = useState(1);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [featuredVideo, setFeaturedVideo] = useState<{
    videoId: string;
    videoUrl: string;
    videoTitle: string;
    channelName: string;
    thumbnailUrl: string;
    description: string;
  } | null>(null);

  // Settings state
  const [showFurigana, setShowFurigana] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);
  const [highlightMode, setHighlightMode] = useState<HighlightMode>("content");
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(true);
  const [videoLoopEnabled, setVideoLoopEnabled] = useState(false);
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [translationInFlight, setTranslationInFlight] = useState<Set<string>>(() => new Set());
  const [resegmenting, setResegmenting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [overrideDirty, setOverrideDirty] = useState(false);
  const [savingOverrides, setSavingOverrides] = useState(false);
  const [resettingOverrides, setResettingOverrides] = useState(false);
  const [splitCursorByIndex, setSplitCursorByIndex] = useState<Record<number, number>>({});
  const [canUndo, setCanUndo] = useState(false);
  const repeatCountDisplay = videoLoopEnabled ? 1 : repeatCount;
  const currentRepeatDisplay = videoLoopEnabled ? 1 : currentRepeat;
  const trackFeaturedClick = useCallback(() => {
    if (!featuredVideo) return;
    void fetch('/api/analytics/content-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'video',
        contentId: featuredVideo.videoId,
        title: featuredVideo.videoTitle,
        url: featuredVideo.videoUrl,
        source: 'youtube_shadowing_featured',
      }),
    }).catch(() => {});
  }, [featuredVideo]);

  useEffect(() => {
    const fetchFeaturedVideo = async () => {
      try {
        const response = await fetch('/api/youtube/featured');
        if (!response.ok) return;
        const data = await response.json();
        setFeaturedVideo(data.featured || null);
      } catch (err) {
        setFeaturedVideo(null);
      }
    };

    fetchFeaturedVideo();
  }, []);

  // Word explanation state
  const [wordModalOpen, setWordModalOpen] = useState(false);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [wordContext, setWordContext] = useState<string | undefined>(undefined);

  // Memoize options to avoid recreating explainWord callback on every render
  const wordExplanationOptions = useMemo(
    () => (videoId ? { youtubeId: videoId } : undefined),
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
  const translationPollRef = useRef<NodeJS.Timeout | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const repeatCountRef = useRef(repeatCount);
  const segmentIndexRef = useRef(0);
  const currentRepeatRef = useRef(1);
  const hasHydratedRef = useRef(false);
  const clearedSessionRef = useRef(false);
  const videoLoopEnabledRef = useRef(false);
  const translationRequestRef = useRef<{ videoId: string; startedAt: number } | null>(null);
  const translationInFlightRef = useRef<Set<string>>(new Set());
  const furiganaHintShownRef = useRef(false);
  const reentryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const baselineSegmentsRef = useRef<TranscriptSegment[]>([]);
  const editHistoryRef = useRef<TranscriptSegment[][]>([]);

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

  const videoUrl = useMemo(() => {
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
  }, [videoId]);

  const clearReentryTimeout = useCallback(() => {
    if (reentryTimeoutRef.current) {
      clearTimeout(reentryTimeoutRef.current);
      reentryTimeoutRef.current = null;
    }
  }, []);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    clearReentryTimeout();
  }, [clearReentryTimeout]);

  const clearTranslationPoll = useCallback(() => {
    if (translationPollRef.current) {
      clearInterval(translationPollRef.current);
      translationPollRef.current = null;
    }
  }, []);

  const seekToSegment = useCallback(
    (index: number) => {
      const player = playerRef.current;
      const segment = segmentsRef.current[index];

      if (!player || !segment) return;

      // Cancel any pending re-entry from previous segment
      clearReentryTimeout();

      segmentIndexRef.current = index;
      currentRepeatRef.current = 1;
      setCurrentSegmentIndex(index);
      setCurrentRepeat(1);

      player.seekTo(segment.start, true);
      player.playVideo();

      // SYNC_V2: fire-and-forget seek verification (no perceived latency)
      if (SYNC_V2) {
        void verifySeekLanding(player, segment.start);
      }
    },
    [setCurrentSegmentIndex, clearReentryTimeout],
  );

  const evaluatePlayback = useCallback(() => {
    const player = playerRef.current;
    const segment = segmentsRef.current[segmentIndexRef.current];

    if (!player || !segment) return;

    const currentTime = player.getCurrentTime();
    setCurrentTime(currentTime);

    // SYNC_V2: adaptive buffer based on segment duration and playback rate
    let segmentEnd: number;
    if (SYNC_V2) {
      const segmentDuration = segment.end - segment.start;
      const playbackRate = player.getPlaybackRate?.() ?? 1.0;
      const { triggerBuffer } = calculateSegmentBuffers(segmentDuration, playbackRate);
      const nextSegment = segmentsRef.current[segmentIndexRef.current + 1];
      const nextDuration = nextSegment ? (nextSegment.end - nextSegment.start) : null;
      const nextIsShort = nextDuration != null && nextDuration <= 3.0;
      const currentIsLong = segmentDuration >= 6.0;
      let minBuffer = nextIsShort
        ? SHORT_NEXT_SEGMENT_TRIGGER_BUFFER_SEC
        : MIN_TRIGGER_BUFFER_SEC;
      if (currentIsLong) {
        minBuffer = Math.max(
          minBuffer,
          nextIsShort ? LONG_TO_SHORT_TRIGGER_BUFFER_SEC : LONG_SEGMENT_TRIGGER_BUFFER_SEC
        );
      }
      const cappedMaxBuffer = Math.max(
        MIN_TRIGGER_BUFFER_SEC,
        segmentDuration * MAX_TRIGGER_BUFFER_RATIO
      );
      const safeTriggerBuffer = Math.min(
        Math.max(triggerBuffer, minBuffer),
        cappedMaxBuffer
      );
      segmentEnd = Math.max(segment.end - safeTriggerBuffer, segment.start + 0.05);
    } else {
      segmentEnd = Math.max(segment.end - 0.08, segment.start + 0.05);
    }

    if (currentTime >= segmentEnd) {
      // Hard stop at boundary to avoid audible spill into the next segment
      // while async seek verification is running.
      player.pauseVideo();

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
        // SYNC_V2: re-entry stabilization with settle delay + seek verification
        if (SYNC_V2) {
          const expectedSegmentIndex = next.segmentIndex;
          player.seekTo(target.start, true);
          clearReentryTimeout();
          reentryTimeoutRef.current = setTimeout(() => {
            reentryTimeoutRef.current = null;
            // Guard: only resume if we're still on the expected segment and poll is active
            if (segmentIndexRef.current !== expectedSegmentIndex || !pollRef.current) return;
            void verifySeekLanding(player, target.start).then(() => {
              // Re-check after async verification — state may have changed
              if (segmentIndexRef.current !== expectedSegmentIndex || !pollRef.current) return;
              player.playVideo();
            });
          }, REENTRY_DELAY_MS);
        } else {
          player.seekTo(target.start, true);
          player.playVideo();
        }
      } else {
        clearPoll();
      }
    }
  }, [clearPoll, clearReentryTimeout]);

  const startPoll = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(evaluatePlayback, POLL_INTERVAL_MS);
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
          const p = playerRef.current;
          p.seekTo(firstSegment.start, true);
          p.playVideo();

          // SYNC_V2: verify seek landing on loop restart
          if (SYNC_V2) {
            void verifySeekLanding(p, firstSegment.start);
          }
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
          durationInSeconds: data.video.durationInSeconds,
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
          `/api/youtube/transcript/${encodeURIComponent(extractedId)}`,
        );

        if (!response.ok) {
          const details = await response.json().catch(() => ({}));
          throw new Error(
            details.error || t('youtubeShadowing.errors.transcriptUnavailable'),
          );
        }

        const data = (await response.json()) as TranscriptResponse;

        // 🎯 Highlight which transcript source was used
        console.log(
          `%c 📹 TRANSCRIPT SOURCE: ${data.source?.toUpperCase() || 'UNKNOWN'} %c`,
          'background: #ef4444; color: white; font-size: 14px; font-weight: bold; padding: 4px 8px; border-radius: 4px;',
          ''
        );
        console.log(
          `%c Segments: ${data.segments?.length || 0} | Language: ${data.language || 'unknown'} %c`,
          'background: #374151; color: #ef4444; font-size: 12px; padding: 2px 8px; border-radius: 2px;',
          ''
        );

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

        const normalizedSegments = normalizeSegmentsForPlayback(data.segments);
        setVideoId(extractedId);
        setSegments(normalizedSegments);
        segmentsRef.current = normalizedSegments;
        segmentIndexRef.current = 0;
        currentRepeatRef.current = 1;
        repeatCountRef.current = repeatCount;
        setCurrentSegmentIndex(0);
        setCurrentRepeat(1);
        setSource(data.source);
        setShowUrlInput(false); // Auto-collapse form after successful load
        setVideoLoopEnabled(false); // Reset video loop when loading new video
        setEditMode(false);
        setOverrideDirty(false);
        setSplitCursorByIndex({});
        baselineSegmentsRef.current = cloneSegments(normalizedSegments);
        editHistoryRef.current = [];
        setCanUndo(false);

        setStatus(
          t('youtubeShadowing.status.transcriptLoaded', {
            source: data.source.replace("-", " "),
            language: data.language || language,
          }),
        );

        if (normalizedSegments[0] && playerRef.current) {
          playerRef.current.seekTo(normalizedSegments[0].start, true);

          // SYNC_V2: verify initial transcript seek landing
          if (SYNC_V2) {
            void verifySeekLanding(playerRef.current, normalizedSegments[0].start);
          }
        }

        // Fetch video metadata
        fetchVideoMetadata(extractedId);

        // Prefetch word explanations - prioritize first segments for instant response
        const PRIORITY_SEGMENTS = 3; // Precompute first 3 segments immediately
        const prioritySegments = normalizedSegments.slice(0, PRIORITY_SEGMENTS);
        const remainingSegments = normalizedSegments.slice(PRIORITY_SEGMENTS);

        const priorityText = prioritySegments.map((s) => s.text).join(" ");
        const remainingText = remainingSegments.map((s) => s.text).join(" ");

        console.log('[YouTubeShadowing] Prefetch word explanations (priority)', {
          videoId: extractedId,
          contentType: 'youtube',
          prioritySegments: prioritySegments.length,
          priorityTextLength: priorityText.length,
          remainingSegments: remainingSegments.length,
        });

        // 1. Priority: First 3 segments - user needs these immediately
        prefetchWordExplanations({
          contentId: extractedId,
          contentType: "youtube",
          text: priorityText,
        });

        // 2. Background: Remaining segments - precompute while user watches
        if (remainingText.trim()) {
          // Small delay to let priority batch start first
          setTimeout(() => {
            console.log('[YouTubeShadowing] Prefetch word explanations (background)', {
              videoId: extractedId,
              remainingTextLength: remainingText.length,
            });
            prefetchWordExplanations({
              contentId: extractedId,
              contentType: "youtube",
              text: remainingText,
              background: true, // Allow running while priority batch is still generating
            });
          }, 2000);
        }
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

  const handleResegment = useCallback(async () => {
    if (!videoId || !segmentsRef.current.length || resegmenting) return;

    setResegmenting(true);
    setStatus("Resegmenting transcript...");
    setError(null);

    try {
      const response = await fetch("/api/youtube/resegment?forceRefresh=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          segments: segmentsRef.current.map((seg) => ({
            text: seg.text,
            start: seg.start,
            end: seg.end,
          })),
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !Array.isArray(data?.segments)) {
        throw new Error(data?.message || "Resegmentation failed");
      }

      const nextSegments = normalizeSegmentsForPlayback(data.segments.map(
        (seg: { text: string; start: number; end: number }) => ({
          text: seg.text,
          start: seg.start,
          end: seg.end,
        }),
      ));

      if (!nextSegments.length) {
        throw new Error("Resegmentation returned no segments");
      }

      const nextIndex = Math.min(segmentIndexRef.current, nextSegments.length - 1);
      setSegments(nextSegments);
      segmentsRef.current = nextSegments;
      segmentIndexRef.current = nextIndex;
      currentRepeatRef.current = 1;
      setCurrentSegmentIndex(nextIndex);
      setCurrentRepeat(1);

      const target = nextSegments[nextIndex];
      if (target && playerRef.current) {
        playerRef.current.seekTo(target.start, true);
        if (SYNC_V2) {
          void verifySeekLanding(playerRef.current, target.start);
        }
      }

      const sourceLabel = data.source || "deterministic";
      const fallbackReason = data.fallbackReason || "none";
      const providerAttempted = data.providerAttempted || "unknown";
      setStatus(
        sourceLabel === "ai"
          ? `Resegmentation complete (ai via ${providerAttempted}).`
          : `Resegmentation complete (deterministic: ${fallbackReason}, provider: ${providerAttempted}).`,
      );
      showToast(
        sourceLabel === "ai"
          ? `AI resegmentation complete (${providerAttempted}).`
          : `Deterministic fallback: ${fallbackReason} (${providerAttempted}).`,
        sourceLabel === "ai" ? "success" : "warning",
      );
      setOverrideDirty(false);
      setSplitCursorByIndex({});
      baselineSegmentsRef.current = cloneSegments(nextSegments);
      editHistoryRef.current = [];
      setCanUndo(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Resegmentation failed";
      setError(message);
      showToast(message, "warning");
    } finally {
      setResegmenting(false);
    }
  }, [videoId, resegmenting, showToast]);

  const applyEditedSegments = useCallback(
    (nextSegments: TranscriptSegment[], requestedIndex: number, options?: { recordHistory?: boolean }) => {
      const normalized = normalizeSegmentsForPlayback(nextSegments);
      if (!normalized.length) return;
      const recordHistory = options?.recordHistory !== false;
      if (recordHistory && segmentsRef.current.length > 0) {
        editHistoryRef.current.push(cloneSegments(segmentsRef.current));
        if (editHistoryRef.current.length > 50) {
          editHistoryRef.current.shift();
        }
        setCanUndo(editHistoryRef.current.length > 0);
      }

      const boundedIndex = Math.max(0, Math.min(requestedIndex, normalized.length - 1));
      setSegments(normalized);
      segmentsRef.current = normalized;
      segmentIndexRef.current = boundedIndex;
      setCurrentSegmentIndex(boundedIndex);
      currentRepeatRef.current = 1;
      setCurrentRepeat(1);
      setOverrideDirty(true);

      const target = normalized[boundedIndex];
      if (target && playerRef.current) {
        playerRef.current.seekTo(target.start, true);
        if (SYNC_V2) {
          void verifySeekLanding(playerRef.current, target.start);
        }
      }
    },
    []
  );

  const handleSplitSegment = useCallback(
    (index: number) => {
      const current = segmentsRef.current[index];
      if (!current) return;

      const cursorIndex = splitCursorByIndex[index];
      const cursorSplitValid =
        typeof cursorIndex === 'number' &&
        cursorIndex >= 2 &&
        cursorIndex <= current.text.trim().length - 2;
      const splitIndex = cursorSplitValid ? cursorIndex : findSplitIndexForText(current.text);
      if (splitIndex == null) {
        showToast("Unable to split this segment automatically.", "warning");
        return;
      }

      const segmentDuration = current.end - current.start;
      if (segmentDuration <= MIN_SEGMENT_DURATION_SECONDS * 2) {
        showToast("Segment is too short to split safely.", "warning");
        return;
      }

      const text = current.text.trim();
      const leftText = text.slice(0, splitIndex).trim();
      const rightText = text.slice(splitIndex).trim();
      if (!leftText || !rightText) {
        showToast("Split would create an empty segment.", "warning");
        return;
      }

      const rawRatio = splitIndex / text.length;
      const ratio = Math.max(0.2, Math.min(0.8, rawRatio));
      const splitTime = current.start + segmentDuration * ratio;
      const safeSplitTime = Math.min(
        current.end - MIN_SEGMENT_DURATION_SECONDS,
        Math.max(current.start + MIN_SEGMENT_DURATION_SECONDS, splitTime)
      );

      const next = [...segmentsRef.current];
      next.splice(index, 1, {
        ...current,
        text: leftText,
        end: safeSplitTime,
      }, {
        ...current,
        text: rightText,
        start: safeSplitTime,
      });

      const selectedIndex = segmentIndexRef.current > index
        ? segmentIndexRef.current + 1
        : segmentIndexRef.current;
      applyEditedSegments(next, selectedIndex);
    },
    [applyEditedSegments, showToast, splitCursorByIndex]
  );

  const handleSegmentTextChange = useCallback((index: number, text: string) => {
    if (!segmentsRef.current[index]) return;
    editHistoryRef.current.push(cloneSegments(segmentsRef.current));
    if (editHistoryRef.current.length > 50) {
      editHistoryRef.current.shift();
    }
    setCanUndo(editHistoryRef.current.length > 0);
    const next = [...segmentsRef.current];
    next[index] = { ...next[index], text };
    setSegments(next);
    segmentsRef.current = next;
    setOverrideDirty(true);
  }, []);

  const handleBoundaryTakeFromNext = useCallback(
    (index: number, tokenCount: number = 1) => {
      if (index >= segmentsRef.current.length - 1) return;
      const current = segmentsRef.current[index];
      const nextSegment = segmentsRef.current[index + 1];
      if (!current || !nextSegment) return;

      const nextSplit = splitLeadingTokens(nextSegment.text, tokenCount);
      if (!nextSplit || !nextSplit.token || !nextSplit.remainder) {
        showToast("Cannot move boundary from next segment.", "warning");
        return;
      }

      const updatedCurrent = {
        ...current,
        text: joinSegmentTexts(current.text, nextSplit.token),
      };
      const updatedNext = {
        ...nextSegment,
        text: nextSplit.remainder,
      };

      const next = [...segmentsRef.current];
      next[index] = updatedCurrent;
      next[index + 1] = updatedNext;
      applyEditedSegments(next, segmentIndexRef.current);
    },
    [applyEditedSegments, showToast]
  );

  const handleBoundaryGiveToNext = useCallback(
    (index: number, tokenCount: number = 1) => {
      if (index >= segmentsRef.current.length - 1) return;
      const current = segmentsRef.current[index];
      const nextSegment = segmentsRef.current[index + 1];
      if (!current || !nextSegment) return;

      const currentSplit = splitTrailingTokens(current.text, tokenCount);
      if (!currentSplit || !currentSplit.token || !currentSplit.remainder) {
        showToast("Cannot move boundary to next segment.", "warning");
        return;
      }

      const updatedCurrent = {
        ...current,
        text: currentSplit.remainder,
      };
      const updatedNext = {
        ...nextSegment,
        text: joinSegmentTexts(currentSplit.token, nextSegment.text),
      };

      const next = [...segmentsRef.current];
      next[index] = updatedCurrent;
      next[index + 1] = updatedNext;
      applyEditedSegments(next, segmentIndexRef.current);
    },
    [applyEditedSegments, showToast]
  );

  const handleUndoEdit = useCallback(() => {
    const previous = editHistoryRef.current.pop();
    if (!previous || !previous.length) return;
    setCanUndo(editHistoryRef.current.length > 0);
    applyEditedSegments(previous, Math.min(segmentIndexRef.current, previous.length - 1), {
      recordHistory: false,
    });
  }, [applyEditedSegments]);

  const handleResetEdits = useCallback(async () => {
    if (!videoId || resettingOverrides || savingOverrides) return;
    setResettingOverrides(true);
    try {
      const resetResponse = await fetch('/api/youtube/transcript/overrides', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      const resetData = await resetResponse.json().catch(() => ({}));
      if (!resetResponse.ok || !resetData?.success) {
        throw new Error(resetData?.error || 'Failed to reset transcript edits');
      }

      const reloadResponse = await fetch(
        `/api/youtube/transcript/${encodeURIComponent(videoId)}?lang=${encodeURIComponent(language)}`,
        { cache: 'no-store' }
      );
      if (!reloadResponse.ok) {
        throw new Error('Transcript restored but refresh failed');
      }

      const reloadData = (await reloadResponse.json()) as TranscriptResponse;
      if (!Array.isArray(reloadData.segments) || reloadData.segments.length === 0) {
        throw new Error('No transcript segments after reset');
      }

      const normalizedSegments = normalizeSegmentsForPlayback(reloadData.segments);
      setSegments(normalizedSegments);
      segmentsRef.current = normalizedSegments;
      const nextIndex = Math.min(segmentIndexRef.current, normalizedSegments.length - 1);
      segmentIndexRef.current = nextIndex;
      setCurrentSegmentIndex(nextIndex);
      currentRepeatRef.current = 1;
      setCurrentRepeat(1);

      baselineSegmentsRef.current = cloneSegments(normalizedSegments);
      editHistoryRef.current = [];
      setCanUndo(false);
      setOverrideDirty(false);
      setSplitCursorByIndex({});
      setStatus('Transcript reset to original from cache.');
      showToast('Transcript reset to original.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset transcript edits';
      setError(message);
      showToast(message, 'warning');
    } finally {
      setResettingOverrides(false);
    }
  }, [videoId, resettingOverrides, savingOverrides, language, showToast]);

  const handleMergeWithPrevious = useCallback(
    (index: number) => {
      if (index <= 0) return;
      const previous = segmentsRef.current[index - 1];
      const current = segmentsRef.current[index];
      if (!previous || !current) return;

      const merged: TranscriptSegment = {
        start: previous.start,
        end: current.end,
        text: joinSegmentTexts(previous.text, current.text),
        translation: previous.translation || current.translation,
      };

      const next = [...segmentsRef.current];
      next.splice(index - 1, 2, merged);
      const selectedIndex = Math.max(
        0,
        segmentIndexRef.current >= index ? segmentIndexRef.current - 1 : segmentIndexRef.current
      );
      applyEditedSegments(next, selectedIndex);
    },
    [applyEditedSegments]
  );

  const handleMergeWithNext = useCallback(
    (index: number) => {
      if (index >= segmentsRef.current.length - 1) return;
      const current = segmentsRef.current[index];
      const nextSegment = segmentsRef.current[index + 1];
      if (!current || !nextSegment) return;

      const merged: TranscriptSegment = {
        start: current.start,
        end: nextSegment.end,
        text: joinSegmentTexts(current.text, nextSegment.text),
        translation: current.translation || nextSegment.translation,
      };

      const next = [...segmentsRef.current];
      next.splice(index, 2, merged);
      const selectedIndex = Math.min(segmentIndexRef.current, next.length - 1);
      applyEditedSegments(next, selectedIndex);
    },
    [applyEditedSegments]
  );

  const handleSaveOverrides = useCallback(async () => {
    if (!videoId || !segmentsRef.current.length || !overrideDirty || savingOverrides) return;

    setSavingOverrides(true);
    try {
      const response = await fetch('/api/youtube/transcript/overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          segments: segmentsRef.current.map(segment => ({
            start: segment.start,
            end: segment.end,
            text: segment.text,
            translation: segment.translation,
          })),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        throw new Error(data?.error || 'Failed to save transcript edits');
      }

      setOverrideDirty(false);
      setStatus('Transcript edits saved.');
      showToast('Transcript edits saved.', 'success');
      baselineSegmentsRef.current = cloneSegments(segmentsRef.current);
      editHistoryRef.current = [];
      setCanUndo(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save transcript edits';
      setError(message);
      showToast(message, 'warning');
    } finally {
      setSavingOverrides(false);
    }
  }, [videoId, overrideDirty, savingOverrides, showToast]);

  const handleTimingNudge = useCallback(
    (index: number, edge: 'start' | 'end', delta: number) => {
      const current = segmentsRef.current[index];
      if (!current) return;

      const previous = segmentsRef.current[index - 1];
      const nextSegment = segmentsRef.current[index + 1];
      const next = [...segmentsRef.current];

      let start = current.start;
      let end = current.end;

      if (edge === 'start') {
        const minStart = previous ? previous.end + SEGMENT_EPSILON_SECONDS : 0;
        const maxStart = end - MIN_SEGMENT_DURATION_SECONDS;
        start = Math.min(maxStart, Math.max(minStart, start + delta));
      } else {
        const minEnd = start + MIN_SEGMENT_DURATION_SECONDS;
        const maxEnd = nextSegment ? nextSegment.start - SEGMENT_EPSILON_SECONDS : Number.POSITIVE_INFINITY;
        end = Math.max(minEnd, Math.min(maxEnd, end + delta));
      }

      next[index] = {
        ...current,
        start,
        end,
      };

      applyEditedSegments(next, segmentIndexRef.current);
    },
    [applyEditedSegments]
  );

  const transcriptEditSections = useMemo(
    () => [
      {
        id: "transcript-edit",
        title: "Transcript Edit",
        items: [
          {
            id: "toggle-edit",
            label: "Edit Transcript",
            type: "toggle" as const,
            value: editMode,
            onClick: () => setEditMode(prev => !prev),
          },
          {
            id: "save-edits",
            label: savingOverrides ? "Saving..." : "Save Edits",
            disabled: !overrideDirty || savingOverrides || resettingOverrides,
            onClick: () => {
              void handleSaveOverrides();
            },
          },
          {
            id: "undo-edit",
            label: "Undo",
            disabled: !canUndo || savingOverrides || resettingOverrides,
            onClick: handleUndoEdit,
          },
          {
            id: "reset-edits",
            label: resettingOverrides ? "Resetting..." : "Reset Edits",
            disabled: savingOverrides || resettingOverrides,
            onClick: () => {
              void handleResetEdits();
            },
          },
        ],
      },
    ],
    [
      editMode,
      overrideDirty,
      savingOverrides,
      canUndo,
      resettingOverrides,
      handleSaveOverrides,
      handleUndoEdit,
      handleResetEdits,
    ]
  );

  useEffect(() => {
    return () => {
      clearTranslationPoll();
    };
  }, [clearTranslationPoll]);

  useEffect(() => {
    if (!showTranslation || !videoId || !segments.length) return;

    const hasTranslations = segments.some((segment) => !!segment.translation);
    if (hasTranslations) return;

    if (translationRequestRef.current?.videoId === videoId) {
      return;
    }

    translationRequestRef.current = { videoId, startedAt: Date.now() };

    const queueTranslation = async () => {
      try {
        await fetch("/api/youtube/transcript/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId, async: true, mode: "full", userLevel: "N4" }),
        });
      } catch (err) {
        console.error("[YouTubeShadowing] Failed to queue transcript translation", err);
      }
    };

    const refreshTranscript = async () => {
      try {
        const response = await fetch(
          `/api/youtube/transcript/${encodeURIComponent(videoId)}?lang=${encodeURIComponent(language)}`,
          { cache: "no-store" }
        );
        if (!response.ok) return;
        const data = (await response.json()) as TranscriptResponse;
        if (Array.isArray(data.segments) && data.segments.length) {
          const normalizedSegments = normalizeSegmentsForPlayback(data.segments);
          setSegments(normalizedSegments);
          segmentsRef.current = normalizedSegments;
        }
      } catch (err) {
        console.warn("[YouTubeShadowing] Failed to refresh transcript translations", err);
      }
    };

    queueTranslation();
    clearTranslationPoll();
    translationPollRef.current = setInterval(async () => {
      try {
        const statusResponse = await fetch(
          `/api/youtube/transcript/translate?videoId=${encodeURIComponent(videoId)}&status=true`,
          { cache: "no-store" }
        );
        if (!statusResponse.ok) return;
        const status = await statusResponse.json();
        if (status?.status === "complete") {
          clearTranslationPoll();
          await refreshTranscript();
        } else if (status?.status === "failed") {
          clearTranslationPoll();
        }
      } catch {
        // keep polling silently
      }
    }, 3000);
  }, [showTranslation, videoId, segments, language, clearTranslationPoll]);

  useEffect(() => {
    if (!showTranslation || !videoId) return;

    const segment = segments[currentSegmentIndex];
    if (!segment || segment.translation) return;

    const key = `${videoId}:${segment.start}-${segment.end}:${segment.text}`;
    if (translationInFlightRef.current.has(key)) return;
    translationInFlightRef.current.add(key);
    setTranslationInFlight(prev => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });

    const run = async () => {
      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: segment.text,
            mode: 'full',
            userLevel: 'N4',
            includeGrammarNotes: false,
            preserveGrammarStructure: true,
          }),
        });

        if (!response.ok) return;
        const data = await response.json();
        const translatedText = data?.data?.translatedText;
        if (!translatedText) return;

        setSegments(prev => {
          const current = prev[currentSegmentIndex];
          if (!current || current.translation) return prev;
          const next = [...prev];
          next[currentSegmentIndex] = { ...current, translation: translatedText };
          segmentsRef.current = next;
          return next;
        });

        await fetch('/api/youtube/transcript/segment-translation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            segment: { start: segment.start, end: segment.end, text: segment.text },
            translation: translatedText,
          }),
        });
      } catch {
        // silent fail
      } finally {
        translationInFlightRef.current.delete(key);
        setTranslationInFlight(prev => {
          if (!prev.has(key)) return prev;
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    };

    void run();
  }, [showTranslation, videoId, segments, currentSegmentIndex]);

  // Auto-trigger word precompute on cached session restores or navigation
  useEffect(() => {
    if (!videoId || segments.length === 0) return;

    const priorityText = segments.slice(0, 3).map((s) => s.text).join(" ");
    const remainingText = segments.slice(3).map((s) => s.text).join(" ");

    if (priorityText.trim()) {
      prefetchWordExplanations({
        contentId: videoId,
        contentType: "youtube",
        text: priorityText,
      });
    }

    if (remainingText.trim()) {
      setTimeout(() => {
        prefetchWordExplanations({
          contentId: videoId,
          contentType: "youtube",
          text: remainingText,
          background: true,
        });
      }, 500);
    }
  }, [videoId, segments, prefetchWordExplanations]);

  const practiceMetadata = useMemo(() => {
    if (!source) return undefined;
    return {
      transcriptSource: source,
      transcriptLanguage: language,
    };
  }, [source, language]);

  useYouTubePracticeTracking({
    videoId,
    videoUrl,
    videoTitle: videoMetadata?.title || videoId || null,
    thumbnailUrl: videoMetadata?.thumbnailUrl,
    channelName: videoMetadata?.channelTitle,
    duration: videoMetadata?.durationInSeconds,
    metadata: practiceMetadata,
    isPlaying,
    currentTime,
  });

  // Handle word tap for explanation
  const handleWordTap = useCallback(
    async (word: string, context: string) => {
      // Filter out punctuation-only tokens
      const cleanWord = word.trim();
      if (!cleanWord || "。、！？「」『』（）".includes(cleanWord)) {
        return;
      }

      if (!hasSeenWordLookup(cleanWord)) {
        const decision = await checkWordLookupOnly({ failOpen: false });
        if (!decision.allow) {
          const upgradeAction = !isPremium
            ? {
                label: t('subscription.actions.upgrade'),
                onClick: () => router.push('/pricing'),
              }
            : undefined;
          showToast(t('entitlements.messages.lookupLimitReached'), 'warning', 5000, upgradeAction);
          return;
        }
      }

      setSelectedWord(cleanWord);
      setWordContext(context);
      setWordModalOpen(true);
      await explainWord(cleanWord, context);
    },
    [checkWordLookupOnly, explainWord, isPremium, router, showToast, t],
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

  useEffect(() => {
    if (!showFurigana || furiganaHintShownRef.current) return;
    if (typeof window === "undefined") return;

    const hintKey = "moshiFuriganaEditHintSeen";
    if (localStorage.getItem(hintKey)) {
      furiganaHintShownRef.current = true;
      return;
    }

    showToast(t('youtubeShadowing.hints.editFurigana'), "info", 4500);
    localStorage.setItem(hintKey, "1");
    furiganaHintShownRef.current = true;
  }, [showFurigana, showToast]);

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
        const normalizedSegments = normalizeSegmentsForPlayback(parsed.segments);
        setSegments(normalizedSegments);
        segmentsRef.current = normalizedSegments;
        setShowUrlInput(false); // Collapse form when restoring a session
        baselineSegmentsRef.current = cloneSegments(normalizedSegments);
        editHistoryRef.current = [];
        setCanUndo(false);
        setOverrideDirty(false);
        setSplitCursorByIndex({});
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
    setEditMode(false);
    setOverrideDirty(false);
    setSplitCursorByIndex({});
    baselineSegmentsRef.current = [];
    editHistoryRef.current = [];
    setCanUndo(false);
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

              <div className={styles.videoBottomRow}>
                {/* YouTube Button - small pill on left side */}
                {videoId && (
                  <div className={styles.youtubeButtonWrapper}>
                    <YouTubeButton videoId={videoId} />
                  </div>
                )}

                {/* Clear Session Button - bottom right */}
                {videoId && (
                  <div className={styles.rightActions}>
                    <button
                      onClick={() => {
                        void handleResegment();
                      }}
                      className={styles.aiResegmentButton}
                      title="Run transcript resegmentation"
                      disabled={resegmenting}
                    >
                      <RefreshCw className={`w-4 h-4 ${resegmenting ? "animate-spin" : ""}`} />
                      <span>{resegmenting ? "Resegmenting..." : "AI Resegment"}</span>
                    </button>

                    <button
                      onClick={() => setShowClearConfirm(true)}
                      className={styles.clearSessionButton}
                      title={t("youtubeShadowing.settings.clearSession")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
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
                      {currentRepeatDisplay}/{repeatCountDisplay}
                    </span>
                  </div>

                  <div className={styles.heroText}>
                    <GrammarHighlightedText
                      text={segments[currentSegmentIndex].text}
                      highlightMode={highlightMode}
                      showFurigana={showFurigana}
                      furiganaContextKey={videoId ? `youtube:${videoId}` : undefined}
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
                  {showTranslation &&
                    !segments[currentSegmentIndex]?.translation &&
                    videoId &&
                    translationInFlight.has(
                      `${videoId}:${segments[currentSegmentIndex]?.start}-${segments[currentSegmentIndex]?.end}:${segments[currentSegmentIndex]?.text}`
                    ) && (
                      <p className="text-base text-gray-500 dark:text-gray-400 mt-1 italic text-center">
                        {t('common.loading')}
                      </p>
                    )}
                </div>
              ) : (
                <div className={styles.emptyState}>
                  <p>{t('youtubeShadowing.hints.transcriptWillAppear')}</p>
                </div>
              )}
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
          </div>

          {/* Transcript List / Featured Video */}
          <div className={styles.transcriptColumn}>
            {segments.length > 0 ? (
              <div className={styles.transcriptListSection}>
                <div className={styles.listHeader}>
                  <h3 className={styles.listTitle}>{t('youtubeShadowing.player.transcript.title')}</h3>
                  <SettingsDropdown
                    sections={transcriptEditSections}
                    buttonIcon={<MoreVertical className="w-4 h-4" />}
                    showChevron={false}
                    buttonClassName={styles.editMenuButton}
                    position="right"
                    showDividers={false}
                  />
                </div>
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
                            {currentRepeatDisplay}/{repeatCountDisplay}
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
                          {editMode ? (
                            <textarea
                              value={segment.text}
                              className={styles.segmentTextEditor}
                              onChange={(e) => handleSegmentTextChange(index, e.target.value)}
                              onSelect={(e) => {
                                const value = e.currentTarget.selectionStart ?? 0;
                                setSplitCursorByIndex(prev => ({ ...prev, [index]: value }));
                              }}
                            />
                          ) : (
                            <GrammarHighlightedText
                              text={segment.text}
                              highlightMode={highlightMode}
                              showFurigana={showFurigana}
                              furiganaContextKey={videoId ? `youtube:${videoId}` : undefined}
                              onWordClick={(word, e) => {
                                e.stopPropagation();
                                handleWordTap(word, segment.text);
                              }}
                            />
                          )}
                        </div>
                        {editMode && (
                          <div className={styles.segmentEditRow}>
                            <button
                              type="button"
                              className={styles.segmentEditButton}
                              onClick={() => handleSplitSegment(index)}
                            >
                              Split
                            </button>
                            <button
                              type="button"
                              className={styles.segmentEditButton}
                              onClick={() => handleTimingNudge(index, 'start', -TIMING_NUDGE_SECONDS)}
                            >
                              Start-
                            </button>
                            <button
                              type="button"
                              className={styles.segmentEditButton}
                              onClick={() => handleTimingNudge(index, 'start', TIMING_NUDGE_SECONDS)}
                            >
                              Start+
                            </button>
                            <button
                              type="button"
                              className={styles.segmentEditButton}
                              onClick={() => handleTimingNudge(index, 'end', -TIMING_NUDGE_SECONDS)}
                            >
                              End-
                            </button>
                            <button
                              type="button"
                              className={styles.segmentEditButton}
                              onClick={() => handleTimingNudge(index, 'end', TIMING_NUDGE_SECONDS)}
                            >
                              End+
                            </button>
                            <button
                              type="button"
                              className={styles.segmentEditButton}
                              onClick={() => handleBoundaryTakeFromNext(index)}
                              disabled={index >= segments.length - 1}
                            >
                              Take Next
                            </button>
                            <button
                              type="button"
                              className={styles.segmentEditButton}
                              onClick={() => handleBoundaryTakeFromNext(index, 2)}
                              disabled={index >= segments.length - 1}
                            >
                              Take 2
                            </button>
                            <button
                              type="button"
                              className={styles.segmentEditButton}
                              onClick={() => handleBoundaryGiveToNext(index)}
                              disabled={index >= segments.length - 1}
                            >
                              Give Next
                            </button>
                            <button
                              type="button"
                              className={styles.segmentEditButton}
                              onClick={() => handleBoundaryGiveToNext(index, 2)}
                              disabled={index >= segments.length - 1}
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
                              disabled={index >= segments.length - 1}
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
            ) : featuredVideo ? (
              <div className={styles.featuredVideoWrapper}>
                {/* Featured Video Card */}
                <div className={styles.featuredCard}>
                  <div className={styles.featuredBadge}>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Featured</span>
                  </div>

                  <div className={styles.featuredThumbnail}>
                    <img
                      src={featuredVideo.thumbnailUrl}
                      alt={featuredVideo.videoTitle}
                      className={styles.thumbnailImage}
                    />
                    <div className={styles.playOverlay}>
                      <button
                        onClick={() => {
                          trackFeaturedClick();
                          setVideoInput(featuredVideo.videoUrl);
                          void loadTranscript(featuredVideo.videoUrl);
                        }}
                        className={styles.playButton}
                      >
                        <Play className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className={styles.featuredContent}>
                    <h3 className={styles.featuredTitle}>
                      {featuredVideo.videoTitle}
                    </h3>
                    <p className={styles.featuredChannel}>{featuredVideo.channelName}</p>
                    <p className={styles.featuredDescription}>
                      "{featuredVideo.description}"
                    </p>
                    <button
                      onClick={() => {
                        trackFeaturedClick();
                        setVideoInput(featuredVideo.videoUrl);
                        void loadTranscript(featuredVideo.videoUrl);
                      }}
                      className={styles.startButton}
                    >
                      <Play className="w-4 h-4" />
                      Start Learning
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {/* Sticky Bottom Control Bar */}
      {segments.length > 0 && (
        <div className={styles.bottomControlBar}>
          <div className={styles.controlBarInner}>
            {/* Top-left curved white border accent */}
            <div
              className="absolute inset-0 rounded-full border-2 border-white/50 pointer-events-none z-20"
              style={{
                maskImage: "linear-gradient(135deg, black 0%, black 5%, transparent 12%)",
                WebkitMaskImage: "linear-gradient(135deg, black 0%, black 5%, transparent 12%)",
              }}
            />
            {/* Bottom-right curved white border accent */}
            <div
              className="absolute inset-0 rounded-full border-2 border-white/50 pointer-events-none z-20"
              style={{
                maskImage: "linear-gradient(-45deg, black 0%, black 5%, transparent 12%)",
                WebkitMaskImage: "linear-gradient(-45deg, black 0%, black 5%, transparent 12%)",
              }}
            />

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
            </div>

            {/* Quick preset buttons */}
            <div className="grid grid-cols-5 gap-2 mb-3">
              {[1, 2, 3, 5, 10].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleRepeatChange(preset)}
                  disabled={videoLoopEnabled}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    repeatCount === preset
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-dark-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {preset}x
                </button>
              ))}
            </div>

            {/* Stepper controls */}
            <div className="flex items-center justify-center gap-4 p-3 bg-gray-100 dark:bg-dark-800 rounded-lg">
              <button
                onClick={() => handleRepeatChange(Math.max(1, repeatCount - 1))}
                disabled={repeatCount <= 1 || videoLoopEnabled}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-dark-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">−</span>
              </button>

              <div className="flex flex-col items-center gap-1">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={repeatCount}
                  onChange={(e) => {
                    const value = Math.max(1, Math.min(10, Number(e.target.value)));
                    handleRepeatChange(value);
                  }}
                  disabled={videoLoopEnabled}
                  className="w-16 px-2 py-2 text-center text-lg font-semibold border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-dark-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  repeats
                </span>
              </div>

              <button
                onClick={() => handleRepeatChange(Math.min(10, repeatCount + 1))}
                disabled={repeatCount >= 10 || videoLoopEnabled}
                className="w-10 h-10 flex items-center justify-center rounded-lg bg-white dark:bg-dark-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-dark-600 transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">+</span>
              </button>
            </div>

            {videoLoopEnabled && (
              <p className="text-xs text-gray-400 mt-2 italic text-center">
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
        }}
        title={t("youtubeShadowing.lockScreen.title")}
        unlockText={t("youtubeShadowing.lockScreen.tapToUnlock")}
      />

      {/* Clear Session Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowClearConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="bg-white/95 dark:bg-dark-800/95 backdrop-blur-2xl rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <Trash2 className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">{t("youtubeShadowing.settings.clearSession")}</h3>
                <p className="text-muted-foreground">
                  {t("youtubeShadowing.settings.clearSessionConfirm")}
                </p>
              </div>

              {videoMetadata && (
                <div className="bg-gray-50/50 dark:bg-dark-700/50 backdrop-blur rounded-xl p-4 mb-6">
                  <p className="font-semibold line-clamp-2 mb-1">
                    {videoMetadata.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {videoMetadata.channelTitle}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-6 py-3 bg-gray-100 dark:bg-dark-700 text-foreground rounded-xl hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors font-medium"
                >
                  {t('common.cancel')}
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    clearSession();
                    setShowClearConfirm(false);
                  }}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 flex items-center justify-center font-medium shadow-lg"
                >
                  {t("youtubeShadowing.clearSessionButton")}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <MobileNavSpacer />
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
