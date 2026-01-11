/**
 * Zod Schemas for AI Processor Responses
 *
 * These schemas provide:
 * 1. Runtime validation for AI responses (catches hallucinations)
 * 2. Type safety via z.infer<typeof Schema>
 * 3. OpenAI Structured Outputs support via zodResponseFormat
 *
 * Usage:
 * - OpenAI: Use zodResponseFormat(Schema, "name") for guaranteed schema adherence
 * - Ollama: Use Schema.safeParse(response) for post-response validation
 */

import { z } from 'zod';

// ============================================
// Common Schemas
// ============================================

export const JLPTLevelSchema = z.enum(['N5', 'N4', 'N3', 'N2', 'N1']);

export const DifficultySchema = z.enum(['easy', 'medium', 'hard']);

export const VocabularyItemSchema = z.object({
  word: z.string().describe('Japanese word'),
  reading: z.string().describe('Hiragana reading'),
  meaning: z.string().describe('English meaning'),
  jlptLevel: JLPTLevelSchema.optional().describe('JLPT level if known'),
  difficulty: DifficultySchema.optional().describe('Difficulty for learners'),
});

export const GrammarNoteSchema = z.object({
  pattern: z.string().describe('Grammar pattern (e.g., ～ている)'),
  explanation: z.string().describe('Clear explanation of the pattern'),
  example: z.string().optional().describe('Example sentence'),
});

// ============================================
// Translation Schemas
// ============================================

export const TranslationHintSchema = z.object({
  type: z.enum(['grammar', 'structure', 'particle', 'verb', 'noun', 'adjective'])
    .describe('Type of hint'),
  explanation: z.string().describe('Educational hint about this aspect'),
  position: z.number().optional().describe('Position in original text'),
});

export const PartialTranslationSchema = z.object({
  original: z.string().describe('Original Japanese text'),
  partial: z.string().describe('Mixed translation with brackets for untranslated parts'),
  translatedParts: z.array(z.object({
    originalText: z.string().describe('Difficult part in Japanese'),
    translation: z.string().describe('Its English translation'),
    position: z.number().optional().describe('Position in text'),
    type: z.enum(['key_phrase', 'difficult_word', 'grammar_pattern']).optional(),
  })).describe('Parts that were translated'),
  remainingJapanese: z.array(z.string()).optional().describe('Parts left in Japanese'),
});

export const TranslationResultSchema = z.object({
  originalText: z.string().describe('The original Japanese text'),
  translatedText: z.string().describe('Full English translation'),
  mode: z.enum(['hints', 'partial', 'full', 'learning']).describe('Translation mode used'),
  confidence: z.number().min(0).max(1).describe('Translation confidence score 0-1'),

  // Optional fields based on mode
  hints: z.array(TranslationHintSchema).optional().describe('Grammar hints for learning'),
  partialTranslation: PartialTranslationSchema.optional().describe('Partial translation result'),
  grammarNotes: z.array(GrammarNoteSchema).optional().describe('Grammar explanations'),
  keyVocabulary: z.array(VocabularyItemSchema).optional().describe('Key vocabulary items'),
  alternatives: z.array(z.string()).optional().describe('Alternative translations'),
  learningPoints: z.array(z.string()).optional().describe('What this text teaches'),
  nextSteps: z.array(z.string()).optional().describe('Study recommendations'),
});

// ============================================
// Word Explanation Schemas
// ============================================

export const KanjiBreakdownSchema = z.object({
  kanji: z.string().describe('Single kanji character'),
  meaning: z.string().describe('Kanji meaning'),
  kunYomi: z.array(z.string()).describe('Kun readings'),
  onYomi: z.array(z.string()).describe('On readings'),
});

export const ConjugationTableSchema = z.object({
  dictionary: z.string().describe('Dictionary form'),
  present: z.string().optional(),
  past: z.string().optional(),
  negative: z.string().optional(),
  teForm: z.string().optional(),
  potential: z.string().optional(),
  passive: z.string().optional(),
  causative: z.string().optional(),
  imperative: z.string().optional(),
  volitional: z.string().optional(),
});

