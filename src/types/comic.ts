/**
 * Comic Types for "Moshi Goes to Japan" Series
 *
 * Separate from story types - comics have panels, speech bubbles,
 * and use persistent character references for consistency.
 */

import { JLPTLevel } from './kanji'

export type { JLPTLevel }

/**
 * Saved character sheet for reuse across episodes
 */
export interface SavedCharacter {
  id: string
  name: string
  nameJa: string
  description: string
  visualDescription: string
  personality: string
  isMascot: boolean // True for Moshi
  referenceImageUrl: string // Firebase Storage URL
  referenceImageData: string // Base64 for Gemini consistency
  colorPalette: string[] // Main colors for consistency
  tags: string[]
  usedInEpisodes: string[] // Episode IDs
  createdAt: Date
  createdBy: string
  updatedAt: Date
}

/**
 * Comic series metadata
 */
export interface ComicSeries {
  id: string
  slug: string
  title: string
  titleJa: string
  description: string
  descriptionJa: string
  coverImageUrl: string
  mainCharacterId: string // Reference to saved_characters
  supportingCharacterIds: string[]
  defaultJlptLevel: JLPTLevel
  visualStyle: string
  settings: ComicSeriesSettings
  episodeCount: number
  publishedEpisodeCount: number
  totalViews: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ComicSeriesSettings {
  panelLayout: 'vertical-scroll' | '2x2-grid' | 'manga-style'
  panelsPerPage: number
  aspectRatio: '9:16' | '3:4' | '1:1' // Vertical for mobile webtoon style
  speechBubbleStyle: 'round' | 'cloud' | 'sharp'
  includeFurigana: boolean
  includeTranslation: boolean
  generateAudio: boolean
}

/**
 * A single comic episode (equivalent to a story)
 */
export interface ComicEpisode {
  id: string
  seriesId: string
  slug: string
  episodeNumber: number
  title: string
  titleJa: string
  description: string
  descriptionJa: string
  coverImageUrl: string
  jlptLevel: JLPTLevel
  theme: string // e.g., "konbini", "train station", "temple"
  location: string // e.g., "Tokyo", "Kyoto"
  panels: ComicPanel[]
  vocabulary: ComicVocabulary[]
  grammarPoints: string[]
  culturalNotes: CulturalNote[]
  quiz?: ComicQuiz
  metadata: ComicEpisodeMetadata
  status: 'draft' | 'review' | 'published' | 'archived'
  publishedAt?: Date
  createdAt: Date
  updatedAt: Date
}

/**
 * A single panel in a comic
 */
export interface ComicPanel {
  panelNumber: number
  imageUrl: string
  imagePrompt: string // For regeneration
  sceneDescription: string
  dialogues: PanelDialogue[]
  narration?: {
    textJa: string
    textEn: string
    audioUrl?: string
  }
  soundEffects?: SoundEffect[]
  highlightedVocabulary: string[] // Word IDs to highlight
}

/**
 * Speech bubble content
 */
export interface PanelDialogue {
  characterId: string
  characterName: string
  textJa: string
  textEn: string
  furigana?: string // Full text with furigana markup
  audioUrl?: string
  bubblePosition: {
    x: number // 0-100 percentage
    y: number // 0-100 percentage
  }
  bubbleStyle: 'speech' | 'thought' | 'shout' | 'whisper'
  emotion: 'neutral' | 'happy' | 'surprised' | 'confused' | 'excited' | 'sad'
}

/**
 * Japanese sound effects (onomatopoeia)
 */
export interface SoundEffect {
  textJa: string // e.g., "ドキドキ", "ガタンゴトン"
  meaning: string // e.g., "heart pounding", "train sounds"
  position: {
    x: number
    y: number
  }
}

/**
 * Vocabulary item extracted from episode
 */
export interface ComicVocabulary {
  id: string
  word: string
  reading: string
  meaning: string
  partOfSpeech: string
  jlptLevel: JLPTLevel
  usedInPanels: number[] // Panel numbers where this word appears
  exampleFromComic: string // Sentence from the comic
  audioUrl?: string
}

/**
 * Cultural notes for learning context
 */
export interface CulturalNote {
  id: string
  title: string
  titleJa: string
  content: string
  contentJa: string
  relatedPanels: number[]
  iconEmoji: string // e.g., "🏯", "🍱", "🚃"
}

/**
 * Quiz for the episode
 */
export interface ComicQuiz {
  questions: ComicQuizQuestion[]
  passingScore: number // Percentage
}

export interface ComicQuizQuestion {
  id: string
  type: 'multiple-choice' | 'fill-blank' | 'listening' | 'reading-comprehension'
  questionJa: string
  questionEn: string
  options?: string[]
  correctAnswer: string | number
  explanation: string
  explanationJa: string
  relatedPanel?: number
  audioUrl?: string // For listening questions
}

/**
 * Episode metadata
 */
export interface ComicEpisodeMetadata {
  generatedAt: Date
  generatedBy: string // Admin user ID or 'scheduler'
  aiModel: string
  imageModel: string
  totalTokensUsed: number
  totalImageGenerations: number
  estimatedCost: number
  generationTimeSeconds: number
  isAIGenerated: boolean
  characterRefsUsed: string[] // Character IDs used for consistency
}

/**
 * Draft for episode generation (similar to ai_story_drafts)
 */
export interface ComicEpisodeDraft {
  id: string
  seriesId: string
  episodeNumber: number
  theme: string
  location: string
  jlptLevel: JLPTLevel

