/**
 * Unified AI Service Types
 * Central type definitions for all AI-powered features
 */

import { JLPTLevel } from '@/types/aiStory';

// ============================================
// Core Types
// ============================================

export type AIModel = 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo';

export type AITaskType =
  | 'generate_review_questions'
  | 'explain_grammar'
  | 'clean_transcript'
  | 'process_article'
  | 'generate_story'
  | 'generate_story_multistep'
  | 'generate_moodboard'
  | 'analyze_content'
  | 'suggest_improvements'
  | 'translate_content'
  | 'simplify_text'
  | 'generate_quiz'
  | 'create_flashcards'
  | 'fix_transcript'
  | 'extract_vocabulary';

export interface AIServiceConfig {
  model?: AIModel;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
  stream?: boolean;
  cacheResults?: boolean;
  cacheDuration?: number; // in seconds
}

// ============================================
// Request/Response Types
// ============================================

export interface AIRequest<T = any> {
  task: AITaskType;
  content: T;
  config?: TaskConfig;
  metadata?: RequestMetadata;
}

export interface AIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: TokenUsage;
  cached?: boolean;
  processingTime?: number;
  metadata?: ResponseMetadata;
}

export interface TaskConfig {
  jlptLevel?: JLPTLevel;
  targetLength?: 'short' | 'medium' | 'long';
  style?: 'formal' | 'casual' | 'academic';
  difficulty?: 'easy' | 'medium' | 'hard';
  includeExamples?: boolean;
  includeExplanations?: boolean;
  language?: string;
  customPrompt?: string;
  [key: string]: any; // Allow task-specific config
}

export interface RequestMetadata {
  userId?: string;
  sessionId?: string;
  source?: string;
  timestamp?: Date;
  priority?: 'low' | 'normal' | 'high';
}

