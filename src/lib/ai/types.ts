/**
 * Unified AI Service Types
 * Central type definitions for all AI-powered features
 */

import { JLPTLevel } from '@/types/kanji'

// Re-export JLPTLevel for convenience
export type { JLPTLevel } from '@/types/kanji'

// ============================================
// Core Types
// ============================================

export type AIModel =
  | 'gpt-4'
  | 'gpt-4o-mini'
  | 'gpt-4o'
  | 'gpt-3.5-turbo'
  | 'gemini-2.5-flash-image'
  | 'gemini-3-pro-image'
  | 'dall-e-3'

export type AITaskType =
  | 'generate_review_questions'
  | 'explain_grammar'
  | 'explain_grammar_sentence'
  | 'explain_word'
  | 'generate_kanji_mnemonic'
  | 'clean_transcript'
  | 'process_article'
  | 'generate_story'
  | 'generate_story_multistep'
  | 'generate_moodboard'
  | 'generate_image'
  | 'generate_character_model_sheet'
  | 'enhance_image_prompt'
  | 'store_image'
  | 'analyze_content'
  | 'suggest_improvements'
  | 'translate_content'
  | 'simplify_text'
  | 'generate_quiz'
  | 'create_flashcards'
  | 'fix_transcript'
  | 'extract_vocabulary'

export interface AIServiceConfig {
  model?: AIModel
  temperature?: number
  maxTokens?: number
  timeout?: number
  maxRetries?: number
  stream?: boolean
  cacheResults?: boolean
  cacheDuration?: number // in seconds
}

// ============================================
// Request/Response Types
// ============================================

export interface AIRequest<T = any> {
  task: AITaskType
  content: T
  config?: TaskConfig
  metadata?: RequestMetadata
}

export interface AIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  usage?: TokenUsage
  cached?: boolean
  processingTime?: number
  metadata?: ResponseMetadata
}

export interface TaskConfig {
  jlptLevel?: JLPTLevel
  targetLength?: 'short' | 'medium' | 'long'
  style?: 'formal' | 'casual' | 'academic'
  difficulty?: 'easy' | 'medium' | 'hard'
  includeExamples?: boolean
  includeExplanations?: boolean
  language?: string
  customPrompt?: string
  [key: string]: any // Allow task-specific config
}

export interface RequestMetadata {
  userId?: string
  sessionId?: string
  source?: string
  timestamp?: Date
  priority?: 'low' | 'normal' | 'high'
  [key: string]: any // Allow task-specific metadata (step, draftId, pageNumber, etc.)
}

export interface ResponseMetadata {
  modelUsed: AIModel
  promptTokens?: number
  completionTokens?: number
  totalCost?: number
  cacheHit?: boolean
  processingSteps?: string[]
  errorCode?: string
  errorDetails?: string
  task?: AITaskType
  [key: string]: any // Allow additional processor-specific metadata
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCost: number
}

// ============================================
// Task-Specific Types
// ============================================

// Review Questions
export interface ReviewQuestionRequest {
  content: {
    kanji?: string[]
    vocabulary?: Array<{ word: string; reading: string; meaning: string }>
    grammar?: string[]
    context?: string
  }
  questionCount?: number
  questionTypes?: Array<'multiple_choice' | 'fill_blank' | 'true_false' | 'matching' | 'ordering'>
}

export interface ReviewQuestion {
  id: string
  type: 'multiple_choice' | 'fill_blank' | 'true_false' | 'matching' | 'ordering'
  question: string
  questionJa?: string
  options?: string[]
  correctAnswer: string | number | boolean
  explanation?: string
  explanationJa?: string
  difficulty: number // 1-5
  tags?: string[]
}

// Grammar Explanation
export interface GrammarExplanationRequest {
  content: string // Japanese text or grammar pattern
  focusPoints?: string[] // Specific grammar points to explain
  compareWith?: string[] // Similar patterns to compare
}

export interface GrammarSentenceExplanationRequest {
  sentence: string
  context?: string
  title?: string
  surroundingSentences?: string[]
  focusQuestion?: string
}

export interface GrammarExplanation {
  pattern: string
  patternRomaji?: string
  meaning: string
  structure: string
  examples: Array<{
    japanese: string
    furigana?: string
    translation: string
    notes?: string
  }>
  commonMistakes?: string[]
  relatedPatterns?: string[]
  jlptLevel?: JLPTLevel
  formality?: 'casual' | 'formal' | 'both'
}

// Word Explanation
export interface WordExplanationRequest {
  word: string
  context?: string
}

export interface KanjiBreakdown {
  kanji: string
  meaning: string
  kunYomi: string[]
  onYomi: string[]
}

export interface ConjugationTable {
  dictionary: string
  present?: string
  past?: string
  negative?: string
  teForm?: string
  potential?: string
  passive?: string
  causative?: string
  imperative?: string
  volitional?: string
}

export interface PitchAccent {
  pattern: string
  notation: string
}

