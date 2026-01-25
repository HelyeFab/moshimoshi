"use strict";
/**
 * AI Provider Configuration
 * Controls which AI service to use (OpenAI, Ollama, Gemini, or Hybrid)
 *
 * Safe rollback: Just change AI_PROVIDER env var to 'openai'
 *
 * Current setup (Dec 2024):
 * - Primary: Ollama (Qwen 2.5 32B on Modal) - excellent Japanese, $0 per token
 * - Fallback: OpenAI (GPT-4o-mini) - for when Ollama is down
 * - Image generation: Gemini/Imagen (free tier + excellent quality)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerHealth = void 0;
exports.getProviderConfig = getProviderConfig;
exports.getOllamaConfig = getOllamaConfig;
exports.getGeminiConfig = getGeminiConfig;
exports.selectProvider = selectProvider;
/**
 * Get provider configuration from environment variables
 */
function getProviderConfig() {
    const primary = (process.env.AI_PROVIDER || 'openai');
    const fallback = (process.env.AI_PROVIDER_FALLBACK || 'openai');
    const ollamaEnabled = process.env.AI_OLLAMA_ENABLED === 'true';
    return {
        primary,
        fallback,
        enabled: {
            openai: true, // Always enabled (for fallback)
            ollama: ollamaEnabled,
        },
        routing: getDefaultRouting(primary, ollamaEnabled),
    };
}
/**
 * Default routing rules for task types
 *
 * Strategy (Dec 2024 - Qwen 2.5 32B on Modal):
 * - Ollama (Qwen 32B): ~10-20s response, $0 per token, excellent Japanese quality
 * - OpenAI (GPT-4o-mini): ~5s response, ~$0.0005 cost, excellent quality
 *
 * With Qwen 32B, quality matches GPT-4o-mini for Japanese tasks.
 * Route ALL text tasks to Ollama for maximum cost savings.
 * Image generation uses Gemini/Nano Banana (free tier, excellent quality).
 */
function getDefaultRouting(primary, ollamaEnabled) {
    // If Ollama is disabled or primary is OpenAI, route everything to OpenAI
    if (!ollamaEnabled || primary === 'openai') {
        return {
            explain_word: 'openai',
            explain_grammar: 'openai',
            explain_grammar_sentence: 'openai',
            generate_review_questions: 'openai',
            generate_kanji_mnemonic: 'openai',
            clean_transcript: 'openai',
            fix_transcript: 'openai',
            generate_story: 'openai',
            generate_moodboard: 'openai',
            generate_book_summary: 'openai',
            translate_text: 'openai',
            // Image generation uses Gemini/Imagen (free tier)
            generate_image: 'gemini',
        };
    }
    // If primary is Ollama, use it for ALL text tasks (maximum cost savings)
    // Qwen 2.5 32B quality is excellent for Japanese language tasks
    if (primary === 'ollama') {
        return {
            // ALL TEXT TASKS → Ollama (Qwen 32B - excellent quality, $0 cost)
            explain_word: 'ollama',
            explain_grammar: 'ollama',
            explain_grammar_sentence: 'ollama',
            generate_review_questions: 'ollama',
            generate_kanji_mnemonic: 'ollama',
            clean_transcript: 'ollama',
            fix_transcript: 'ollama',
            generate_story: 'ollama',
            generate_moodboard: 'ollama',
            generate_book_summary: 'ollama',
            translate_text: 'ollama',
            // Image generation uses Gemini/Imagen (free tier)
            generate_image: 'gemini',
        };
    }
    // Hybrid mode: Route most tasks to Ollama, keep OpenAI for speed-critical
    return {
        // REAL-TIME USER TASKS → Ollama (Qwen 32B is fast enough, ~10-20s warm)
        explain_word: 'ollama', // User reading, Qwen handles well
        explain_grammar: 'ollama', // Grammar explanations, excellent quality
        explain_grammar_sentence: 'ollama', // Sentence analysis, excellent quality
        // BACKGROUND/ASYNC TASKS → Ollama
        generate_review_questions: 'ollama', // Background generation
        generate_kanji_mnemonic: 'ollama', // Kanji mnemonics, cached in Firebase
        clean_transcript: 'ollama', // Background processing
        fix_transcript: 'ollama', // Background processing
        translate_text: 'ollama', // Translation, Qwen is excellent
        // ADMIN/CONTENT CREATION → Ollama
        generate_story: 'ollama', // Story generation
        generate_moodboard: 'ollama', // Kanji moodboards
        generate_book_summary: 'ollama', // Book summaries
        // IMAGE GENERATION → Gemini/Imagen (free tier)
        generate_image: 'gemini',
    };
}
/**
 * Get Ollama configuration from environment
 *
 * Default: Modal-hosted Qwen 2.5 32B
 * - Endpoint: https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run
 * - Model: qwen2.5:32b (excellent Japanese language support)
 * - Auth: X-API-Key header with MODAL_API_KEY
 */
function getOllamaConfig() {
    return {
        baseUrl: process.env.OLLAMA_BASE_URL ||
            'https://emmanuelfabiani23--ollama-llm-ollamallm-serve.modal.run',
        apiKey: process.env.MODAL_API_KEY || '',
        model: process.env.OLLAMA_MODEL || 'qwen2.5:32b',
        timeout: parseInt(process.env.OLLAMA_TIMEOUT || '300000'), // 5 min for 32B model
        maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES || '2'),
    };
}
/**
 * Get Gemini configuration from environment
 *
 * Used for: Image generation ("Nano Banana")
 * - Model: gemini-2.5-flash-image
 * - Free tier: 15 requests/minute, 1500/day
 * - Auth: API key via URL parameter
 */
function getGeminiConfig() {
    return {
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image',
        timeout: parseInt(process.env.GEMINI_TIMEOUT || '60000'),
    };
}
/**
 * Provider health tracker
 */
class ProviderHealthTracker {
    constructor() {
        this.health = {
            openai: true,
            ollama: true,
            hybrid: true,
            gemini: true,
        };
        this.lastCheck = {
            openai: 0,
            ollama: 0,
            hybrid: 0,
            gemini: 0,
        };
        this.checkInterval = 60000; // 60 seconds
    }
    isHealthy(provider) {
        return this.health[provider];
    }
    markUnhealthy(provider) {
        console.warn(`⚠️ Provider ${provider} marked as unhealthy`);
        this.health[provider] = false;
        this.lastCheck[provider] = Date.now();
    }
    markHealthy(provider) {
        if (!this.health[provider]) {
            console.log(`✅ Provider ${provider} recovered`);
        }
        this.health[provider] = true;
        this.lastCheck[provider] = Date.now();
    }
    shouldCheckHealth(provider) {
        return Date.now() - this.lastCheck[provider] > this.checkInterval;
    }
}
exports.providerHealth = new ProviderHealthTracker();
/**
 * Select which provider to use for a task
 */
function selectProvider(taskType, config) {
    // Get the configured provider for this task
    const configured = config.routing[taskType] || config.primary;
    // If the configured provider is Ollama but it's disabled, use fallback
    if (configured === 'ollama' && !config.enabled.ollama) {
        return config.fallback;
    }
    // If the configured provider is unhealthy, use fallback
    if (!exports.providerHealth.isHealthy(configured)) {
        console.warn(`Provider ${configured} is unhealthy, using fallback ${config.fallback}`);
        return config.fallback;
    }
    return configured;
}
//# sourceMappingURL=providers.js.map