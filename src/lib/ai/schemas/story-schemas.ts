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
  questionJa: z.string().optional(),
  options: z.array(z.string()).optional(),
  correctAnswer: z.union([z.string(), z.number(), z.boolean()]),
  explanation: z.string().optional(),
  explanationJa: z.string().optional(),
  difficulty: z.number().int().min(1).max(5),
  tags: z.array(z.string()).optional(),
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
  imagePrompt: z.string().optional(),
  vocabularyNotes: z.record(z.string(), z.string()).optional(),
  grammarNotes: z.record(z.string(), z.string()).optional(),
}).passthrough();

// ============================================
// Vocabulary Item Schema
// ============================================

export const VocabularyItemSchema = z.object({
  word: z.string(),
  meaning: z.string(),
  reading: z.string().optional(),
  pageNumber: z.number().int().positive().optional(),
}).passthrough();

// ============================================
// Generated Story Schema (for StoryProcessor)
// ============================================

export const GeneratedStorySchema = z.object({
  title: z.string().min(1),
  titleJa: z.string().min(1),
  description: z.string(),
  pages: z.array(StoryPageSchema).min(1),
  vocabulary: z.array(VocabularyItemSchema).optional(),
  quiz: z.array(ReviewQuestionSchema).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
}).passthrough();

// ============================================
// Character Sheet Schema (for MultiStepStoryProcessor)
// ============================================

export const CharacterSchema = z.object({
  name: z.string(),
  nameJa: z.string(),
  description: z.string(),
  visualDescription: z.string(),
  personality: z.string().optional(),
  role: z.string().optional(),
});

export const SettingSchema = z.object({
  location: z.string(),
  time: z.string(),
  atmosphere: z.string(),
  visualDetails: z.string().optional(),
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
  summaryJa: z.string().optional(),
  imagePrompt: z.string(),
  keyVocabulary: z.array(z.string()).optional(),
  grammarPoints: z.array(z.string()).optional(),
}).passthrough();

export const StoryOutlineSchema = z.object({
  title: z.string(),
  titleJa: z.string(),
  description: z.string(),
  descriptionJa: z.string().optional(),
  pages: z.array(OutlinePageSchema).min(1),
  targetVocabulary: z.array(z.string()).optional(),
  targetGrammar: z.array(z.string()).optional(),
}).passthrough(); // Allow additional fields from AI

// ============================================
// Quiz Generation Schema
// ============================================

export const QuizQuestionsResponseSchema = z.object({
  questions: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      questionJa: z.string().optional(),
      options: z.array(z.string()).optional(),
      correctIndex: z.number().int().min(0), // AI returns correctIndex, we'll map to correctAnswer
      explanation: z.string().optional(),
      explanationJa: z.string().optional(),
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
  enhancedPrompt: z.string().optional(),
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