export interface RelatedWords {
  synonyms?: string[]
  antonyms?: string[]
  compounds?: string[]
  relatedExpressions?: string[]
}

export interface WordExplanation {
  word: string
  reading: string
  romaji: string
  meaning: string
  partOfSpeech: string
  // Surface forms seen in content (e.g., conjugations or inflected forms)
  surfaceForms?: string[]

  // Optional precomputed audio (preferred over client TTS when available)
  audioUrl?: string

  // Kanji breakdown
  kanjiBreakdown?: KanjiBreakdown[]

  // Conjugation (for verbs/adjectives) - basic forms from AI
  conjugation?: ConjugationTable

  // Full conjugations (100+ forms) - generated by ExtendedConjugationEngine
  // This is populated during precompute for verbs and adjectives
  fullConjugations?: {
    conjugationType: string // 'Ichidan' | 'Godan' | 'Irregular' | 'i-adjective' | 'na-adjective'
    forms: Record<string, string> // ExtendedConjugationForms as a plain object
  }

  // Pitch accent
  pitchAccent?: PitchAccent

  // Related words
  relatedWords?: RelatedWords

  // Context sentence + translation captured during precompute
  contextSentence?: string
  contextTranslation?: string

  // Usage
  jlptLevel?: JLPTLevel
  formality: 'casual' | 'formal' | 'neutral' | 'both'
  usageNotes?: string

  // Examples
  examples: Array<{
    japanese: string
    furigana: string
    translation: string
    notes?: string
  }>
}

// Kanji Mnemonic
export interface KanjiMnemonicRequest {
  kanji: string
  meaning?: string
  components?: string[]
}

export interface KanjiMnemonicComponent {
  part: string
  meaning: string
}

export interface KanjiMnemonic {
  kanji: string
  meaning: string
  mnemonic: string
  components?: KanjiMnemonicComponent[]
  createdAt: Date
  provider: 'ollama' | 'openai' | 'koohii' | 'manual'
  version?: number
  author?: string  // For koohii attribution
  votes?: number   // Koohii community votes
}

// Transcript Processing
export interface TranscriptProcessRequest {
  content: {
    transcript: Array<{
      text: string
      startTime?: number
      endTime?: number
    }>
    videoTitle?: string
    language?: string
  }
  splitForShadowing?: boolean
  maxSegmentLength?: number
  addFurigana?: boolean
  fixErrors?: boolean
  improveNaturalness?: boolean
  includeTranslations?: boolean
}

export interface ProcessedTranscript {
  segments: Array<{
    id: string
    text: string
    textWithFurigana?: string
    startTime: number
    endTime: number
    difficulty?: number
    keyVocabulary?: string[]
    translation?: string
  }>
  summary?: string
  keyPoints?: string[]
  vocabulary?: Array<{
    word: string
    reading: string
    meaning: string
    frequency: number
  }>
  metadata?: Record<string, any>
}

// Article Processing
export interface ArticleProcessRequest {
  content: {
    html?: string
    text?: string
    url?: string
    title?: string
  }
  simplifyTo?: JLPTLevel
  extractVocabulary?: boolean
  generateSummary?: boolean
  generateQuiz?: boolean
  highlightGrammar?: boolean
}

export interface ProcessedArticle {
  title: string
  originalText: string
  simplifiedText?: string
  summary?: string
  summaryJa?: string
  vocabulary?: Array<{
    word: string
    reading: string
    meaning: string
    jlptLevel?: JLPTLevel
    frequency: 'common' | 'uncommon' | 'rare'
  }>
  grammarPoints?: GrammarExplanation[]
  quiz?: ReviewQuestion[]
  readingTime?: number // in minutes
  difficulty?: JLPTLevel
}

// Story Generation
export interface StoryGenerationRequest {
  theme: string
  characters?: any[]
  setting?: any
  pageCount?: number
  includeQuiz?: boolean
  includeVocabulary?: boolean
  visualStyle?: string
  metadata?: Record<string, any>
}

export interface GeneratedStory {
  title: string
  titleJa: string
  description: string
  pages: Array<{
    pageNumber: number
    text: string
    textWithFurigana: string
    translation: string
    imagePrompt?: string
    vocabularyNotes?: Record<string, string>
    grammarNotes?: Record<string, string>
  }>
  vocabulary?: any[]
  quiz?: ReviewQuestion[]
  metadata?: any
}

// Moodboard Generation
export interface MoodboardGenerationRequest {
  theme: string
  kanjiCount?: number
  tags?: string[]
  focusAreas?: string[]
}

export interface GeneratedMoodboard {
  title: string
  description: string
  themeColor: string
  emoji: string
  kanjiList: Array<{
    kanji: string
    meaning: string
    onyomi: string[]
    kunyomi: string[]
    jlptLevel: JLPTLevel
    strokeCount: number
    examples: Array<{
      sentence: string
      translation: string
    }>
    tags?: string[]
  }>
}

