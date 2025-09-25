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
    difficulty?: number; // 0-1
    tags?: string[];
    notes?: string;
    audioUrl?: string;
    imageUrl?: string;
    lastReviewed?: number;
    nextReview?: number;
    reviewCount?: number;
    correctCount?: number;
    srsLevel?: number;
    easeFactor?: number;
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