export interface ResponseMetadata {
  modelUsed: AIModel;
  promptTokens?: number;
  completionTokens?: number;
  totalCost?: number;
  cacheHit?: boolean;
  processingSteps?: string[];
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

// ============================================
// Task-Specific Types
// ============================================

// Review Questions
export interface ReviewQuestionRequest {
  content: {
    kanji?: string[];
    vocabulary?: Array<{ word: string; reading: string; meaning: string }>;
    grammar?: string[];
    context?: string;
  };
  questionCount?: number;
  questionTypes?: Array<'multiple_choice' | 'fill_blank' | 'true_false' | 'matching' | 'ordering'>;
}

export interface ReviewQuestion {
  id: string;
  type: 'multiple_choice' | 'fill_blank' | 'true_false' | 'matching' | 'ordering';
  question: string;
  questionJa?: string;
  options?: string[];
  correctAnswer: string | number | boolean;
  explanation?: string;
  explanationJa?: string;
  difficulty: number; // 1-5
  tags?: string[];
}

// Grammar Explanation
export interface GrammarExplanationRequest {
  content: string; // Japanese text or grammar pattern
  focusPoints?: string[]; // Specific grammar points to explain
  compareWith?: string[]; // Similar patterns to compare
}

export interface GrammarExplanation {
  pattern: string;
  patternRomaji?: string;
  meaning: string;
  structure: string;
  examples: Array<{
    japanese: string;
    furigana?: string;
    translation: string;
    notes?: string;
  }>;
  commonMistakes?: string[];
  relatedPatterns?: string[];
  jlptLevel?: JLPTLevel;
  formality?: 'casual' | 'formal' | 'both';
}

// Transcript Processing
export interface TranscriptProcessRequest {
  content: {
    transcript: Array<{
      text: string;
      startTime?: number;
      endTime?: number;
    }>;
    videoTitle?: string;
    language?: string;
  };
  splitForShadowing?: boolean;
  maxSegmentLength?: number;
  addFurigana?: boolean;
  fixErrors?: boolean;
  improveNaturalness?: boolean;
}

export interface ProcessedTranscript {
  segments: Array<{
    id: string;
    text: string;
    textWithFurigana?: string;
    startTime: number;
    endTime: number;
    difficulty?: number;
    keyVocabulary?: string[];
  }>;
  summary?: string;
  keyPoints?: string[];
  vocabulary?: Array<{
    word: string;
    reading: string;
    meaning: string;
    frequency: number;
  }>;
}

// Article Processing
export interface ArticleProcessRequest {
  content: {
    html?: string;
    text?: string;
    url?: string;
    title?: string;
  };
  simplifyTo?: JLPTLevel;
  extractVocabulary?: boolean;
  generateSummary?: boolean;
  generateQuiz?: boolean;
  highlightGrammar?: boolean;
}

export interface ProcessedArticle {
  title: string;
  originalText: string;
  simplifiedText?: string;
  summary?: string;
  summaryJa?: string;
  vocabulary?: Array<{
    word: string;
    reading: string;
    meaning: string;
    jlptLevel?: JLPTLevel;
    frequency: 'common' | 'uncommon' | 'rare';
  }>;
  grammarPoints?: GrammarExplanation[];
  quiz?: ReviewQuestion[];
  readingTime?: number; // in minutes
  difficulty?: JLPTLevel;
}

// Story Generation
export interface StoryGenerationRequest {
  theme: string;
  characters?: any[];
  setting?: any;
  pageCount?: number;
  includeQuiz?: boolean;
  includeVocabulary?: boolean;
  visualStyle?: string;
}

export interface GeneratedStory {
  title: string;
  titleJa: string;
  description: string;
  pages: Array<{
    pageNumber: number;
    text: string;
    textWithFurigana: string;
    translation: string;
    imagePrompt?: string;
    vocabularyNotes?: Record<string, string>;
    grammarNotes?: Record<string, string>;
  }>;
  vocabulary?: any[];
  quiz?: ReviewQuestion[];
  metadata?: any;
}

// Moodboard Generation
export interface MoodboardGenerationRequest {
  theme: string;
  kanjiCount?: number;
  tags?: string[];
  focusAreas?: string[];
}

export interface GeneratedMoodboard {
  title: string;
  description: string;
  themeColor: string;
  emoji: string;
  kanjiList: Array<{
    kanji: string;
    meaning: string;
    onyomi: string[];
    kunyomi: string[];
    jlptLevel: JLPTLevel;
    strokeCount: number;
    examples: Array<{
      sentence: string;
      translation: string;
    }>;
    tags?: string[];
  }>;
}

// ============================================
// Processor Types
// ============================================

export interface ProcessorContext {
  model: AIModel;
  config: AIServiceConfig;
  userId?: string;
  sessionId?: string;
}

export interface ProcessorResult<T = any> {
  data: T;
  usage: TokenUsage;
  metadata?: any;
}

export abstract class BaseProcessor<TRequest = any, TResponse = any> {
  protected context: ProcessorContext;

  constructor(context: ProcessorContext) {
    this.context = context;
  }

  abstract process(request: TRequest, config?: TaskConfig): Promise<ProcessorResult<TResponse>>;
  abstract validateRequest(request: TRequest): void;
  abstract getPrompt(request: TRequest, config?: TaskConfig): string;
  abstract parseResponse(response: string): TResponse;
}

// ============================================
// Cache Types
// ============================================

export interface CacheEntry {
  key: string;
  data: any;
  timestamp: Date;
  expiresAt: Date;
  hits: number;
  metadata?: {
    task: AITaskType;
    model: AIModel;
    userId?: string;
  };
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
    super(message);
    this.name = 'AIServiceError';
  }
}

// ============================================
// Cost Estimation
// ============================================

export interface ModelPricing {
  model: AIModel;
  inputCostPer1k: number; // in USD
  outputCostPer1k: number; // in USD
}

export const MODEL_PRICING: Record<AIModel, ModelPricing> = {
  'gpt-4o-mini': {
    model: 'gpt-4o-mini',
    inputCostPer1k: 0.00015,
    outputCostPer1k: 0.0006
  },
  'gpt-4o': {
    model: 'gpt-4o',
    inputCostPer1k: 0.0025,
    outputCostPer1k: 0.01
  },
  'gpt-3.5-turbo': {
    model: 'gpt-3.5-turbo',
    inputCostPer1k: 0.0005,
    outputCostPer1k: 0.0015
  }
};

// ============================================
// Validation Types
// ============================================

export interface ValidationRule {
  field: string;
  type: 'required' | 'type' | 'length' | 'range' | 'pattern' | 'custom';
  value?: any;
  message: string;
  validator?: (value: any) => boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
}