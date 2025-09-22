/**
 * Resilient API Client using the improved retry mechanism
 * Demonstrates practical usage of RetryManager with circuit breaker
 */

import { retryManager, RetryConfig } from './retry-manager';
import { ReviewEngineMonitor } from '@/lib/monitoring/sentry';
import { reviewLogger } from '@/lib/monitoring/logger';

export interface APIRequestOptions extends RequestInit {
  retryConfig?: RetryConfig;
  timeout?: number;
}

export class ResilientAPIClient {
  private baseUrl: string;
  
  constructor(baseUrl: string = '/api/review') {
    this.baseUrl = baseUrl;
  }
  
  /**
   * Make a resilient GET request
   */
  async get<T>(endpoint: string, options?: APIRequestOptions): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const result = await retryManager.executeWithRetry(
      `GET:${endpoint}`,
      async () => {
        const startTime = Date.now();
        
        const response = await fetch(url, {
          ...options,
          method: 'GET',
          signal: this.createAbortSignal(options?.timeout || 10000)
        });
        
        const duration = Date.now() - startTime;
        ReviewEngineMonitor.trackAPICall(endpoint, duration, response.status);
        
        if (!response.ok) {
          throw this.createAPIError(response);
        }
        
        return response.json();
      },
      options?.retryConfig
    );
    
    if (!result.success) {
      throw result.error;
    }
    
    return result.data!;
  }
  
  /**
   * Make a resilient POST request
   */
  async post<T>(endpoint: string, data?: any, options?: APIRequestOptions): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const result = await retryManager.executeWithRetry(
      `POST:${endpoint}`,
      async () => {
        const startTime = Date.now();
        
        const response = await fetch(url, {
          ...options,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers
          },
          body: data ? JSON.stringify(data) : undefined,
          signal: this.createAbortSignal(options?.timeout || 10000)
        });
        
        const duration = Date.now() - startTime;
        ReviewEngineMonitor.trackAPICall(endpoint, duration, response.status);
        
        if (!response.ok) {
          throw this.createAPIError(response);
        }
        
        return response.json();
      },
      options?.retryConfig
    );
    
    if (!result.success) {
      throw result.error;
    }
    
    return result.data!;
  }
  
  /**
   * Batch multiple API calls with resilience
   */
  async batch<T>(
    requests: Array<{
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      endpoint: string;
      data?: any;
    }>
  ): Promise<Map<string, T>> {
    const operations = requests.map(req => ({
      name: `${req.method}:${req.endpoint}`,
      operation: async () => {
        const url = `${this.baseUrl}${req.endpoint}`;
        
        const response = await fetch(url, {
          method: req.method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: req.data ? JSON.stringify(req.data) : undefined
        });
        
        if (!response.ok) {
          throw this.createAPIError(response);
        }
        
        return response.json();
      }
    }));
    
    const results = await retryManager.executeBulkWithRetry(operations);
    
    const successfulResults = new Map<string, T>();
    const errors: string[] = [];
    
    results.forEach((result, key) => {
      if (result.success) {
        successfulResults.set(key, result.data as T);
      } else {
        errors.push(`${key}: ${result.error?.message}`);
      }
    });
    
    if (errors.length > 0) {
      reviewLogger.warn('Some batch operations failed:', errors);
    }
    
    return successfulResults;
  }
  
  /**
   * Create an abort signal for request timeout
   */
  private createAbortSignal(timeout: number): AbortSignal {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeout);
    return controller.signal;
  }
  
  /**
   * Create a proper error object from response
   */
  private async createAPIError(response: Response): Promise<Error> {
    let message = `API Error: ${response.status} ${response.statusText}`;
    
    try {
      const errorBody = await response.json();
      if (errorBody.error) {
        message = errorBody.error;
      } else if (errorBody.message) {
        message = errorBody.message;
      }
    } catch {
      // Ignore JSON parse errors
    }
    
    const error = new Error(message);
    (error as any).statusCode = response.status;
    (error as any).statusText = response.statusText;
    
    // Mark as retryable based on status code
    if ([429, 500, 502, 503, 504].includes(response.status)) {
      (error as any).retryable = true;
    }
    
    return error;
  }
  
  /**
   * Get circuit breaker statistics for monitoring
   */
  getCircuitStats() {
    return retryManager.getCircuitStats();
  }
  
  /**
   * Reset a specific circuit breaker
   */
  resetCircuit(endpoint: string) {
    retryManager.resetCircuit(endpoint);
  }
}

// Create specialized API clients for different services
export class ReviewAPIClient extends ResilientAPIClient {
  constructor() {
    super('/api/review');
  }
  
  async getQueue(limit: number = 20) {
    return this.get<any>(`/queue?limit=${limit}`, {
      retryConfig: {
        maxAttempts: 3,
        circuitBreakerThreshold: 3,
        circuitBreakerTimeout: 30000
      }
    });
  }
  
  async createSession(data: any) {
    return this.post<any>('/session/start', data, {
      retryConfig: {
        maxAttempts: 2, // Don't retry too many times for session creation
        timeout: 5000
      }
    });
  }
  
  async submitAnswer(sessionId: string, answer: any) {
    return this.post<any>(`/session/${sessionId}/answer`, answer, {
      retryConfig: {
        maxAttempts: 3,
        baseDelay: 500 // Faster retries for answers
      }
    });
  }
  
  async syncBatch(items: any[]) {
    return this.post<any>('/sync/batch', { items }, {
      retryConfig: {
        maxAttempts: 5, // More retries for sync
        timeout: 30000, // Longer timeout for batch operations
        circuitBreakerThreshold: 10 // Higher threshold for sync
      }
    });
  }
}

// Usage example with monitoring
export async function demonstrateResilientAPI() {
  const client = new ReviewAPIClient();
  
  try {
    // This will automatically retry on failure
    const queue = await client.getQueue(20);
    reviewLogger.info('Queue loaded successfully:', queue);
    
    // Check circuit breaker status
    const stats = client.getCircuitStats();
    stats.forEach((stat, endpoint) => {
      reviewLogger.info(`Circuit ${endpoint}: ${stat.state}, Success rate: ${stat.successRate}`);
    });
    
    // Batch operations with resilience
    const batchResults = await client.batch([
      { method: 'GET', endpoint: '/stats' },
      { method: 'GET', endpoint: '/queue/preview' },
      { method: 'POST', endpoint: '/pin', data: { contentId: 'kanji-123' } }
    ]);
    
    reviewLogger.info('Batch results:', batchResults);
    
  } catch (error: any) {
    // All retries failed or circuit is open
    reviewLogger.error('API call failed after retries:', error.message);
    
    // Check if circuit breaker is open
    const stats = client.getCircuitStats();
    const openCircuits = Array.from(stats.entries())
      .filter(([_, stat]) => stat.state === 'open');
    
    if (openCircuits.length > 0) {
      reviewLogger.warn('Open circuits detected:', openCircuits);
      
      // Optionally reset after some time
      setTimeout(() => {
        openCircuits.forEach(([endpoint]) => {
          client.resetCircuit(endpoint);
        });
      }, 60000);
    }
  }
}