export const WordExplanationSchema = z.object({
  word: z.string().describe('The Japanese word'),
  reading: z.string().describe('Hiragana reading'),
  romaji: z.string().describe('Romaji transcription'),
  meaning: z.string().describe('English meaning'),
  partOfSpeech: z.string().describe('Part of speech'),

  kanjiBreakdown: z.array(KanjiBreakdownSchema).optional(),
  conjugation: ConjugationTableSchema.optional(),

  pitchAccent: z.object({
    pattern: z.string(),
    notation: z.string(),
  }).optional(),

  relatedWords: z.object({
    synonyms: z.array(z.string()).optional(),
    antonyms: z.array(z.string()).optional(),
    compounds: z.array(z.string()).optional(),
    relatedExpressions: z.array(z.string()).optional(),
  }).optional(),

  jlptLevel: JLPTLevelSchema.optional(),
  formality: z.enum(['casual', 'formal', 'neutral', 'both']),
  usageNotes: z.string().optional(),

  examples: z.array(z.object({
    japanese: z.string(),
    furigana: z.string(),
    translation: z.string(),
    notes: z.string().optional(),
  })).describe('Example sentences'),
});

// ============================================
// Grammar Explanation Schemas
// ============================================

export const GrammarExplanationSchema = z.object({
  pattern: z.string().describe('Grammar pattern'),
  patternRomaji: z.string().optional().describe('Romaji version'),
  meaning: z.string().describe('What the pattern means'),
  structure: z.string().describe('How to form this pattern'),

  examples: z.array(z.object({
    japanese: z.string(),
    furigana: z.string().optional(),
    translation: z.string(),
    notes: z.string().optional(),
  })).describe('Example sentences'),

  commonMistakes: z.array(z.string()).optional(),
  relatedPatterns: z.array(z.string()).optional(),
  jlptLevel: JLPTLevelSchema.optional(),
  formality: z.enum(['casual', 'formal', 'both']).optional(),
});

export const GrammarSentenceExplanationSchema = z.object({
  sentence: z.string().describe('The original sentence'),
  translation: z.string().describe('English translation'),
  breakdown: z.array(z.object({
    segment: z.string().describe('Part of the sentence'),
    reading: z.string().optional().describe('Reading if contains kanji'),
    meaning: z.string().describe('What this part means'),
    grammarPoint: z.string().optional().describe('Grammar concept if applicable'),
  })).describe('Sentence breakdown'),
  grammarPoints: z.array(GrammarNoteSchema).describe('Grammar points in the sentence'),
  vocabulary: z.array(VocabularyItemSchema).optional(),
  culturalNotes: z.string().optional(),
});

// ============================================
// Review Question Schemas
// ============================================

export const ReviewQuestionSchema = z.object({
  id: z.string().describe('Unique question ID'),
  type: z.enum(['multiple_choice', 'fill_blank', 'true_false', 'matching', 'ordering']),
  question: z.string().describe('Question text in English'),
  questionJa: z.string().optional().describe('Question in Japanese'),
  options: z.array(z.string()).optional().describe('Answer options for multiple choice'),
  correctAnswer: z.union([z.string(), z.number(), z.boolean()]).describe('The correct answer'),
  explanation: z.string().optional().describe('Why this answer is correct'),
  explanationJa: z.string().optional(),
  difficulty: z.number().min(1).max(5).describe('Difficulty 1-5'),
  tags: z.array(z.string()).optional(),
});

export const ReviewQuestionsResultSchema = z.object({
  questions: z.array(ReviewQuestionSchema).describe('Generated review questions'),
  metadata: z.object({
    totalQuestions: z.number(),
    difficulty: DifficultySchema,
    topics: z.array(z.string()),
  }).optional(),
});

// ============================================
// Story Generation Schemas
// ============================================
// Note: StoryPageSchema and GeneratedStorySchema are now imported from story-schemas.ts
// to avoid conflicts and ensure OpenAI Structured Outputs compatibility (no .optional())

// ============================================
// Moodboard Schemas
// ============================================

export const MoodboardKanjiSchema = z.object({
  kanji: z.string().describe('Single kanji character'),
  meaning: z.string().describe('Primary meaning'),
  onyomi: z.array(z.string()).describe('On readings'),
  kunyomi: z.array(z.string()).describe('Kun readings'),
  jlptLevel: JLPTLevelSchema,
  strokeCount: z.number().describe('Number of strokes'),
  examples: z.array(z.object({
    sentence: z.string(),
    translation: z.string(),
  })).describe('Example sentences'),
  tags: z.array(z.string()).optional(),
});

export const GeneratedMoodboardSchema = z.object({
  title: z.string().describe('Moodboard title'),
  description: z.string().describe('Theme description'),
  themeColor: z.string().describe('Hex color code'),
  emoji: z.string().describe('Theme emoji'),
  kanjiList: z.array(MoodboardKanjiSchema).describe('Kanji in this moodboard'),
});

