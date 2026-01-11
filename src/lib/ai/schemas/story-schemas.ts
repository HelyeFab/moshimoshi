/**
 * Zod Schemas for Story Generation with OpenAI Structured Outputs
 *
 * These schemas ensure 100% reliability when generating stories with AI.
 * They match the existing TypeScript interfaces but provide runtime validation.
 */

import { z } from 'zod';

// ============================================
// JLPT Level Schema
// ============================================

export const JLPTLevelSchema = z.enum(['N5', 'N4', 'N3', 'N2', 'N1']);

// ============================================
// Review Question Schemas
// ============================================

export const ReviewQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(['multiple_choice', 'fill_blank', 'true_false', 'matching', 'ordering']),
  question: z.string(),
  questionJa: z.string().default(''),
  options: z.array(z.string()).default([]),
  correctAnswer: z.union([z.string(), z.number(), z.boolean()]),
  explanation: z.string().default(''),
  explanationJa: z.string().default(''),
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string()).default([]),
});

// Don't export conflicting types - use existing types from src/lib/ai/types.ts

// ============================================
// Story Page Schema
// ============================================

export const StoryPageSchema = z.object({
  pageNumber: z.number().int().positive(),
  text: z.string().min(1),
  textWithFurigana: z.string().min(1),
  translation: z.string().min(1),
  imagePrompt: z.string().default(''),
  vocabularyNotes: z.record(z.string(), z.string()).default({}),
  grammarNotes: z.record(z.string(), z.string()).default({}),
}).passthrough();

// ============================================
// Vocabulary Item Schema
// ============================================

export const VocabularyItemSchema = z.object({
  word: z.string(),
  meaning: z.string(),
  reading: z.string().default(''),
  pageNumber: z.number().int().positive().default(0),
}).passthrough();

// ============================================
// Generated Story Schema (for StoryProcessor)
// ============================================

export const GeneratedStorySchema = z.object({
  title: z.string().min(1),
  titleJa: z.string().min(1),
  description: z.string(),
  pages: z.array(StoryPageSchema).min(1),
  vocabulary: z.array(VocabularyItemSchema).default([]),
  quiz: z.array(ReviewQuestionSchema).default([]),
  metadata: z.record(z.string(), z.any()).default({}),
}).passthrough();

// ============================================
// Character Sheet Schema (for MultiStepStoryProcessor)
// ============================================

export const CharacterSchema = z.object({
  name: z.string(),
  nameJa: z.string(),
  description: z.string(),
  visualDescription: z.string(),
  personality: z.string().default(''),
  role: z.string().default(''),
});

export const SettingSchema = z.object({
  location: z.string(),
  time: z.string(),
  atmosphere: z.string(),
  visualDetails: z.string().default(''),
}).passthrough(); // Allow additional fields from AI

export const CharacterSheetSchema = z.object({
  mainCharacter: z.object({
    name: z.string(),
    nameJa: z.string(),
    description: z.string(),
    visualDescription: z.string(),
    personality: z.string().default(''),
    referenceImage: z.string().default(''),
  }),
  supportingCharacters: z.array(
    z.object({
      name: z.string(),
      nameJa: z.string(),
      description: z.string(),
      visualDescription: z.string(),
      role: z.string().default(''),
      referenceImage: z.string().default(''),
    })
  ),
  setting: SettingSchema,
  visualStyle: z.string(),
  saveForReuse: z.boolean().default(false),
  colorPalette: z.array(z.string()).default([]),
  moodKeywords: z.array(z.string()).default([]),
}).passthrough(); // Allow additional fields

// ============================================
// Story Outline Schema (for MultiStepStoryProcessor)
// ============================================

export const OutlinePageSchema = z.object({
  pageNumber: z.number().int().positive(),
  summary: z.string(),
  summaryJa: z.string().default(''),
  imagePrompt: z.string(),
  keyVocabulary: z.array(z.string()).default([]),
  grammarPoints: z.array(z.string()).default([]),
}).passthrough();

export const StoryOutlineSchema = z.object({
  title: z.string(),
  titleJa: z.string(),
  description: z.string(),
  descriptionJa: z.string().default(''),
  pages: z.array(OutlinePageSchema).min(1),
  targetVocabulary: z.array(z.string()).default([]),
  targetGrammar: z.array(z.string()).default([]),
}).passthrough(); // Allow additional fields from AI

// ============================================
// Quiz Generation Schema
// ============================================

export const QuizQuestionsResponseSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      questionJa: z.string().default(''),
      options: z.array(z.string()).default([]),
      correctIndex: z.number().int().min(0), // AI returns correctIndex, we'll map to correctAnswer
      explanation: z.string().default(''),
      explanationJa: z.string().default(''),
    })
  ),
}).passthrough();

// ============================================
// Model Sheet Generation Schema
// ============================================

export const ModelSheetPromptSchema = z.object({
  prompt: z.string(),
  characterId: z.string(),
}).passthrough();

// ============================================
// Page Image Prompt Schema
// ============================================

export const PageImagePromptSchema = z.object({
  imagePrompt: z.string(),
  enhancedPrompt: z.string().default(''),
  pageNumber: z.number().int().positive(),
}).passthrough();

// ============================================
// Helper Functions
// ============================================

/**
 * Validates story data against schema
 * Returns validation result with typed errors
 */
export function validateStory(data: unknown) {
  return GeneratedStorySchema.safeParse(data);
}

/**
 * Validates character sheet against schema
 */
export function validateCharacterSheet(data: unknown) {
  return CharacterSheetSchema.safeParse(data);
}

/**
 * Validates story outline against schema
 */
export function validateStoryOutline(data: unknown) {
  return StoryOutlineSchema.safeParse(data);
}

/**
 * Validates story page against schema
 */
export function validateStoryPage(data: unknown) {
  return StoryPageSchema.safeParse(data);
}