// Image Generation
export interface ImageGenerationRequest {
  prompt: string
  characterProfile?: CharacterProfile
  sessionId?: string
  size?: '1024x1024' | '1792x1024' | '1024x1792'
  quality?: 'standard' | 'hd'
  style?: 'vivid' | 'natural'
  model?: 'dall-e-3' | 'dall-e-2'
}

export interface GeneratedImage {
  imageUrl: string
  revisedPrompt?: string
  provider: 'openai' | 'stability' | 'midjourney' | 'gemini'
  metadata?: {
    prompt: string
    model: string
    size: string
    quality: string
  }
}

// Character Model Sheet
export interface CharacterModelSheetRequest {
  character: {
    name: string
    nameJa: string
    description: string
    visualDescription: string
  }
  visualStyle: string
}

export interface GeneratedModelSheet {
  imageUrl: string
  characterProfile: CharacterProfile
  sessionId: string
  revisedPrompt?: string
}

// Character Profile for Consistency
export interface CharacterProfile {
  characterId: string
  gender: 'male' | 'female' | 'non-binary'
  apparentAge: string
  hairStyle: string
  hairColor: string
  eyeColor: string
  skinTone: string
  facialFeatures: string
  bodyBuild: string
  height: string
  primaryOutfit: string
  outfitColors: string
  accessories?: string
  artStyle: string
  styleModifiers: string[]
}

// Image Prompt Enhancement
export interface ImagePromptEnhancementRequest {
  basePrompt: string
  pageText?: string
  pageTranslation?: string
  characterName?: string
  characterDescription?: string
  setting?: string
  theme?: string
}

export interface EnhancedImagePrompt {
  enhancedPrompt: string
  originalPrompt: string
  metadata?: {
    characterIncluded: boolean
    settingIncluded: boolean
    visualStyleApplied: boolean
  }
}

// Image Storage
export interface ImageStorageRequest {
  imageUrl: string
  storagePath: string
  metadata?: {
    storyId?: string
    pageNumber?: number
    characterId?: string
    generatedAt?: string
  }
}

export interface StoredImage {
  url: string
  path: string
  expiresAt?: string
  metadata?: Record<string, any>
}

// ============================================
// Processor Types
// ============================================

export interface ProcessorContext {
  model: AIModel
  config: AIServiceConfig
  userId?: string
  sessionId?: string
}

export interface ProcessorResult<T = any> {
  data: T
  usage: TokenUsage
  metadata?: any
}

export abstract class BaseProcessor<TRequest = any, TResponse = any> {
  protected context: ProcessorContext

  constructor(context: ProcessorContext) {
    this.context = context
  }

  abstract process(request: TRequest, config?: TaskConfig): Promise<ProcessorResult<TResponse>>
  abstract validateRequest(request: TRequest): void
  abstract getPrompt(request: TRequest, config?: TaskConfig): string
  abstract parseResponse(response: string): TResponse
}

// ============================================
// Cache Types
// ============================================

export interface CacheEntry {
  key: string
  data: any
  timestamp: Date
  expiresAt: Date
  hits: number
  metadata?: {
    task: AITaskType
    model: AIModel
    userId?: string
  }
}

// ============================================
// Error Types
// ============================================

export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'AIServiceError'
  }
}

// ============================================
// Cost Estimation
// ============================================

export interface ModelPricing {
  model: AIModel
  inputCostPer1k: number // in USD
  outputCostPer1k: number // in USD
}

export const MODEL_PRICING: Record<AIModel, ModelPricing> = {
  'gpt-4': {
    model: 'gpt-4',
    inputCostPer1k: 0.03,
    outputCostPer1k: 0.06,
  },
  'gpt-4o-mini': {
    model: 'gpt-4o-mini',
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006,
  },
  'gpt-4o': {
    model: 'gpt-4o',
    inputCostPer1k: 0.0025,
    outputCostPer1k: 0.01,
  },
  'gpt-3.5-turbo': {
    model: 'gpt-3.5-turbo',
    inputCostPer1k: 0.0005,
    outputCostPer1k: 0.0015,
  },
  'gemini-2.5-flash-image': {
    model: 'gemini-2.5-flash-image',
    inputCostPer1k: 0, // Free tier
    outputCostPer1k: 0.02, // ~$0.02 per image
  },
  'gemini-3-pro-image': {
    model: 'gemini-3-pro-image',
    inputCostPer1k: 0,
    outputCostPer1k: 0.04, // ~$0.04 per image (higher quality)
  },
  'dall-e-3': {
    model: 'dall-e-3',
    inputCostPer1k: 0,
    outputCostPer1k: 0.04, // ~$0.04 per image (standard quality 1024x1024)
  },
}

// ============================================
// Validation Types
// ============================================

export interface ValidationRule {
  field: string
  type: 'required' | 'type' | 'length' | 'range' | 'pattern' | 'custom'
  value?: any
  message: string
  validator?: (value: any) => boolean
}

export interface ValidationResult {
  valid: boolean
  errors: Array<{
    field: string
    message: string
  }>
}
