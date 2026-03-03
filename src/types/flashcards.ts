// Flashcard Types

export type CardStyle = 'minimal' | 'decorated' | 'themed';
export type AnimationSpeed = 'slow' | 'normal' | 'fast';
export type StudyDirection = 'front-to-back' | 'back-to-front' | 'mixed';
export type StudyMode = 'classic' | 'match' | 'speed' | 'write' | 'voice' | 'preview' | 'study';
export type CardStatus = 'new' | 'learning' | 'review' | 'mastered';
export type DeckOrigin = 'deckmarket';

export interface FlashcardDeck {
  id: string; // UUID
  userId: string; // Firebase UID
  name: string;
  description?: string;
  emoji: string;
  color: string; // palette color
  cardStyle: CardStyle;
  cards: FlashcardContent[];
  settings: DeckSettings;
  stats: DeckStats;
  createdAt: number;
  updatedAt: number;
  isStarter?: boolean;
  sourceListId?: string; // Link to UserList if created from list
  source?: 'anki' | 'user'; // Source of the deck (Anki import or user-created)
  origin?: DeckOrigin;
  tags?: string[];
  restoreStatus?: 'restoring' | 'error';
  metadata?: {
    originalFilename?: string;
    importedAt?: string;
    hasMedia?: boolean;
    ankiImport?: boolean;
    r2BackupEnabled?: boolean;
    origin?: 'deckmarket';
  };
  r2?: {  // R2 metadata (populated after upload to cloud storage)
    cardsKey: string;
    manifestKey: string;
    mediaPrefix: string;
    uploadedAt: number;
  };
}

export interface FlashcardContent {
  id: string;
  front: CardSide | string; // String format for Anki cards with HTML
  back: CardSide | string; // String format for Anki cards with HTML
  metadata?: {
    // SRS Algorithm Identifier
    algorithm?: 'sm2' | 'fsrs'; // Which SRS algorithm is being used

    // SRS Core Data (Common to both SM-2 and FSRS)
    status?: CardStatus; // 'new' | 'learning' | 'review' | 'mastered'
    interval?: number; // Days until next review
    lapses?: number; // Number of times forgotten

    // SM-2 Specific Fields (optional, used only when algorithm='sm2')
    easeFactor?: number; // Difficulty multiplier (default 2.5) - SM-2 only
    repetitions?: number; // Number of successful reviews - SM-2 only

    // FSRS Specific Fields (optional, used only when algorithm='fsrs')
    stability?: number; // Memory stability in days - FSRS only
    difficulty?: number; // Item difficulty (1-10) - FSRS only
    retrievability?: number; // Current probability of recall (0-1) - FSRS only
    state?: number; // FSRS internal state - FSRS only

    // Review Tracking
    lastReviewed?: number; // Timestamp of last review
    nextReview?: number; // Timestamp when due for review
    reviewCount?: number; // Total number of reviews
    correctCount?: number; // Number of correct reviews

    // Performance Metrics
    averageResponseTime?: number; // Average response time in ms
    lastResponseTime?: number; // Last response time in ms
    streak?: number; // Current correct answer streak
    bestStreak?: number; // Best streak achieved

    // Learning Progress
    learningStep?: number; // Current step in learning phase (0-based)
    graduatedAt?: number; // When card graduated from learning

    // Content Metadata
    tags?: string[];
    notes?: string;
    hints?: string | string[]; // Custom hints for the card
    audioUrl?: string;
    imageUrl?: string;
    frontAudioUrl?: string;
    backAudioUrl?: string;

    // Anki-specific fields
    source?: string; // Source of the card (e.g., 'anki')
    expression?: string; // Japanese expression/word
    sentence?: string; // Example sentence
    reading?: string; // Japanese reading (hiragana/katakana)
    meaning?: string; // English meaning
    audioFilename?: string; // Original audio filename for IndexedDB lookup
    imageFilename?: string; // Original image filename for IndexedDB lookup
    frontAudioFilename?: string; // Side-specific front audio filename (Anki/native media)
    backAudioFilename?: string; // Side-specific back audio filename (Anki/native media)

    // Furigana support
    furiganaFront?: string; // Pre-generated furigana HTML for front text
    furiganaBack?: string; // Pre-generated furigana HTML for back text
    hasNativeFurigana?: boolean; // True if card already has furigana (from Anki)

    // Additional tracking
    createdAt?: number; // When card was added to deck
    modifiedAt?: number; // Last content modification
  };
}

export interface CardSide {
  text: string;
  subtext?: string; // Reading, pronunciation, etc.
  media?: {
    type: 'image' | 'audio' | 'video';
    filename?: string;  // Filename reference for R2 storage (user decks)
    url: string;        // blob URL for preview (ephemeral)
    alt?: string;
  };
  style?: CardStyleOverride;
}

export interface CardStyleOverride {
  fontSize?: 'small' | 'medium' | 'large' | 'x-large';
  fontFamily?: string;
  textColor?: string; // Uses theme colors
  backgroundColor?: string; // Uses theme colors
  textAlign?: 'left' | 'center' | 'right';
}

export interface DeckSettings {
  studyDirection: StudyDirection;
  autoPlay: boolean;
  showHints: boolean;
  animationSpeed: AnimationSpeed;
  soundEffects: boolean;
  hapticFeedback: boolean;
  sessionLength: number; // cards per session
  reviewMode: 'srs' | 'random' | 'sequential';
  newCardsPerDay?: number;
  reviewsPerDay?: number;
  furigana?: {
    enabled: boolean;
    showOnFront: boolean;
    showOnBack: boolean;
  };
}

export interface DeckStats {
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  masteredCards: number;
  totalStudied: number;
  lastStudied?: number;
  averageAccuracy: number;
  currentStreak: number;
  longestStreak: number;
  totalTimeSpent: number; // milliseconds
  heatmapData?: { [date: string]: number }; // date -> study count
}

