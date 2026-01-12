/**
 * Comic Types for "Moshi Goes to Japan" Series
 *
 * Separate from story types - comics have panels, speech bubbles,
 * and use persistent character references for consistency.
 */

import { JLPTLevel } from './kanji'
import { BaseQuizQuestion } from './quiz'

export type { JLPTLevel }

/**
 * Character role in the series
 */
export type CharacterRole = 'protagonist' | 'mentor' | 'friend' | 'recurring' | 'guest'

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
  role: CharacterRole // Role in the series
  isMascot: boolean // True for Moshi
  speakingStyle?: string // How the character speaks (formal, casual, etc.)
  catchphrase?: string // Optional catchphrase
  referenceImageUrl: string // Firebase Storage URL
  referenceImageData: string // Base64 for Gemini consistency
  colorPalette: string[] // Main colors for consistency
  props?: string[] // Character props (staff, backpack, etc.)
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

  // Word explanation async generation status
  wordExplanationsStatus?: 'generating' | 'complete' | 'failed'
  wordExplanationsStartedAt?: Date
  wordExplanationsCompletedAt?: Date
  wordExplanationsFailedAt?: Date
  wordExplanationsError?: string
  wordExplanationsCount?: number

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
  characters: string[] // Character IDs appearing in this panel
  dialogues: PanelDialogue[]
  narration?: {
    textJa: string
    textEn: string
    furigana?: string // Full text with furigana markup (ruby tags)
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

/**
 * Comic quiz question type - now unified with BaseQuizQuestion
 *
 * Comics support additional features like listening questions and panel references,
 * which are handled through optional fields in BaseQuizQuestion
 */
export type ComicQuizQuestion = BaseQuizQuestion

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
    characters: string[] // Character IDs appearing in this panel
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

/**
 * Queue item for scheduled comic generation
 */
export interface ComicQueueItem {
  id: string
  theme: string // e.g., 'temple', 'sakura'
  location: string // e.g., 'Senso-ji Temple'
  titleEn?: string // Optional override
  titleJa?: string // Optional override
  characterIds: string[] // ['moshi-master', 'sensei-panda']
  jlptLevel: JLPTLevel
  priority: number // For ordering (lower = first)
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: Date
  createdBy: string // Admin user ID
  scheduledFor?: Date // Optional: specific date
  processedAt?: Date
  episodeId?: string // Set after generation
  error?: string // If failed
}

/**
 * Available characters for comics
 */
export const COMIC_CHARACTERS = [
  { id: 'moshi-master', name: 'Moshi', nameJa: 'もし', role: 'protagonist' },
  { id: 'sensei-panda', name: 'Sensei', nameJa: '先生', role: 'mentor' },
  { id: 'yuki-sloth', name: 'Yuki', nameJa: 'ゆき', role: 'friend' },
  { id: 'koa-koala', name: 'Koa', nameJa: 'コア', role: 'friend' },
] as const

/**
 * Episode themes with locations and default characters
 */
export const EPISODE_THEMES = [
  // Solo Moshi episodes (introductory)
  { theme: 'arrival', location: 'Narita Airport', titleEn: 'Arriving in Japan', titleJa: '日本に到着', characters: ['moshi-master'] },

  // Episodes with Sensei (learning cultural lessons)
  { theme: 'temple', location: 'Senso-ji Temple', titleEn: 'Temple Visit', titleJa: 'お寺参り', characters: ['moshi-master', 'sensei-panda'] },
  { theme: 'geisha', location: 'Kyoto Gion', titleEn: 'Kyoto Magic', titleJa: '京都の魔法', characters: ['moshi-master', 'sensei-panda'] },
  { theme: 'castle', location: 'Osaka Castle', titleEn: 'Castle Adventure', titleJa: 'お城冒険', characters: ['moshi-master', 'sensei-panda'] },
  { theme: 'onsen', location: 'Hot Spring Town', titleEn: 'Onsen Experience', titleJa: '温泉体験', characters: ['moshi-master', 'sensei-panda'] },

  // Episodes with Yuki (relaxed, mindful adventures)
  { theme: 'sakura', location: 'Ueno Park', titleEn: 'Cherry Blossoms', titleJa: '桜を見る', characters: ['moshi-master', 'yuki-sloth'] },
  { theme: 'rain', location: 'Tokyo Streets', titleEn: 'Rainy Day', titleJa: '雨の日', characters: ['moshi-master', 'yuki-sloth'] },
  { theme: 'ramen', location: 'Ramen Shop', titleEn: 'Ramen Quest', titleJa: 'ラーメン探し', characters: ['moshi-master', 'yuki-sloth'] },
  { theme: 'konbini', location: 'Convenience Store', titleEn: 'Konbini Adventure', titleJa: 'コンビニ冒険', characters: ['moshi-master', 'yuki-sloth'] },

  // Episodes with Koa (adventurous exploration)
  { theme: 'train', location: 'Shinkansen', titleEn: 'First Train Ride', titleJa: '初めての電車', characters: ['moshi-master', 'koa-koala'] },
  { theme: 'lost', location: 'Shibuya', titleEn: 'Lost in Tokyo', titleJa: '東京で迷子', characters: ['moshi-master', 'koa-koala'] },
  { theme: 'arcade', location: 'Game Center', titleEn: 'Arcade Challenge', titleJa: 'ゲームセンター', characters: ['moshi-master', 'koa-koala'] },
  { theme: 'snow', location: 'Hokkaido', titleEn: 'Snow Day', titleJa: '雪の日', characters: ['moshi-master', 'koa-koala'] },

  // Group episodes (multiple friends)
  { theme: 'matsuri', location: 'Summer Festival', titleEn: 'Festival Fun', titleJa: 'お祭り', characters: ['moshi-master', 'yuki-sloth', 'koa-koala'] },
  { theme: 'sushi', location: 'Sushi Restaurant', titleEn: 'Sushi Surprise', titleJa: 'お寿司びっくり', characters: ['moshi-master', 'yuki-sloth', 'koa-koala'] },
  { theme: 'karaoke', location: 'Karaoke Box', titleEn: 'Karaoke Night', titleJa: 'カラオケの夜', characters: ['moshi-master', 'yuki-sloth', 'koa-koala'] },
  { theme: 'deer', location: 'Nara Park', titleEn: 'Deer Friends', titleJa: '鹿の友達', characters: ['moshi-master', 'yuki-sloth', 'koa-koala'] },
  { theme: 'fishing', location: 'Tsukiji Market', titleEn: 'Fish Market Morning', titleJa: '魚市場の朝', characters: ['moshi-master', 'sensei-panda', 'koa-koala'] },
  { theme: 'school', location: 'Japanese School', titleEn: 'Making Friends', titleJa: '友達を作る', characters: ['moshi-master', 'sensei-panda', 'yuki-sloth', 'koa-koala'] },

  // Finale with all characters
  { theme: 'goodbye', location: 'Tokyo Station', titleEn: 'Until Next Time', titleJa: 'また会う日まで', characters: ['moshi-master', 'sensei-panda', 'yuki-sloth', 'koa-koala'] },
] as const

export type ComicTheme = (typeof EPISODE_THEMES)[number]
