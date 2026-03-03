/**
 * Zod Schema for Drill Word Resolver AI Processor
 *
 * Validates AI output that resolves unknown/uncertain Focus Word inputs
 * into drill-ready metadata. No conjugation forms are generated.
 *
 * Used by:
 * - DrillWordResolverProcessor (OpenAI with Structured Outputs)
 * - DrillWordResolverProcessorHybrid (Ollama with post-response validation)
 *
 * NOTE: OpenAI Structured Outputs requires .nullable() instead of .optional()
 * for fields that may be absent. We use .nullable() on the main schema for
 * OpenAI compatibility, and export a lenient schema for Ollama validation.
 *
 * SEMANTIC INVARIANT (enforced via superRefine):
 *   verb          → conjugationType must be Ichidan | Godan | Irregular
 *   i-adjective   → conjugationType must be 'i-adjective'
 *   na-adjective  → conjugationType must be 'na-adjective'
 *   noun/adverb/particle/other → conjugationType must be null (or missing in lenient)
 */

import { z } from 'zod';

// ============================================
// Drill Word Resolver Schema
// ============================================

export const DrillWordResolverConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const DrillWordResolverConjugationTypeSchema = z.enum([
  'Ichidan',
  'Godan',
  'Irregular',
  'i-adjective',
  'na-adjective',
]);

export const DrillWordResolverPartOfSpeechSchema = z.enum([
  'verb',
  'i-adjective',
  'na-adjective',
  'noun',
  'adverb',
  'particle',
  'other',
]);

// ============================================
// Semantic consistency refinement
// ============================================

const VERB_CONJUGATION_TYPES = new Set(['Ichidan', 'Godan', 'Irregular']);
const NON_CONJUGATABLE_POS = new Set(['noun', 'adverb', 'particle', 'other']);

/**
 * Enforce partOfSpeech ↔ conjugationType consistency.
 * Shared by both main and lenient schemas.
 */
function refinePartOfSpeechConsistency(
  data: { partOfSpeech: string; conjugationType?: string | null },
  ctx: z.RefinementCtx
): void {
  const { partOfSpeech, conjugationType } = data;
  // Normalize: treat undefined the same as null for consistency checks
  const ct = conjugationType ?? null;

  if (partOfSpeech === 'verb') {
    if (ct === null || !VERB_CONJUGATION_TYPES.has(ct)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['conjugationType'],
        message: `verb requires conjugationType to be one of Ichidan, Godan, Irregular (got ${ct === null ? 'null' : `"${ct}"`})`,
      });
    }
  } else if (partOfSpeech === 'i-adjective') {
    if (ct !== 'i-adjective') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['conjugationType'],
        message: `i-adjective requires conjugationType "i-adjective" (got ${ct === null ? 'null' : `"${ct}"`})`,
      });
    }
  } else if (partOfSpeech === 'na-adjective') {
    if (ct !== 'na-adjective') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['conjugationType'],
        message: `na-adjective requires conjugationType "na-adjective" (got ${ct === null ? 'null' : `"${ct}"`})`,
      });
    }
  } else if (NON_CONJUGATABLE_POS.has(partOfSpeech)) {
    if (ct !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['conjugationType'],
        message: `${partOfSpeech} must not have a conjugationType (got "${ct}")`,
      });
    }
  }
}

// ============================================
// Alternative schema (used inside arrays — also refined)
// ============================================

const DrillWordResolverAlternativeBaseSchema = z.object({
  surface: z.string().describe('Alternative surface form'),
  lemma: z.string().describe('Alternative dictionary form'),
  reading: z.string().describe('Alternative hiragana reading'),
  meaning: z.string().nullable().describe('Alternative English meaning'),
  partOfSpeech: DrillWordResolverPartOfSpeechSchema.describe('Part of speech'),
  conjugationType: DrillWordResolverConjugationTypeSchema.nullable()
    .describe('Conjugation type if conjugatable'),
  confidence: DrillWordResolverConfidenceSchema.describe('Confidence level'),
});

export const DrillWordResolverAlternativeSchema =
  DrillWordResolverAlternativeBaseSchema.superRefine(refinePartOfSpeechConsistency);

// ============================================
// Main schema — OpenAI Structured Outputs compatible
// ============================================

const DrillWordResolverResultBaseSchema = z.object({
  surface: z.string().describe('Surface form as given or normalized'),
  lemma: z.string().describe('Dictionary/base form'),
  reading: z.string().describe('Hiragana reading of the lemma'),
  meaning: z.string().nullable().describe('Primary English meaning'),
  partOfSpeech: DrillWordResolverPartOfSpeechSchema.describe('Part of speech classification'),
  conjugationType: DrillWordResolverConjugationTypeSchema.nullable()
    .describe('Conjugation type for conjugatable words (verbs, adjectives)'),
  confidence: DrillWordResolverConfidenceSchema.describe('Resolution confidence'),
  alternatives: z.array(DrillWordResolverAlternativeSchema).nullable()
    .describe('Alternative interpretations if ambiguous'),
  notes: z.string().nullable()
    .describe('Brief note about the resolution (e.g., irregular verb, suru-verb)'),
});

export const DrillWordResolverResultSchema =
  DrillWordResolverResultBaseSchema.superRefine(refinePartOfSpeechConsistency);

// ============================================
// Lenient schema — Ollama compatible (missing fields OK)
// ============================================

const DrillWordResolverResultLenientBaseSchema = z.object({
  surface: z.string(),
  lemma: z.string(),
  reading: z.string(),
  meaning: z.string().nullish(),
  partOfSpeech: DrillWordResolverPartOfSpeechSchema,
  conjugationType: DrillWordResolverConjugationTypeSchema.nullish(),
  confidence: DrillWordResolverConfidenceSchema,
  alternatives: z.array(DrillWordResolverAlternativeSchema).nullish(),
  notes: z.string().nullish(),
});

export const DrillWordResolverResultLenientSchema =
  DrillWordResolverResultLenientBaseSchema.superRefine(refinePartOfSpeechConsistency);

// ============================================
// Type Exports
// ============================================

export type DrillWordResolverConfidence = z.infer<typeof DrillWordResolverConfidenceSchema>;
export type DrillWordResolverConjugationType = z.infer<typeof DrillWordResolverConjugationTypeSchema>;
export type DrillWordResolverPartOfSpeech = z.infer<typeof DrillWordResolverPartOfSpeechSchema>;
export type DrillWordResolverAlternative = z.infer<typeof DrillWordResolverAlternativeSchema>;
export type DrillWordResolverResult = z.infer<typeof DrillWordResolverResultSchema>;

// ============================================
// Request Type
// ============================================

export interface DrillWordResolverRequest {
  /** The word/input to resolve */
  word: string;
  /** Optional context to disambiguate */
  context?: string;
}