export interface FlashcardStreakSnapshot {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD (local)
  streak1: number;
  streak2: number;
  streak3plus: number;
  total: number;
  updatedAt: number;
}

// Request/Response types for API
export interface CreateDeckRequest {
  id?: string; // Optional ID for syncing existing decks
  name: string;
  description?: string;
  emoji?: string;
  color?: string;
  cardStyle?: CardStyle;
  source?: 'anki' | 'user';
  isStarter?: boolean;
  origin?: DeckOrigin;
  settings?: Partial<DeckSettings>;
  sourceListId?: string;
  initialCards?: Array<{
    id?: string; // Preserve existing card ID for SRS data when updating
    front: string | Omit<CardSide, 'style'>;
    back: string | Omit<CardSide, 'style'>;
    metadata?: FlashcardContent['metadata'];
  }>;
}

export interface UpdateDeckRequest {
  name?: string;
  description?: string;
  emoji?: string;
  color?: string;
  cardStyle?: CardStyle;
  settings?: Partial<DeckSettings>;
  cards?: FlashcardContent[];
}

export interface AddCardRequest {
  id?: string;
  deckId: string;
  front: Omit<CardSide, 'style'>;
  back: Omit<CardSide, 'style'>;
  metadata?: FlashcardContent['metadata'];
}

export interface UpdateCardRequest {
  front?: Omit<CardSide, 'style'>;
  back?: Omit<CardSide, 'style'>;
  metadata?: FlashcardContent['metadata'];
}

export interface StudySessionRequest {
  deckId: string;
  mode: StudyMode;
  sessionLength?: number;
  includeNew?: boolean;
  includeReview?: boolean;
}

export interface StudySessionResponse {
  sessionId: string;
  cards: FlashcardContent[];
  mode: StudyMode;
  startedAt: number;
}

export interface PersistedStudySession {
  version: 1;
  userId: string;
  deckId: string;
  mode: StudyMode;
  cardIds: string[];
  currentIndex: number;
  responses: Array<[
    string,
    { correct: boolean; difficulty?: string; responseTime: number }
  ]>;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
  newCardsStudied: number;
  learningCardsStudied: number;
  reviewCardsStudied: number;
  streakCount: number;
  bestStreak: number;
  totalResponseTime: number;
  fastestResponseTime: number;
  slowestResponseTime: number;
  elapsedTime: number;
  pausedTime: number;
  isPaused: boolean;
  savedAt: number;
  deviceId?: string;
}

export interface ReviewResult {
  cardId: string;
  correct: boolean;
  responseTime: number;
  difficulty?: 'again' | 'hard' | 'good' | 'easy';
  skipped?: boolean;
}

export interface SessionSummary {
  sessionId: string;
  deckId: string;
  cardsStudied: number;
  correctAnswers: number;
  accuracy: number;
  averageResponseTime: number;
  newCardsLearned: number;
  cardsReviewed: number;
  streakMaintained: boolean;
  xpEarned?: number;
  achievements?: string[];
  // For server-side XP calculation (must match client formula)
  bestStreak?: number;
  fastCards?: number;
  // Study-mode drill follow-up (non-SRS): cards marked Again/Hard in this run.
  studyFollowUpCardIds?: string[];
}

// Session History for persistence and analytics
export interface SessionStats {
  id: string;
  userId: string;
  deckId: string;
  deckName: string;
  timestamp: number; // Session start time
  duration: number; // Session duration in ms

  // Performance Metrics
  cardsStudied: number;
  cardsCorrect: number;
  cardsIncorrect: number;
  cardsSkipped: number;
  accuracy: number; // 0-1

  // Card Type Breakdown
  newCards: number;
  learningCards: number;
  reviewCards: number;

  // Response Metrics
  averageResponseTime: number; // ms
  fastestResponseTime: number;
  slowestResponseTime: number;

  // Progress Metrics
  xpEarned: number;
  streakSnapshot: number; // Streak at time of session
  perfectSession: boolean; // 100% accuracy

  // Study Mode
  mode?: StudyMode;
  settings?: {
    sessionLength: number;
    reviewMode: string;
  };
}

// Import/Export types
export interface ImportDeckRequest {
  name: string;
  format: 'csv' | 'json' | 'anki' | 'list';
  data?: string | File;
  emoji?: string;
  color?: string;
  mergeWithExisting?: boolean;
  sourceListId?: string; // For importing from existing user lists
  ankiDeckId?: string; // For importing from Anki import feature
  origin?: DeckOrigin;
}

export interface ExportDeckRequest {
  deckId: string;
  format: 'csv' | 'json';
  includeProgress?: boolean;
  includeMedia?: boolean;
}

// Color palette for decks (using existing theme colors)
export const DECK_COLORS = [
  'primary',   // Sakura pink
  'ocean',     // Blue
  'matcha',    // Green
  'sunset',    // Orange
  'lavender',  // Purple
  'monochrome' // Gray
] as const;

export type DeckColor = typeof DECK_COLORS[number];

// Default emojis for decks
export const SUGGESTED_DECK_EMOJIS = [
  '🎴', '📚', '🎯', '🧠', '💡', '⭐', '🌟', '✨', '🔥', '📝',
  '🎨', '🌸', '🌊', '🍃', '🏔️', '🌅', '🎌', '⛩️', '🗾', '🏯'
] as const;

// Animation presets
export const CARD_ANIMATIONS = {
  flip: {
    slow: 600,
    normal: 400,
    fast: 200
  },
  slide: {
    slow: 500,
    normal: 300,
    fast: 150
  },
  fade: {
    slow: 400,
    normal: 250,
    fast: 100
  }
} as const;
