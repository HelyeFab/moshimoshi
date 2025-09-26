// Flashcard Types

export type CardStyle = 'minimal' | 'decorated' | 'themed';
export type AnimationSpeed = 'slow' | 'normal' | 'fast';
export type StudyDirection = 'front-to-back' | 'back-to-front' | 'mixed';
export type StudyMode = 'classic' | 'match' | 'speed' | 'write' | 'voice';
export type CardStatus = 'new' | 'learning' | 'review' | 'mastered';

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
  sourceListId?: string; // Link to UserList if created from list
  tags?: string[];
}

export interface FlashcardContent {
  id: string;
  front: CardSide;
  back: CardSide;
  metadata?: {
    // SRS Core Data
    status?: CardStatus; // 'new' | 'learning' | 'review' | 'mastered'
    interval?: number; // Days until next review
    easeFactor?: number; // Difficulty multiplier (default 2.5)
    repetitions?: number; // Number of successful reviews
    lapses?: number; // Number of times forgotten

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
    difficulty?: number; // User-perceived difficulty (0-1)
    tags?: string[];
    notes?: string;
    audioUrl?: string;
    imageUrl?: string;

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
    url: string;
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

// Request/Response types for API
export interface CreateDeckRequest {
  id?: string; // Optional ID for syncing existing decks
  name: string;
  description?: string;
  emoji?: string;
  color?: string;
  cardStyle?: CardStyle;
  settings?: Partial<DeckSettings>;
  sourceListId?: string;
  initialCards?: Array<{
    front: Omit<CardSide, 'style'>;
    back: Omit<CardSide, 'style'>;
    metadata?: FlashcardContent['metadata'];
  }>;
}

export interface UpdateDeckRequest {
  name?: string;
  description?: string;
  emoji?: string;
  color?: string;
  settings?: Partial<DeckSettings>;
}

export interface AddCardRequest {
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