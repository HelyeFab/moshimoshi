"use strict";
/**
 * Zod Schemas for Story Generation with OpenAI Structured Outputs
 *
 * These schemas ensure 100% reliability when generating stories with AI.
 * They match the existing TypeScript interfaces but provide runtime validation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageImagePromptSchema = exports.ModelSheetPromptSchema = exports.QuizQuestionsResponseSchema = exports.StoryOutlineSchema = exports.OutlinePageSchema = exports.CharacterSheetSchema = exports.SettingSchema = exports.CharacterSchema = exports.GeneratedStorySchema = exports.VocabularyItemSchema = exports.StoryPageSchema = exports.ReviewQuestionSchema = exports.JLPTLevelSchema = void 0;
exports.validateStory = validateStory;
exports.validateCharacterSheet = validateCharacterSheet;
exports.validateStoryOutline = validateStoryOutline;
exports.validateStoryPage = validateStoryPage;
const zod_1 = require("zod");
// ============================================
// JLPT Level Schema
// ============================================
exports.JLPTLevelSchema = zod_1.z.enum(['N5', 'N4', 'N3', 'N2', 'N1']);
// ============================================
// Review Question Schemas
// ============================================
exports.ReviewQuestionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.enum(['multiple_choice', 'fill_blank', 'true_false', 'matching', 'ordering']),
    question: zod_1.z.string(),
    questionJa: zod_1.z.string().optional(),
    options: zod_1.z.array(zod_1.z.string()).optional(),
    correctAnswer: zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()]),
    explanation: zod_1.z.string().optional(),
    explanationJa: zod_1.z.string().optional(),
    difficulty: zod_1.z.number().int().min(1).max(5),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
});
// Don't export conflicting types - use existing types from src/lib/ai/types.ts
// ============================================
// Story Page Schema
// ============================================
exports.StoryPageSchema = zod_1.z.object({
    pageNumber: zod_1.z.number().int().positive(),
    text: zod_1.z.string().min(1),
    textWithFurigana: zod_1.z.string().min(1),
    translation: zod_1.z.string().min(1),
    imagePrompt: zod_1.z.string().optional(),
    vocabularyNotes: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
    grammarNotes: zod_1.z.record(zod_1.z.string(), zod_1.z.string()).optional(),
}).passthrough();
// ============================================
// Vocabulary Item Schema
// ============================================
exports.VocabularyItemSchema = zod_1.z.object({
    word: zod_1.z.string(),
    meaning: zod_1.z.string(),
    reading: zod_1.z.string().optional(),
    pageNumber: zod_1.z.number().int().positive().optional(),
}).passthrough();
// ============================================
// Generated Story Schema (for StoryProcessor)
// ============================================
exports.GeneratedStorySchema = zod_1.z.object({
    title: zod_1.z.string().min(1),
    titleJa: zod_1.z.string().min(1),
    description: zod_1.z.string(),
    pages: zod_1.z.array(exports.StoryPageSchema).min(1),
    vocabulary: zod_1.z.array(exports.VocabularyItemSchema).optional(),
    quiz: zod_1.z.array(exports.ReviewQuestionSchema).optional(),
    metadata: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
}).passthrough();
// ============================================
// Character Sheet Schema (for MultiStepStoryProcessor)
// ============================================
exports.CharacterSchema = zod_1.z.object({
    name: zod_1.z.string(),
    nameJa: zod_1.z.string(),
    description: zod_1.z.string(),
    visualDescription: zod_1.z.string(),
    personality: zod_1.z.string().optional(),
    role: zod_1.z.string().optional(),
});
exports.SettingSchema = zod_1.z.object({
    location: zod_1.z.string(),
    time: zod_1.z.string(),
    atmosphere: zod_1.z.string(),
    visualDetails: zod_1.z.string().optional(),
}).passthrough(); // Allow additional fields from AI
exports.CharacterSheetSchema = zod_1.z.object({
    mainCharacter: zod_1.z.object({
        name: zod_1.z.string(),
        nameJa: zod_1.z.string(),
        description: zod_1.z.string(),
        visualDescription: zod_1.z.string(),
        personality: zod_1.z.string().optional(),
        referenceImage: zod_1.z.string().optional(),
    }),
    supportingCharacters: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string(),
        nameJa: zod_1.z.string(),
        description: zod_1.z.string(),
        visualDescription: zod_1.z.string(),
        role: zod_1.z.string().optional(),
        referenceImage: zod_1.z.string().optional(),
    })),
    setting: exports.SettingSchema,
    visualStyle: zod_1.z.string(),
    saveForReuse: zod_1.z.boolean().optional(),
    colorPalette: zod_1.z.array(zod_1.z.string()).optional(),
    moodKeywords: zod_1.z.array(zod_1.z.string()).optional(),
}).passthrough(); // Allow additional fields
// ============================================
// Story Outline Schema (for MultiStepStoryProcessor)
// ============================================
exports.OutlinePageSchema = zod_1.z.object({
    pageNumber: zod_1.z.number().int().positive(),
    summary: zod_1.z.string(),
    summaryJa: zod_1.z.string().optional(),
    imagePrompt: zod_1.z.string(),
    keyVocabulary: zod_1.z.array(zod_1.z.string()).optional(),
    grammarPoints: zod_1.z.array(zod_1.z.string()).optional(),
}).passthrough();
exports.StoryOutlineSchema = zod_1.z.object({
    title: zod_1.z.string(),
    titleJa: zod_1.z.string(),
    description: zod_1.z.string(),
    descriptionJa: zod_1.z.string().optional(),
    pages: zod_1.z.array(exports.OutlinePageSchema).min(1),
    targetVocabulary: zod_1.z.array(zod_1.z.string()).optional(),
    targetGrammar: zod_1.z.array(zod_1.z.string()).optional(),
}).passthrough(); // Allow additional fields from AI
// ============================================
// Quiz Generation Schema
// ============================================
exports.QuizQuestionsResponseSchema = zod_1.z.object({
    questions: zod_1.z.array(zod_1.z.object({
        id: zod_1.z.string(),
        question: zod_1.z.string(),
        questionJa: zod_1.z.string().optional(),
        options: zod_1.z.array(zod_1.z.string()).optional(),
        correctIndex: zod_1.z.number().int().min(0), // AI returns correctIndex, we'll map to correctAnswer
        explanation: zod_1.z.string().optional(),
        explanationJa: zod_1.z.string().optional(),
    })),
}).passthrough();
// ============================================
// Model Sheet Generation Schema
// ============================================
exports.ModelSheetPromptSchema = zod_1.z.object({
    prompt: zod_1.z.string(),
    characterId: zod_1.z.string(),
}).passthrough();
// ============================================
// Page Image Prompt Schema
// ============================================
exports.PageImagePromptSchema = zod_1.z.object({
    imagePrompt: zod_1.z.string(),
    enhancedPrompt: zod_1.z.string().optional(),
    pageNumber: zod_1.z.number().int().positive(),
}).passthrough();
// ============================================
// Helper Functions
// ============================================
/**
 * Validates story data against schema
 * Returns validation result with typed errors
 */
function validateStory(data) {
    return exports.GeneratedStorySchema.safeParse(data);
}
/**
 * Validates character sheet against schema
 */
function validateCharacterSheet(data) {
    return exports.CharacterSheetSchema.safeParse(data);
}
/**
 * Validates story outline against schema
 */
function validateStoryOutline(data) {
    return exports.StoryOutlineSchema.safeParse(data);
}
/**
 * Validates story page against schema
 */
function validateStoryPage(data) {
    return exports.StoryPageSchema.safeParse(data);
}
//# sourceMappingURL=story-schemas.js.map