import type { MutableRefObject, RefObject } from 'react';

/**
 * YouTube Player Types
 * Copied from moshi-player with extensions for repeat/shadowing mode
 */

export interface YouTubePlayerState {
  playing: boolean;
  muted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  playbackRate: number;
  quality: string;
  fullscreen: boolean;
  buffered: number;
  error: string | null;
  playerState: YouTubePlayerStateEnum;
}

export interface YouTubePlayerConfig {
  videoId: string;
  width?: number | string;
  height?: number | string;
  autoplay?: boolean;
  controls?: boolean;
  loop?: boolean;
  muted?: boolean;
  start?: number;
  end?: number;
  quality?: 'small' | 'medium' | 'large' | 'hd720' | 'hd1080' | 'highres' | 'auto';
  cc_lang_pref?: string;
  cc_load_policy?: 0 | 1;
  color?: 'red' | 'white';
  disablekb?: boolean;
  enablejsapi?: boolean;
  fs?: boolean;
  hl?: string;
  iv_load_policy?: 1 | 3;
  modestbranding?: boolean;
  origin?: string;
  playlist?: string;
  playsinline?: boolean;
  rel?: boolean;
}

export interface YouTubePlayerActions {
  play: () => void;
  pause: () => void;
  stop: () => void;
  seekTo: (seconds: number) => void;
  setVolume: (volume: number) => void;
  mute: () => void;
  unmute: () => void;
  setPlaybackRate: (rate: number) => void;
  toggleFullscreen: () => void;
  loadVideoById: (videoId: string, startSeconds?: number) => void;
  loadVideoByUrl: (url: string, startSeconds?: number) => void;
}

export interface YouTubePlayerHookResult<
  State extends YouTubePlayerState = YouTubePlayerState,
  Actions extends YouTubePlayerActions = YouTubePlayerActions,
> {
  containerRef: RefObject<HTMLDivElement>;
  playerRef: MutableRefObject<any>;
  state: State;
  actions: Actions;
  isReady: boolean;
}

export interface YouTubePlayerProps {
  videoId: string;
  config?: Partial<YouTubePlayerConfig>;
  onReady?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onVolumeChange?: (volume: number) => void;
  onPlaybackRateChange?: (rate: number) => void;
  onQualityChange?: (quality: string) => void;
  onSeekRequest?: (seekFunction: (time: number) => void) => void;
  onPlayerApi?: (api: {
    play: () => void;
    pause: () => void;
    seekTo: (time: number) => void;
    getCurrentTime: () => number;
  }) => void;
  className?: string;
}

export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: number;
  author: string;
  views: number;
  uploadDate: string;
}

// YouTube Player API Events
export type YouTubePlayerEvent =
  | 'ready'
  | 'statechange'
  | 'playbackqualitychange'
  | 'playbackratechange'
  | 'error'
  | 'apichange';

// YouTube Player States
export enum YouTubePlayerStateEnum {
  UNSTARTED = -1,
  ENDED = 0,
  PLAYING = 1,
  PAUSED = 2,
  BUFFERING = 3,
  CUED = 5,
}

// YouTube Player Errors
export enum YouTubePlayerError {
  INVALID_PARAM = 2,
  HTML5_ERROR = 5,
  VIDEO_NOT_FOUND = 100,
  VIDEO_NOT_ALLOWED = 101,
  VIDEO_NOT_ALLOWED_DISGUISE = 150,
}

// Transcript types
export interface TranscriptSegment {
  start: number;
  duration: number;
  end: number;
  startTime: number;
  endTime: number;
  text: string;
  words?: string[]; // For word-level tapping
}

export interface TranscriptData {
  available: boolean;
  videoId: string;
  title: string;
  language?: string;
  languageCode?: string;
  isJapanese?: boolean;
  isGenerated?: boolean;
  availableLanguages?: string[];
  languageNote?: string;
  segments?: TranscriptSegment[];
  totalSegments?: number;
  totalDuration?: number;
  message?: string;
  error?: string;
  source?: string;
  method?: string;
  fetchedAt?: string;
  forcedJapanese?: boolean;
}

export interface CaptionProps {
  videoId: string;
  currentTime: number;
  isVisible?: boolean;
  className?: string;
  onToggle?: (visible: boolean) => void;
  onSeekToTime?: (seconds: number) => void;
  loadStartTime?: number | null;
}

export interface YouTubePlayerApiError {
  code: YouTubePlayerError;
  message: string;
}

// ====================
// MOSHIMOSHI EXTENSIONS FOR REPEAT/SHADOWING MODE
// ====================

/**
 * Repeat mode configuration
 */
export interface RepeatModeConfig {
  enabled: boolean;
  count: number;              // Number of times to repeat (1-20)
  currentRepeat: number;      // Current repeat number (0-indexed)
  pauseDuration: number;      // Pause between repeats in milliseconds (500-3000)
}

/**
 * Extended player state with repeat mode
 */
export interface ShadowingPlayerState extends YouTubePlayerState {
  isInRepeatMode: boolean;
  isPausingForRepeat: boolean;
  repeatConfig: RepeatModeConfig;
  currentSegmentIndex: number;
  activeSegmentId: string | null;
}

/**
 * Extended player actions with repeat functionality
 */
export interface ShadowingPlayerActions extends YouTubePlayerActions {
  setRepeatCount: (count: number) => void;
  setPauseDuration: (duration: number) => void;
  skipToNextSegment: () => void;
  skipToPreviousSegment: () => void;
  playSegment: (index: number) => void;
  stopRepeats: () => void;
}

/**
 * Segment playback event
 */
export interface SegmentPlaybackEvent {
  segmentIndex: number;
  repeatNumber: number;
  totalRepeats: number;
  isLastRepeat: boolean;
  seekDurationMs?: number; // Time taken for seek operation (performance tracking)
  wasSeekSlow?: boolean;   // Flag if seek took >1000ms
}

/**
 * Extended player props with shadowing features
 */
export interface ShadowingPlayerProps extends Omit<YouTubePlayerProps, 'onSeekRequest'> {
  transcript?: TranscriptSegment[];
  repeatCount?: number;
  pauseDuration?: number;
  onSegmentChange?: (index: number) => void;
  onSegmentComplete?: (event: SegmentPlaybackEvent) => void;
  onRepeatCycleComplete?: (segmentIndex: number) => void;
  showTranscript?: boolean;
  enableWordTap?: boolean;
  onWordTap?: (word: string) => void;
  onPlayerReady?: (seekFn: (time: number) => void, playPauseFn: () => void) => void;
}
