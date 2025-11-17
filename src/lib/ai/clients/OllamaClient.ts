/**
 * Ollama API Client
 * Provides interface to self-hosted Ollama LLM service
 *
 * Features:
 * - Streaming and non-streaming responses
 * - Connection pooling for performance
 * - Automatic retries with exponential backoff
 * - Health checking
 */

import https from 'https';

export interface OllamaConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeout?: number;
  maxRetries?: number;
}

export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  format?: 'json';
  context?: number[];
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
    stop?: string[];
    seed?: number;
    repeat_penalty?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  done_reason?: string;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  stream?: boolean;
  format?: 'json';
  options?: OllamaGenerateRequest['options'];
}

export class OllamaClient {
  private config: Required<OllamaConfig>;
  private agent: https.Agent;

  constructor(config: OllamaConfig) {
    this.config = {
      timeout: 60000,
      maxRetries: 2,
      ...config
    };

    // Connection pooling for better performance
    this.agent = new https.Agent({
      keepAlive: true,
      maxSockets: 10,
      keepAliveMsecs: 30000
    });
  }

  /**
   * Generate text from a prompt (non-streaming)
   */
  async generate(request: Omit<OllamaGenerateRequest, 'model'>): Promise<OllamaGenerateResponse> {
    const fullRequest: OllamaGenerateRequest = {
      model: this.config.model,
      stream: false,
      ...request
    };

    const response = await this.fetchWithRetry('/api/generate', {
      method: 'POST',
      headers: {
        'X-API-Key': this.config.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fullRequest)
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Generate text with streaming (yields chunks as they arrive)
   */
  async *generateStream(request: Omit<OllamaGenerateRequest, 'model' | 'stream'>): AsyncGenerator<string, void, unknown> {
    const fullRequest: OllamaGenerateRequest = {
      model: this.config.model,
      stream: true,
      ...request
    };

    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'X-API-Key': this.config.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fullRequest),
      // @ts-ignore - agent is supported in Node.js fetch
      agent: this.agent
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line) as OllamaGenerateResponse;
            if (data.response) {
              yield data.response;
            }
          } catch (e) {
            // Skip malformed JSON
            console.warn('Failed to parse streaming chunk:', line);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Chat with conversation context
   */
  async chat(request: Omit<OllamaChatRequest, 'model'>): Promise<{ content: string; context?: any }> {
    const fullRequest: OllamaChatRequest = {
      model: this.config.model,
      stream: false,
      ...request
    };

    const response = await this.fetchWithRetry('/api/chat', {
      method: 'POST',
      headers: {
        'X-API-Key': this.config.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fullRequest)
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      content: data.message?.content || '',
      context: data.context
    };
  }

  /**
   * Check if Ollama service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.config.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.config.model,
          prompt: 'ping',
          stream: false,
          options: { num_predict: 1 }
        }),
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      return response.ok;
    } catch (error) {
      console.warn('Ollama health check failed:', error);
      return false;
    }
  }

  /**
   * Fetch with automatic retries and exponential backoff
   */
  private async fetchWithRetry(endpoint: string, options: RequestInit, retries = 0): Promise<Response> {
    try {
      const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
        ...options,
        signal: AbortSignal.timeout(this.config.timeout),
        // @ts-ignore
        agent: this.agent
      });

      // Retry on server errors (5xx)
      if (response.status >= 500 && retries < this.config.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retries), 10000);
        console.warn(`Ollama server error ${response.status}, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(endpoint, options, retries + 1);
      }

      return response;
    } catch (error) {
      // Retry on network errors
      if (retries < this.config.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retries), 10000);
        console.warn(`Ollama request failed, retrying in ${delay}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.fetchWithRetry(endpoint, options, retries + 1);
      }

      throw error;
    }
  }

  /**
   * Calculate estimated tokens from text (rough approximation)
   */
  static estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token for English
    // ~2 characters per token for Japanese/Chinese
    const hasAsian = /[\u3000-\u9fff\uac00-\ud7af]/.test(text);
    return Math.ceil(text.length / (hasAsian ? 2 : 4));
  }
}
