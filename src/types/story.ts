import { JLPTLevel } from './kanji'
import { BaseQuizQuestion } from './quiz'

// Re-export JLPTLevel for convenience
export type { JLPTLevel } from './kanji'

export interface StoryPage {
  pageNumber: number
  imageUrl?: string
  imageAlt?: string
  text: string // Japanese text with ruby tags for furigana
  textWithFurigana?: string // Alternative furigana format
  translation: string // English translation
  audioUrl?: string // Optional audio narration
  vocabularyNotes?: Record<string, string> // key: word, value: definition
  grammarNotes?: Record<string, string> // key: pattern, value: explanation
}

/**
 * Story quiz question type - now unified with BaseQuizQuestion
 *
 * BREAKING CHANGE: correctIndex has been replaced with correctAnswer
 * Use the migration utilities in @/types/quiz for legacy data
 */
export type StoryQuizQuestion = BaseQuizQuestion

export interface Story {
  id: string
  title: string
  titleJa: string // Japanese title with furigana (ruby tags)
  description: string
  jlptLevel: JLPTLevel
  theme: string
  tags: string[]
  coverImageUrl?: string
  pages: StoryPage[]
  quiz?: StoryQuizQuestion[]

  // Metadata
  authorId: string
  createdAt: Date
  updatedAt: Date
  publishedAt?: Date
  status: 'draft' | 'published' | 'archived'

  // Stats
  viewCount: number
  completionCount: number
  averageQuizScore?: number

  // SEO
  slug: string
  seoTitle?: string
  seoDescription?: string

  // Mood Board Reference (optional)
  moodBoardId?: string
  moodBoardTitle?: string
  moodBoardKanji?: string[]

  // AI Generation Metadata
  isAIGenerated?: boolean
  aiModel?: string
  generationPrompt?: string
  characterSheet?: any // AI character sheet data

  // Audio Generation
  fullAudioUrl?: string // Full story narration (all pages concatenated)
  audioGeneratedAt?: Date
  audioProvider?: 'voicevox' | 'openai' | 'elevenlabs'
  audioVoice?: string
  audioStatus?: 'pending' | 'generating' | 'complete' | 'partial' | 'failed'
  audioError?: string
}

// Enhanced Story Progress
export interface StoryProgress {
  storyId: string
  userId: string
  currentPage: number
  totalPages?: number
  lastReadSection?: string
  completed: boolean
  completedAt?: Date
  quizScore?: number
  quizAttempts: number
  savedWords: string[]
  lastReadAt: Date
  progress: number // 0-100 percentage
  timeSpent: number // Total time spent reading in seconds
  quizScores?: number[]
  vocabularyLearned?: string[]
  updatedAt: Date
}

// Story Bookmark interface
export interface StoryBookmark {
  id: string
  userId: string
  storyId: string
  storyTitle: string
  storyDifficulty: JLPTLevel
  bookmarkedAt: Date
  lastReadAt?: Date
  readingProgress: number // 0-100 progress
  notes?: string
  tags?: string[]
  isFavorite: boolean
  syncStatus: 'local' | 'synced' | 'pending'
  originalContent?: any // Story snapshot for offline access
  updatedAt: Date
}

export interface StoryStats {
  totalStoriesRead: number
  storiesReadToday: number
  lastStoryDate: string
  favoriteThemes: string[]
  averageQuizScore: number
  savedWordsFromStories: number
}

// Story themes
export const STORY_THEMES = [
  'Adventure',
  'School Life',
  'Traditional Culture',
  'Modern Life',
  'Fantasy',
  'Science Fiction',
  'Mystery',
  'Slice of Life',
  'Historical',
  'Comedy',
  'Nature',
  'Travel',
  'Food',
  'Family',
  'Friendship',
  'Sports',
  'Music',
  'Art',
  'Technology',
  'Festivals',
] as const

export type StoryTheme = (typeof STORY_THEMES)[number]

// Story tags for more specific categorization
export const STORY_TAGS = [
  'animals',
  'food',
  'travel',
  'friendship',
  'family',
  'work',
  'sports',
  'music',
  'art',
  'nature',
  'technology',
  'folklore',
  'seasons',
  'festivals',
  'daily-life',
] as const

export type StoryTag = (typeof STORY_TAGS)[number]

// Translation modes for learning-focused assistance
export type TranslationMode = 'off' | 'hints' | 'partial' | 'full' | 'learning'
export type TranslationProvider = 'ai' | 'google' | 'deepl' | 'azure'

// Reading Settings for Story Reader and Article Reader
export interface ReadingSettings {
  fontSize: 'small' | 'medium' | 'large' | 'xlarge'
  showFurigana: boolean
  highlightVocabulary: boolean
  highlightGrammar?: boolean // Highlight grammar patterns
  highlightMode: 'none' | 'all' | 'content' | 'grammar'
  darkMode: boolean
  autoPlay?: boolean
  playbackSpeed?: number // 0.5 to 2.0 - Audio playback speed

  // Enhanced Translation Settings
  showTranslation?: boolean // Legacy field - keep for backward compatibility
  translationMode: TranslationMode
  translationProvider: TranslationProvider
  showTranslationConfidence: boolean
  preserveGrammarStructure: boolean
  includeGrammarNotes: boolean
  autoAddToVocabulary: boolean // Automatically add unknown words to vocabulary list
  translationUserLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1' // For personalized translation assistance

  // Shadowing mode specific settings
  shadowingMode: boolean
}

// Selected Word for dictionary lookup
export interface SelectedWord {
  word: string
  reading?: string
  meanings?: string[]
  position: { x: number; y: number }
}

// Parsed Word for Japanese text processing
export interface ParsedWord {
  word: string
  reading?: string
  type?: string
}
