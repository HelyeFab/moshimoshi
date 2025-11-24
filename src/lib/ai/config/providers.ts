/**
 * AI Provider Configuration
 * Controls which AI service to use (OpenAI, Ollama, or Hybrid)
 *
 * Safe rollback: Just change AI_PROVIDER env var to 'openai'
 */

export type AIProviderType = 'openai' | 'ollama' | 'hybrid';
export type AITaskType = string; // Import from your types

export interface ProviderConfig {
  primary: AIProviderType;
  fallback: AIProviderType;
  enabled: {
    openai: boolean;
    ollama: boolean;
  };
  routing: {
    // Which provider to use for each task type
    [taskType: string]: AIProviderType;
  };
}

/**
 * Get provider configuration from environment variables
 */
export function getProviderConfig(): ProviderConfig {
  const primary = (process.env.AI_PROVIDER || 'openai') as AIProviderType;
  const fallback = (process.env.AI_PROVIDER_FALLBACK || 'openai') as AIProviderType;
  const ollamaEnabled = process.env.AI_OLLAMA_ENABLED === 'true';

  return {
    primary,
    fallback,
    enabled: {
      openai: true, // Always enabled (for fallback)
      ollama: ollamaEnabled
    },
    routing: getDefaultRouting(primary, ollamaEnabled)
  };
}

/**
 * Default routing rules for task types
 *
 * Strategy based on performance testing:
 * - Ollama: ~30s response, $0 cost, excellent quality
 * - OpenAI: ~15s response, ~$0.0005 cost, excellent quality
 *
 * Smart routing:
 * - Background/async tasks → Ollama (cost savings, speed acceptable)
 * - Real-time user-facing tasks → OpenAI (speed critical)
 */
function getDefaultRouting(primary: AIProviderType, ollamaEnabled: boolean): Record<string, AIProviderType> {
  // If Ollama is disabled or primary is OpenAI, route everything to OpenAI
  if (!ollamaEnabled || primary === 'openai') {
    return {
      explain_word: 'openai',
      explain_grammar: 'openai',
      explain_grammar_sentence: 'openai',
      generate_review_questions: 'openai',
      clean_transcript: 'openai',
      fix_transcript: 'openai',
      generate_story: 'openai',
      generate_moodboard: 'openai',
      generate_book_summary: 'openai',
    };
  }

  // If primary is Ollama, use it for ALL tasks (maximum cost savings)
  if (primary === 'ollama') {
    return {
      explain_word: 'ollama',
      explain_grammar: 'ollama',
      explain_grammar_sentence: 'ollama',
      generate_review_questions: 'ollama',
      clean_transcript: 'ollama',
      fix_transcript: 'ollama',
      generate_story: 'ollama',
      generate_moodboard: 'ollama',
      generate_book_summary: 'ollama',
    };
  }

  // Hybrid mode: SMART ROUTING based on performance testing
  // Optimizes for: Speed for real-time tasks, Cost for background tasks
  return {
    // REAL-TIME USER TASKS → OpenAI (speed critical, user waiting)
    explain_word: 'openai',              // User reading, needs <5s response
    explain_grammar: 'openai',           // User stuck, needs fast help
    explain_grammar_sentence: 'openai',  // Interactive feature, speed matters

    // BACKGROUND/ASYNC TASKS → Ollama (can wait 30s, save costs)
    generate_review_questions: 'ollama', // Background generation, async
    clean_transcript: 'ollama',          // Background processing
    fix_transcript: 'ollama',            // Background processing

    // ADMIN/CONTENT CREATION → Ollama (can wait, massive content = big savings)
    generate_story: 'ollama',            // Admin task, 30-60s acceptable
    generate_moodboard: 'ollama',        // Admin task, 30s acceptable
    generate_book_summary: 'ollama',     // Admin task, condensed books, cost savings
  };
}

/**
 * Get Ollama configuration from environment
 */
export function getOllamaConfig() {
  return {
    baseUrl: process.env.OLLAMA_BASE_URL || 'https://api.selfmind.dev/chat',
    apiKey: process.env.SHELDON_API_KEY || '',
    model: process.env.OLLAMA_MODEL || 'qwen2.5:7b',
    timeout: parseInt(process.env.OLLAMA_TIMEOUT || '60000'),
    maxRetries: parseInt(process.env.OLLAMA_MAX_RETRIES || '2')
  };
}

/**
 * Provider health tracker
 */
class ProviderHealthTracker {
  private health: Record<AIProviderType, boolean> = {
    openai: true,
    ollama: true,
    hybrid: true
  };

  private lastCheck: Record<AIProviderType, number> = {
    openai: 0,
    ollama: 0,
    hybrid: 0
  };

  private checkInterval = 60000; // 60 seconds

  isHealthy(provider: AIProviderType): boolean {
    return this.health[provider];
  }

  markUnhealthy(provider: AIProviderType): void {
    console.warn(`⚠️ Provider ${provider} marked as unhealthy`);
    this.health[provider] = false;
    this.lastCheck[provider] = Date.now();
  }

  markHealthy(provider: AIProviderType): void {
    if (!this.health[provider]) {
      console.log(`✅ Provider ${provider} recovered`);
    }
    this.health[provider] = true;
    this.lastCheck[provider] = Date.now();
  }

  shouldCheckHealth(provider: AIProviderType): boolean {
    return Date.now() - this.lastCheck[provider] > this.checkInterval;
  }
}

export const providerHealth = new ProviderHealthTracker();

/**
 * Select which provider to use for a task
 */
export function selectProvider(taskType: string, config: ProviderConfig): AIProviderType {
  // Get the configured provider for this task
  const configured = config.routing[taskType] || config.primary;

  // If the configured provider is Ollama but it's disabled, use fallback
  if (configured === 'ollama' && !config.enabled.ollama) {
    return config.fallback;
  }

  // If the configured provider is unhealthy, use fallback
  if (!providerHealth.isHealthy(configured)) {
    console.warn(`Provider ${configured} is unhealthy, using fallback ${config.fallback}`);
    return config.fallback;
  }

  return configured;
}
