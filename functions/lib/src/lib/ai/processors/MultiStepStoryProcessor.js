"use strict";
/**
 * Multi-Step Story Processor
 * Handles the multi-step story generation process with character sheets, outlines, pages, and quizzes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiStepStoryProcessor = void 0;
const BaseProcessor_1 = require("./BaseProcessor");
const types_1 = require("../types");
class MultiStepStoryProcessor extends BaseProcessor_1.BaseProcessor {
    constructor(context) {
        super(context);
        this.contentGuidelines = `
IMPORTANT CONTENT GUIDELINES:
- NO sexual content or innuendo
- NO violence or graphic descriptions
- NO racial, gender, or cultural stereotypes
- NO political or controversial topics
- NO religious content
- Focus on educational, wholesome, and culturally respectful content
- Suitable for all ages`;
        this.jlptGuidelines = {
            N5: 'Use only basic vocabulary and simple sentence structures. Present tense mainly, very simple past tense. Basic particles (は、が、を、に、で、と、も、の). Maximum 10-15 words per sentence.',
            N4: 'Use elementary vocabulary and grammar. Can use past tense, て-form, basic adjective conjugations. Sentences up to 15-20 words.',
            N3: 'Use intermediate vocabulary and grammar. Can use passive, causative, conditional forms. More complex sentence structures. Sentences up to 20-25 words.',
            N2: 'Use upper-intermediate vocabulary and grammar. Complex sentence patterns, keigo, nuanced expressions. Natural flowing text.',
            N1: 'Use advanced vocabulary and grammar. Literary expressions, complex kanji, sophisticated sentence structures. No restrictions.',
        };
    }
    /**
     * Build moodboard kanji requirement string for prompts
     */
    buildMoodboardKanjiRequirement(moodboardKanji) {
        if (!moodboardKanji || moodboardKanji.length === 0) {
            return '';
        }
        const kanjiList = moodboardKanji.map(k => `• ${k.kanji} (${k.meaning})`).join('\n');
        return `
═══════════════════════════════════════════════════════════════
⚠️ CRITICAL REQUIREMENT - MOODBOARD KANJI INTEGRATION ⚠️
═══════════════════════════════════════════════════════════════

This story is being generated FROM A KANJI MOODBOARD. The PRIMARY PURPOSE
of this story is to help learners see these specific kanji IN CONTEXT.

You MUST use EVERY SINGLE kanji from this list in the story:

${kanjiList}

RULES:
1. EVERY kanji above MUST appear at least once in the story text
2. Use them in natural, meaningful sentences - not forced or awkward
3. Distribute them across different pages (don't cluster all in one page)
4. Use common vocabulary words that contain these kanji
5. The story plot should naturally incorporate situations where these kanji would be used

VERIFICATION: Before finalizing, mentally check that ALL ${moodboardKanji.length} kanji from the list above appear somewhere in your story text.

═══════════════════════════════════════════════════════════════
`;
    }
    /**
     * Build page-specific kanji reminder for individual page generation
     */
    buildPageKanjiReminder(moodboardKanji, pageNumber, totalPages) {
        if (!moodboardKanji || moodboardKanji.length === 0) {
            return '';
        }
        // Distribute kanji across pages
        const kanjiPerPage = Math.ceil(moodboardKanji.length / totalPages);
        const startIdx = (pageNumber - 1) * kanjiPerPage;
        const endIdx = Math.min(startIdx + kanjiPerPage, moodboardKanji.length);
        const pageKanji = moodboardKanji.slice(startIdx, endIdx);
        if (pageKanji.length === 0) {
            return '';
        }
        const kanjiList = pageKanji.map(k => `${k.kanji}(${k.meaning})`).join(', ');
        return `
⚠️ PAGE ${pageNumber} KANJI TARGET: Try to include these kanji on this page: ${kanjiList}
(This is a suggested distribution - ensure ALL moodboard kanji appear somewhere in the full story)
`;
    }
    /**
     * Process multi-step story generation request
     */
    async process(request, config) {
        // Validate request
        this.validateRequest(request);
        switch (request.step) {
            case 'character_sheet':
                return this.generateCharacterSheet(request, config);
            case 'outline':
                return this.generateOutline(request, config);
            case 'generate_page':
                return this.generatePage(request, config);
            case 'generate_quiz':
                return this.generateQuiz(request, config);
            case 'generate_model_sheet':
                return this.generateModelSheet(request, config);
            case 'generate_page_image':
                return this.generatePageImage(request, config);
            case 'store_page_image':
                return this.storePageImage(request, config);
            default:
                throw new types_1.AIServiceError(`Invalid step: ${request.step}`, 'INVALID_STEP', 400);
        }
    }
    /**
     * Validate request
     */
    validateRequest(request) {
        if (!request.step) {
            throw new types_1.AIServiceError('Step is required', 'VALIDATION_ERROR', 400);
        }
        switch (request.step) {
            case 'character_sheet':
                if (!request.theme) {
                    throw new types_1.AIServiceError('Theme is required for character sheet generation', 'VALIDATION_ERROR', 400);
                }
                break;
            case 'outline':
                if (!request.draftId && !request.characterSheet) {
                    throw new types_1.AIServiceError('Draft ID or character sheet is required for outline generation', 'VALIDATION_ERROR', 400);
                }
                break;
            case 'generate_page':
                if (!request.pageNumber) {
                    throw new types_1.AIServiceError('Page number is required for page generation', 'VALIDATION_ERROR', 400);
                }
                break;
            case 'generate_quiz':
                if (!request.draftId && !request.pages) {
                    throw new types_1.AIServiceError('Draft ID or pages are required for quiz generation', 'VALIDATION_ERROR', 400);
                }
                break;
        }
    }
    /**
     * Generate character sheet
     */
    async generateCharacterSheet(request, config) {
        const jlptLevel = request.jlptLevel || (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        const pageCount = request.pageCount || 5;
        const systemPrompt = 'You are an expert in creating educational Japanese stories for language learners. You understand JLPT levels and create culturally appropriate content.';
        const moodboardRequirement = this.buildMoodboardKanjiRequirement(request.moodboardKanji);
        const userPrompt = `Create a character sheet for a Japanese learning story with the following requirements:

Theme: ${request.theme}
JLPT Level: ${jlptLevel}
Story Length: ${pageCount} pages
${moodboardRequirement}
${this.contentGuidelines}

Create a detailed character sheet in JSON format with:
1. A main character (with name in English and Japanese)
2. 1-2 supporting characters
3. Setting details (location, time period, atmosphere)
4. Visual style description for consistency

IMPORTANT - CHARACTER DIVERSITY REQUIREMENTS:
- Vary gender: Create male, female, or gender-neutral protagonists (avoid repeating same gender)
- Vary age groups: Children (6-12), teens (13-17), adults (18-50), or elderly (50+)
- Vary names: Use diverse Japanese names - avoid overusing common names like Yuki, Sakura, Hana
  Examples for variety: Haruto, Takeshi, Kenji, Mei, Ren, Sora, Akira, Kaito, Natsuki, Riku
- Age-appropriate and relatable for language learners
- Culturally authentic but not stereotypical
- Interesting but not overly complex

Response format (JSON only):
{
  "mainCharacter": {
    "name": "English name",
    "nameJa": "Japanese name with kanji/kana",
    "description": "Character personality and role",
    "visualDescription": "Physical appearance for image generation",
    "personality": "Key personality traits"
  },
  "supportingCharacters": [...],
  "setting": {...},
  "visualStyle": "Overall visual style",
  "colorPalette": ["#hex1", "#hex2", "#hex3"],
  "moodKeywords": ["keyword1", "keyword2", "keyword3"]
}`;
        const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);
        const characterSheet = this.parseJSON(content);
        return {
            data: characterSheet,
            usage,
            metadata: {
                step: 'character_sheet',
                theme: request.theme,
                jlptLevel,
            },
        };
    }
    /**
     * Generate story outline
     */
    async generateOutline(request, config) {
        const jlptLevel = request.jlptLevel || (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        const pageCount = request.pageCount || 5;
        const characterSheet = request.characterSheet;
        const systemPrompt = 'You are an expert in creating educational Japanese stories for language learners.';
        const moodboardRequirement = this.buildMoodboardKanjiRequirement(request.moodboardKanji);
        const userPrompt = `Create a story outline for a Japanese learning story:

Theme: ${request.theme}
JLPT Level: ${jlptLevel}
Number of pages: ${pageCount}
${moodboardRequirement}
Character Sheet:
${JSON.stringify(characterSheet, null, 2)}

${this.contentGuidelines}
${this.jlptGuidelines[jlptLevel]}

Create a page-by-page outline that:
1. Tells a complete, engaging story
2. Uses vocabulary and grammar appropriate for ${jlptLevel}
3. Introduces concepts gradually
4. Includes repetition of key vocabulary
5. Has a clear beginning, middle, and end

Response format (JSON only):
{
  "title": "Story title in English",
  "titleJa": "Story title in Japanese",
  "description": "Brief story description",
  "descriptionJa": "Description in Japanese",
  "pages": [...],
  "targetVocabulary": [...],
  "targetGrammar": [...]
}`;
        const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);
        const outline = this.parseJSON(content);
        return {
            data: outline,
            usage,
            metadata: {
                step: 'outline',
                theme: request.theme,
                jlptLevel,
                pageCount,
            },
        };
    }
    /**
     * Generate individual page
     */
    async generatePage(request, config) {
        var _a;
        const jlptLevel = request.jlptLevel || (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        const pageNumber = request.pageNumber;
        const characterSheet = request.characterSheet;
        const outline = request.outline;
        const systemPrompt = 'You are an expert in writing Japanese learning materials. You create natural, engaging text appropriate for specific JLPT levels.';
        const moodboardRequirement = this.buildMoodboardKanjiRequirement(request.moodboardKanji);
        const totalPages = ((_a = outline === null || outline === void 0 ? void 0 : outline.pages) === null || _a === void 0 ? void 0 : _a.length) || 5;
        const pageKanjiReminder = this.buildPageKanjiReminder(request.moodboardKanji, pageNumber, totalPages);
        const userPrompt = `Generate page ${pageNumber} of the Japanese learning story:

Character Sheet:
${JSON.stringify(characterSheet, null, 2)}

Page Outline:
${JSON.stringify(outline.pages[pageNumber - 1], null, 2)}

JLPT Level: ${jlptLevel}
${this.jlptGuidelines[jlptLevel]}
${moodboardRequirement}${pageKanjiReminder}
Generate the actual story text for this page following these requirements:
1. Japanese text with natural flow
2. Use vocabulary and grammar appropriate for ${jlptLevel}
3. Make it engaging and educational
4. Include the key vocabulary and grammar points from the outline
5. Text should be 3-5 sentences for N5, 4-6 for N4, 5-8 for N3+

Response format (JSON only):
{
  "pageNumber": ${pageNumber},
  "text": "Japanese text for the page (plain text, no furigana)",
  "textWithFurigana": "Same text but with furigana in HTML ruby tags <ruby>漢字<rt>かんじ</rt></ruby>",
  "translation": "Natural English translation",
  "vocabularyNotes": {
    "word1": "explanation",
    "word2": "explanation"
  },
  "grammarNotes": {
    "pattern1": "explanation",
    "pattern2": "explanation"
  },
  "imagePrompt": "Detailed prompt for DALL-E including character descriptions and visual style"
}`;
        const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);
        const page = this.parseJSON(content);
        // Validate required fields - especially translation which is often missing
        if (!page.text) {
            throw new types_1.AIServiceError('Page generation failed: missing text field', 'INVALID_RESPONSE_FORMAT', 500);
        }
        // Ensure translation exists - if AI didn't provide it, generate it
        if (!page.translation && page.text) {
            console.warn(`[MultiStepStoryProcessor] Page ${pageNumber} missing translation, generating separately...`);
            try {
                const translationResult = await this.callOpenAI('You are a Japanese-English translator. Translate the following Japanese text to natural, fluent English. Return ONLY the English translation, nothing else.', page.text);
                page.translation = translationResult.content.trim();
                console.log(`[MultiStepStoryProcessor] Generated missing translation for page ${pageNumber}`);
            }
            catch (translationError) {
                console.error(`[MultiStepStoryProcessor] Failed to generate translation for page ${pageNumber}:`, translationError);
                // Continue without translation - will be handled at read time with fallback
            }
        }
        return {
            data: page,
            usage,
            metadata: {
                step: 'generate_page',
                pageNumber,
                jlptLevel,
            },
        };
    }
    /**
     * Generate quiz
     */
    async generateQuiz(request, config) {
        const jlptLevel = request.jlptLevel || (config === null || config === void 0 ? void 0 : config.jlptLevel) || 'N5';
        const outline = request.outline;
        const pages = request.pages;
        const systemPrompt = 'You are an expert in creating educational assessments for Japanese language learners.';
        const userPrompt = `Create a comprehension quiz for this Japanese story:

Story Title: ${outline === null || outline === void 0 ? void 0 : outline.title} / ${outline === null || outline === void 0 ? void 0 : outline.titleJa}
Story Pages: ${JSON.stringify(pages === null || pages === void 0 ? void 0 : pages.map((p) => ({
            text: p.text,
            translation: p.translation,
        })), null, 2)}

JLPT Level: ${jlptLevel}

Create 5-8 multiple choice questions that test:
1. Reading comprehension
2. Vocabulary understanding
3. Grammar recognition
4. Story sequence
5. Character understanding

Questions should be appropriate for ${jlptLevel} learners.

Response format (JSON only):
{
  "questions": [
    {
      "id": "q1",
      "question": "Question in English",
      "questionJa": "<ruby>質問<rt>しつもん</rt></ruby>を<ruby>日本語<rt>にほんご</rt></ruby>で（optional for higher levels）",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct",
      "explanationJa": "<ruby>説明<rt>せつめい</rt></ruby>を<ruby>日本語<rt>にほんご</rt></ruby>で"
    }
  ]
}

**IMPORTANT: For questionJa and explanationJa fields:**
- Wrap ALL kanji in <ruby> tags with furigana readings
- Format: <ruby>漢字<rt>かんじ</rt></ruby>
- Example: "この<ruby>言葉<rt>ことば</rt></ruby>の<ruby>意味<rt>いみ</rt></ruby>は?"
- Do NOT use parentheses format - use <ruby><rt> tags only`;
        const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt);
        const response = this.parseJSON(content);
        // Map to ReviewQuestion type
        const questions = response.questions.map(q => (Object.assign(Object.assign({}, q), { type: 'multiple_choice', correctAnswer: q.correctIndex, difficulty: this.calculateQuestionDifficulty(jlptLevel), tags: ['story-comprehension', jlptLevel.toLowerCase()] })));
        return {
            data: questions,
            usage,
            metadata: {
                step: 'generate_quiz',
                questionCount: questions.length,
                jlptLevel,
            },
        };
    }
    /**
     * Get system prompt - required by base class
     */
    getSystemPrompt(config) {
        return 'You are an expert in creating educational Japanese stories for language learners.';
    }
    /**
     * Get user prompt - required by base class
     */
    getUserPrompt(request, config) {
        // This is handled in individual step methods
        return '';
    }
    /**
     * Parse response - required by base class
     */
    parseResponse(response) {
        return this.parseJSON(response);
    }
    /**
     * Calculate question difficulty based on JLPT level
     */
    calculateQuestionDifficulty(jlptLevel) {
        const levelMap = {
            N5: 1,
            N4: 2,
            N3: 3,
            N2: 4,
            N1: 5,
        };
        return levelMap[jlptLevel] || 3;
    }
    /**
     * Generate character model sheet
     */
    async generateModelSheet(request, config) {
        if (!request.characterSheet) {
            throw new types_1.AIServiceError('Character sheet is required for model sheet generation', 'VALIDATION_ERROR', 400);
        }
        const visualStyle = request.characterSheet.visualStyle || 'anime illustration style';
        const systemPrompt = `You are an expert at creating detailed character model sheets for consistent visual representation.`;
        const userPrompt = `Create a comprehensive DALL-E 3 prompt for a character model sheet:

Character: ${request.characterSheet.mainCharacter.name}
Visual Description: ${request.characterSheet.mainCharacter.visualDescription}
Description: ${request.characterSheet.mainCharacter.description}
Visual Style: ${visualStyle}

Create a prompt that will generate a character model sheet showing:
- Front view of the character
- Side view
- Various facial expressions
- Full body and close-up views
- Consistent design elements

The prompt should be detailed and ensure visual consistency. Return ONLY the DALL-E prompt, no explanations.`;
        const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt, {
            responseFormat: 'text',
        });
        const modelSheetPrompt = content.trim();
        return {
            data: {
                prompt: modelSheetPrompt,
                characterId: `${request.characterSheet.mainCharacter.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
                characterSheet: request.characterSheet,
            },
            usage,
            metadata: {
                step: 'generate_model_sheet',
            },
        };
    }
    /**
     * Generate page image
     */
    async generatePageImage(request, config) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (!request.pageText) {
            throw new types_1.AIServiceError('Page text is required for image generation', 'VALIDATION_ERROR', 400);
        }
        const characterName = ((_b = (_a = request.characterSheet) === null || _a === void 0 ? void 0 : _a.mainCharacter) === null || _b === void 0 ? void 0 : _b.name) || '';
        const characterDesc = ((_d = (_c = request.characterSheet) === null || _c === void 0 ? void 0 : _c.mainCharacter) === null || _d === void 0 ? void 0 : _d.visualDescription) || '';
        const setting = ((_f = (_e = request.characterSheet) === null || _e === void 0 ? void 0 : _e.setting) === null || _f === void 0 ? void 0 : _f.location) || '';
        const visualStyle = ((_g = request.characterSheet) === null || _g === void 0 ? void 0 : _g.visualStyle) || 'anime illustration style';
        const systemPrompt = `You are an expert at creating detailed image prompts for children's story illustrations.
Create prompts that:
1. Include the character's full description
2. Describe the specific action or scene
3. Include setting and atmosphere details
4. Are vivid and age-appropriate

Return ONLY the image prompt, no explanations.`;
        const userPrompt = `Story text: ${request.pageText}
Translation: ${request.pageTranslation || 'N/A'}
Character: ${characterName} (${characterDesc})
Setting: ${setting}
Visual Style: ${visualStyle}
Page: ${request.pageNumber}

Create a detailed DALL-E 3 prompt for this story page.`;
        const { content, usage } = await this.callOpenAI(systemPrompt, userPrompt, {
            responseFormat: 'text',
        });
        const imagePrompt = content.trim();
        // Build consistency prompt
        let finalPrompt = imagePrompt;
        if (request.characterProfile && request.sessionId) {
            const profile = request.characterProfile;
            finalPrompt = `[CHARACTER REF: ${profile.characterId}-${request.sessionId}] ${visualStyle}. Character: ${characterDesc}. Scene: ${imagePrompt}. Maintain exact character appearance.`;
        }
        return {
            data: {
                imagePrompt: finalPrompt,
                enhancedPrompt: imagePrompt,
                pageNumber: request.pageNumber,
            },
            usage,
            metadata: {
                step: 'generate_page_image',
                pageNumber: request.pageNumber,
            },
        };
    }
    /**
     * Store page image
     */
    async storePageImage(request, config) {
        if (!request.imageUrl || !request.storagePath) {
            throw new types_1.AIServiceError('Image URL and storage path are required', 'VALIDATION_ERROR', 400);
        }
        return {
            data: {
                imageUrl: request.imageUrl,
                storagePath: request.storagePath,
                pageNumber: request.pageNumber,
                draftId: request.draftId,
            },
            usage: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
                estimatedCost: 0,
            },
            metadata: {
                step: 'store_page_image',
                pageNumber: request.pageNumber,
            },
        };
    }
}
exports.MultiStepStoryProcessor = MultiStepStoryProcessor;
//# sourceMappingURL=MultiStepStoryProcessor.js.map