  // Generation progress
  status: 'generating' | 'panels_complete' | 'images_complete' | 'review' | 'published' | 'failed'
  currentStep: ComicGenerationStep
  progress: number // 0-100

  // Generated content
  outline?: ComicOutline
  panels?: ComicPanel[]
  vocabulary?: ComicVocabulary[]
  culturalNotes?: CulturalNote[]
  quiz?: ComicQuiz

  // Character references for consistency
  characterRefs: {
    characterId: string
    referenceImageData: string
  }[]

  // Error handling
  error?: string
  retryCount: number

  createdAt: Date
  updatedAt: Date
}

export type ComicGenerationStep =
  | 'outline'
  | 'panels'
  | 'dialogues'
  | 'images'
  | 'vocabulary'
  | 'cultural_notes'
  | 'quiz'
  | 'audio'
  | 'complete'

/**
 * Outline generated before panels
 */
export interface ComicOutline {
  title: string
  titleJa: string
  synopsis: string
  synopsisJa: string
  panelBreakdown: {
    panelNumber: number
    description: string
    keyDialogue: string
    vocabularyFocus: string[]
  }[]
  learningObjectives: string[]
}

/**
 * User progress tracking
 */
export interface ComicProgress {
  odUserId: string
  odseriesId: string
  episodeId: string
  panelsRead: number[]
  vocabularyLearned: string[]
  quizScore?: number
  quizAttempts: number
  completedAt?: Date
  lastReadAt: Date
  createdAt: Date
}

/**
 * Generation request for scheduler/manual trigger
 */
export interface ComicGenerationRequest {
  seriesId: string
  theme?: string // Optional override
  location?: string
  jlptLevel?: JLPTLevel // Optional override
  episodeNumber?: number // Auto-increment if not specified
  triggeredBy: 'scheduler' | 'manual'
  adminKey?: string
}

/**
 * Generation log for audit trail
 */
export interface ComicGenerationLog {
  id: string
  seriesId: string
  episodeId?: string
  episodeNumber: number
  theme: string
  jlptLevel: JLPTLevel
  success: boolean
  error?: string
  durationMs: number
  tokensUsed: number
  imagesGenerated: number
  estimatedCost: number
  triggeredBy: 'scheduler' | 'manual'
  triggeredByUserId?: string
  createdAt: Date
}
