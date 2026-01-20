"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateStoryPage = exports.validateStoryOutline = exports.validateCharacterSheet = exports.validateStory = exports.GeneratedStorySchema = exports.StoryPageSchema = exports.PageImagePromptSchema = exports.ModelSheetPromptSchema = exports.QuizQuestionsResponseSchema = exports.OutlinePageSchema = exports.StoryOutlineSchema = exports.CharacterSheetSchema = exports.STORY_SCHEMA_VERSION = exports.ProcessedTranscriptSchema = exports.TranscriptSegmentSchema = exports.GeneratedMoodboardSchema = exports.MoodboardKanjiSchema = exports.ReviewQuestionsResultSchema = exports.ReviewQuestionSchema = exports.GrammarSentenceExplanationSchema = exports.GrammarExplanationSchema = exports.WordExplanationSchema = exports.ConjugationTableSchema = exports.KanjiBreakdownSchema = exports.TranslationResultSchema = exports.PartialTranslationSchema = exports.TranslationHintSchema = exports.GrammarNoteSchema = exports.VocabularyItemSchema = exports.DifficultySchema = exports.JLPTLevelSchema = void 0;
exports.validateAIResponse = validateAIResponse;
exports.safeValidateAIResponse = safeValidateAIResponse;
exports.applyDefaults = applyDefaults;
const zod_1 = require("zod");
// ============================================
// Common Schemas
// ============================================
exports.JLPTLevelSchema = zod_1.z.enum(['N5', 'N4', 'N3', 'N2', 'N1']);
exports.DifficultySchema = zod_1.z.enum(['easy', 'medium', 'hard']);
exports.VocabularyItemSchema = zod_1.z.object({
    word: zod_1.z.string().describe('Japanese word'),
    reading: zod_1.z.string().describe('Hiragana reading'),
    meaning: zod_1.z.string().describe('English meaning'),
    jlptLevel: exports.JLPTLevelSchema.optional().describe('JLPT level if known'),
    difficulty: exports.DifficultySchema.optional().describe('Difficulty for learners'),
});
exports.GrammarNoteSchema = zod_1.z.object({
    pattern: zod_1.z.string().describe('Grammar pattern (e.g., ～ている)'),
    explanation: zod_1.z.string().describe('Clear explanation of the pattern'),
    example: zod_1.z.string().optional().describe('Example sentence'),
});
// ============================================
// Translation Schemas
// ============================================
exports.TranslationHintSchema = zod_1.z.object({
    type: zod_1.z.enum(['grammar', 'structure', 'particle', 'verb', 'noun', 'adjective'])
        .describe('Type of hint'),
    explanation: zod_1.z.string().describe('Educational hint about this aspect'),
    position: zod_1.z.number().optional().describe('Position in original text'),
});
exports.PartialTranslationSchema = zod_1.z.object({
    original: zod_1.z.string().describe('Original Japanese text'),
    partial: zod_1.z.string().describe('Mixed translation with brackets for untranslated parts'),
    translatedParts: zod_1.z.array(zod_1.z.object({
        originalText: zod_1.z.string().describe('Difficult part in Japanese'),
        translation: zod_1.z.string().describe('Its English translation'),
        position: zod_1.z.number().optional().describe('Position in text'),
        type: zod_1.z.enum(['key_phrase', 'difficult_word', 'grammar_pattern']).optional(),
    })).describe('Parts that were translated'),
    remainingJapanese: zod_1.z.array(zod_1.z.string()).optional().describe('Parts left in Japanese'),
});
exports.TranslationResultSchema = zod_1.z.object({
    originalText: zod_1.z.string().describe('The original Japanese text'),
    translatedText: zod_1.z.string().describe('Full English translation'),
    mode: zod_1.z.enum(['hints', 'partial', 'full', 'learning']).describe('Translation mode used'),
    confidence: zod_1.z.number().min(0).max(1).describe('Translation confidence score 0-1'),
    // Optional fields based on mode
    hints: zod_1.z.array(exports.TranslationHintSchema).optional().describe('Grammar hints for learning'),
    partialTranslation: exports.PartialTranslationSchema.optional().describe('Partial translation result'),
    grammarNotes: zod_1.z.array(exports.GrammarNoteSchema).optional().describe('Grammar explanations'),
    keyVocabulary: zod_1.z.array(exports.VocabularyItemSchema).optional().describe('Key vocabulary items'),
    alternatives: zod_1.z.array(zod_1.z.string()).optional().describe('Alternative translations'),
    learningPoints: zod_1.z.array(zod_1.z.string()).optional().describe('What this text teaches'),
    nextSteps: zod_1.z.array(zod_1.z.string()).optional().describe('Study recommendations'),
});
// ============================================
// Word Explanation Schemas
// ============================================
exports.KanjiBreakdownSchema = zod_1.z.object({
    kanji: zod_1.z.string().describe('Single kanji character'),
    meaning: zod_1.z.string().describe('Kanji meaning'),
    kunYomi: zod_1.z.array(zod_1.z.string()).describe('Kun readings'),
    onYomi: zod_1.z.array(zod_1.z.string()).describe('On readings'),
});
exports.ConjugationTableSchema = zod_1.z.object({
    dictionary: zod_1.z.string().describe('Dictionary form'),
    present: zod_1.z.string().optional(),
    past: zod_1.z.string().optional(),
    negative: zod_1.z.string().optional(),
    teForm: zod_1.z.string().optional(),
    potential: zod_1.z.string().optional(),
    passive: zod_1.z.string().optional(),
    causative: zod_1.z.string().optional(),
    imperative: zod_1.z.string().optional(),
    volitional: zod_1.z.string().optional(),
});
exports.WordExplanationSchema = zod_1.z.object({
    word: zod_1.z.string().describe('The Japanese word'),
    reading: zod_1.z.string().describe('Hiragana reading'),
    romaji: zod_1.z.string().describe('Romaji transcription'),
    meaning: zod_1.z.string().describe('English meaning'),
    partOfSpeech: zod_1.z.string().describe('Part of speech'),
    kanjiBreakdown: zod_1.z.array(exports.KanjiBreakdownSchema).optional(),
    conjugation: exports.ConjugationTableSchema.optional(),
    pitchAccent: zod_1.z.object({
        pattern: zod_1.z.string(),
        notation: zod_1.z.string(),
    }).optional(),
    relatedWords: zod_1.z.object({
        synonyms: zod_1.z.array(zod_1.z.string()).optional(),
        antonyms: zod_1.z.array(zod_1.z.string()).optional(),
        compounds: zod_1.z.array(zod_1.z.string()).optional(),
        relatedExpressions: zod_1.z.array(zod_1.z.string()).optional(),
    }).optional(),
    jlptLevel: exports.JLPTLevelSchema.optional(),
    formality: zod_1.z.enum(['casual', 'formal', 'neutral', 'both']),
    usageNotes: zod_1.z.string().optional(),
    examples: zod_1.z.array(zod_1.z.object({
        japanese: zod_1.z.string(),
        furigana: zod_1.z.string(),
        translation: zod_1.z.string(),
        notes: zod_1.z.string().optional(),
    })).describe('Example sentences'),
});
// ============================================
// Grammar Explanation Schemas
// ============================================
exports.GrammarExplanationSchema = zod_1.z.object({
    pattern: zod_1.z.string().describe('Grammar pattern'),
    patternRomaji: zod_1.z.string().optional().describe('Romaji version'),
    meaning: zod_1.z.string().describe('What the pattern means'),
    structure: zod_1.z.string().describe('How to form this pattern'),
    examples: zod_1.z.array(zod_1.z.object({
        japanese: zod_1.z.string(),
        furigana: zod_1.z.string().optional(),
        translation: zod_1.z.string(),
        notes: zod_1.z.string().optional(),
    })).describe('Example sentences'),
    commonMistakes: zod_1.z.array(zod_1.z.string()).optional(),
    relatedPatterns: zod_1.z.array(zod_1.z.string()).optional(),
    jlptLevel: exports.JLPTLevelSchema.optional(),
    formality: zod_1.z.enum(['casual', 'formal', 'both']).optional(),
});
exports.GrammarSentenceExplanationSchema = zod_1.z.object({
    sentence: zod_1.z.string().describe('The original sentence'),
    translation: zod_1.z.string().describe('English translation'),
    breakdown: zod_1.z.array(zod_1.z.object({
        segment: zod_1.z.string().describe('Part of the sentence'),
        reading: zod_1.z.string().optional().describe('Reading if contains kanji'),
        meaning: zod_1.z.string().describe('What this part means'),
        grammarPoint: zod_1.z.string().optional().describe('Grammar concept if applicable'),
    })).describe('Sentence breakdown'),
    grammarPoints: zod_1.z.array(exports.GrammarNoteSchema).describe('Grammar points in the sentence'),
    vocabulary: zod_1.z.array(exports.VocabularyItemSchema).optional(),
    culturalNotes: zod_1.z.string().optional(),
});
// ============================================
// Review Question Schemas
// ============================================
exports.ReviewQuestionSchema = zod_1.z.object({
    id: zod_1.z.string().describe('Unique question ID'),
    type: zod_1.z.enum(['multiple_choice', 'fill_blank', 'true_false', 'matching', 'ordering']),
    question: zod_1.z.string().describe('Question text in English'),
    questionJa: zod_1.z.string().optional().describe('Question in Japanese'),
    options: zod_1.z.array(zod_1.z.string()).optional().describe('Answer options for multiple choice'),
    correctAnswer: zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()]).describe('The correct answer'),
    explanation: zod_1.z.string().optional().describe('Why this answer is correct'),
    explanationJa: zod_1.z.string().optional(),
    difficulty: zod_1.z.number().min(1).max(5).describe('Difficulty 1-5'),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.ReviewQuestionsResultSchema = zod_1.z.object({
    questions: zod_1.z.array(exports.ReviewQuestionSchema).describe('Generated review questions'),
    metadata: zod_1.z.object({
        totalQuestions: zod_1.z.number(),
        difficulty: exports.DifficultySchema,
        topics: zod_1.z.array(zod_1.z.string()),
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
exports.MoodboardKanjiSchema = zod_1.z.object({
    kanji: zod_1.z.string().describe('Single kanji character'),
    meaning: zod_1.z.string().describe('Primary meaning'),
    onyomi: zod_1.z.array(zod_1.z.string()).describe('On readings'),
    kunyomi: zod_1.z.array(zod_1.z.string()).describe('Kun readings'),
    jlptLevel: exports.JLPTLevelSchema,
    strokeCount: zod_1.z.number().describe('Number of strokes'),
    examples: zod_1.z.array(zod_1.z.object({
        sentence: zod_1.z.string(),
        translation: zod_1.z.string(),
    })).describe('Example sentences'),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
exports.GeneratedMoodboardSchema = zod_1.z.object({
    title: zod_1.z.string().describe('Moodboard title'),
    description: zod_1.z.string().describe('Theme description'),
    themeColor: zod_1.z.string().describe('Hex color code'),
    emoji: zod_1.z.string().describe('Theme emoji'),
    kanjiList: zod_1.z.array(exports.MoodboardKanjiSchema).describe('Kanji in this moodboard'),
});
// ============================================
// Transcript Processing Schemas
// ============================================
exports.TranscriptSegmentSchema = zod_1.z.object({
    id: zod_1.z.string().describe('Segment ID'),
    text: zod_1.z.string().describe('Japanese text'),
    textWithFurigana: zod_1.z.string().optional().describe('Text with furigana'),
    startTime: zod_1.z.number().describe('Start time in seconds'),
    endTime: zod_1.z.number().describe('End time in seconds'),
    difficulty: zod_1.z.number().min(1).max(5).optional(),
    keyVocabulary: zod_1.z.array(zod_1.z.string()).optional(),
    translation: zod_1.z.string().optional(),
});
exports.ProcessedTranscriptSchema = zod_1.z.object({
    segments: zod_1.z.array(exports.TranscriptSegmentSchema).describe('Processed segments'),
    summary: zod_1.z.string().optional().describe('Content summary'),
    keyPoints: zod_1.z.array(zod_1.z.string()).optional(),
    vocabulary: zod_1.z.array(exports.VocabularyItemSchema).optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
// ============================================
// Validation Helpers
// ============================================
/**
 * Format Zod errors for logging (handles both Zod 3.x and 4.x)
 */
function formatZodErrors(error) {
    var _a;
    // Zod 4.x uses .issues, access it safely
    const issues = (_a = error.issues) !== null && _a !== void 0 ? _a : [];
    return issues.map((issue) => {
        var _a;
        const path = ((_a = issue.path) === null || _a === void 0 ? void 0 : _a.join('.')) || 'root';
        const message = issue.message || 'Unknown error';
        return `${path}: ${message}`;
    }).join('; ');
}
/**
 * Safely parse and validate an AI response against a schema
 * Returns the validated data or throws a detailed error
 */
function validateAIResponse(schema, response, context) {
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
function safeValidateAIResponse(schema, response, context) {
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
function applyDefaults(data, defaults) {
    return Object.assign(Object.assign({}, defaults), data);
}
// ============================================
// Multi-Step Story Generation Schemas
// ============================================
var story_schemas_1 = require("./story-schemas");
Object.defineProperty(exports, "STORY_SCHEMA_VERSION", { enumerable: true, get: function () { return story_schemas_1.STORY_SCHEMA_VERSION; } });
Object.defineProperty(exports, "CharacterSheetSchema", { enumerable: true, get: function () { return story_schemas_1.CharacterSheetSchema; } });
Object.defineProperty(exports, "StoryOutlineSchema", { enumerable: true, get: function () { return story_schemas_1.StoryOutlineSchema; } });
Object.defineProperty(exports, "OutlinePageSchema", { enumerable: true, get: function () { return story_schemas_1.OutlinePageSchema; } });
Object.defineProperty(exports, "QuizQuestionsResponseSchema", { enumerable: true, get: function () { return story_schemas_1.QuizQuestionsResponseSchema; } });
Object.defineProperty(exports, "ModelSheetPromptSchema", { enumerable: true, get: function () { return story_schemas_1.ModelSheetPromptSchema; } });
Object.defineProperty(exports, "PageImagePromptSchema", { enumerable: true, get: function () { return story_schemas_1.PageImagePromptSchema; } });
Object.defineProperty(exports, "StoryPageSchema", { enumerable: true, get: function () { return story_schemas_1.StoryPageSchema; } });
Object.defineProperty(exports, "GeneratedStorySchema", { enumerable: true, get: function () { return story_schemas_1.GeneratedStorySchema; } });
Object.defineProperty(exports, "validateStory", { enumerable: true, get: function () { return story_schemas_1.validateStory; } });
Object.defineProperty(exports, "validateCharacterSheet", { enumerable: true, get: function () { return story_schemas_1.validateCharacterSheet; } });
Object.defineProperty(exports, "validateStoryOutline", { enumerable: true, get: function () { return story_schemas_1.validateStoryOutline; } });
Object.defineProperty(exports, "validateStoryPage", { enumerable: true, get: function () { return story_schemas_1.validateStoryPage; } });
// Note: We don't export types here to avoid conflicts with existing types
// in src/lib/ai/types.ts. The schemas are for validation only.
// Trigger Vercel rebuild - 1768144161
//# sourceMappingURL=index.js.map