// ============================================
// Transcript Processing Schemas
// ============================================

export const TranscriptSegmentSchema = z.object({
  id: z.string().describe('Segment ID'),
  text: z.string().describe('Japanese text'),
  textWithFurigana: z.string().optional().describe('Text with furigana'),
  startTime: z.number().describe('Start time in seconds'),
  endTime: z.number().describe('End time in seconds'),
  difficulty: z.number().min(1).max(5).optional(),
  keyVocabulary: z.array(z.string()).optional(),
  translation: z.string().optional(),
});

export const ProcessedTranscriptSchema = z.object({
  segments: z.array(TranscriptSegmentSchema).describe('Processed segments'),
  summary: z.string().optional().describe('Content summary'),
  keyPoints: z.array(z.string()).optional(),
  vocabulary: z.array(VocabularyItemSchema).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

// ============================================
// Type Exports (for use in processors)
// ============================================

export type TranslationResult = z.infer<typeof TranslationResultSchema>;
export type WordExplanation = z.infer<typeof WordExplanationSchema>;
export type GrammarExplanation = z.infer<typeof GrammarExplanationSchema>;
export type GrammarSentenceExplanation = z.infer<typeof GrammarSentenceExplanationSchema>;
export type ReviewQuestion = z.infer<typeof ReviewQuestionSchema>;
export type ReviewQuestionsResult = z.infer<typeof ReviewQuestionsResultSchema>;
// Note: GeneratedStory type removed - now defined in src/lib/ai/types.ts to avoid conflicts
export type GeneratedMoodboard = z.infer<typeof GeneratedMoodboardSchema>;
export type ProcessedTranscript = z.infer<typeof ProcessedTranscriptSchema>;
export type VocabularyItem = z.infer<typeof VocabularyItemSchema>;
export type GrammarNote = z.infer<typeof GrammarNoteSchema>;

// ============================================
// Validation Helpers
// ============================================

/**
 * Format Zod errors for logging (handles both Zod 3.x and 4.x)
 */
function formatZodErrors(error: z.ZodError): string {
  // Zod 4.x uses .issues, access it safely
  const issues = error.issues ?? [];
  return issues.map((issue) => {
    const path = issue.path?.join('.') || 'root';
    const message = issue.message || 'Unknown error';
    return `${path}: ${message}`;
  }).join('; ');
}

/**
 * Safely parse and validate an AI response against a schema
 * Returns the validated data or throws a detailed error
 */
export function validateAIResponse<T>(
  schema: z.ZodSchema<T>,
  response: unknown,
  context?: string
): T {
  const result = schema.safeParse(response);

  if (!result.success) {
    const errors = formatZodErrors(result.error);
    console.error(`[AI Validation] Schema validation failed${context ? ` for ${context}` : ''}:`, errors);
    console.error('[AI Validation] Received:', JSON.stringify(response, null, 2).substring(0, 500));
    throw new Error(`AI response validation failed: ${errors}`);
  }

  return result.data;
}

/**
 * Safely parse and validate, returning null on failure instead of throwing
 */
export function safeValidateAIResponse<T>(
  schema: z.ZodSchema<T>,
  response: unknown,
  context?: string
): T | null {
  const result = schema.safeParse(response);

  if (!result.success) {
    const errors = formatZodErrors(result.error);
    console.warn(`[AI Validation] Schema validation failed${context ? ` for ${context}` : ''}:`, errors);
    return null;
  }

  return result.data;
}

/**
 * Apply default values to partial AI responses
 * Useful when AI omits optional fields
 */
export function applyDefaults<T extends object>(
  data: Partial<T>,
  defaults: Partial<T>
): T {
  return { ...defaults, ...data } as T;
}

// ============================================
// Multi-Step Story Generation Schemas
// ============================================

export {
  CharacterSheetSchema,
  StoryOutlineSchema,
  OutlinePageSchema,
  QuizQuestionsResponseSchema,
  ModelSheetPromptSchema,
  PageImagePromptSchema,
  StoryPageSchema,
  GeneratedStorySchema,
  validateStory,
  validateCharacterSheet,
  validateStoryOutline,
  validateStoryPage,
} from './story-schemas';

// Note: We don't export types here to avoid conflicts with existing types
// in src/lib/ai/types.ts. The schemas are for validation only.
// Trigger Vercel rebuild - 1768144161
