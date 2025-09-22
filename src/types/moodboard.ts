// Main MoodBoard type used internally
export interface MoodBoard {
  id: string;
  title: string;
  emoji: string;
  jlpt: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  background: string;
  description: string;
  kanji: KanjiItem[];
  createdAt: Date;
  updatedAt?: Date;
  createdBy?: string; // Always "admin" for admin-created boards
  isActive: boolean;
  sortOrder?: number;
}

// Alternative format for importing mood boards from JSON
export interface MoodBoardImport {
  category: string;  // Maps to title
  themeColor: string;  // Used to generate background gradient
  description: string;
  kanjiList: KanjiImportItem[];  // Maps to kanji array
  emoji?: string;  // Optional, will use default if not provided
  jlptLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';  // Optional, will use N5 if not provided
}

export interface KanjiItem {
  char: string;
  meaning: string;
  // Support both old (nested) and new (flat) structure
  readings?: {
    on: string[];
    kun: string[];
  };
  onyomi?: string[];  // New flat structure
  kunyomi?: string[];  // New flat structure
  jlpt?: string;  // JLPT level for individual kanji
  examples: string[] | { sentence: string; translation?: string }[]; // Support both formats
  difficulty?: number; // 1-5, optional now
  strokeCount?: number;
  tags?: string[];
}

// Kanji format for imports
export interface KanjiImportItem {
  kanji: string;  // Maps to char
  kana: string;  // Primary reading (usually kun)
  meaning: string;
  jlptLevel: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  examples: {
    sentence: string;
    translation: string;
  }[];
  onyomi?: string[];
  kunyomi?: string[];
  radicals?: string[];
  strokeCount?: number;
  tags?: string[];
}

export interface BoardProgress {
  boardId: string;
  learnedKanji: string[]; // kanji characters
  completedAt?: Date;
  lastStudied: Date;
  totalKanji: number;
  progressPercentage: number;
}

export interface MoodBoardsProgress {
  [boardId: string]: BoardProgress;
}

// Helper types for component props
export interface MoodBoardCardProps {
  board: MoodBoard;
  progress?: BoardProgress;
  onClick: (boardId: string) => void;
}

export interface KanjiCardProps {
  kanji: KanjiItem;
  isLearned: boolean;
  onToggleLearned: (char: string) => void;
  showBack?: boolean;
}

// Mood board themes
export const MOODBOARD_THEMES = [
  'family',
  'nature',
  'emotions',
  'food',
  'travel',
  'school',
  'work',
  'animals',
  'colors',
  'weather',
  'time',
  'body',
  'house',
  'sports',
  'music'
] as const;

export type MoodBoardTheme = typeof MOODBOARD_THEMES[number];