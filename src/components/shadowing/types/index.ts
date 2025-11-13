/**
 * Shared types for News & Stories shadowing components
 */

export interface ShadowingSentence {
  id?: string;
  text: string;
  startIndex?: number;
  endIndex?: number;
  furiganaText?: string;
  translation?: string;
}

export interface ShadowingRepeatConfig {
  enabled: boolean;
  count: number;
  currentRepeat: number;
  pauseDuration: number; // in milliseconds
}

export interface ShadowingSession {
  sentences: ShadowingSentence[];
  currentIndex: number;
  repeatConfig: ShadowingRepeatConfig;
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface ShadowingSettings {
  showFurigana: boolean;
  playbackSpeed: number;
  voice?: 'male' | 'female';
  // Optional settings that may not be present in all implementations
  highlightGrammar?: boolean;
  highlightMode?: 'none' | 'all' | 'content' | 'grammar';
  fontSize?: string;
  showTranslation?: boolean;
}

export interface ShadowingContent {
  id: string;
  text: string;
  title: string;
  type: 'article' | 'story';
}

// Event handlers
export interface ShadowingHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onRepeatCountChange: (count: number) => void;
  onPauseDurationChange: (duration: number) => void;
  onSettingsChange: (settings: ShadowingSettings) => void;
  onSentenceSelect: (index: number) => void;
  onClose: () => void;
}

// TTS integration
export interface ShadowingTTSOptions {
  voice?: string;
  speed: number;
}

export interface ShadowingTTSProvider {
  play: (text: string, options?: ShadowingTTSOptions) => Promise<void>;
  stop: () => void;
  isPlaying: boolean;
  isLoading: boolean;
  preload: (texts: string[], options?: ShadowingTTSOptions) => Promise<void>;
}

// A11y announcements
export interface ShadowingAnnouncement {
  type: 'sentence-change' | 'repeat-progress' | 'playback-state' | 'error';
  message: string;
  priority: 'polite' | 'assertive';
}

// Keyboard shortcuts
export interface ShadowingKeyBinding {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  description: string;
  handler: () => void;
}